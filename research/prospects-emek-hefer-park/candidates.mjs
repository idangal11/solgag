// Business-prospect pilot, step 1–2: candidate roofs + address matching for the
// Emek Hefer Industrial Park (OSM way 31978862).
// Run from the project root:  node research/prospects-emek-hefer-park/candidates.mjs [--min-area=1000] [--max=50] [--no-nominatim]
//
// Inputs
//   raw/park-polygon.json                         park boundary (OSM, ODbL)
//   raw/osm-park-v2.json                          OSM buildings, addresses, POIs, streets (fetch-osm.mjs)
//   ../pilot-emek-hefer/raw/ms-122112223.geojsonl Microsoft Global ML Building Footprints (CDLA-Permissive-2.0)
//   ../pilot-emek-hefer/raw/osm-solar.json        OSM mapped solar (existing PV flag)
// Output
//   data/roofs.json  — one record per candidate roof with building- and address-match evidence.
//
// Roof geometry and area come only from the Microsoft footprints (licensed for
// extraction and processing). No imagery is read or traced. OSM is used as
// corroborating evidence (building match, addresses, named businesses).

import area from '@turf/area';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const DIR = path.resolve('research/prospects-emek-hefer-park');
const RAW = path.join(DIR, 'raw');
const OUT = path.join(DIR, 'data');
const MS_FILE = path.resolve('research/pilot-emek-hefer/raw/ms-122112223.geojsonl');
const SOLAR_FILE = path.resolve('research/pilot-emek-hefer/raw/osm-solar.json');
fs.mkdirSync(OUT, { recursive: true });

const arg = (name, def) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? Number(a.split('=')[1]) : def;
};
const MIN_AREA = arg('min-area', 1000);
const MAX_ROOFS = arg('max', 50);
const USE_NOMINATIM = !process.argv.includes('--no-nominatim');
const USABLE_RATIO = 0.65; // same assumption as the app calculator
const SQM_PER_KWP = 6.5;
const UA = 'SolGag-research-pilot/0.1 (internal feasibility study; low volume)';

