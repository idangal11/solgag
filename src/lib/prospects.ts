import { z } from 'zod';
import type { Tone } from './labels';
import type { LatLng } from './types';

// Business-prospect pilot (admin-only): candidate commercial roofs and the
// businesses publicly listed at or near them. Shared by the admin pages, the
// import action, the CSV export and their tests.

export type Confidence = 'high' | 'medium' | 'low';
export type ReviewStatus = 'pending' | 'approved' | 'corrected' | 'rejected';
/** Never "owner" without evidence: a business at an address may be a tenant. */
export type Relation = 'occupant_unverified' | 'occupant_confirmed' | 'owner_evidence' | 'not_at_roof';
export type SourceKind = 'official' | 'osm' | 'registry' | 'lead' | 'other';

export interface AddressCandidate {
  street: string;
  houseNumber: string | null;
  locality: string | null;
  source: string;
  sourceUrl: string | null;
  method: string;
  distanceM: number | null;
  confidence: Confidence;
}

export interface ProspectSource {
  url: string;
  kind: SourceKind;
  label: string;
}

export interface ProspectBusiness {
  id: string;
  roofId: string;
  isDemo: boolean;
  name: string;
  nameEn: string | null;
  category: string | null;
  companyNumber: string | null;
  relation: Relation;
  relationEvidence: string | null;
  matchConfidence: Confidence;
  matchBasis: string;
  businessAddress: string | null;
  businessAddressSourceUrl: string | null;
  website: string | null;
  websiteSourceUrl: string | null;
  phone: string | null;
  phoneSourceUrl: string | null;
  phoneSnippet: string | null;
  email: string | null;
  emailSourceUrl: string | null;
  emailSnippet: string | null;
  contactsCheckedAt: string | null;
  sources: ProspectSource[];
  reviewStatus: ReviewStatus;
  reviewNote: string | null;
}

export interface SuitabilityDetail {
  usableAreaM2?: number;
  estKwpDc?: number;
  assumptions?: string;
  existingPvMappedInOsm?: string[];
}

export interface ProspectRoof {
  id: string;
  batch: string;
  ref: string;
  isDemo: boolean;
  /** Outer ring, [lat, lng], without the closing point. */
  polygon: LatLng[];
  center: LatLng;
  areaM2: number;
  building: { source: string; sourceUrl: string | null; license: string; confidence: Confidence; basis: string[] };
  address: {
    street: string;
    houseNumber: string | null;
    locality: string | null;
    source: string | null;
    sourceUrl: string | null;
    method: string | null;
    confidence: Confidence | null;
  } | null;
  addressCandidates: AddressCandidate[];
  suitability: 'preliminary_unverified' | 'plausible_after_review' | 'unsuitable';
  suitabilityDetail: SuitabilityDetail;
  reviewStatus: ReviewStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  businesses: ProspectBusiness[];
}

// ─── Labels ─────────────────────────────────────────────────────────────

export const CONFIDENCE: Record<Confidence, { label: string; tone: Tone }> = {
  high: { label: 'גבוהה', tone: 'ok' },
  medium: { label: 'בינונית', tone: 'warn' },
  low: { label: 'נמוכה', tone: 'bad' },
};

export const REVIEW: Record<ReviewStatus, { label: string; tone: Tone; color: string }> = {
  pending: { label: 'ממתין לבדיקה', tone: 'warn', color: '#d99a00' },
  approved: { label: 'אושר', tone: 'ok', color: '#1f7a55' },
  corrected: { label: 'תוקן ואושר', tone: 'info', color: '#2c6fbb' },
  rejected: { label: 'נדחה', tone: 'muted', color: '#7d8a84' },
};

export const RELATION: Record<Relation, { label: string; tone: Tone; help: string }> = {
  occupant_unverified: {
    label: 'עסק בכתובת — לא ידוע אם בעלים',
    tone: 'muted',
    help: 'העסק פועל בכתובת או ליד הגג לפי מקור ציבורי. ייתכן שהוא שוכר. אין ראיה לבעלות על הגג.',
  },
  occupant_confirmed: {
    label: 'מאושר שפועל במבנה — לא ידוע אם בעלים',
    tone: 'info',
    help: 'נבדק שהעסק פועל במבנה הזה. עדיין אין ראיה לבעלות על הגג.',
  },
  owner_evidence: {
    label: 'יש ראיה לבעלות',
    tone: 'ok',
    help: 'קיימת ראיה כתובה לבעלות (למשל נסח טאבו או הצהרת החברה), המתועדת בשדה הראיה.',
  },
  not_at_roof: { label: 'לא נמצא במבנה הזה', tone: 'bad', help: 'הבדיקה העלתה שהעסק אינו פועל במבנה הזה.' },
};

export const SUITABILITY_LABEL: Record<ProspectRoof['suitability'], string> = {
  preliminary_unverified: 'הערכה ראשונית — לא נבדק',
  plausible_after_review: 'נראה מתאים בבדיקה ראשונית — טעון סקר',
  unsuitable: 'לא מתאים',
};

