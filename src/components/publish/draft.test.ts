import { describe, expect, it } from 'vitest';
import { toListingRow } from '@/lib/listing-payload';
import type { LatLng, Listing } from '@/lib/types';
import {
  areaChanged,
  declarationText,
  draftFromListing,
  effectiveLocation,
  errorsForStep,
  footprintChanged,
  isFarFromRing,
  locationChanged,
  MAX_VERTICES,
  newDraft,
  ownershipFactsChanged,
  stepOfError,
  techFactsChanged,
  validateDraft,
  type Draft,
} from './draft';
import { parseStoredWizard } from './draftStorage';
import { saveErrorMessage } from './saveErrors';

// ~60 m × 60 m square in Petah Tikva
const SQUARE: LatLng[] = [
  [32.09, 34.88],
  [32.09, 34.8806],
  [32.0905, 34.8806],
  [32.0905, 34.88],
];

function validDraft(over: Partial<Draft> = {}): Draft {
  return {
    ...newDraft('ישראל ישראלי'),
    title: 'גג מחסן גדול',
    locality: 'פתח תקווה',
    polygon: SQUARE,
    declared: true,
    ...over,
  };
}

describe('validateDraft', () => {
  it('reports Hebrew errors on the step that owns each field', () => {
    const { data, errors } = validateDraft(newDraft());
    expect(data).toBeNull();
    expect(stepOfError('title')).toBe(0);
    expect(Object.keys(errorsForStep(errors, 0))).toEqual(expect.arrayContaining(['ownerDisplayName', 'title', 'locality']));
    expect(errorsForStep(errors, 1)).toMatchObject({ location: expect.any(String), polygon: expect.any(String) });
    expect(errors.declared).toBe('יש לאשר את ההצהרה כדי לפרסם');
    for (const msg of Object.values(errors)) expect(msg).toMatch(/[֐-׿]/);
  });

  it('accepts a complete polygon draft and uses the centroid as location', () => {
    const { data, errors } = validateDraft(validDraft());
    expect(errors).toEqual({});
    expect(data?.areaSource).toBe('polygon');
    expect(data?.totalAreaSqm).toBeGreaterThan(2500);
    expect(data?.usableAreaSqm).toBeLessThanOrEqual(data!.totalAreaSqm);
    expect(data?.location[0]).toBeCloseTo(32.09025, 4);
  });

  it('blocks a self-intersecting outline', () => {
    const bowtie: LatLng[] = [SQUARE[0], SQUARE[2], SQUARE[1], SQUARE[3]];
    expect(validateDraft(validDraft({ polygon: bowtie })).errors.polygon).toMatch(/חוצים/);
  });

  it('blocks locations outside the supported area', () => {
    const { errors } = validateDraft(validDraft({ polygon: [], areaMode: 'manual', manualArea: '1000', location: [40.7, -74] }));
    expect(errors.location).toMatch(/מחוץ לאזור/);
  });

  it('requires a manual area and the price field of the chosen model', () => {
    const e1 = validateDraft(validDraft({ polygon: [], areaMode: 'manual', manualArea: '', location: SQUARE[0] })).errors;
    expect(e1.area).toBe('נא להזין שטח גג במ״ר');
    const e2 = validateDraft(validDraft({ agreement: 'fixed_rent', rent: '' })).errors;
    expect(e2.rentPerSqmYear).toBe('נא להזין שכירות מבוקשת');
  });
});

