// Diagnostics on matching, double counting, missed roofs, landuse and relations.
// Area overlaps are measured by dense point sampling (no polygon clipping library needed).
import AUDIT from './recompute.mjs';
import fs from 'node:fs';
const { osm, osmAll, ms, msAll, lu, solar, cands, iOsmBB, iOsmAll, iMsBB, iMsAll, inside, bboxOf, luAt, osmRel, luRel, gj, stats } = AUDIT;
const ROOT = 'C:/Users/idang/solgag/research/pilot-emek-hefer/';
const D2R = Math.PI / 180;
const out = {};

class Idx {
  constructor(items, cell = 0.002) {
    this.items = items; this.cell = cell; this.m = new Map();
    items.forEach((it, i) => { const [a, b, c, d] = it.bb; for (let gx = Math.floor(a / cell); gx <= Math.floor(c / cell); gx++) for (let gy = Math.floor(b / cell); gy <= Math.floor(d / cell); gy++) { const k = gx * 1e6 + gy; if (!this.m.has(k)) this.m.set(k, []); this.m.get(k).push(i); } });
  }
  at(pt) { return (this.m.get(Math.floor(pt[0] / this.cell) * 1e6 + Math.floor(pt[1] / this.cell)) ?? []).filter((i) => { const b = this.items[i].bb; return pt[0] >= b[0] && pt[0] <= b[2] && pt[1] >= b[1] && pt[1] <= b[3] && inside(pt, this.items[i].ring); }); }
}
// Grid samples inside a polygon; each sample carries an equal share of the polygon's area.
function samples(ring, bb, area, target = 1500) {
  const s = Math.max(0.4, Math.sqrt(area / target));
  const lat0 = (bb[1] + bb[3]) / 2;
  const dy = s / 110900, dx = s / (111320 * Math.cos(lat0 * D2R));
  const pts = [];
  for (let y = bb[1] + dy / 2; y < bb[3]; y += dy) for (let x = bb[0] + dx / 2; x < bb[2]; x += dx) if (inside([x, y], ring)) pts.push([x, y]);
  return { pts, w: pts.length ? area / pts.length : 0 };
}
const r0 = (v) => Math.round(v);

// ── D1: published vs. recomputed candidate sets, matched by geometry ──
// Match published <-> recomputed by geometry: same vertex count, every vertex within 2e-7 deg.
const pub = gj.features.map((f) => ({ ring: f.geometry.coordinates[0], p: f.properties }));
pub.forEach((f) => { f.bb = bboxOf(f.ring); });
const sameRing = (r1, r2) => r1.length === r2.length && r1.every((v, i) => Math.abs(v[0] - r2[i][0]) < 2e-7 && Math.abs(v[1] - r2[i][1]) < 2e-7);
const byN = new Map();
cands.forEach((b) => { const k = b.ring.length; if (!byN.has(k)) byN.set(k, []); byN.get(k).push(b); });
cands.forEach((b, i) => (b.mkey = `m${i}`));
for (const f of pub) {
  const m = (byN.get(f.ring.length) ?? []).find((b) => !b.taken && sameRing(b.ring, f.ring));
  if (m) { m.taken = true; f.key = m.mkey; } else f.key = `p:${f.p.id}`;
}
const gkey = (ring) => ring.mkey;
const pubByKey = new Map(pub.map((f) => [f.key, f]));
const mineByKey = new Map(cands.map((b) => [b.mkey, b]));
for (const b of cands) b.ring.mkey = b.mkey;
const onlyPub = pub.filter((f) => !mineByKey.has(f.key));
const onlyMine = cands.filter((b) => !pubByKey.has(gkey(b.ring)));
const srcChanged = cands.filter((b) => pubByKey.has(gkey(b.ring)) && pubByKey.get(gkey(b.ring)).p.source !== b.srcKey);
const ctxMap = { industrial: 'industrial', commercial: 'commercial', retail: 'commercial', farmyard: 'agricultural', farmland: 'agricultural', greenhouse_horticulture: 'agricultural', residential: 'residential', military: 'military', unmapped: 'unmapped' };
const ctxChanged = cands.filter((b) => pubByKey.has(gkey(b.ring)) && pubByKey.get(gkey(b.ring)).p.context !== ctxMap[b.lu]);
out.D1_setDiff = {
  onlyPublished: onlyPub.map((f) => ({ id: f.p.id, source: f.p.source, area: f.p.areaSqm, lat: f.p.lat, lng: f.p.lng })),
  onlyRecomputed: onlyMine.map((b) => ({ id: b.id, src: b.srcKey, area: r0(b.aSph), c: b.c.map((v) => +v.toFixed(6)) })),
  areaOnlyPublished: onlyPub.reduce((s, f) => s + f.p.areaSqm, 0),
  areaOnlyRecomputed: r0(onlyMine.reduce((s, b) => s + b.aSph, 0)),
  sourceLabelChanged: srcChanged.map((b) => ({ id: b.id, published: pubByKey.get(gkey(b.ring)).p.source, recomputed: b.srcKey, area: r0(b.aSph) })),
  contextChanged: ctxChanged.length,
};