// ─── geometry helpers ([lng, lat]) ─────────────────────────────────────────
const closeRing = (r) => (r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1] ? r : [...r, r[0]]);
const bboxOf = (ring) => {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, y] of ring) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; }
  return [a, b, c, d];
};
const boxesTouch = (p, q, pad = 0) => p[0] - pad <= q[2] && q[0] - pad <= p[2] && p[1] - pad <= q[3] && q[1] - pad <= p[3];
function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
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
// Local metric projection around the park (equirectangular; error < 0.1% at this scale).
const LAT0 = 32.40;
const MX = 111320 * Math.cos((LAT0 * Math.PI) / 180);
const MY = 110574;
const toM = ([x, y]) => [x * MX, y * MY];
function segDist(p, a, b) {
  const [px, py] = toM(p), [ax, ay] = toM(a), [bx, by] = toM(b);
  const dx = bx - ax, dy = by - ay;
  const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
/** Distance in metres from a point to a polygon (0 when inside). */
function pointPolyDist(p, ring) {
  if (pointInRing(p, ring)) return 0;
  let d = Infinity;
  for (let i = 0; i < ring.length - 1; i++) d = Math.min(d, segDist(p, ring[i], ring[i + 1]));
  return d;
}
/** Minimum distance in metres between a polygon and a polyline. */
function polyLineDist(ring, line) {
  let d = Infinity;
  for (const v of ring) for (let i = 0; i < line.length - 1; i++) d = Math.min(d, segDist(v, line[i], line[i + 1]));
  for (const v of line) for (let i = 0; i < ring.length - 1; i++) d = Math.min(d, segDist(v, ring[i], ring[i + 1]));
  return d;
}
/** Intersection area (m²) of two polygons by 1.5 m grid sampling. */
function overlapArea(a, b) {
  const ba = bboxOf(a), bb = bboxOf(b);
  const box = [Math.max(ba[0], bb[0]), Math.max(ba[1], bb[1]), Math.min(ba[2], bb[2]), Math.min(ba[3], bb[3])];
  if (box[0] >= box[2] || box[1] >= box[3]) return 0;
  const step = 1.5;
  const sx = step / MX, sy = step / MY;
  let n = 0;
  for (let x = box[0] + sx / 2; x < box[2]; x += sx) for (let y = box[1] + sy / 2; y < box[3]; y += sy) if (pointInRing([x, y], a) && pointInRing([x, y], b)) n++;
  return n * step * step;
}
const r6 = (n) => Math.round(n * 1e6) / 1e6;

// ─── inputs ────────────────────────────────────────────────────────────────
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
const parkWay = readJson(path.join(RAW, 'park-polygon.json')); // geometry only (its saved name tags are mis-encoded)
const park = closeRing(parkWay.geometry.map((g) => [g.lon, g.lat]));
const parkBox = bboxOf(park);
const osm = JSON.parse(fs.readFileSync(path.join(RAW, 'osm-park-v2.json'), 'utf8'));

const osmBuildings = [];
const osmPoints = []; // addressed or named nodes
const osmStreets = [];
const osmLanduse = [];
for (const e of osm.elements) {
  const t = e.tags ?? {};
  if (e.type === 'node') {
    if (t.name || t['addr:housenumber']) osmPoints.push({ id: `node/${e.id}`, at: [e.lon, e.lat], tags: t });
  } else if (e.type === 'way' && e.geometry) {
    const line = e.geometry.map((g) => [g.lon, g.lat]);
    // Through-roads (Route 4 etc.) are not postal streets for buildings in the park.
    if (t.highway && t.name && !/^(motorway|trunk)(_link)?$/.test(t.highway)) osmStreets.push({ id: `way/${e.id}`, name: t['name:he'] || t.name, line, tags: t });
    const closed = line.length > 3 && line[0][0] === line.at(-1)[0] && line[0][1] === line.at(-1)[1];
    if (!closed) continue;
    if (t.building) osmBuildings.push({ id: `way/${e.id}`, ring: line, bbox: bboxOf(line), area: polyArea(line), tags: t });
    else if (t.landuse) osmLanduse.push({ id: `way/${e.id}`, ring: line, tags: t });
    else if (t.name) osmPoints.push({ id: `way/${e.id}`, at: centroidOf(line), ring: line, tags: t });
  } else if (e.type === 'relation' && t.building && e.members) {
    // Multipolygon buildings: use each closed outer member as a ring.
    for (const m of e.members) {
      if (m.role !== 'outer' || !m.geometry) continue;
      const ring = m.geometry.map((g) => [g.lon, g.lat]);
      if (ring.length > 3 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]) {
        osmBuildings.push({ id: `relation/${e.id}`, ring, bbox: bboxOf(ring), area: polyArea(ring), tags: t });
      }
    }
  }
}
let solarRings = [];
if (fs.existsSync(SOLAR_FILE)) {
  const solar = JSON.parse(fs.readFileSync(SOLAR_FILE, 'utf8'));
  for (const e of solar.elements ?? []) {
    if (e.type === 'way' && e.geometry) solarRings.push({ id: `way/${e.id}`, ring: e.geometry.map((g) => [g.lon, g.lat]) });
    if (e.type === 'node') solarRings.push({ id: `node/${e.id}`, at: [e.lon, e.lat] });
  }
}
console.log(`OSM: ${osmBuildings.length} building rings, ${osmPoints.length} named/addressed points, ${osmStreets.length} named street segments, ${osmLanduse.length} landuse; solar features ${solarRings.length}`);