describe('toListingRow', () => {
  it('maps to snake_case columns with model-specific terms', () => {
    const { data } = validateDraft(validDraft({ agreement: 'fixed_rent', rent: '25', share: '12', roofType: 'בטון' }));
    const row = toListingRow(data!);
    expect(row.location).toMatch(/^SRID=4326;POINT\(34\.88/);
    expect(row.footprint).toMatch(/^SRID=4326;POLYGON\(\(/);
    expect(row.rent_per_sqm_year).toBe(25);
    expect(row.share_pct).toBeNull();
    expect(row.tech_assessment).toBe('owner_reported');
    expect(row).not.toHaveProperty('owner_verification');
    expect(row).not.toHaveProperty('is_fictional');
  });

  it('omits the footprint below 3 points and marks tech as not assessed', () => {
    const { data } = validateDraft(validDraft({ polygon: [], areaMode: 'manual', manualArea: '1200', location: SQUARE[0] }));
    const row = toListingRow(data!);
    expect(row.footprint).toBeNull();
    expect(row.area_source).toBe('manual_estimate');
    expect(row.total_area_sqm).toBe(1200);
    expect(row.share_pct).toBe(12);
    expect(row.tech_assessment).toBe('not_assessed');
  });
});

describe('edit round trip', () => {
  const listing = {
    id: '00000000-0000-0000-0000-000000000001',
    title: 'גג מחסן גדול',
    locality: 'פתח תקווה',
    region: 'center',
    buildingType: 'warehouse',
    center: [32.09025, 34.8803],
    polygon: SQUARE,
    polygonIllustrative: false,
    totalAreaSqm: 3100,
    usableAreaSqm: 2000,
    areaSource: 'polygon',
    availability: 'available',
    agreement: 'open',
    terms: { rentPerSqmYear: null, sharePct: null, years: null, notes: '' },
    description: '',
    ownerDisplayName: 'ישראל ישראלי',
    ownerVerification: 'verified',
    techAssessment: 'not_assessed',
    tech: { roofType: null, shading: null, grid: null, roofAgeYears: null },
    images: [],
    isFictional: false,
    isMine: true,
    status: 'published',
    adminHidden: false,
    createdAt: '',
    updatedAt: '',
  } satisfies Listing;

  it('prefills the draft and detects geometry changes', () => {
    const d = draftFromListing(listing);
    expect(d.usablePct).toBe(65);
    expect(d.declared).toBe(false);
    expect(locationChanged(d, d)).toBe(false);
    expect(footprintChanged(d, d)).toBe(false);
    expect(footprintChanged({ ...d, polygon: SQUARE.slice(0, 3) }, d)).toBe(true);
    expect(locationChanged({ ...d, location: [32.1, 34.9] }, d)).toBe(true);
  });

  it('lets the point of a polygon-only listing follow a redrawn outline', () => {
    // The stored point is the outline's centroid → the draft keeps no explicit marker.
    const d = draftFromListing(listing);
    expect(d.location).toBeNull();
    expect(effectiveLocation(d)).toEqual([32.09025, 34.8803]);
    // Redrawn 300 m east: the point moves with it and is sent with the footprint.
    const moved: LatLng[] = SQUARE.map(([lat, lng]) => [lat, Math.round((lng + 0.003) * 1e7) / 1e7]);
    const edited = { ...d, polygon: moved };
    expect(locationChanged(edited, d)).toBe(true);
    expect(effectiveLocation(edited)![1]).toBeCloseTo(34.8833, 6);
  });

  it('keeps a marker the owner placed explicitly', () => {
    const d = draftFromListing({ ...listing, center: [32.0901, 34.8801] });
    expect(d.location).toEqual([32.0901, 34.8801]);
    expect(locationChanged({ ...d, polygon: SQUARE.slice(0, 3) }, d)).toBe(false);
  });

  it('knows which edits reset the ownership and survey badges', () => {
    const d = draftFromListing(listing);
    expect(ownershipFactsChanged({ ...d, title: 'כותרת חדשה לגג' }, d)).toBe(false);
    expect(ownershipFactsChanged({ ...d, locality: 'ראש העין' }, d)).toBe(true);
    expect(ownershipFactsChanged({ ...d, ownerDisplayName: 'מישהו אחר' }, d)).toBe(true);
    expect(ownershipFactsChanged({ ...d, locality: ` ${d.locality} ` }, d)).toBe(false);
    expect(techFactsChanged({ ...d, description: 'תיאור חדש' }, d)).toBe(false);
    expect(techFactsChanged({ ...d, roofType: 'בטון' }, d)).toBe(true);
    expect(techFactsChanged({ ...d, usablePct: 70 }, d)).toBe(true);
    expect(areaChanged(d, d)).toBe(false);
    expect(areaChanged({ ...d, areaMode: 'manual', manualArea: '3100' }, d)).toBe(true);
  });
});

describe('isFarFromRing', () => {
  it('flags a pin on another building but not one next to the roof', () => {
    expect(isFarFromRing([32.09025, 34.8803], SQUARE)).toBe(false);
    expect(isFarFromRing([32.0906, 34.8807], SQUARE)).toBe(false); // ~10 m outside a corner
    expect(isFarFromRing([32.09025, 34.8833], SQUARE)).toBe(true); // ~280 m east
    expect(isFarFromRing([32.2, 34.9], SQUARE.slice(0, 2))).toBe(false); // no outline yet
  });
});

describe('vertex cap', () => {
  it('matches the DB limit (200 vertices + the closing point) with a Hebrew message', () => {
    expect(MAX_VERTICES).toBe(200);
    const ring: LatLng[] = Array.from({ length: MAX_VERTICES + 1 }, (_, i) => {
      const a = (2 * Math.PI * i) / (MAX_VERTICES + 1);
      return [32.09 + 0.001 * Math.sin(a), 34.88 + 0.001 * Math.cos(a)];
    });
    expect(validateDraft(validDraft({ polygon: ring })).errors.polygon).toMatch(/עד 200 נקודות/);
    const max = ring.slice(0, MAX_VERTICES);
    const { data, errors } = validateDraft(validDraft({ polygon: max }));
    expect(errors).toEqual({});
    // polygonEWKT closes the ring: 201 points, exactly what footprint_size_limit allows.
    expect(toListingRow(data!).footprint!.split(',')).toHaveLength(MAX_VERTICES + 1);
  });
});

describe('declarationText', () => {
  it('never makes the owner of a verified or surveyed listing deny the check', () => {
    expect(declarationText('not_verified', 'not_assessed')).toMatch(/לא אימתה את הבעלות ולא ביצעה בדיקה הנדסית/);
    expect(declarationText('pending', 'survey_planned')).toMatch(/לא אימתה את הבעלות ולא ביצעה בדיקה הנדסית/);
    const verified = declarationText('verified', 'owner_reported');
    expect(verified).not.toMatch(/לא אימתה/);
    expect(verified).toMatch(/לא ביצעה בדיקה הנדסית/);
    const surveyed = declarationText('not_verified', 'assessed');
    expect(surveyed).toMatch(/לא אימתה את הבעלות/);
    expect(surveyed).not.toMatch(/לא ביצעה בדיקה הנדסית/);
    expect(declarationText('verified', 'assessed')).not.toMatch(/לא אימתה|לא ביצעה/);
  });
});

describe('stored wizard draft', () => {
  const base = newDraft('ישראל ישראלי');
  const opts = { base, baseVersion: 'new', lastStep: 3 };
  const envelope = (over: Record<string, unknown> = {}) =>
    JSON.stringify({
      v: 1,
      base: 'new',
      savedAt: Date.now(),
      draft: { ...validDraft(), title: 'טיוטה שנשמרה' },
      step: 2,
      maxStep: 2,
      removedIds: ['img-1', 7],
      pendingPhotos: 3,
      ...over,
    });

  it('restores the draft, the step and how many photos were lost', () => {
    const snap = parseStoredWizard(envelope(), opts);
    expect(snap).toMatchObject({ step: 2, maxStep: 2, removedIds: ['img-1'], lostPhotos: 3 });
    expect(snap!.draft.title).toBe('טיוטה שנשמרה');
    expect(snap!.draft.polygon).toEqual(SQUARE);
    // The declaration is always confirmed again before saving.
    expect(snap!.draft.declared).toBe(false);
  });

  it('drops drafts of another listing version, stale or broken ones', () => {
    expect(parseStoredWizard(null, opts)).toBeNull();
    expect(parseStoredWizard('{not json', opts)).toBeNull();
    expect(parseStoredWizard(envelope({ base: '2026-01-01T00:00:00Z' }), opts)).toBeNull();
    expect(parseStoredWizard(envelope({ savedAt: Date.now() - 2 * 24 * 3600 * 1000 }), opts)).toBeNull();
  });

  it('keeps base values for malformed fields', () => {
    const snap = parseStoredWizard(
      envelope({ draft: { title: 42, region: 'mars', polygon: [[1, 'x']], usablePct: 400, location: [32.1, 34.9] }, step: 9 }),
      opts,
    );
    expect(snap!.draft).toMatchObject({ title: '', region: 'center', polygon: [], usablePct: 95, location: [32.1, 34.9] });
    expect(snap!.step).toBe(2);
  });
});

describe('saveErrorMessage', () => {
  it('shows the DB rate limits and size limits in Hebrew', () => {
    const limit = 'פרסמת מודעות רבות בזמן קצר. נסו שוב מאוחר יותר.';
    expect(saveErrorMessage({ code: '54000', message: limit, status: 400 })).toBe(limit);
    expect(saveErrorMessage({ code: '54000', message: 'rate limited' })).toMatch(/מכסת/);
    expect(saveErrorMessage({ code: '22023', message: 'פוליגון הגג מורכב מדי (עד 200 נקודות, ללא חורים)' })).toMatch(/מורכב מדי/);
    expect(
      saveErrorMessage({ code: '23514', message: 'new row for relation "listings" violates check constraint "footprint_size_limit"' }),
    ).toMatch(/עד 200 נקודות/);
    expect(saveErrorMessage({ status: 413, message: 'Request Entity Too Large' })).toMatch(/גדולה מדי/);
  });

  it('never shows English or technical text', () => {
    const cases = [
      { code: '23514', message: 'violates check constraint "listings_title_check"' },
      { code: '22001', message: 'value too long' },
      { code: 'PGRST301', message: 'JWT expired', status: 401 },
      { status: 503, message: 'Service Unavailable' },
      { status: 0 },
      null,
    ];
    for (const c of cases) expect(saveErrorMessage(c)).toMatch(/^[^A-Za-z]*$/);
  });
});
