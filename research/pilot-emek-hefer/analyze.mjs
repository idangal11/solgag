// Feasibility study: detect potential solar rooftops from open building data.
// Run from the project root:  node research/pilot-emek-hefer/analyze.mjs
//
// Inputs (raw/): OpenStreetMap buildings, land use and mapped solar (Overpass,
// queries in overpass-queries.txt) and Microsoft Global ML Building Footprints
// (ms-*.geojsonl, fetched by fetch-ms.mjs).
// Outputs (data/): candidate roofs as GeoJSON + summary statistics.
//
// v2 — fixes from the independent audit: stable centroids, relation stitching,
// overlap-based OSM/MS matching (both directions, no double counting), land-use
// exclusions applied to Microsoft footprints too, confidence tiers, kWp labelled DC.

import area from '@turf/area';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve('research/pilot-emek-hefer');
const RAW = path.join(DIR, 'raw');
const OUT = path.join(DIR, 'data');
fs.mkdirSync(OUT, { recursive: true });

const BBOX = { s: 32.3, w: 34.85, n: 32.42, e: 35.0 };
const MIN_AREA = 1000; // m² — "large roof" threshold
const USABLE_RATIO = 0.65; // share of footprint that can hold panels (assumption, same as the app)
const SQM_PER_KWP = 6.5;
const RESIDENTIAL_TAGS = new Set(['apartments', 'detached', 'house', 'semidetached_house', 'residential', 'terrace', 'dormitory', 'bungalow']);
const NON_ROOF_TAGS = new Set(['greenhouse', 'construction', 'ruins', 'roof', 'carport']);
const NON_RESIDENTIAL_TAGS = new Set(['industrial', 'warehouse', 'commercial', 'retail', 'school', 'public', 'office', 'sports_hall', 'farm_auxiliary', 'barn', 'cowshed', 'hangar', 'supermarket', 'college', 'university', 'hospital']);

// ─── geometry helpers ([lng, lat]) ─────────────────────────────────────
const closeRing = (r) => (r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r : [...r, r[0]]);
const bboxOf = (ring) => {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, y] of ring) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; }
  return [a, b, c, d];
};
const inBox = ([x, y], bb) => x >= bb[0] && x <= bb[2] && y >= bb[1] && y <= bb[3];
function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** Area-weighted centroid, computed relative to the first vertex (numerically stable). */
function centroidOf(ring) {
  const [ox, oy] = ring[0];
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const x0 = ring[i][0] - ox, y0 = ring[i][1] - oy, x1 = ring[i + 1][0] - ox, y1 = ring[i + 1][1] - oy;
    const f = x0 * y1 - x1 * y0;
    a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-20) return ring[0];
  return [ox + cx / (3 * a), oy + cy / (3 * a)];
}
const polyArea = (ring) => area({ type: 'Polygon', coordinates: [ring] });
function elongation(ring) {
  const lat0 = ring[0][1];
  const mx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const pts = ring.slice(0, -1).map(([x, y]) => [(x - ring[0][0]) * mx, (y - ring[0][1]) * 111320]);
  const n = pts.length, ax = pts.reduce((s, p) => s + p[0], 0) / n, ay = pts.reduce((s, p) => s + p[1], 0) / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of pts) { sxx += (x - ax) ** 2; syy += (y - ay) ** 2; sxy += (x - ax) * (y - ay); }
  const tr = sxx + syy, det = sxx * syy - sxy * sxy, disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const l2 = tr / 2 - disc;
  return l2 <= 0 ? 99 : Math.sqrt((tr / 2 + disc) / l2);
}
/** Join open way segments into closed rings (OSM multipolygon outers). */
function stitch(segments) {
  const rings = [];
  const pool = segments.map((s) => s.slice());
  while (pool.length) {
    let cur = pool.shift();
    let progress = true;
    while (progress && !(cur[0][0] === cur[cur.length - 1][0] && cur[0][1] === cur[cur.length - 1][1])) {
      progress = false;
      const end = cur[cur.length - 1];
      for (let i = 0; i < pool.length; i++) {
        const s = pool[i];
        if (s[0][0] === end[0] && s[0][1] === end[1]) cur = cur.concat(s.slice(1));
        else if (s[s.length - 1][0] === end[0] && s[s.length - 1][1] === end[1]) cur = cur.concat(s.slice(0, -1).reverse());
        else continue;
        pool.splice(i, 1);
        progress = true;
        break;
      }
    }
    if (cur.length >= 4 && cur[0][0] === cur[cur.length - 1][0] && cur[0][1] === cur[cur.length - 1][1]) rings.push(cur);
  }
  return rings;
}
/** Grid index over polygons' bboxes. */
function gridIndex(items, cell = 0.004) {
  const idx = new Map();
  items.forEach((it, i) => {
    const [x0, y0, x1, y1] = it.bbox;
    for (let gx = Math.floor(x0 / cell); gx <= Math.floor(x1 / cell); gx++)
      for (let gy = Math.floor(y0 / cell); gy <= Math.floor(y1 / cell); gy++) {
        const k = `${gx}:${gy}`;
        if (!idx.has(k)) idx.set(k, []);
        idx.get(k).push(i);
      }
  });
  return (pt) => idx.get(`${Math.floor(pt[0] / cell)}:${Math.floor(pt[1] / cell)}`) ?? [];
}
/** Sample points on a ~3 m grid inside a polygon (capped), for overlap shares. */
function samplePoints(b, max = 600) {
  const [x0, y0, x1, y1] = b.bbox;
  const mx = 111320 * Math.cos((b.centroid[1] * Math.PI) / 180);
  let step = 3;
  while (((x1 - x0) * mx / step) * ((y1 - y0) * 111320 / step) > max * 2.5) step *= 1.5;
  const dx = step / mx, dy = step / 111320, pts = [];
  for (let x = x0 + dx / 2; x < x1; x += dx) for (let y = y0 + dy / 2; y < y1; y += dy) if (pointInRing([x, y], b.ring)) pts.push([x, y]);
  return pts.length ? pts : [b.centroid];
}
const coverShare = (b, list, find, filter = () => true) => {
  const pts = samplePoints(b);
  let hit = 0;
  for (const p of pts) if (find(p).some((i) => filter(list[i]) && inBox(p, list[i].bbox) && pointInRing(p, list[i].ring))) hit++;
  return hit / pts.length;
};
const inPilot = ([x, y]) => y >= BBOX.s && y <= BBOX.n && x >= BBOX.w && x <= BBOX.e;