export const SOURCE_KIND_LABEL: Record<SourceKind, string> = {
  official: 'אתר רשמי',
  osm: 'OpenStreetMap',
  registry: 'רשם החברות',
  lead: 'מקור לאיתור בלבד',
  other: 'מקור',
};

export const UNAVAILABLE = 'לא זמין';

// ─── Filters ────────────────────────────────────────────────────────────

export interface ProspectFilters {
  minArea: number;
  review: 'all' | ReviewStatus;
  building: 'all' | Confidence;
  business: 'all' | 'with' | 'strong' | 'none';
  demo: 'all' | 'real' | 'demo';
}

export const DEFAULT_FILTERS: ProspectFilters = { minArea: 0, review: 'all', building: 'all', business: 'all', demo: 'all' };

const liveBusinesses = (r: ProspectRoof) => r.businesses.filter((b) => b.reviewStatus !== 'rejected' && b.relation !== 'not_at_roof');

export function applyProspectFilters(roofs: ProspectRoof[], f: ProspectFilters): ProspectRoof[] {
  return roofs.filter((r) => {
    if (r.areaM2 < f.minArea) return false;
    if (f.review !== 'all' && r.reviewStatus !== f.review) return false;
    if (f.building !== 'all' && r.building.confidence !== f.building) return false;
    if (f.demo === 'real' && r.isDemo) return false;
    if (f.demo === 'demo' && !r.isDemo) return false;
    const live = liveBusinesses(r);
    if (f.business === 'with' && !live.length) return false;
    if (f.business === 'none' && live.length) return false;
    if (f.business === 'strong' && !live.some((b) => b.matchConfidence !== 'low')) return false;
    return true;
  });
}

export function parseProspectFilters(sp: Record<string, string | string[] | undefined>): ProspectFilters {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? '';
  };
  const pick = <T extends string>(v: string, allowed: readonly T[], fallback: T): T => ((allowed as readonly string[]).includes(v) ? (v as T) : fallback);
  const minArea = Number.parseInt(one('minArea'), 10);
  return {
    minArea: Number.isFinite(minArea) && minArea > 0 ? Math.min(minArea, 1_000_000) : 0,
    review: pick(one('review'), ['all', 'pending', 'approved', 'corrected', 'rejected'] as const, 'all'),
    building: pick(one('building'), ['all', 'high', 'medium', 'low'] as const, 'all'),
    business: pick(one('business'), ['all', 'with', 'strong', 'none'] as const, 'all'),
    demo: pick(one('demo'), ['all', 'real', 'demo'] as const, 'all'),
  };
}

export function filtersToQuery(f: ProspectFilters): string {
  const p = new URLSearchParams();
  if (f.minArea > 0) p.set('minArea', String(f.minArea));
  for (const k of ['review', 'building', 'business', 'demo'] as const) if (f[k] !== 'all') p.set(k, f[k]);
  return p.toString();
}

// ─── Import file (research/prospects-*/data/prospects-import.json) ──────

const httpUrl = z.url({ protocol: /^https?$/ }).max(1000);
const optUrl = httpUrl.nullish();
const confidence = z.enum(['high', 'medium', 'low']);
const text = (max: number) => z.string().trim().min(1).max(max);
const optText = (max: number) => z.string().trim().max(max).nullish();

const importBusiness = z
  .object({
    dedupeKey: text(200),
    isDemo: z.boolean().optional(),
    name: text(200),
    nameEn: optText(200),
    category: optText(200),
    companyNumber: z.string().regex(/^\d{9}$/).nullish(),
    relation: z.enum(['occupant_unverified', 'occupant_confirmed', 'owner_evidence', 'not_at_roof']).default('occupant_unverified'),
    relationEvidence: optText(1000),
    matchConfidence: confidence,
    matchBasis: text(1000),
    businessAddress: optText(300),
    businessAddressSourceUrl: optUrl,
    website: optUrl,
    websiteSourceUrl: optUrl,
    phone: optText(40),
    phoneSourceUrl: optUrl,
    phoneSnippet: optText(300),
    email: z.email().max(200).nullish(),
    emailSourceUrl: optUrl,
    emailSnippet: optText(300),
    contactsCheckedAt: z.iso.datetime({ offset: true }).nullish(),
    sources: z.array(z.object({ url: httpUrl, kind: z.enum(['official', 'osm', 'registry', 'lead', 'other']), label: text(200) })).max(30).default([]),
  })
  .refine((b) => !b.website || b.websiteSourceUrl, { message: 'website without a source URL' })
  .refine((b) => !b.phone || b.phoneSourceUrl, { message: 'phone without a source URL' })
  .refine((b) => !b.email || b.emailSourceUrl, { message: 'email without a source URL' })
  .refine((b) => b.relation !== 'owner_evidence' || (b.relationEvidence?.length ?? 0) >= 10, { message: 'owner relation without evidence' });

