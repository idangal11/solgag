// Writes data/prospects-emek-hefer-park.csv from data/prospects-import.json using the app's own
// CSV format (src/lib/prospects.ts → prospectsToCsv), i.e. the same file /admin/prospects exports
// before any review. Run from the project root:
//   node --experimental-strip-types research/prospects-emek-hefer-park/export-csv.mts
import area from '@turf/area';
import fs from 'node:fs';
import { prospectsToCsv, type ProspectRoof } from '../../src/lib/prospects.ts';

const DIR = 'research/prospects-emek-hefer-park/data';
const data = JSON.parse(fs.readFileSync(`${DIR}/prospects-import.json`, 'utf8'));

const roofs: ProspectRoof[] = data.roofs.map((r: any, i: number) => {
  const ring = r.geometry.coordinates[0].map(([lng, lat]: number[]) => [lat, lng]);
  const n = ring.length - 1;
  const center = [ring.slice(0, n).reduce((s: number, p: number[]) => s + p[0], 0) / n, ring.slice(0, n).reduce((s: number, p: number[]) => s + p[1], 0) / n];
  // Geodesic area, as PostGIS computes it on import (±1 m² rounding).
  const areaM2 = Math.round(area({ type: 'Polygon', coordinates: r.geometry.coordinates }));
  return {
    id: String(i), batch: data.batch, ref: r.ref, isDemo: false, polygon: ring.slice(0, n), center, areaM2,
    building: { source: r.buildingSource, sourceUrl: r.buildingSourceUrl, license: r.buildingLicense, confidence: r.buildingConfidence, basis: r.buildingBasis },
    address: r.address, addressCandidates: r.addressCandidates, suitability: 'preliminary_unverified', suitabilityDetail: r.suitability,
    reviewStatus: 'pending', reviewNote: null, reviewedAt: null,
    businesses: r.businesses.map((b: any, j: number) => ({
      id: `${i}-${j}`, roofId: String(i), isDemo: false, relationEvidence: null, nameEn: null, category: null, companyNumber: null,
      businessAddress: null, businessAddressSourceUrl: null, website: null, websiteSourceUrl: null, phone: null, phoneSourceUrl: null,
      phoneSnippet: null, email: null, emailSourceUrl: null, emailSnippet: null, contactsCheckedAt: null, sources: [],
      reviewStatus: 'pending', reviewNote: null, ...b,
    })),
  };
});
fs.writeFileSync(`${DIR}/prospects-emek-hefer-park.csv`, prospectsToCsv(roofs));

const strong = roofs.flatMap((r) => r.businesses.filter((b) => b.matchConfidence !== 'low').map((b) => ({ roof: r.ref, area: r.areaM2, name: b.name, conf: b.matchConfidence, phone: b.phone ?? '—', email: b.email ?? '—', web: b.website ?? '—' })));
console.log(JSON.stringify(strong, null, 1));
const all = new Map(roofs.flatMap((r) => r.businesses.map((b) => [b.dedupeKey ?? b.name, b])));
console.log(`rows: ${roofs.reduce((s, r) => s + Math.max(1, r.businesses.length), 0)}; distinct businesses ${all.size}; phone ${[...all.values()].filter((b) => b.phone).length}; email ${[...all.values()].filter((b) => b.email).length}; website ${[...all.values()].filter((b) => b.website).length}`);
const bc = roofs.reduce((m: any, r) => ((m[r.building.confidence] = (m[r.building.confidence] ?? 0) + 1), m), {});
const ac = roofs.reduce((m: any, r) => ((m[`${r.address?.confidence ?? 'none'}${r.address?.houseNumber ? '+num' : ''}`] = (m[`${r.address?.confidence ?? 'none'}${r.address?.houseNumber ? '+num' : ''}`] ?? 0) + 1), m), {});
console.log('building', JSON.stringify(bc), 'address', JSON.stringify(ac), 'no business', roofs.filter((r) => !r.businesses.length).length);