// ─── load OSM ──────────────────────────────────────────────────────────
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
function ringsOf(el) {
  if (el.type === 'way' && el.geometry?.length >= 4) return [closeRing(el.geometry.map((p) => [p.lon, p.lat]))];
  if (el.type === 'relation') {
    const outers = (el.members ?? []).filter((m) => m.role === 'outer' && m.geometry?.length >= 2).map((m) => m.geometry.map((p) => [p.lon, p.lat]));
    return stitch(outers);
  }
  return [];
}

const landuse = [];
for (const el of readJson('osm-landuse.json').elements) for (const ring of ringsOf(el)) landuse.push({ type: el.tags.landuse, ring, bbox: bboxOf(ring) });
const LANDUSE_PRIORITY = ['military', 'industrial', 'commercial', 'retail', 'farmyard', 'greenhouse_horticulture', 'residential', 'farmland'];
const findLanduse = gridIndex(landuse, 0.01);
const landuseAt = (pt) => {
  const hits = findLanduse(pt).map((i) => landuse[i]).filter((l) => inBox(pt, l.bbox) && pointInRing(pt, l.ring)).map((l) => l.type);
  return LANDUSE_PRIORITY.find((t) => hits.includes(t)) ?? 'unmapped';
};

const osm = [];
let osmRelationsUsed = 0;
for (const el of readJson('osm-buildings.json').elements) {
  const rings = ringsOf(el);
  if (!rings.length) continue;
  if (el.type === 'relation') osmRelationsUsed++;
  const ring = rings.sort((a, b) => polyArea(b) - polyArea(a))[0];
  const c = centroidOf(ring);
  if (!inPilot(c)) continue;
  osm.push({ source: 'osm', id: `${el.type}/${el.id}`, tag: el.tags?.building ?? 'yes', name: el.tags?.name ?? null, ring, bbox: bboxOf(ring), centroid: c, area: polyArea(ring) });
}