// ─── Microsoft footprints inside the park ──────────────────────────────────
const footprints = [];
let scanned = 0;
const rl = readline.createInterface({ input: fs.createReadStream(MS_FILE), crlfDelay: Infinity });
for await (const line of rl) {
  if (!line.trim()) continue;
  scanned++;
  // Cheap pre-filter on the first coordinate before parsing the whole feature.
  const m = /\[\s*\[\s*\[\s*([\d.]+)\s*,\s*([\d.]+)/.exec(line);
  if (!m) continue;
  const x = Number(m[1]), y = Number(m[2]);
  if (x < parkBox[0] - 0.003 || x > parkBox[2] + 0.003 || y < parkBox[1] - 0.003 || y > parkBox[3] + 0.003) continue;
  const f = JSON.parse(line);
  const ring = closeRing(f.geometry.coordinates[0]);
  const c = centroidOf(ring);
  if (!pointInRing(c, park)) continue;
  footprints.push({ ring, centroid: c, area: polyArea(ring), props: f.properties ?? {} });
}
console.log(`Microsoft: scanned ${scanned.toLocaleString()} footprints, ${footprints.length} with centroid inside the park`);

// ─── evaluate each footprint ───────────────────────────────────────────────
const EXCLUDE_BUILDING = new Set(['greenhouse', 'roof', 'carport', 'construction', 'ruins']);
const BUSINESS_KEYS = ['shop', 'office', 'craft', 'amenity', 'industrial', 'company', 'tourism', 'healthcare'];
const excluded = [];
const evaluated = [];
for (const fp of footprints.filter((f) => f.area >= MIN_AREA)) {
  const box = bboxOf(fp.ring);
  // OSM building corroboration (overlap both ways).
  const matches = [];
  for (const b of osmBuildings) {
    if (!boxesTouch(box, b.bbox)) continue;
    const inter = overlapArea(fp.ring, b.ring);
    if (inter <= 0) continue;
    const iou = inter / (fp.area + b.area - inter);
    matches.push({ osmId: b.id, iou: Math.round(iou * 100) / 100, shareOfRoof: Math.round((inter / fp.area) * 100) / 100, osmAreaM2: Math.round(b.area), tags: b.tags });
  }
  matches.sort((a, b) => b.shareOfRoof - a.shareOfRoof);
  const badTag = matches.find((mm) => EXCLUDE_BUILDING.has(mm.tags.building) && mm.shareOfRoof > 0.3);
  const lu = osmLanduse.find((l) => pointInRing(fp.centroid, l.ring) && /greenhouse|construction|brownfield/.test(l.tags.landuse));
  if (badTag || lu) {
    excluded.push({ centroid: fp.centroid, areaM2: Math.round(fp.area), reason: badTag ? `OSM building=${badTag.tags.building}` : `OSM landuse=${lu.tags.landuse}` });
    continue;
  }
  // Building-match confidence: does an independent source (OSM) agree that a building of ~this size is here?
  const best = matches[0];
  const iouBest = Math.max(0, ...matches.map((mm) => mm.iou));
  const covered = matches.reduce((s, mm) => s + mm.shareOfRoof, 0);
  let buildingConfidence = 'low';
  const basis = [`Microsoft ML footprint${fp.props.confidence > 0 ? ` (model confidence ${fp.props.confidence.toFixed(2)})` : ''}`];
  if (iouBest >= 0.6) { buildingConfidence = 'high'; basis.push(`OSM building ${best.osmId} overlaps closely (IoU ${iouBest})`); }
  else if (covered >= 0.5) { buildingConfidence = 'medium'; basis.push(`OSM buildings cover ${Math.round(covered * 100)}% of the footprint but outlines differ (best IoU ${iouBest}); may be several buildings or an extension`); }
  else if (matches.length) { buildingConfidence = 'low'; basis.push(`OSM building(s) cover only ${Math.round(covered * 100)}% of the footprint`); }
  else basis.push('no OSM building mapped here; not independently corroborated');

  // Businesses mapped in OSM at or near this building. Outside the footprint the
  // point may belong to a neighbouring building, so it is kept as ambiguous.
  const pois = [];
  for (const p of osmPoints) {
    if (!p.tags.name || !BUSINESS_KEYS.some((k) => p.tags[k])) continue;
    const d = pointPolyDist(p.at, fp.ring);
    if (d > 60) continue;
    pois.push({ osmId: p.id, name: p.tags['name:he'] || p.tags.name, nameEn: p.tags['name:en'] ?? null, kind: BUSINESS_KEYS.map((k) => p.tags[k] && `${k}=${p.tags[k]}`).filter(Boolean).join(', '), website: p.tags.website ?? p.tags['contact:website'] ?? null, phone: p.tags.phone ?? p.tags['contact:phone'] ?? null, email: p.tags.email ?? p.tags['contact:email'] ?? null, address: p.tags['addr:street'] ? `${p.tags['addr:street']} ${p.tags['addr:housenumber'] ?? ''}`.trim() : null, distanceM: Math.round(d), relation: d === 0 ? 'inside_footprint' : 'nearby_ambiguous' });
  }
  for (const mm of matches) {
    const t = mm.tags;
    if (t.name && mm.shareOfRoof > 0.2) pois.push({ osmId: mm.osmId, name: t['name:he'] || t.name, nameEn: t['name:en'] ?? null, kind: ['building=' + t.building, ...BUSINESS_KEYS.map((k) => t[k] && `${k}=${t[k]}`)].filter(Boolean).join(', '), website: t.website ?? t['contact:website'] ?? null, phone: t.phone ?? t['contact:phone'] ?? null, email: t.email ?? t['contact:email'] ?? null, distanceM: 0, relation: 'named_osm_building_overlapping' });
  }

  // Address candidates.
  const addresses = [];
  for (const mm of matches) {
    const t = mm.tags;
    if (t['addr:street'] && mm.shareOfRoof > 0.2) {
      addresses.push({ street: t['addr:street'], houseNumber: t['addr:housenumber'] ?? null, locality: t['addr:city'] ?? 'פארק תעשיות עמק חפר', source: `OpenStreetMap ${mm.osmId}`, sourceUrl: `https://www.openstreetmap.org/${mm.osmId}`, method: 'addr:* tags on the OSM building overlapping this footprint', distanceM: 0, confidence: t['addr:housenumber'] && mm.iou >= 0.5 ? 'high' : 'medium' });
    }
  }
  for (const p of osmPoints) {
    if (!p.tags['addr:street']) continue;
    const d = pointPolyDist(p.at, fp.ring);
    if (d > 15) continue;
    addresses.push({ street: p.tags['addr:street'], houseNumber: p.tags['addr:housenumber'] ?? null, locality: p.tags['addr:city'] ?? 'פארק תעשיות עמק חפר', source: `OpenStreetMap ${p.id}`, sourceUrl: `https://www.openstreetmap.org/${p.id}`, method: d === 0 ? 'OSM address point inside the footprint' : `OSM address point ${Math.round(d)} m from the footprint`, distanceM: Math.round(d), confidence: d === 0 && p.tags['addr:housenumber'] ? 'high' : 'medium' });
  }
  // Nearest named streets (street-level only; house numbers are never guessed).
  const streetDist = new Map();
  for (const s of osmStreets) {
    const d = polyLineDist(fp.ring, s.line);
    if (!streetDist.has(s.name) || d < streetDist.get(s.name).d) streetDist.set(s.name, { d, id: s.id });
  }
  const near = [...streetDist.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => a.d - b.d);
  for (const [i, s] of near.entries()) {
    if (i > 0 && (s.d > 45 || s.d > near[0].d + 25)) break;
    addresses.push({ street: s.name, houseNumber: null, locality: 'פארק תעשיות עמק חפר', source: `OpenStreetMap ${s.id}`, sourceUrl: `https://www.openstreetmap.org/${s.id}`, method: `nearest named street (${Math.round(s.d)} m from the footprint); street-level only, house number unknown`, distanceM: Math.round(s.d), confidence: 'low' });
    if (i >= 1) break;
  }

  // Existing PV mapped in OSM on this roof?
  const solar = solarRings.filter((s) => (s.ring ? overlapArea(fp.ring, closeRing(s.ring)) > 20 : pointInRing(s.at, fp.ring))).map((s) => s.id);

  evaluated.push({ fp, matches, buildingConfidence, basis, pois, addresses, solar });
}
evaluated.sort((a, b) => b.fp.area - a.fp.area);
const chosen = evaluated.slice(0, MAX_ROOFS);
console.log(`≥${MIN_AREA} m²: ${evaluated.length} candidates (${excluded.length} excluded), keeping ${chosen.length}`);

// ─── Nominatim reverse geocoding (≤1 request/second, cached) ───────────────
const cacheFile = path.join(RAW, 'nominatim-reverse.json');
const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
if (USE_NOMINATIM) {
  for (const e of chosen) {
    const [lon, lat] = e.fp.centroid;
    const key = `${lat.toFixed(6)},${lon.toFixed(6)}`;
    if (!cache[key]) {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=he&lat=${lat}&lon=${lon}`;
      const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://solgag-mu.vercel.app' } });
      cache[key] = res.ok ? await res.json() : { error: res.status };
      fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 1));
      await new Promise((r) => setTimeout(r, 1100));
    }
    const n = cache[key];
    if (n?.address?.road) {
      // Nominatim returns the nearest addressed object, which may be a neighbouring
      // building. Its house number is only kept when that object lies on this roof.
      const objDist = n.lat ? pointPolyDist([Number(n.lon), Number(n.lat)], e.fp.ring) : null;
      const onRoof = objDist === 0;
      const hn = n.address.house_number && onRoof ? n.address.house_number : null;
      const note = n.address.house_number && !onRoof ? `; nearest numbered object (${n.address.road} ${n.address.house_number}) is ${Math.round(objDist)} m away on another building, number not used` : '';
      e.addresses.push({ street: n.address.road, houseNumber: hn, locality: n.address.village || n.address.town || n.address.hamlet || n.address.city || n.address.county || null, source: `Nominatim reverse → ${n.osm_type}/${n.osm_id}`, sourceUrl: `https://www.openstreetmap.org/${n.osm_type}/${n.osm_id}`, method: (hn ? 'Nominatim reverse geocode: the returned addressed object lies on this roof' : 'Nominatim reverse geocode of the roof centroid (street-level)') + note, distanceM: objDist == null ? null : Math.round(objDist), confidence: hn ? 'medium' : 'low' });
    }
  }
}

// ─── output ────────────────────────────────────────────────────────────────
const RANK = { high: 3, medium: 2, low: 1 };
const roofs = chosen.map((e, i) => {
  const [lon, lat] = e.fp.centroid;
  // De-duplicate address candidates by street+number, keep the strongest evidence first.
  const seen = new Map();
  for (const a of e.addresses.sort((x, y) => RANK[y.confidence] - RANK[x.confidence] || (y.houseNumber ? 1 : 0) - (x.houseNumber ? 1 : 0))) {
    const k = `${a.street}|${a.houseNumber ?? ''}`;
    if (!seen.has(k)) seen.set(k, a);
    else seen.get(k).corroboratedBy = [...(seen.get(k).corroboratedBy ?? []), a.source];
  }
  const addressCandidates = [...seen.values()];
  const usable = e.fp.area * USABLE_RATIO;
  return {
    id: `EHP-${String(i + 1).padStart(2, '0')}`,
    sourceKey: `msbf:${lat.toFixed(6)},${lon.toFixed(6)}`,
    geometry: { type: 'Polygon', coordinates: [e.fp.ring.map(([x, y]) => [r6(x), r6(y)])] },
    centroid: [r6(lon), r6(lat)],
    areaM2: Math.round(e.fp.area),
    building: {
      source: 'Microsoft Global ML Building Footprints',
      sourceUrl: 'https://github.com/microsoft/GlobalMLBuildingFootprints',
      license: 'CDLA-Permissive-2.0',
      modelConfidence: e.fp.props.confidence > 0 ? Math.round(e.fp.props.confidence * 1000) / 1000 : null,
      confidence: e.buildingConfidence,
      basis: e.basis,
      osmMatches: e.matches.map(({ tags, ...m }) => ({ ...m, building: tags.building, name: tags.name ?? null })),
    },
    addressCandidates,
    address: addressCandidates[0] ?? null,
    osmBusinesses: e.pois,
    suitability: {
      status: 'preliminary_unverified',
      usableAreaM2: Math.round(usable),
      estKwpDc: Math.round(usable / SQM_PER_KWP),
      assumptions: `Usable share ${USABLE_RATIO * 100}% of footprint, ${SQM_PER_KWP} m²/kWp. Roof type, structure, shading, existing PV, ownership and grid capacity not checked.`,
      existingPvMappedInOsm: e.solar,
    },
  };
});
fs.writeFileSync(path.join(OUT, 'roofs.json'), JSON.stringify({ generatedAt: new Date().toISOString(), park: { name: 'פארק תעשיות עמק חפר', osm: 'way/31978862' }, minAreaM2: MIN_AREA, excluded, roofs }, null, 1));
const tally = (f) => roofs.reduce((m, r) => ((m[f(r)] = (m[f(r)] ?? 0) + 1), m), {});
console.log('building confidence', tally((r) => r.building.confidence));
console.log('best address', tally((r) => (r.address ? `${r.address.confidence}${r.address.houseNumber ? '+number' : ''}` : 'none')));
console.log('roofs with OSM business', roofs.filter((r) => r.osmBusinesses.length).length);
console.log('area range', roofs.at(-1)?.areaM2, '–', roofs[0]?.areaM2, 'm²; total', roofs.reduce((s, r) => s + r.areaM2, 0), 'm²');
