import { isInSupportedArea, isSelfIntersecting, polygonAreaSqm, polygonCentroid } from '@/lib/geo';
import type { AgreementModel, AreaSource, Availability, BuildingType, LatLng, Listing, Region } from '@/lib/types';
import { fieldErrors, listingSchema, type ListingInput } from '@/lib/validation';

// Form state of the publish/edit wizard. Numeric inputs stay strings while the
// user types; draftToInput converts them for listingSchema.

export type DrawMode = 'locate' | 'draw';
export type AreaMode = 'polygon' | 'manual';
export type ManualSource = Exclude<AreaSource, 'polygon'>;

export interface Draft {
  ownerDisplayName: string;
  title: string;
  buildingType: BuildingType;
  locality: string;
  region: Region;
  description: string;
  location: LatLng | null;
  polygon: LatLng[];
  areaMode: AreaMode;
  manualArea: string;
  manualSource: ManualSource;
  usablePct: number;
  roofType: string;
  shading: string;
  grid: string;
  roofAge: string;
  agreement: AgreementModel;
  rent: string;
  share: string;
  years: string;
  termsNotes: string;
  availability: Availability;
  declared: boolean;
}

export const STEPS = ['בעלים ומבנה', 'מיקום וגבולות', 'פרטים ותמונות', 'הסכם ופרסום'] as const;

export const USABLE_PCT = { min: 20, max: 95, default: 65 } as const;
export const MAX_VERTICES = 200;

export function newDraft(ownerDisplayName = ''): Draft {
  return {
    ownerDisplayName,
    title: '',
    buildingType: 'warehouse',
    locality: '',
    region: 'center',
    description: '',
    location: null,
    polygon: [],
    areaMode: 'polygon',
    manualArea: '',
    manualSource: 'manual_estimate',
    usablePct: USABLE_PCT.default,
    roofType: '',
    shading: '',
    grid: '',
    roofAge: '',
    agreement: 'revenue_share',
    rent: '',
    share: '12',
    years: '20',
    termsNotes: '',
    availability: 'available',
    declared: false,
  };
}

const str = (n: number | null) => (n === null ? '' : String(n));

export function draftFromListing(l: Listing): Draft {
  const manual = l.areaSource !== 'polygon';
  const pct = l.totalAreaSqm > 0 ? Math.round((l.usableAreaSqm / l.totalAreaSqm) * 100) : USABLE_PCT.default;
  return {
    ownerDisplayName: l.ownerDisplayName,
    title: l.title,
    buildingType: l.buildingType,
    locality: l.locality,
    region: l.region,
    description: l.description,
    location: l.center,
    polygon: l.polygon,
    areaMode: manual ? 'manual' : 'polygon',
    manualArea: manual ? String(l.totalAreaSqm) : '',
    manualSource: manual ? (l.areaSource as ManualSource) : 'manual_estimate',
    usablePct: Math.min(USABLE_PCT.max, Math.max(USABLE_PCT.min, pct)),
    roofType: l.tech.roofType ?? '',
    shading: l.tech.shading ?? '',
    grid: l.tech.grid ?? '',
    roofAge: str(l.tech.roofAgeYears),
    agreement: l.agreement,
    rent: str(l.terms.rentPerSqmYear),
    share: l.terms.sharePct === null ? '12' : String(l.terms.sharePct),
    years: str(l.terms.years),
    termsNotes: l.terms.notes,
    availability: l.availability,
    // The owner re-confirms the declaration whenever the listing is saved.
    declared: false,
  };
}

/** ~1 cm precision; keeps coordinates stable across the PostGIS round trip. */
export const roundLatLng = ([lat, lng]: LatLng): LatLng => [Math.round(lat * 1e7) / 1e7, Math.round(lng * 1e7) / 1e7];

const round1 = (n: number) => Math.round(n * 10) / 10;

function parseNum(s: string): number | null {
  const t = s.trim().replace(/,/g, '');
  return t === '' ? null : Number(t);
}

export function totalArea(d: Draft): number {
  return d.areaMode === 'polygon' ? round1(polygonAreaSqm(d.polygon)) : (parseNum(d.manualArea) ?? 0) || 0;
}

export function usableArea(d: Draft): number {
  return round1((totalArea(d) * d.usablePct) / 100);
}

/** Point stored for the listing: the marker, or the footprint centroid if only a polygon was drawn. */
export function effectiveLocation(d: Draft): LatLng | null {
  if (d.location) return d.location;
  return d.polygon.length >= 3 ? roundLatLng(polygonCentroid(d.polygon)) : null;
}

/** Shape passed to listingSchema (pre-parse input). */
export function draftToInput(d: Draft) {
  return {
    ownerDisplayName: d.ownerDisplayName,
    title: d.title,
    buildingType: d.buildingType,
    region: d.region,
    locality: d.locality,
    description: d.description,
    location: effectiveLocation(d),
    polygon: d.polygon,
    areaSource: d.areaMode === 'polygon' ? ('polygon' as const) : d.manualSource,
    totalAreaSqm: totalArea(d),
    usableAreaSqm: usableArea(d),
    roofType: d.roofType,
    shading: d.shading,
    grid: d.grid,
    roofAgeYears: parseNum(d.roofAge),
    agreement: d.agreement,
    rentPerSqmYear: d.agreement === 'fixed_rent' ? parseNum(d.rent) : null,
    sharePct: d.agreement === 'revenue_share' ? parseNum(d.share) : null,
    termYears: parseNum(d.years),
    termsNotes: d.termsNotes,
    availability: d.availability,
    declared: d.declared,
  };
}