const ms = [];
for (const f of fs.readdirSync(RAW).filter((x) => /^ms-.*\.geojsonl$/.test(x))) {
  for (const line of fs.readFileSync(path.join(RAW, f), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const g = JSON.parse(line).geometry;
    if (g?.type !== 'Polygon') continue;
    const ring = closeRing(g.coordinates[0]);
    const c = centroidOf(ring);
    if (!inPilot(c)) continue;
    ms.push({ source: 'ms', id: `ms/${ms.length}`, tag: 'yes', name: null, ring, bbox: bboxOf(ring), centroid: c, area: polyArea(ring) });
  }
}
const findOsm = gridIndex(osm);
const findMs = gridIndex(ms);

const solar = [];
for (const el of readJson('osm-solar.json').elements) {
  if (el.type === 'node') solar.push({ id: `node/${el.id}`, ring: null, centroid: [el.lon, el.lat], tags: el.tags });
  else for (const ring of ringsOf(el)) solar.push({ id: `${el.type}/${el.id}`, ring, centroid: centroidOf(ring), tags: el.tags });
}

let yieldKwhPerKwp = 1650;
let pvgis = { used: false };
try {
  const url = 'https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=32.36&lon=34.92&peakpower=1&loss=14&optimalangles=1&outputformat=json';
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (res.ok) {
    const j = await res.json();
    const ey = j?.outputs?.totals?.fixed?.E_y;
    if (ey > 0) {
      yieldKwhPerKwp = Math.round(ey);
      pvgis = { used: true, url, E_y: ey, note: 'optimal angles, free-standing, 14% losses — optimistic for roof-following arrays' };
      fs.writeFileSync(path.join(RAW, 'pvgis-response.json'), JSON.stringify(j));
    }
  }
} catch {
  /* keep default, recorded below */
}

// ─── match & classify ──────────────────────────────────────────────────
const isOsmCandidate = (b) => b.area >= MIN_AREA;
const records = [];
for (const b of osm.filter(isOsmCandidate)) {
  const msShare = coverShare(b, ms, findMs);
  records.push({ b, source: msShare >= 0.3 ? 'both' : 'osm_only', msShare });
}
let msDroppedAsDuplicate = 0;
let msMergedSmallOsm = 0;
for (const b of ms.filter((m) => m.area >= MIN_AREA)) {
  const shareByOsmCandidates = coverShare(b, osm, findOsm, isOsmCandidate);
  if (shareByOsmCandidates >= 0.3) { msDroppedAsDuplicate++; continue; } // already represented by an OSM candidate
  const shareByAnyOsm = coverShare(b, osm, findOsm);
  if (shareByAnyOsm >= 0.3) msMergedSmallOsm++;
  records.push({ b, source: shareByAnyOsm >= 0.3 ? 'ms_merged' : 'ms_only', msShare: 1 });
}

const stats = {
  version: 2,
  pilot: { name: 'אזור עמק חפר (מלבן פיילוט, כולל חלק מנתניה וקדימה)', bbox: BBOX, areaKm2: 188.4 },
  assumptions: { MIN_AREA, USABLE_RATIO, SQM_PER_KWP, yieldKwhPerKwp, pvgis, capacityUnit: 'kWp DC' },
  osm: { buildings: osm.length, relationsUsed: osmRelationsUsed, genericTagShare: Math.round((osm.filter((b) => b.tag === 'yes').length / osm.length) * 1000) / 10, mappedSolarFeatures: solar.length },
  ms: { buildings: ms.length, msDroppedAsDuplicate, msMergedSmallOsm },
  raw: { largeRoofs: records.length },
  excluded: {},
  candidates: { total: 0, byTier: { A: 0, B: 0, C: 0 }, bySource: {}, byLanduse: {} },
  totals: { roofAreaSqm: 0, usableSqm: 0, kWp: 0, mwhYear: 0 },
  totalsTierA: { roofAreaSqm: 0, kWp: 0 },
};

const features = [];
for (const { b, source, msShare } of records) {
  const lu = landuseAt(b.centroid);
  let excluded = null;
  if (RESIDENTIAL_TAGS.has(b.tag)) excluded = 'residential building tag';
  else if (NON_ROOF_TAGS.has(b.tag)) excluded = `building=${b.tag}`;
  else if (lu === 'military') excluded = 'military area';
  else if (lu === 'greenhouse_horticulture' && source !== 'both' && !NON_RESIDENTIAL_TAGS.has(b.tag)) excluded = 'greenhouse area (likely greenhouse)';
  else if (lu === 'residential' && !NON_RESIDENTIAL_TAGS.has(b.tag)) excluded = 'residential area';
  if (excluded) { stats.excluded[excluded] = (stats.excluded[excluded] ?? 0) + 1; continue; }

  // Confidence tier: A = both sources agree, in an industrial/commercial/farmyard zone or with a non-residential tag;
  // B = both sources agree elsewhere, or one source in an industrial/commercial/farmyard zone; C = the rest.
  const strongZone = ['industrial', 'commercial', 'retail', 'farmyard'].includes(lu) || NON_RESIDENTIAL_TAGS.has(b.tag);
  const tier = source === 'both' && strongZone ? 'A' : source === 'both' || strongZone ? 'B' : 'C';
  const usable = b.area * USABLE_RATIO;
  const kWp = usable / SQM_PER_KWP;
  const hasMappedSolar = solar.some((s) => inBox(s.centroid, b.bbox) && pointInRing(s.centroid, b.ring));

  stats.candidates.total++;
  stats.candidates.byTier[tier]++;
  stats.candidates.bySource[source] = (stats.candidates.bySource[source] ?? 0) + 1;
  stats.candidates.byLanduse[lu] = (stats.candidates.byLanduse[lu] ?? 0) + 1;
  stats.totals.roofAreaSqm += b.area; stats.totals.usableSqm += usable; stats.totals.kWp += kWp; stats.totals.mwhYear += (kWp * yieldKwhPerKwp) / 1000;
  if (tier === 'A') { stats.totalsTierA.roofAreaSqm += b.area; stats.totalsTierA.kWp += kWp; }

  features.push({
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [b.ring.map(([x, y]) => [Number(x.toFixed(7)), Number(y.toFixed(7))])] },
    properties: {
      id: b.id, source, tier, tag: b.tag, landuse: lu,
      areaSqm: Math.round(b.area), usableSqm: Math.round(usable), kWp: Math.round(kWp), mwhYear: Math.round((kWp * yieldKwhPerKwp) / 1000),
      msShare: Math.round(msShare * 100) / 100, elongation: Math.round(elongation(b.ring) * 10) / 10, mappedSolar: hasMappedSolar,
      lat: Number(b.centroid[1].toFixed(6)), lng: Number(b.centroid[0].toFixed(6)),
    },
  });
}
for (const o of [stats.totals, stats.totalsTierA]) for (const k of Object.keys(o)) o[k] = Math.round(o[k]);