// ── D2: overlap / double counting inside the PUBLISHED candidate set ──
{
  const ip = new Idx(pub);
  let total = 0, union = 0;
  const coveredFrac = [];
  const pairs = new Map();
  pub.forEach((f, i) => {
    const a = f.p.areaSqm;
    total += a;
    const { pts, w } = samples(f.ring, f.bb, a);
    let cov = 0, uni = 0;
    for (const pt of pts) {
      const hits = ip.at(pt).filter((j) => j !== i);
      if (hits.length) cov++;
      if (!hits.some((j) => j < i)) uni++;
      for (const j of hits) if (j > i) { const k = `${i}-${j}`; pairs.set(k, (pairs.get(k) ?? 0) + w); }
    }
    union += uni * w;
    f.covFrac = pts.length ? cov / pts.length : 0;
    coveredFrac.push(f.covFrac);
  });
  const pairList = [...pairs.entries()].map(([k, ov]) => { const [i, j] = k.split('-').map(Number); return { a: pub[i].p, b: pub[j].p, ov }; }).filter((x) => x.ov >= 10);
  const bySrcPair = {};
  for (const x of pairList) { const k = [x.a.source, x.b.source].sort().join('+'); bySrcPair[k] = bySrcPair[k] ?? { pairs: 0, overlapSqm: 0 }; bySrcPair[k].pairs++; bySrcPair[k].overlapSqm += x.ov; }
  for (const k in bySrcPair) bySrcPair[k].overlapSqm = r0(bySrcPair[k].overlapSqm);
  out.D2_publishedOverlap = {
    sumOfAreas: total, unionArea: r0(union), doubleCountedSqm: r0(total - union), doubleCountedPct: +((100 * (total - union)) / total).toFixed(2),
    featuresWithAnyOverlapGt10pct: coveredFrac.filter((x) => x > 0.1).length,
    featuresOverlapGt50pct: coveredFrac.filter((x) => x > 0.5).length,
    overlappingPairs_ge10sqm: pairList.length,
    bySourcePair: bySrcPair,
    worst: pairList.sort((x, y) => y.ov - x.ov).slice(0, 12).map((x) => ({ a: `${x.a.id} (${x.a.source}, ${x.a.areaSqm} m2, ${x.a.tag})`, b: `${x.b.id} (${x.b.source}, ${x.b.areaSqm} m2)`, overlapSqm: r0(x.ov), at: `${x.a.lat},${x.a.lng}` })),
  };
}