/** Error keys shown by each step (schema paths are folded into these). */
export const STEP_FIELDS: readonly (readonly string[])[] = [
  ['ownerDisplayName', 'title', 'buildingType', 'region', 'locality', 'description'],
  ['location', 'polygon', 'area'],
  ['roofType', 'shading', 'grid', 'roofAgeYears'],
  ['agreement', 'rentPerSqmYear', 'sharePct', 'termYears', 'termsNotes', 'availability', 'declared', '_'],
];

const KEY_ALIAS: Record<string, string> = { totalAreaSqm: 'area', usableAreaSqm: 'area', areaSource: 'area' };

// Used when zod falls back to its built-in (English) message.
const FALLBACK: Record<string, string> = {
  location: 'נא לסמן את מיקום המבנה על המפה (או לשרטט את הגג)',
  polygon: 'שרטוט הגג אינו תקין',
  area: 'נא להזין שטח גג תקין במ״ר',
  roofAgeYears: 'גיל הגג: מספר שנים שלם בין 0 ל-150',
  rentPerSqmYear: 'נא להזין שכירות בין 0 ל-1,000 ₪ למ״ר לשנה',
  sharePct: 'נא להזין אחוז בין 1 ל-99',
  termYears: 'תקופת ההתקשרות: מספר שנים שלם בין 1 ל-50',
};

const isHebrew = (s: string) => /[֐-׿]/.test(s);

export const stepOfError = (key: string) => {
  const i = STEP_FIELDS.findIndex((f) => f.includes(key));
  return i === -1 ? STEP_FIELDS.length - 1 : i;
};

/**
 * Validates the whole draft with listingSchema plus the map-specific checks
 * the schema cannot express. Returns Hebrew messages keyed per field.
 */
export function validateDraft(d: Draft): { data: ListingInput | null; errors: Record<string, string> } {
  const parsed = listingSchema.safeParse(draftToInput(d));
  const errors: Record<string, string> = {};

  if (!parsed.success) {
    for (const [path, msg] of Object.entries(fieldErrors(parsed.error))) {
      const head = path.split('.')[0];
      const key = KEY_ALIAS[head] ?? head;
      errors[key] ??= isHebrew(msg) ? msg : (FALLBACK[key] ?? 'ערך לא תקין');
    }
  }

  // zod skips the object-level refinements while any field is invalid, so the
  // cross-field rules are repeated here to show them on the right step.
  const loc = effectiveLocation(d);
  if (!loc) errors.location = FALLBACK.location;
  else if (!isInSupportedArea(loc)) errors.location = 'המיקום מחוץ לאזור הנתמך — כרגע ניתן לפרסם גגות בישראל בלבד';

  if (d.polygon.length >= 3) {
    if (isSelfIntersecting(d.polygon)) {
      errors.polygon = 'קווי השרטוט חוצים זה את זה. גררו או מחקו נקודות כך שגבול הגג לא יחצה את עצמו.';
    } else if (d.polygon.some((p) => !isInSupportedArea(p))) {
      errors.polygon = 'חלק מהשרטוט מחוץ לאזור הנתמך';
    }
  } else if (d.areaMode === 'polygon') {
    errors.polygon = 'נא לשרטט לפחות 3 נקודות, או לעבור להזנת שטח ידנית';
  }

  if (d.areaMode === 'manual' && !d.manualArea.trim()) errors.area = 'נא להזין שטח גג במ״ר';
  else if (d.areaMode === 'polygon' && d.polygon.length < 3) delete errors.area;

  if (d.agreement === 'fixed_rent' && !errors.rentPerSqmYear && !(Number(d.rent) > 0)) {
    errors.rentPerSqmYear = 'נא להזין שכירות מבוקשת';
  }
  if (d.agreement === 'revenue_share' && !errors.sharePct && !(Number(d.share) > 0 && Number(d.share) < 100)) {
    errors.sharePct = FALLBACK.sharePct;
  }

  return { data: parsed.success && !Object.keys(errors).length ? parsed.data : null, errors };
}

export function errorsForStep(errors: Record<string, string>, step: number): Record<string, string> {
  return Object.fromEntries(Object.entries(errors).filter(([k]) => stepOfError(k) === step));
}

const sameRing = (a: LatLng[], b: LatLng[]) =>
  a.length === b.length && a.every((p, i) => p[0] === b[i][0] && p[1] === b[i][1]);

export function locationChanged(d: Draft, initial: Draft): boolean {
  const a = effectiveLocation(d);
  const b = effectiveLocation(initial);
  return !a || !b || a[0] !== b[0] || a[1] !== b[1];
}

export function footprintChanged(d: Draft, initial: Draft): boolean {
  const ring = (x: Draft) => (x.polygon.length >= 3 ? x.polygon : []);
  return !sameRing(ring(d), ring(initial));
}
