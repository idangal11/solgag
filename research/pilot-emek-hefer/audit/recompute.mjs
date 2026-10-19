// Independent recomputation for the Emek Hefer pilot audit.
// Deliberately shares NO code with analyze.mjs: own projection, own area (ellipsoidal
// equal-area + spherical), own centroid, winding-number point-in-polygon, own index.
// Run from C:\Users\idang\solgag:  node research/pilot-emek-hefer/audit/recompute.mjs
import fs from 'node:fs';

const ROOT = 'C:/Users/idang/solgag/research/pilot-emek-hefer/';
const RAW = ROOT + 'raw/';
const BB = { s: 32.3, w: 34.85, n: 32.42, e: 35.0 };
const T = 1000;

// ── geodesy ───────────────────────────────────────────────────────────
const A = 6378137, F = 1 / 298.257223563, E2 = F * (2 - F), D2R = Math.PI / 180;
const R_MEAN = 6371008.8; // what @turf/helpers v7 uses
const e4 = E2 * E2, e6 = e4 * E2;
const arc = (p) =>
  A * ((1 - E2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * p - ((3 * E2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * p) +
    ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * p) - ((35 * e6) / 3072) * Math.sin(6 * p));
const LON0 = 34.925;
// Ellipsoidal sinusoidal projection: exactly equal-area on WGS84.
const pEll = ([lon, lat]) => {
  const p = lat * D2R, s = Math.sin(p);
  const N = A / Math.sqrt(1 - E2 * s * s);
  return [N * Math.cos(p) * (lon - LON0) * D2R, arc(p)];
};
// Spherical sinusoidal (equal-area on a sphere of radius R).
const pSph = (R) => ([lon, lat]) => [R * Math.cos(lat * D2R) * (lon - LON0) * D2R, R * lat * D2R];
const pMean = pSph(R_MEAN);
function shoelace(ring, proj) {
  const q = ring.map(proj);
  const [ox, oy] = q[0];
  let s = 0;
  for (let i = 0; i < q.length - 1; i++) {
    const x0 = q[i][0] - ox, y0 = q[i][1] - oy, x1 = q[i + 1][0] - ox, y1 = q[i + 1][1] - oy;
    s += x0 * y1 - x1 * y0;
  }
  return Math.abs(s) / 2;
}
// Area-weighted centroid computed in a translated, cos-scaled local frame (affine to lon/lat).
function centroid(ring) {
  const [lx, ly] = ring[0];
  const k = Math.cos(ly * D2R);
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const x0 = (ring[i][0] - lx) * k, y0 = ring[i][1] - ly, x1 = (ring[i + 1][0] - lx) * k, y1 = ring[i + 1][1] - ly;
    const c = x0 * y1 - x1 * y0;
    a += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
  }
  if (a === 0) return vertexMean(ring);
  return [lx + cx / (3 * a) / k, ly + cy / (3 * a)];
}
function vertexMean(ring) {
  const n = ring.length - 1;
  let x = 0, y = 0;
  for (let i = 0; i < n; i++) { x += ring[i][0]; y += ring[i][1]; }
  return [x / n, y / n];
}
const inBB = ([x, y]) => y >= BB.s && y <= BB.n && x >= BB.w && x <= BB.e;
// Winding-number point in polygon (Sunday 2001).
function inside([px, py], ring) {
  let w = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const x0 = ring[i][0], y0 = ring[i][1], x1 = ring[i + 1][0], y1 = ring[i + 1][1];
    const isLeft = (x1 - x0) * (py - y0) - (px - x0) * (y1 - y0);
    if (y0 <= py) { if (y1 > py && isLeft > 0) w++; }
    else if (y1 <= py && isLeft < 0) w--;
  }
  return w !== 0;
}
function bboxOf(ring) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, y] of ring) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; }
  return [a, b, c, d];
}
// Bucket index (cell 0.002 deg) storing each polygon in every cell its bbox touches.
class Index {
  constructor(items, cell = 0.002) {
    this.items = items; this.cell = cell; this.m = new Map();
    items.forEach((it, i) => {
      const [a, b, c, d] = it.bb;
      for (let gx = Math.floor(a / cell); gx <= Math.floor(c / cell); gx++)
        for (let gy = Math.floor(b / cell); gy <= Math.floor(d / cell); gy++) {
          const key = gx * 1e6 + gy;
          let arr = this.m.get(key);
          if (!arr) this.m.set(key, (arr = []));
          arr.push(i);
        }
    });
  }
  at(pt) {
    const arr = this.m.get(Math.floor(pt[0] / this.cell) * 1e6 + Math.floor(pt[1] / this.cell)) ?? [];
    const out = [];
    for (const i of arr) {
      const it = this.items[i], b = it.bb;
      if (pt[0] >= b[0] && pt[0] <= b[2] && pt[1] >= b[1] && pt[1] <= b[3] && inside(pt, it.ring)) out.push(i);
    }
    return out;
  }
}
const mk = (src, id, ring, extra = {}) => ({ src, id, ring, bb: bboxOf(ring), c: centroid(ring), aSph: shoelace(ring, pMean), aEll: shoelace(ring, pEll), ...extra });