// Photo review of a stratified random sample (36 roofs, v1 candidate set) — consensus of three
// reviewers (two blind). Recorded here so the map can show measured precision next to raw counts.
stats.photoReview = {
  sampleSize: 36,
  reviewers: 3,
  interRaterAgreementBlind: '33/36',
  consensus: { good_bare_roof: 4, solar_partial: 4, greenhouse: 11, outline_wrong: 7, solar_full: 3, residential: 3, unclear_or_no_majority: 4 },
  note: 'v1 set; Microsoft-only roofs in farm areas were 11/12 greenhouses. Real opportunities concentrated where both sources agree.',
};

features.sort((a, b) => b.properties.areaSqm - a.properties.areaSqm);
const fc = (f) => ({ type: 'FeatureCollection', features: f });
const solarFc = fc(solar.map((s) => ({ type: 'Feature', geometry: s.ring ? { type: 'Polygon', coordinates: [s.ring] } : { type: 'Point', coordinates: s.centroid }, properties: { id: s.id } })));
const landuseFc = fc(landuse.filter((l) => ['industrial', 'commercial', 'retail', 'farmyard', 'greenhouse_horticulture'].includes(l.type)).map((l) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [l.ring] }, properties: { landuse: l.type } })));
fs.writeFileSync(path.join(OUT, 'candidates.geojson'), JSON.stringify(fc(features)));
fs.writeFileSync(path.join(OUT, 'solar.geojson'), JSON.stringify(solarFc));
fs.writeFileSync(path.join(OUT, 'landuse.geojson'), JSON.stringify(landuseFc));
fs.writeFileSync(path.join(OUT, 'stats.json'), JSON.stringify(stats, null, 2));
fs.writeFileSync(path.join(OUT, 'data.js'), `window.PILOT = ${JSON.stringify({ stats, candidates: fc(features), solar: solarFc, landuse: landuseFc })};\n`);
console.log(JSON.stringify(stats, null, 2));
