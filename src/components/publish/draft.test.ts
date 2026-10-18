import { describe, expect, it } from 'vitest';
import { toListingRow } from '@/lib/listing-payload';
import type { LatLng, Listing } from '@/lib/types';
import {
  draftFromListing,
  errorsForStep,
  footprintChanged,
  locationChanged,
  newDraft,
  stepOfError,
  validateDraft,
  type Draft,
} from './draft';

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
});