// ── load ──────────────────────────────────────────────────────────────
const t0 = Date.now();
const osmEls = JSON.parse(fs.readFileSync(RAW + 'osm-buildings.json', 'utf8')).elements;
const osmAll = [];
const osmRel = [];
for (const e of osmEls) {
  if (e.type === 'way' && Array.isArray(e.geometry)) {
    const ring = e.geometry.map((p) => [p.lon, p.lat]);
    osmAll.push(mk('osm', `way/${e.id}`, ring, { tag: e.tags?.building ?? 'yes', name: e.tags?.['name:en'] ?? e.tags?.name ?? null }));
  } else if (e.type === 'relation') osmRel.push(e);
}
const osm = osmAll.filter((b) => inBB(b.c));

const msAll = [];
{
  const txt = fs.readFileSync(RAW + 'ms-122112223.geojsonl', 'utf8');
  let pos = 0, k = 0;
  while (pos < txt.length) {
    let nl = txt.indexOf('\n', pos);
    if (nl < 0) nl = txt.length;
    const line = txt.slice(pos, nl);
    pos = nl + 1;
    if (!line.trim()) continue;
    const g = JSON.parse(line).geometry;
    const ring = g.coordinates[0];
    const bb = bboxOf(ring);
    // cheap prefilter: only keep footprints whose bbox is within 0.01 deg of the pilot bbox
    if (bb[2] < BB.w - 0.01 || bb[0] > BB.e + 0.01 || bb[3] < BB.s - 0.01 || bb[1] > BB.n + 0.01) { k++; continue; }
    msAll.push(mk('ms', `msline/${k}`, ring, { tag: 'yes', line: k }));
    k++;
  }
  globalThis.MS_LINES = k;
}
const ms = msAll.filter((b) => inBB(b.c));

const luEls = JSON.parse(fs.readFileSync(RAW + 'osm-landuse.json', 'utf8')).elements;
const lu = luEls.filter((e) => e.type === 'way' && e.geometry).map((e) => ({ type: e.tags.landuse, id: `way/${e.id}`, ring: e.geometry.map((p) => [p.lon, p.lat]) }));
lu.forEach((l) => (l.bb = bboxOf(l.ring)));
const luRel = luEls.filter((e) => e.type === 'relation');
const solarEls = JSON.parse(fs.readFileSync(RAW + 'osm-solar.json', 'utf8')).elements;
const solar = solarEls.filter((e) => e.type === 'way').map((e) => mk('solar', `way/${e.id}`, e.geometry.map((p) => [p.lon, p.lat]), { tags: e.tags }));
console.error(`loaded in ${(Date.now() - t0) / 1000}s`);

const iOsmBB = new Index(osm), iOsmAll = new Index(osmAll), iMsBB = new Index(ms), iMsAll = new Index(msAll), iLu = new Index(lu, 0.01), iSolar = new Index(solar);

// ── (1) basic counts ─────────────────────────────────────────────────
const R = {};
R.osmWaysTotal = osmAll.length;
R.osmRelationsTotal = osmRel.length;
R.osmRelationsWithMembers = osmRel.filter((r) => r.members?.length).length;
R.osmBuildingsCentroidInBbox = osm.length;
R.osmBuildingsVertexMeanInBbox = osmAll.filter((b) => inBB(vertexMean(b.ring))).length;
R.osmBuildingsBboxIntersects = osmAll.filter((b) => !(b.bb[2] < BB.w || b.bb[0] > BB.e || b.bb[3] < BB.s || b.bb[1] > BB.n)).length;
R.osmRelationsBoundsCentreInBbox = osmRel.filter((r) => inBB([(r.bounds.minlon + r.bounds.maxlon) / 2, (r.bounds.minlat + r.bounds.maxlat) / 2])).length;
R.msFootprintsInFile = globalThis.MS_LINES;
R.msFootprintsCentroidInBbox = ms.length;
R.msVertexMeanInBbox = msAll.filter((b) => inBB(vertexMean(b.ring))).length;

R.osmGe1000_sphereMean = osm.filter((b) => b.aSph >= T).length;
R.osmGe1000_ellipsoid = osm.filter((b) => b.aEll >= T).length;
R.msGe1000_sphereMean = ms.filter((b) => b.aSph >= T).length;
R.msGe1000_ellipsoid = ms.filter((b) => b.aEll >= T).length;
R.meanRatio_sphereOverEllipsoid = osm.reduce((s, b) => s + b.aSph / b.aEll, 0) / osm.length;