const addressCandidate = z.object({
  street: text(120),
  houseNumber: optText(20),
  locality: optText(120),
  source: text(300),
  sourceUrl: optUrl,
  method: text(500),
  distanceM: z.number().nonnegative().nullish(),
  confidence,
});

const importRoof = z.object({
  ref: text(40),
  sourceKey: text(120),
  isDemo: z.boolean().optional(),
  geometry: z.object({
    type: z.literal('Polygon'),
    coordinates: z.array(z.array(z.tuple([z.number().min(34.2).max(35.95), z.number().min(29.4).max(33.4)])).min(4).max(2000)).length(1),
  }),
  buildingSource: text(200),
  buildingSourceUrl: optUrl,
  buildingLicense: text(100),
  buildingConfidence: confidence,
  buildingBasis: z.array(z.string().max(500)).max(20).default([]),
  buildingEvidence: z.record(z.string(), z.unknown()).default({}),
  address: addressCandidate.nullish(),
  addressCandidates: z.array(addressCandidate).max(20).default([]),
  suitability: z
    .object({
      usableAreaM2: z.number().nonnegative().optional(),
      estKwpDc: z.number().nonnegative().optional(),
      assumptions: z.string().max(1000).optional(),
      existingPvMappedInOsm: z.array(z.string().max(100)).max(20).optional(),
    })
    .default({}),
  businesses: z.array(importBusiness).max(50).default([]),
});

export const prospectImportSchema = z.object({
  batch: z.string().regex(/^[a-z0-9-]{3,60}$/),
  isDemo: z.boolean().default(false),
  roofs: z.array(importRoof).min(1).max(500),
});

export type ProspectImport = z.infer<typeof prospectImportSchema>;

// ─── CSV export ─────────────────────────────────────────────────────────

/** Quotes a CSV cell and defuses spreadsheet formulas (=, +, -, @ at the start). */
export function csvCell(v: string | number | boolean | null | undefined): string {
  if (v == null) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const CSV_HEADER = [
  'roof_ref', 'is_demo', 'lat', 'lng', 'area_m2', 'est_kwp_dc_preliminary', 'suitability',
  'building_confidence', 'building_source', 'building_license',
  'address', 'address_confidence', 'address_source', 'address_method', 'roof_review',
  'business_name', 'business_relation', 'business_match_confidence', 'business_match_basis', 'business_address',
  'website', 'website_source', 'phone', 'phone_source', 'email', 'email_source', 'company_number',
  'business_review', 'other_sources',
];

const orUnavailable = (v: string | null) => v ?? UNAVAILABLE;

/**
 * One row per roof × business (a roof without businesses still gets one row).
 * Missing contact values are written as "לא זמין", never left looking like data.
 */
export function prospectsToCsv(roofs: ProspectRoof[]): string {
  const rows: string[][] = [CSV_HEADER];
  for (const r of roofs) {
    const addr = r.address ? `${r.address.street}${r.address.houseNumber ? ` ${r.address.houseNumber}` : ''}${r.address.locality ? `, ${r.address.locality}` : ''}` : UNAVAILABLE;
    const roofCols = [
      r.ref, r.isDemo ? 'demo' : 'real', r.center[0].toFixed(6), r.center[1].toFixed(6), String(Math.round(r.areaM2)),
      r.suitabilityDetail.estKwpDc != null ? String(r.suitabilityDetail.estKwpDc) : '', SUITABILITY_LABEL[r.suitability],
      CONFIDENCE[r.building.confidence].label, r.building.source, r.building.license,
      addr, r.address?.confidence ? CONFIDENCE[r.address.confidence].label : UNAVAILABLE, r.address?.source ?? '', r.address?.method ?? '',
      REVIEW[r.reviewStatus].label,
    ];
    const businesses = r.businesses.length ? r.businesses : [null];
    for (const b of businesses) {
      rows.push([
        ...roofCols,
        ...(b
          ? [
              b.name, RELATION[b.relation].label, CONFIDENCE[b.matchConfidence].label, b.matchBasis, b.businessAddress ?? '',
              orUnavailable(b.website), b.websiteSourceUrl ?? '', orUnavailable(b.phone), b.phoneSourceUrl ?? '',
              orUnavailable(b.email), b.emailSourceUrl ?? '', b.companyNumber ?? '', REVIEW[b.reviewStatus].label,
              b.sources.map((s) => `${SOURCE_KIND_LABEL[s.kind]}: ${s.url}`).join(' | '),
            ]
          : ['', '', '', 'לא נמצא עסק מתאים', '', UNAVAILABLE, '', UNAVAILABLE, '', UNAVAILABLE, '', '', '', '']),
      ]);
    }
  }
  // BOM so Excel opens the Hebrew text as UTF-8.
  return '﻿' + rows.map((cols) => cols.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
