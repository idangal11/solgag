import { AGREEMENT_LABEL, BUILDING_LABEL, REGION_LABEL } from '@/lib/labels';
import type { AgreementModel, BuildingType, Listing, Region } from '@/lib/types';

// Explore filters and their URL form (?region=&minArea=&types=a,b&agreements=a,b&open=1),
// so a filtered view can be shared. Parsing is defensive: unknown values are dropped.

export interface Filters {
  region: Region | 'all';
  minArea: number;
  types: BuildingType[];
  agreements: AgreementModel[];
  openOnly: boolean;
}

export const EMPTY_FILTERS: Filters = { region: 'all', minArea: 0, types: [], agreements: [], openOnly: false };

export const AREA_OPTIONS = [
  { v: 0, label: 'כל גודל' },
  { v: 1000, label: '1,000+ מ״ר' },
  { v: 2500, label: '2,500+ מ״ר' },
  { v: 5000, label: '5,000+ מ״ר' },
  { v: 8000, label: '8,000+ מ״ר' },
] as const;

export const REGIONS = Object.keys(REGION_LABEL) as Region[];
export const BUILDING_TYPES = Object.keys(BUILDING_LABEL) as BuildingType[];
export const AGREEMENTS = Object.keys(AGREEMENT_LABEL) as AgreementModel[];

type ParamsReader = Pick<URLSearchParams, 'get' | 'getAll'>;

/** Accepts both `types=a,b` and repeated `types=a&types=b`; keeps the canonical order. */
function pickList<T extends string>(params: ParamsReader, key: string, allowed: readonly T[]): T[] {
  const raw = new Set(params.getAll(key).flatMap((v) => v.split(',').map((s) => s.trim())));
  return allowed.filter((v) => raw.has(v));
}

/** Snap to the largest offered option that is not above the requested value. */
function snapArea(n: number): number {
  let v = 0;
  for (const o of AREA_OPTIONS) if (o.v <= n) v = o.v;
  return v;
}

export function parseFilters(params: ParamsReader): Filters {
  const region = params.get('region');
  const minArea = Number(params.get('minArea') ?? 0);
  const open = params.get('open');
  return {
    region: region && (REGIONS as string[]).includes(region) ? (region as Region) : 'all',
    minArea: Number.isFinite(minArea) ? snapArea(minArea) : 0,
    types: pickList(params, 'types', BUILDING_TYPES),
    agreements: pickList(params, 'agreements', AGREEMENTS),
    openOnly: open === '1' || open === 'true',
  };
}

/** Replaces the filter keys in `params`, leaving any other parameter (e.g. focus) untouched. */
export function writeFilters(params: URLSearchParams, f: Filters): void {
  for (const k of ['region', 'minArea', 'types', 'agreements', 'open']) params.delete(k);
  if (f.region !== 'all') params.set('region', f.region);
  if (f.minArea > 0) params.set('minArea', String(f.minArea));
  if (f.types.length) params.set('types', f.types.join(','));
  if (f.agreements.length) params.set('agreements', f.agreements.join(','));
  if (f.openOnly) params.set('open', '1');
}

/** Canonical string of just the filter part of a query — stable across unrelated param changes. */
export function filtersKey(params: ParamsReader): string {
  const p = new URLSearchParams();
  writeFilters(p, parseFilters(params));
  return p.toString();
}

/** Query string with readable commas (all filter values are plain slugs). */
export function toQueryString(params: URLSearchParams): string {
  return params.toString().replace(/%2C/gi, ',');
}

export function applyFilters(listings: Listing[], f: Filters): Listing[] {
  return listings.filter(
    (l) =>
      (f.region === 'all' || l.region === f.region) &&
      l.usableAreaSqm >= f.minArea &&
      (!f.types.length || f.types.includes(l.buildingType)) &&
      (!f.agreements.length || f.agreements.includes(l.agreement)) &&
      // Fictional sample listings cannot receive inquiries, so they are never "open to inquiries".
      (!f.openOnly || (l.availability === 'available' && !l.isFictional)),
  );
}

export function activeFilterCount(f: Filters): number {
  return (f.region !== 'all' ? 1 : 0) + (f.minArea ? 1 : 0) + f.types.length + f.agreements.length + (f.openOnly ? 1 : 0);
}

export function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}