// (1e/f) cross matching, as analyze.mjs defines it (both lists restricted to bbox) and with no bbox restriction on the "other" list
const msL = ms.filter((b) => b.aSph >= T);
const osmL = osm.filter((b) => b.aSph >= T);
R.msGe1000_noOsmContainingCentroid_bboxOsm = msL.filter((m) => iOsmBB.at(m.c).length === 0).length;
R.msGe1000_noOsmContainingCentroid_allOsm = msL.filter((m) => iOsmAll.at(m.c).length === 0).length;
R.osmGe1000_noMsContainingCentroid_bboxMs = osmL.filter((o) => iMsBB.at(o.c).length === 0).length;
R.osmGe1000_noMsContainingCentroid_allMs = osmL.filter((o) => iMsAll.at(o.c).length === 0).length;

// ── final candidate set (same rules as the pipeline, re-implemented) ──
const RES = new Set(['apartments', 'detached', 'house', 'semidetached_house', 'residential', 'terrace', 'dormitory', 'bungalow']);
const EXC = new Set(['greenhouse', 'construction', 'ruins', 'roof']);
const PRI = ['military', 'industrial', 'commercial', 'retail', 'farmyard', 'residential', 'greenhouse_horticulture', 'farmland'];
const luAt = (pt) => {
  const types = new Set(iLu.at(pt).map((i) => lu[i].type));
  for (const t of PRI) if (types.has(t)) return t;
  return 'unmapped';
};
const pool = [...osm, ...ms.filter((m) => iOsmBB.at(m.c).length === 0)];
const cands = [];
const excluded = {};
for (const b of pool) {
  if (b.aSph < T) continue;
  b.lu = luAt(b.c);
  const reason = RES.has(b.tag) ? 'residential building' : EXC.has(b.tag) ? `building=${b.tag}` : b.lu === 'military' ? 'military area' : null;
  if (reason) { excluded[reason] = (excluded[reason] ?? 0) + 1; continue; }
  b.srcKey = b.src === 'ms' ? 'ms_only' : iMsBB.at(b.c).length ? 'both' : 'osm_only';
  cands.push(b);
}
R.candidates = cands.length;
R.excluded = excluded;
R.bySource = cands.reduce((o, b) => ((o[b.srcKey] = (o[b.srcKey] ?? 0) + 1), o), {});
R.byLanduseRaw = cands.reduce((o, b) => ((o[b.lu] = (o[b.lu] ?? 0) + 1), o), {});
R.candidateAreaSum_sphereMean = Math.round(cands.reduce((s, b) => s + b.aSph, 0));
R.candidateAreaSum_ellipsoid = Math.round(cands.reduce((s, b) => s + b.aEll, 0));
R.candidates_ellipsoidThreshold = pool.filter((b) => b.aEll >= T && !RES.has(b.tag) && !EXC.has(b.tag) && luAt(b.c) !== 'military').length;

// ── compare with the published outputs ───────────────────────────────
const stats = JSON.parse(fs.readFileSync(ROOT + 'data/stats.json', 'utf8'));
const gj = JSON.parse(fs.readFileSync(ROOT + 'data/candidates.geojson', 'utf8'));
R.published = {
  statsTotal: stats.candidates.total, statsRoofArea: stats.totals.roofAreaSqm, geojsonFeatures: gj.features.length,
  geojsonAreaSum: gj.features.reduce((s, f) => s + f.properties.areaSqm, 0),
  geojsonKwSum: gj.features.reduce((s, f) => s + f.properties.kw, 0),
  geojsonMwhSum: gj.features.reduce((s, f) => s + f.properties.mwhYear, 0),
  geojsonDupIds: gj.features.length - new Set(gj.features.map((f) => f.properties.id)).size,
};
// feature-level match: OSM by id, MS by centroid key
const key = (c) => `${c[0].toFixed(5)},${c[1].toFixed(5)}`;
const pubOsm = new Map(), pubMs = new Map();
for (const f of gj.features) {
  const p = f.properties;
  if (p.id.startsWith('ms/')) pubMs.set(key([p.lng, p.lat]), p); else pubOsm.set(p.id, p);
}
let matched = 0, areaDiffMax = 0, onlyMine = [], areaRel = [];
for (const b of cands) {
  const p = b.src === 'osm' ? pubOsm.get(b.id) : pubMs.get(key(b.c));
  if (!p) { onlyMine.push(b.id); continue; }
  matched++;
  areaDiffMax = Math.max(areaDiffMax, Math.abs(p.areaSqm - b.aSph));
  areaRel.push(p.areaSqm / b.aEll);
}
R.featureMatch = { matched, onlyMine: onlyMine.length, onlyPublished: gj.features.length - matched, maxAbsAreaDiff_vsMySphere: +areaDiffMax.toFixed(2), meanPublishedOverEllipsoid: +(areaRel.reduce((a, b) => a + b, 0) / areaRel.length).toFixed(6) };

fs.writeFileSync(ROOT + 'audit/recompute-core.json', JSON.stringify(R, null, 2));
console.log(JSON.stringify(R, null, 2));

// export for the diagnostics script
globalThis.AUDIT = { osm, osmAll, ms, msAll, lu, solar, cands, iOsmBB, iOsmAll, iMsBB, iMsAll, iLu, iSolar, inside, bboxOf, luAt, osmRel, luRel, R, T, pool, stats, gj };
export default globalThis.AUDIT;