// ── D3: MS-only candidates vs. ALL OSM buildings (any size) ──────────
{
  const osmCandIdx = new Idx(cands.filter((b) => b.src === 'osm'));
  const msOnly = cands.filter((b) => b.srcKey === 'ms_only');
  const buckets = { 'covered<10%': 0, '10-50%': 0, '50-90%': 0, '>=90%': 0 };
  let areaCoveredByOsmAny = 0, areaCoveredByOsmCand = 0, nMostlyCoveredByOsmSmall = 0, areaMostlyCoveredByOsmSmall = 0;
  const examples = [];
  for (const b of msOnly) {
    const { pts, w } = samples(b.ring, b.bb, b.aSph);
    let any = 0, candHit = 0;
    const ids = new Set();
    for (const pt of pts) {
      const h = iOsmAll.at(pt);
      if (h.length) { any++; h.forEach((i) => ids.add(osmAll[i].id)); }
      if (osmCandIdx.at(pt).length) candHit++;
    }
    const f = pts.length ? any / pts.length : 0;
    b.osmCov = f; b.osmCandCov = pts.length ? candHit / pts.length : 0; b.osmIds = ids;
    buckets[f < 0.1 ? 'covered<10%' : f < 0.5 ? '10-50%' : f < 0.9 ? '50-90%' : '>=90%']++;
    areaCoveredByOsmAny += any * w;
    areaCoveredByOsmCand += candHit * w;
    if (f >= 0.5 && b.osmCandCov < 0.1) { nMostlyCoveredByOsmSmall++; areaMostlyCoveredByOsmSmall += b.aSph; }
    if (f >= 0.5 && examples.length < 8) examples.push({ ms: b.id, area: r0(b.aSph), osmCover: +f.toFixed(2), osmBuildings: ids.size, centroidInOwnPolygon: inside(b.c, b.ring), c: b.c.map((v) => +v.toFixed(6)) });
  }
  out.D3_msOnlyVsOsm = {
    msOnly: msOnly.length, coverageBuckets: buckets,
    msOnlyAreaTotal: r0(msOnly.reduce((s, b) => s + b.aSph, 0)),
    areaAlsoCoveredByAnyOsmBuilding: r0(areaCoveredByOsmAny),
    areaAlsoCoveredByOsmCandidates_doubleCounted: r0(areaCoveredByOsmCand),
    mostlyOsmMapped_butOsmPartsBelowThreshold: { n: nMostlyCoveredByOsmSmall, area: r0(areaMostlyCoveredByOsmSmall) },
    ownCentroidOutsideOwnPolygon: msOnly.filter((b) => !inside(b.c, b.ring)).length,
    ownCentroidOutside_andOsmCover50: msOnly.filter((b) => !inside(b.c, b.ring) && b.osmCov >= 0.5).length,
    examples,
  };
}

// ── D4: large MS roofs swallowed by a smaller OSM polygon ─────────────
{
  const msL = ms.filter((b) => b.aSph >= 1000);
  const swallowed = [];
  let dropMatchedToBigger = 0;
  for (const m of msL) {
    const hits = iOsmBB.at(m.c).map((i) => osm[i]);
    if (!hits.length) continue;
    const maxOsm = Math.max(...hits.map((o) => o.aSph));
    if (maxOsm < 1000) swallowed.push({ ms: m, maxOsm });
    else dropMatchedToBigger++;
  }
  // how much of each swallowed MS footprint is covered by OSM at all
  const detail = swallowed.map(({ ms: m, maxOsm }) => {
    const { pts } = samples(m.ring, m.bb, m.aSph, 800);
    const ids = new Set(); let cov = 0;
    for (const pt of pts) { const h = iOsmAll.at(pt); if (h.length) { cov++; h.forEach((i) => ids.add(i)); } }
    const anyCand = [...ids].some((i) => osmAll[i].aSph >= 1000);
    return { area: r0(m.aSph), maxOsmContainingCentroid: r0(maxOsm), osmCover: pts.length ? +(cov / pts.length).toFixed(2) : 0, osmPieces: ids.size, anyOverlappingOsmGe1000: anyCand, c: m.c.map((v) => +v.toFixed(6)) };
  });
  const lost = detail.filter((d) => !d.anyOverlappingOsmGe1000);
  out.D4_msLargeSwallowedBySmallOsm = {
    msGe1000_centroidInOsm: msL.filter((m) => iOsmBB.at(m.c).length > 0).length,
    msGe1000_centroidInOsmGe1000: dropMatchedToBigger,
    msGe1000_centroidInOsmLt1000: swallowed.length,
    ofWhichNoOverlappingOsmGe1000_lostRoofs: lost.length,
    lostRoofArea: lost.reduce((s, d) => s + d.area, 0),
    lostBySize: { '1000-2500': lost.filter((d) => d.area < 2500).length, '2500-5000': lost.filter((d) => d.area >= 2500 && d.area < 5000).length, '5000+': lost.filter((d) => d.area >= 5000).length },
    examples: lost.sort((a, b) => b.area - a.area).slice(0, 10),
  };
}

