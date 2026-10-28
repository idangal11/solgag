import { describe, expect, it } from 'vitest';
import {
  applyProspectFilters,
  csvCell,
  DEFAULT_FILTERS,
  filtersToQuery,
  parseProspectFilters,
  prospectImportSchema,
  prospectsToCsv,
  UNAVAILABLE,
  type ProspectBusiness,
  type ProspectRoof,
} from './prospects';

function biz(over: Partial<ProspectBusiness> = {}): ProspectBusiness {
  return {
    id: 'b1', roofId: 'r1', isDemo: false, name: 'עסק', nameEn: null, category: null, companyNumber: null,
    relation: 'occupant_unverified', relationEvidence: null, matchConfidence: 'medium', matchBasis: 'OSM POI inside the footprint',
    businessAddress: null, businessAddressSourceUrl: null, website: null, websiteSourceUrl: null,
    phone: null, phoneSourceUrl: null, phoneSnippet: null, email: null, emailSourceUrl: null, emailSnippet: null,
    contactsCheckedAt: null, sources: [], reviewStatus: 'pending', reviewNote: null, ...over,
  };
}

function roof(over: Partial<ProspectRoof> = {}): ProspectRoof {
  return {
    id: 'r1', batch: 'test', ref: 'EHP-01', isDemo: false,
    polygon: [[32.4, 34.89], [32.4, 34.891], [32.401, 34.891]], center: [32.4005, 34.8905], areaM2: 2500,
    building: { source: 'Microsoft', sourceUrl: null, license: 'CDLA-Permissive-2.0', confidence: 'high', basis: [] },
    address: null, addressCandidates: [], suitability: 'preliminary_unverified', suitabilityDetail: { estKwpDc: 250 },
    reviewStatus: 'pending', reviewNote: null, reviewedAt: null, businesses: [], ...over,
  };
}

describe('applyProspectFilters', () => {
  const roofs = [
    roof({ id: 'a', areaM2: 1200 }),
    roof({ id: 'b', areaM2: 5000, businesses: [biz({ matchConfidence: 'low' })] }),
    roof({ id: 'c', areaM2: 3000, isDemo: true, reviewStatus: 'approved', businesses: [biz()] }),
    roof({ id: 'd', areaM2: 2000, businesses: [biz({ reviewStatus: 'rejected' })], building: { ...roof().building, confidence: 'medium' } }),
  ];
  const ids = (f: Partial<typeof DEFAULT_FILTERS>) => applyProspectFilters(roofs, { ...DEFAULT_FILTERS, ...f }).map((r) => r.id);

  it('filters by minimum area', () => expect(ids({ minArea: 2500 })).toEqual(['b', 'c']));
  it('filters by review status and building confidence', () => {
    expect(ids({ review: 'approved' })).toEqual(['c']);
    expect(ids({ building: 'medium' })).toEqual(['d']);
  });
  it('ignores rejected businesses when filtering by match', () => {
    expect(ids({ business: 'with' })).toEqual(['b', 'c']);
    expect(ids({ business: 'none' })).toEqual(['a', 'd']);
    expect(ids({ business: 'strong' })).toEqual(['c']);
  });
  it('separates real records from demo data', () => {
    expect(ids({ demo: 'real' })).toEqual(['a', 'b', 'd']);
    expect(ids({ demo: 'demo' })).toEqual(['c']);
  });
});

describe('filter query string', () => {
  it('round-trips and ignores junk', () => {
    const f = { ...DEFAULT_FILTERS, minArea: 1500, review: 'pending' as const, demo: 'real' as const };
    expect(parseProspectFilters(Object.fromEntries(new URLSearchParams(filtersToQuery(f))))).toEqual(f);
    expect(parseProspectFilters({ minArea: '-5', review: 'drop table', building: 'x' })).toEqual(DEFAULT_FILTERS);
  });
});

describe('csv', () => {
  it('quotes cells and defuses spreadsheet formulas', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+972-4-1234567')).toBe("'+972-4-1234567");
    expect(csvCell(null)).toBe('');
  });

  it('writes one row per roof × business, marks missing contacts unavailable, and labels demo rows', () => {
    const csv = prospectsToCsv([
      roof({ businesses: [biz({ phone: '04-6000000', phoneSourceUrl: 'https://example.com/contact' }), biz({ id: 'b2', name: 'שני' })] }),
      roof({ id: 'r2', ref: 'EHP-02', isDemo: true }),
    ]);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(4); // header + 2 businesses + 1 roof without a business
    expect(lines[1]).toContain('04-6000000');
    expect(lines[1]).toContain('https://example.com/contact');
    expect(lines[2]).toContain(UNAVAILABLE);
    expect(lines[3]).toContain('demo');
    expect(lines[3]).toContain('לא נמצא עסק מתאים');
    // Never presents an occupant as the owner.
    expect(lines[1]).toContain('לא ידוע אם בעלים');
  });
});

describe('prospectImportSchema', () => {
  const base = {
    batch: 'emek-hefer-park',
    roofs: [
      {
        ref: 'EHP-01',
        sourceKey: 'msbf:1',
        geometry: { type: 'Polygon', coordinates: [[[34.89, 32.4], [34.891, 32.4], [34.891, 32.401], [34.89, 32.4]]] },
        buildingSource: 'Microsoft',
        buildingLicense: 'CDLA-Permissive-2.0',
        buildingConfidence: 'high',
        businesses: [{ dedupeKey: 'k', name: 'עסק', matchConfidence: 'low', matchBasis: 'same street' }],
      },
    ],
  };
  const withBiz = (b: Record<string, unknown>) => ({ ...base, roofs: [{ ...base.roofs[0], businesses: [{ ...base.roofs[0].businesses[0], ...b }] }] });

  it('accepts a valid batch and defaults the relation to an unverified occupant', () => {
    const r = prospectImportSchema.parse(base);
    expect(r.isDemo).toBe(false);
    expect(r.roofs[0].businesses[0].relation).toBe('occupant_unverified');
  });
  it('refuses contact details without a source URL', () => {
    expect(prospectImportSchema.safeParse(withBiz({ phone: '04-6000000' })).success).toBe(false);
    expect(prospectImportSchema.safeParse(withBiz({ email: 'info@example.com' })).success).toBe(false);
    expect(prospectImportSchema.safeParse(withBiz({ phone: '04-6000000', phoneSourceUrl: 'https://example.com/c' })).success).toBe(true);
  });
  it('refuses "owner" without evidence', () => {
    expect(prospectImportSchema.safeParse(withBiz({ relation: 'owner_evidence' })).success).toBe(false);
  });
  it('refuses geometry outside Israel and non-http source URLs', () => {
    const far = { ...base, roofs: [{ ...base.roofs[0], geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } }] };
    expect(prospectImportSchema.safeParse(far).success).toBe(false);
    expect(prospectImportSchema.safeParse(withBiz({ website: 'javascript:alert(1)', websiteSourceUrl: 'https://x.com' })).success).toBe(false);
  });
});