// ── D5: OSM >=1000 labelled osm_only although MS covers most of it ───
{
  const osmOnly = cands.filter((b) => b.srcKey === 'osm_only');
  let falseOnly = 0; const ex = [];
  for (const b of osmOnly) {
    const { pts } = samples(b.ring, b.bb, b.aSph, 800);
    let cov = 0; for (const pt of pts) if (iMsAll.at(pt).length) cov++;
    const f = pts.length ? cov / pts.length : 0;
    if (f >= 0.5) { falseOnly++; if (ex.length < 6) ex.push({ id: b.id, area: r0(b.aSph), msCover: +f.toFixed(2), centroidInOwnPolygon: inside(b.c, b.ring) }); }
  }
  // MS footprint containing an OSM centroid but much smaller/larger than the OSM building
  const both = cands.filter((b) => b.srcKey === 'both');
  const ratio = both.map((b) => { const hits = iMsBB.at(b.c).map((i) => ms[i]); return Math.max(...hits.map((m) => m.aSph)) / b.aSph; });
  out.D5_osmMatching = {
    osmOnly: osmOnly.length, osmOnly_butMsCoversHalfOrMore: falseOnly, examples: ex,
    both_msAreaOverOsmArea_lt0_5: ratio.filter((r) => r < 0.5).length,
    both_msAreaOverOsmArea_gt2: ratio.filter((r) => r > 2).length,
    osmCandidatesCentroidOutsideOwnPolygon: cands.filter((b) => b.src === 'osm' && !inside(b.c, b.ring)).length,
  };
}

// ── D6: landuse context of candidates, greenhouse areas ───────────────
{
  const by = {};
  for (const b of cands) { const k = `${b.lu}|${b.srcKey}`; by[k] = by[k] ?? { n: 0, area: 0 }; by[k].n++; by[k].area += b.aSph; }
  for (const k in by) by[k].area = r0(by[k].area);
  const gh = cands.filter((b) => b.lu === 'greenhouse_horticulture');
  // landuse polygons overlapping each other with different types (priority actually matters)
  const multi = cands.filter((b) => new Set(AUDIT.iLu.at(b.c).map((i) => lu[i].type)).size > 1).length;
  const tagCounts = {};
  for (const b of cands.filter((x) => x.src === 'osm')) tagCounts[b.tag] = (tagCounts[b.tag] ?? 0) + 1;
  out.D6_landuse = {
    byLanduseAndSource: by,
    greenhouseHorticulture: { n: gh.length, area: r0(gh.reduce((s, b) => s + b.aSph, 0)), msOnly: gh.filter((b) => b.srcKey === 'ms_only').length },
    agriculturalTotal: { n: cands.filter((b) => ['farmland', 'farmyard', 'greenhouse_horticulture'].includes(b.lu)).length, area: r0(cands.filter((b) => ['farmland', 'farmyard', 'greenhouse_horticulture'].includes(b.lu)).reduce((s, b) => s + b.aSph, 0)) },
    candidatesInsideMoreThanOneLanduseType: multi,
    osmCandidateTags: tagCounts,
    residentialContextCandidates_msOnly: cands.filter((b) => b.lu === 'residential' && b.srcKey === 'ms_only').length,
  };
}

// ── D7: mapped solar vs candidates ────────────────────────────────────
{
  const ic = new Idx(cands);
  const res = solar.map((s) => {
    const { pts } = samples(s.ring, s.bb, s.aSph, 400);
    const hit = new Set(); let cov = 0;
    for (const pt of pts) { const h = ic.at(pt); if (h.length) { cov++; h.forEach((i) => hit.add(i)); } }
    const msHit = new Set(); for (const pt of pts) iMsAll.at(pt).forEach((i) => msHit.add(i));
    return { id: s.id, area: r0(s.aSph), floating: s.tags?.floating ?? null, coveredByCandidates: pts.length ? +(cov / pts.length).toFixed(2) : 0, candidates: [...hit].map((i) => `${cands[i].id}(${cands[i].srcKey},${r0(cands[i].aSph)})`), msFootprintsTouching: msHit.size };
  });
  out.D7_solar = res;
}

// ── D8: OSM relations (no members in raw) ─────────────────────────────
{
  const rels = osmRel.map((r) => {
    const b = r.bounds;
    const w = (b.maxlon - b.minlon) * 111320 * Math.cos(((b.minlat + b.maxlat) / 2) * D2R), h = (b.maxlat - b.minlat) * 110900;
    const msIn = ms.filter((m) => m.c[0] >= b.minlon && m.c[0] <= b.maxlon && m.c[1] >= b.minlat && m.c[1] <= b.maxlat);
    const msCand = cands.filter((m) => m.src === 'ms' && m.c[0] >= b.minlon && m.c[0] <= b.maxlon && m.c[1] >= b.minlat && m.c[1] <= b.maxlat);
    return { id: r.id, building: r.tags.building, name: r.tags['name:en'] ?? null, bboxSqm: r0(w * h), msFootprintsInside: msIn.length, msCandidatesInside: msCand.map((m) => r0(m.aSph)) };
  });
  const lrels = luRel.map((r) => {
    const b = r.bounds;
    const n = cands.filter((m) => m.c[0] >= b.minlon && m.c[0] <= b.maxlon && m.c[1] >= b.minlat && m.c[1] <= b.maxlat);
    return { id: r.id, landuse: r.tags.landuse, bounds: b, candidatesWithCentroidInBounds: n.length, ofWhichUnmapped: n.filter((m) => m.lu === 'unmapped').length };
  });
  out.D8_relations = { buildingRelations: rels, landuseRelations: lrels };
}

// ── D9: size/threshold sensitivity and sheds ─────────────────────────
{
  const near = cands.filter((b) => b.aSph >= 1000 && b.aSph < 1010).length;
  const poolBelow = AUDIT.pool.filter((b) => b.aSph >= 990 && b.aSph < 1000).length;
  out.D9_threshold = { candidates_1000_1010: near, pool_990_1000: poolBelow };
}

// ── D10: corrected totals scenarios ───────────────────────────────────
{
  const sumA = (arr) => arr.reduce((s, b) => s + b.aSph, 0);
  const kw = (a) => (a * 0.65) / 6.5;
  const y = stats.assumptions.yieldKwhPerKw;
  const base = sumA(cands);
  const noDup = base - out.D3_msOnlyVsOsm.areaAlsoCoveredByOsmCandidates_doubleCounted;
  const noGh = sumA(cands.filter((b) => !(b.lu === 'greenhouse_horticulture')));
  const noGhNoDup = noGh - cands.filter((b) => b.srcKey === 'ms_only' && b.lu !== 'greenhouse_horticulture').reduce((s, b) => s + b.osmCandCov * b.aSph, 0);
  const sc = (a) => ({ areaSqm: r0(a), MWp: +(kw(a) / 1000).toFixed(1), GWhYear: +((kw(a) * y) / 1e6).toFixed(1) });
  out.D10_scenarios = { published: sc(stats.totals.roofAreaSqm), recomputedStableCentroid: sc(base), minusMsOnlyOverlapWithOsmCandidates: sc(noDup), minusGreenhouseLanduse: sc(noGh), minusBoth: sc(noGhNoDup) };
}

fs.writeFileSync(ROOT + 'audit/diagnostics.json', JSON.stringify(out, null, 2));
console.log('=====DIAG=====');
console.log(JSON.stringify(out, null, 2));
