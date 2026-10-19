// Israel-wide scale of large roofs in the Microsoft Global ML Building Footprints dataset,
// plus a national Phase 1 review-workload estimate scaled from the Emek Hefer pilot.
//
// Run from the project root:
//   node research/israel-scale/count.mjs                  (download missing tiles, then count)
//   node research/israel-scale/count.mjs --download-only
//   node research/israel-scale/count.mjs --skip-download  (count what is already in raw/)
//
// Inputs:  Microsoft index (dataset-links.csv, binary-searched with HTTP range requests, as in
//          research/pilot-emek-hefer/fetch-ms.mjs) → every row whose Location is exactly "Israel",
//          downloaded gzipped to research/israel-scale/raw/ (git-ignored) and streamed through gunzip.
//          research/pilot-emek-hefer/data/candidates.geojson for the pilot tier ratios.
// Output:  research/israel-scale/summary.json
//
// Areas use @turf/area (same as the pilot). Centroids use the pilot's area-weighted centroid, so
// the pilot-bbox calibration count is directly comparable with audit/recompute-core.json.

import area from '@turf/area';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const INDEX = 'https://minedbuildings.z5.web.core.windows.net/global-buildings/dataset-links.csv';
// Newer release on Microsoft's new host (README update log 2026-07-24 / 2026-08-13). Compared by index metadata only.
const NEW_INDEX = 'https://bfppub.blob.core.windows.net/%24web/2026-08-13/dataset-links.csv';
const DIR = path.resolve('research/israel-scale');
const RAW = path.join(DIR, 'raw');
const PILOT_CANDIDATES = path.resolve('research/pilot-emek-hefer/data/candidates.geojson');
const COUNTRY = 'Israel';
// Separate "Location" entries the index has for neighbouring / disputed areas (metadata only, not downloaded).
const NEIGHBOURS = ['WestBank', 'GazaStrip', 'GolanHeights', 'GolanHeightsSubdistrict'];
const SKIP_DOWNLOAD = process.argv.includes('--skip-download');
const DOWNLOAD_ONLY = process.argv.includes('--download-only');
fs.mkdirSync(RAW, { recursive: true });

// ─── pilot constants (research/pilot-emek-hefer) ───────────────────────
const PILOT_BBOX = { s: 32.3, w: 34.85, n: 32.42, e: 35.0 };
const PILOT = {
  msGe1000Audit: 2293, // audit/recompute-core.json msGe1000_ellipsoid (MS footprints ≥1000 m², centroid in bbox)
  rawLargeRoofs: 2482, // OSM ∪ MS roofs ≥1000 m² (stats.json raw.largeRoofs)
  candidates: 992, // after residential / greenhouse / military exclusions
  tierA: 238,
  tierB: 231,
  tierC: 523,
  tierAReview: { n: 12, bare: 5, partial: 1, fullPv: 2, wrongOutline: 3, unclear: 1 },
};
const USABLE_RATIO = 0.65;
const SQM_PER_KWP = 6.5;
const SECONDS_PER_ROOF = [5, 10, 20];
const PRODUCTIVE_HOURS_PER_DAY = 6;
// Precision (bare + partial share) for tiers the pilot did not measure separately — ASSUMPTIONS.
const PRECISION_ASSUMED = {
  B: { central: 0.2, low: 0.1, high: 0.3 },
  C: { central: 0.05, low: 0.02, high: 0.1 },
  excluded: { central: 0.02, low: 0.0, high: 0.05 }, // roofs the land-use filter removes (residential/greenhouse/military)
};
// Regional-transfer uncertainty on scaled counts (judgement, see notes).
const TRANSFER_LOW = 0.5;
const TRANSFER_HIGH = 1.5;
// Imagery tile loads per reviewed roof (256-px raster tiles; see notes).
const TILES_PER_ROOF = { oneView: 24, twoViews: 48 };
// Outline correction instead of rejection: share of wrong outlines (pilot Tier A 3/12) and seconds per fix (assumption).
const OUTLINE_FIX = { share: 0.25, seconds: [60, 120] };
// ArcGIS Location Platform basemap tiles: "2M free then $0.15 per 1,000 tiles" — https://location.arcgis.com/pricing/
// (seen 2026-10-19; whether the 2M allowance resets monthly is not stated on the page → UNVERIFIED).
const ARCGIS = { freeTiles: 2_000_000, usdPer1000: 0.15, source: 'https://location.arcgis.com/pricing/', seen: '2026-10-19' };

// ─── size classes ──────────────────────────────────────────────────────
const CLASSES = ['lt500', '500-1000', '1000-2500', '2500-5000', '5000-10000', '10000+'];
const GE1000 = CLASSES.slice(2);
function classOf(a) {
  if (a < 500) return 'lt500';
  if (a < 1000) return '500-1000';
  if (a < 2500) return '1000-2500';
  if (a < 5000) return '2500-5000';
  if (a < 10000) return '5000-10000';
  return '10000+';
}
const newAgg = () => Object.fromEntries(CLASSES.map((c) => [c, { n: 0, areaSqm: 0 }]));
function add(agg, cls, a) {
  agg[cls].n++;
  agg[cls].areaSqm += a;
}
function finishAgg(agg) {
  const out = {};
  for (const c of CLASSES) out[c] = { n: agg[c].n, areaSqm: Math.round(agg[c].areaSqm) };
  const sum = (cs) => cs.reduce((s, c) => ({ n: s.n + agg[c].n, areaSqm: s.areaSqm + agg[c].areaSqm }), { n: 0, areaSqm: 0 });
  const all = sum(CLASSES);
  const ge500 = sum(CLASSES.slice(1));
  const ge1000 = sum(GE1000);
  out.all = { n: all.n, areaSqm: Math.round(all.areaSqm) };
  out.ge500 = { n: ge500.n, areaSqm: Math.round(ge500.areaSqm) };
  out.ge1000 = { n: ge1000.n, areaSqm: Math.round(ge1000.areaSqm), kWpDcIfAllUsable: Math.round((ge1000.areaSqm * USABLE_RATIO) / SQM_PER_KWP) };
  out.shareGe1000OfAll = all.n ? round(ge1000.n / all.n, 5) : null;
  out.shareGe1000OfGe500 = ge500.n ? round(ge1000.n / ge500.n, 4) : null;
  out.areaShareGe1000OfAll = all.areaSqm ? round(ge1000.areaSqm / all.areaSqm, 4) : null;
  return out;
}
const round = (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d;

// ─── geometry helpers ([lng, lat]) ─────────────────────────────────────
const closeRing = (r) => (r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r : [...r, r[0]]);
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
function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const bboxOf = (ring) => {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, y] of ring) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; }
  return [a, b, c, d];
};
/** Distance in metres from a point to a polyline ring (equirectangular, fine at this scale). */
function distToRingM([x, y], ring) {
  const mx = 111320 * Math.cos((y * Math.PI) / 180), my = 110574;
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const ax = (ring[i][0] - x) * mx, ay = (ring[i][1] - y) * my, bx = (ring[i + 1][0] - x) * mx, by = (ring[i + 1][1] - y) * my;
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
    const px = ax + t * dx, py = ay + t * dy;
    const d = Math.hypot(px, py);
    if (d < best) best = d;
  }
  return best;
}
function quadkey(lat, lng, z) {
  const s = Math.sin((lat * Math.PI) / 180);
  const x = Math.floor(((lng + 180) / 360) * 2 ** z);
  const y = Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z);
  let q = '';
  for (let i = z; i > 0; i--) {
    let d = 0;
    const m = 1 << (i - 1);
    if (x & m) d++;
    if (y & m) d += 2;
    q += d;
  }
  return q;
}
function quadkeyBounds(qk) {
  let x = 0, y = 0;
  for (const ch of qk) { const d = Number(ch); x = (x << 1) | (d & 1); y = (y << 1) | ((d >> 1) & 1); }
  const n = 2 ** qk.length;
  const lat = (yy) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * yy) / n))) * 180) / Math.PI;
  return { s: round(lat(y + 1), 4), w: round((x / n) * 360 - 180, 4), n: round(lat(y), 4), e: round(((x + 1) / n) * 360 - 180, 4) };
}

// ─── approximate 1949 armistice ("Green Line") areas — hand-drawn, ±1–2 km ─────
// Used ONLY to test whether the "Israel" files contain footprints beyond the Green Line.
const REGIONS = {
  westBank: [
    [34.88, 31.42], [34.93, 31.36], [35.05, 31.35], [35.2, 31.36], [35.3, 31.4], [35.4, 31.47], [35.46, 31.49],
    [35.5, 31.65], [35.56, 31.76], [35.55, 31.95], [35.53, 32.1], [35.55, 32.25], [35.57, 32.4], [35.5, 32.43],
    [35.45, 32.5], [35.37, 32.52], [35.27, 32.55], [35.2, 32.55], [35.12, 32.5], [35.07, 32.45], [35.04, 32.38],
    [35.02, 32.31], [35.0, 32.24], [34.965, 32.19], [34.975, 32.14], [34.96, 32.1], [34.985, 32.03], [35.0, 31.96],
    [34.97, 31.89], [34.97, 31.84], [35.03, 31.83], [35.08, 31.82], [35.12, 31.815], [35.17, 31.81], [35.2, 31.8],
    [35.225, 31.787], [35.226, 31.777], [35.225, 31.762], [35.235, 31.745], [35.215, 31.738], [35.19, 31.748],
    [35.16, 31.74], [35.13, 31.725], [35.105, 31.71], [35.05, 31.68], [35.0, 31.66], [34.97, 31.62], [34.95, 31.55],
    [34.92, 31.48], [34.88, 31.42],
  ],
  golan: [
    [35.64, 32.7], [35.66, 32.78], [35.65, 32.88], [35.62, 32.9], [35.63, 33.0], [35.62, 33.1], [35.64, 33.2],
    [35.68, 33.25], [35.75, 33.3], [35.82, 33.4], [35.86, 33.43], [35.92, 33.33], [35.88, 33.2], [35.84, 33.1],
    [35.86, 32.98], [35.88, 32.85], [35.82, 32.75], [35.75, 32.7], [35.64, 32.7],
  ],
  gaza: [
    [34.219, 31.322], [34.267, 31.22], [34.367, 31.291], [34.403, 31.351], [34.49, 31.446], [34.567, 31.54],
    [34.535, 31.59], [34.49, 31.6], [34.4, 31.51], [34.3, 31.42], [34.219, 31.322],
  ],
};
const REGION_BBOX = Object.fromEntries(Object.entries(REGIONS).map(([k, r]) => [k, bboxOf(r)]));
function regionOf(pt) {
  for (const [k, ring] of Object.entries(REGIONS)) {
    const b = REGION_BBOX[k];
    if (pt[0] >= b[0] && pt[0] <= b[2] && pt[1] >= b[1] && pt[1] <= b[3] && pointInRing(pt, ring)) return k;
  }
  return 'israelProper';
}

// Probe boxes (±0.008° ≈ ±0.9 km): direct evidence of what the "Israel" files contain.
const PROBES = [
  ['Tel Aviv (control)', 32.08, 34.78, 'israel'],
  ['Haifa Bay industry (control)', 32.8, 35.05, 'israel'],
  ['Beer Sheva (control)', 31.25, 34.79, 'israel'],
  ['Eilat (control)', 29.56, 34.95, 'israel'],
  ['Kiryat Shmona (control)', 33.21, 35.57, 'israel'],
  ['West Jerusalem centre (control)', 31.785, 35.205, 'israel'],
  ['Mount Scopus (pre-1967 Israeli enclave)', 31.795, 35.245, 'enclave1949'],
  ['East Jerusalem — Old City/Sheikh Jarrah', 31.785, 35.235, 'eastJerusalem'],
  ['East Jerusalem — Silwan/Ras al-Amud', 31.768, 35.24, 'eastJerusalem'],
  ['East Jerusalem — Beit Hanina', 31.83, 35.222, 'eastJerusalem'],
  ['East Jerusalem — Pisgat Zeev', 31.83, 35.245, 'eastJerusalem'],
  ['East Jerusalem — Atarot industrial zone', 31.857, 35.215, 'eastJerusalem'],
  ['East Jerusalem — Gilo', 31.735, 35.19, 'eastJerusalem'],
  ['WB settlement — Ariel', 32.105, 35.175, 'westBank'],
  ['WB settlement — Barkan industrial zone', 32.11, 35.105, 'westBank'],
  ['WB settlement — Maale Adumim', 31.775, 35.3, 'westBank'],
  ['WB settlement — Mishor Adumim industrial zone', 31.792, 35.335, 'westBank'],
  ['WB settlement — Modiin Illit', 31.93, 35.04, 'westBank'],
  ['WB settlement — Beitar Illit', 31.7, 35.118, 'westBank'],
  ['WB settlement — Kiryat Arba', 31.53, 35.12, 'westBank'],
  ['WB Palestinian city — Ramallah', 31.903, 35.205, 'westBank'],
  ['WB Palestinian city — Nablus', 32.222, 35.255, 'westBank'],
  ['WB Palestinian city — Hebron', 31.532, 35.095, 'westBank'],
  ['WB Palestinian city — Jenin', 32.46, 35.3, 'westBank'],
  ['Golan — Katzrin', 32.99, 35.69, 'golan'],
  ['Golan — Majdal Shams', 33.27, 35.77, 'golan'],
  ['Gaza — Gaza City', 31.515, 34.455, 'gaza'],
  ['Gaza — Khan Yunis', 31.345, 34.305, 'gaza'],
].map(([name, lat, lng, kind]) => ({ name, lat, lng, kind, footprints: 0, ge1000: 0 }));
const PROBE_HALF = 0.008;

// ─── index search (HTTP range requests; the CSV is sorted by Location) ───────────
async function range(url, start, end) {
  const res = await fetch(url, { headers: { Range: `bytes=${start}-${end}` } });
  if (res.status !== 206) throw new Error(`range not supported: ${res.status}`);
  return res.text();
}
async function headOf(url) {
  const h = await fetch(url, { method: 'HEAD' });
  return { size: Number(h.headers.get('content-length')), lastModified: h.headers.get('last-modified') };
}
const { size: indexSize, lastModified: indexLastModified } = await headOf(INDEX);
console.log(`index: ${(indexSize / 1e6).toFixed(1)} MB, last-modified ${indexLastModified}`);

async function locationAt(url, size, offset) {
  const chunk = await range(url, offset, Math.min(size - 1, offset + 4096));
  const lines = chunk.split('\n');
  const line = offset === 0 ? lines[1] : lines[1] ?? lines[0];
  return line?.split(',')[0] ?? '';
}
const parseSize = (s) => {
  const m = /^([\d.]+)\s*(B|KB|MB|GB)$/i.exec(s?.trim() ?? '');
  if (!m) return null;
  return Math.round(Number(m[1]) * { B: 1, KB: 1e3, MB: 1e6, GB: 1e9 }[m[2].toUpperCase()]);
};
async function rowsFor(name, url = INDEX, size = indexSize) {
  let lo = 0, hi = size;
  while (hi - lo > 65536) {
    const mid = Math.floor((lo + hi) / 2);
    if ((await locationAt(url, size, mid)).localeCompare(name, 'en') < 0) lo = mid;
    else hi = mid;
  }
  const rows = [];
  let offset = lo;
  let done = false;
  while (!done && offset < size) {
    const chunk = await range(url, offset, Math.min(size - 1, offset + 500_000));
    const lines = chunk.split('\n');
    if (offset + chunk.length < size) lines.pop();
    if (offset !== 0) lines.shift();
    for (const line of lines) {
      const [loc, qk, url, sz, uploadDate] = line.trim().split(',');
      if (loc === name) rows.push({ qk, url, sizeLabel: sz, approxBytes: parseSize(sz), uploadDate });
      else if (rows.length || loc.localeCompare(name, 'en') > 0) { done = true; break; }
    }
    offset += chunk.lastIndexOf('\n') + 1;
  }
  return rows;
}

const rows = await rowsFor(COUNTRY);
console.log(`${COUNTRY}: ${rows.length} tiles, ~${(rows.reduce((s, r) => s + (r.approxBytes ?? 0), 0) / 1e6).toFixed(0)} MB gz`);
const neighbours = {};
for (const name of NEIGHBOURS) {
  const r = await rowsFor(name);
  neighbours[name] = {
    tiles: r.length,
    approxGzMB: round(r.reduce((s, x) => s + (x.approxBytes ?? 0), 0) / 1e6, 1),
    quadkeys: r.map((x) => `${x.qk} (${x.sizeLabel})`),
  };
  console.log(`${name}: ${r.length} tiles, ${neighbours[name].approxGzMB} MB gz`);
}
// Newer release: compare Israel tile sizes (index metadata only — tiles are not downloaded).
let newerRelease = null;
try {
  const h = await headOf(NEW_INDEX);
  const nr = await rowsFor(COUNTRY, NEW_INDEX, h.size);
  const byQk = Object.fromEntries(nr.map((x) => [x.qk, x]));
  const oldSum = rows.reduce((s, x) => s + (x.approxBytes ?? 0), 0);
  const newSum = nr.reduce((s, x) => s + (x.approxBytes ?? 0), 0);
  newerRelease = {
    index: NEW_INDEX,
    lastModified: h.lastModified,
    tiles: nr.length,
    sameQuadkeys: nr.length === rows.length && rows.every((x) => byQk[x.qk]),
    sizeLabelSumOld: oldSum,
    sizeLabelSumNew: newSum,
    sizeChangePct: round(((newSum - oldSum) / oldSum) * 100, 2),
    perTile: rows.map((x) => `${x.qk}: ${x.sizeLabel} → ${byQk[x.qk]?.sizeLabel ?? 'missing'}`),
  };
  console.log(`newer release ${h.lastModified}: ${nr.length} Israel tiles, size change ${newerRelease.sizeChangePct}%`);
} catch (e) {
  newerRelease = { index: NEW_INDEX, error: String(e) };
}

// ─── download (streamed, gzipped as served) ────────────────────────────
const fileFor = (r) => path.join(RAW, `israel-${r.qk}.geojsonl.gz`);
let downloadedBytes = 0;
if (!SKIP_DOWNLOAD) {
  const queue = [...rows];
  async function worker() {
    while (queue.length) {
      const r = queue.shift();
      const dest = fileFor(r);
      const res = await fetch(r.url);
      if (!res.ok) throw new Error(`download ${r.qk}: HTTP ${res.status}`);
      const len = Number(res.headers.get('content-length'));
      if (fs.existsSync(dest) && fs.statSync(dest).size === len) {
        await res.body.cancel();
        console.log(`  have ${r.qk} (${(len / 1e6).toFixed(1)} MB)`);
        continue;
      }
      const tmp = `${dest}.part`;
      await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp));
      const got = fs.statSync(tmp).size;
      if (len && got !== len) throw new Error(`download ${r.qk}: got ${got} of ${len} bytes`);
      fs.renameSync(tmp, dest);
      downloadedBytes += got;
      console.log(`  downloaded ${r.qk} (${(got / 1e6).toFixed(1)} MB)`);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
}
const rawBytes = rows.reduce((s, r) => s + (fs.existsSync(fileFor(r)) ? fs.statSync(fileFor(r)).size : 0), 0);
console.log(`raw/: ${(rawBytes / 1e6).toFixed(1)} MB gz`);
if (DOWNLOAD_ONLY) process.exit(0);

// ─── count ─────────────────────────────────────────────────────────────
const national = newAgg();
const perQk = {};
const LAT_BANDS = { north_gt32_5: newAgg(), center_31_7to32_5: newAgg(), south_lt31_7: newAgg() };
const latHalfDeg = {}; // ≥1000 m² per 0.5° latitude band
const regions = { israelProper: newAgg(), westBank: newAgg(), golan: newAgg(), gaza: newAgg() };
const westBankDeep = newAgg(); // centroid >3 km inside the approximate West Bank outline
const outlineCells = {}; // 0.05° cells of footprints that fall inside the approximate outlines
const pilot = newAgg();
const geomTypes = {};
const conf = { ge1000WithConfidence: 0, ge1000Missing: 0, sum: 0, below0_8: 0 };
const geomGe1000 = { n: 0, vertices: 0, bytes: 0 };
let duplicatesGe500 = 0;
let centroidOutsideFileQuadkey = 0;
let parseErrors = 0;
const seen = new Set();
const largest = [];
const bbox = [Infinity, Infinity, -Infinity, -Infinity];
const t0 = Date.now();

for (const r of rows) {
  const file = fileFor(r);
  if (!fs.existsSync(file)) throw new Error(`missing ${file}`);
  const q = (perQk[r.qk] = { agg: newAgg(), bbox: [Infinity, Infinity, -Infinity, -Infinity], gzBytes: fs.statSync(file).size, uploadDate: r.uploadDate });
  const gunzip = zlib.createGunzip();
  let streamErr = null;
  const input = fs.createReadStream(file).pipe(gunzip);
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  gunzip.on('error', (e) => { streamErr = e; rl.close(); });
  for await (const line of rl) {
    if (!line || line.length < 10) continue;
    let f;
    try { f = JSON.parse(line); } catch { parseErrors++; continue; }
    const g = f.geometry;
    if (!g) { parseErrors++; continue; }
    geomTypes[g.type] = (geomTypes[g.type] ?? 0) + 1;
    const outer = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0][0] : null;
    if (!outer || outer.length < 3) { parseErrors++; continue; }
    const a = area(g);
    const c = centroidOf(closeRing(outer));
    const cls = classOf(a);
    if (a >= 500) {
      const key = `${c[0].toFixed(6)},${c[1].toFixed(6)},${Math.round(a)}`;
      if (seen.has(key)) { duplicatesGe500++; continue; }
      seen.add(key);
    }
    add(national, cls, a);
    add(q.agg, cls, a);
    if (c[0] < q.bbox[0]) q.bbox[0] = c[0]; if (c[1] < q.bbox[1]) q.bbox[1] = c[1];
    if (c[0] > q.bbox[2]) q.bbox[2] = c[0]; if (c[1] > q.bbox[3]) q.bbox[3] = c[1];
    if (quadkey(c[1], c[0], r.qk.length) !== r.qk) centroidOutsideFileQuadkey++;
    add(c[1] > 32.5 ? LAT_BANDS.north_gt32_5 : c[1] >= 31.7 ? LAT_BANDS.center_31_7to32_5 : LAT_BANDS.south_lt31_7, cls, a);
    if (a >= 1000) {
      geomGe1000.n++;
      geomGe1000.vertices += outer.length;
      geomGe1000.bytes += line.length;
      const hb = (Math.floor(c[1] * 2) / 2).toFixed(1);
      latHalfDeg[hb] ??= { n: 0, areaSqm: 0 };
      latHalfDeg[hb].n++;
      latHalfDeg[hb].areaSqm += a;
      const cf = f.properties?.confidence;
      if (typeof cf === 'number' && cf >= 0) { conf.ge1000WithConfidence++; conf.sum += cf; if (cf < 0.8) conf.below0_8++; } else conf.ge1000Missing++;
      if (largest.length < 30 || a > largest[largest.length - 1].areaSqm) {
        largest.push({ areaSqm: Math.round(a), lat: round(c[1], 5), lng: round(c[0], 5), qk: r.qk });
        largest.sort((x, y) => y.areaSqm - x.areaSqm);
        if (largest.length > 30) largest.pop();
      }
    }
    const reg = regionOf(c);
    add(regions[reg], cls, a);
    if (reg !== 'israelProper') {
      const k = `${reg} ${(Math.floor(c[1] * 20) / 20).toFixed(2)}N ${(Math.floor(c[0] * 20) / 20).toFixed(2)}E`;
      outlineCells[k] = (outlineCells[k] ?? 0) + 1;
    }
    if (reg === 'westBank' && distToRingM(c, REGIONS.westBank) > 3000) add(westBankDeep, cls, a);
    if (c[1] >= PILOT_BBOX.s && c[1] <= PILOT_BBOX.n && c[0] >= PILOT_BBOX.w && c[0] <= PILOT_BBOX.e) add(pilot, cls, a);
    for (const p of PROBES) {
      if (Math.abs(c[1] - p.lat) <= PROBE_HALF && Math.abs(c[0] - p.lng) <= PROBE_HALF) {
        p.footprints++;
        if (a >= 1000) p.ge1000++;
        p.maxLng = Math.max(p.maxLng ?? -Infinity, c[0]);
      }
    }
    if (c[0] < bbox[0]) bbox[0] = c[0]; if (c[1] < bbox[1]) bbox[1] = c[1];
    if (c[0] > bbox[2]) bbox[2] = c[0]; if (c[1] > bbox[3]) bbox[3] = c[1];
  }
  if (streamErr) throw streamErr;
  const fin = finishAgg(q.agg);
  console.log(`  ${r.qk}: ${fin.all.n} footprints, ${fin.ge1000.n} ≥1000 m² (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

// ─── pilot calibration ────────────────────────────────────────────────
const pilotFin = finishAgg(pilot);
const cand = JSON.parse(fs.readFileSync(PILOT_CANDIDATES, 'utf8')).features.map((f) => f.properties);
const tierByClass = Object.fromEntries(GE1000.map((c) => [c, { A: 0, B: 0, C: 0 }]));
const tierArea = { A: 0, B: 0, C: 0 };
const tierN = { A: 0, B: 0, C: 0 };
for (const p of cand) {
  tierByClass[classOf(p.areaSqm)][p.tier]++;
  tierArea[p.tier] += p.areaSqm;
  tierN[p.tier]++;
}
const meanTierArea = Object.fromEntries(Object.keys(tierArea).map((t) => [t, Math.round(tierArea[t] / tierN[t])]));
const M_p = pilotFin.ge1000.n;
const flatRatio = {
  rawLargeRoofs: PILOT.rawLargeRoofs / M_p,
  candidates: PILOT.candidates / M_p,
  A: PILOT.tierA / M_p,
  B: PILOT.tierB / M_p,
  C: PILOT.tierC / M_p,
};
const classRatio = Object.fromEntries(
  GE1000.map((c) => {
    const n = pilot[c].n;
    return [c, { pilotMs: n, A: n ? tierByClass[c].A / n : 0, B: n ? tierByClass[c].B / n : 0, C: n ? tierByClass[c].C / n : 0 }];
  }),
);

// ─── national scaling ─────────────────────────────────────────────────
const nat = finishAgg(national);
const N = nat.ge1000.n;
const scaledFlat = { A: N * flatRatio.A, B: N * flatRatio.B, C: N * flatRatio.C, raw: N * flatRatio.rawLargeRoofs };
const scaledStrat = { A: 0, B: 0, C: 0 };
for (const c of GE1000) for (const t of ['A', 'B', 'C']) scaledStrat[t] += national[c].n * classRatio[c][t];
scaledStrat.raw = scaledFlat.raw; // no per-class OSM union factor; same as flat
scaledStrat.excluded = scaledStrat.raw - scaledStrat.A - scaledStrat.B - scaledStrat.C;
scaledFlat.excluded = scaledFlat.raw - scaledFlat.A - scaledFlat.B - scaledFlat.C;

// Wilson 95% interval
function wilson(k, n, z = 1.96) {
  const p = k / n, z2 = z * z;
  const c = (p + z2 / (2 * n)) / (1 + z2 / n);
  const h = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return { p: round(p, 3), low: round(c - h, 3), high: round(c + h, 3) };
}
const tr = PILOT.tierAReview;
const precA = { bare: wilson(tr.bare, tr.n), barePlusPartial: wilson(tr.bare + tr.partial, tr.n) };
const PREC = {
  A: { central: (tr.bare + tr.partial) / tr.n, low: precA.barePlusPartial.low, high: precA.barePlusPartial.high, bareOnly: tr.bare / tr.n },
  B: PRECISION_ASSUMED.B,
  C: PRECISION_ASSUMED.C,
  excluded: PRECISION_ASSUMED.excluded,
};

const SCENARIOS = [
  { id: 'A', label: 'Tier A only (both sources agree + industrial/commercial/farmyard zone or non-residential tag)', tiers: ['A'] },
  { id: 'AB', label: 'Tier A + B', tiers: ['A', 'B'] },
  { id: 'ABC', label: 'All land-use-filtered candidates (A + B + C)', tiers: ['A', 'B', 'C'] },
  { id: 'unfiltered', label: 'Every roof ≥1000 m² (OSM ∪ MS), no land-use filter — upper bound', tiers: ['A', 'B', 'C', 'excluded'] },
];
function scenario(s) {
  const n = (src) => s.tiers.reduce((sum, t) => sum + src[t], 0);
  const central = n(scaledFlat);
  const pub = (src, k) => s.tiers.reduce((sum, t) => sum + src[t] * PREC[t][k], 0);
  const roofs = { central: Math.round(central), sizeStratified: Math.round(n(scaledStrat)), low: Math.round(central * TRANSFER_LOW), high: Math.round(central * TRANSFER_HIGH) };
  const reviewHours = {};
  for (const sec of SECONDS_PER_ROOF) {
    const h = (roofs.central * sec) / 3600;
    reviewHours[`${sec}s`] = {
      singlePassHours: round(h, 1),
      singlePassPersonDays: round(h / PRODUCTIVE_HOURS_PER_DAY, 1),
      doubleReviewHours: round(2 * h, 1),
      rangeSinglePassHours: [round((roofs.low * sec) / 3600, 1), round((roofs.high * sec) / 3600, 1)],
    };
  }
  const publishable = {
    central: Math.round(pub(scaledFlat, 'central')),
    low: Math.round(pub(scaledFlat, 'low') * TRANSFER_LOW),
    high: Math.round(pub(scaledFlat, 'high') * TRANSFER_HIGH),
  };
  const bareCentral = s.tiers.reduce((sum, t) => sum + scaledFlat[t] * (t === 'A' ? PREC.A.bareOnly : PREC[t].central), 0);
  const kWpCentral = s.tiers.reduce((sum, t) => sum + scaledFlat[t] * PREC[t].central * (meanTierArea[t] ?? meanTierArea.C) * USABLE_RATIO / SQM_PER_KWP, 0);
  const imageryTiles = {
    oneViewOnePass: Math.round(roofs.central * TILES_PER_ROOF.oneView),
    twoViewsOnePass: Math.round(roofs.central * TILES_PER_ROOF.twoViews),
    twoViewsTwoReviewers: Math.round(roofs.central * TILES_PER_ROOF.twoViews * 2),
  };
  const arcgisUsd = (tiles) => round((Math.max(0, tiles - ARCGIS.freeTiles) * ARCGIS.usdPer1000) / 1000, 0);
  const outlineFixHours = Object.fromEntries(OUTLINE_FIX.seconds.map((sec) => [`${sec}s`, round((roofs.central * OUTLINE_FIX.share * sec) / 3600, 1)]));
  return {
    ...s,
    roofsToReview: roofs,
    reviewHours,
    outlineFixHoursIfCorrectedNotRejected: { share: OUTLINE_FIX.share, ...outlineFixHours },
    publishableOpportunities: { ...publishable, bareRoofOnlyCentral: Math.round(bareCentral) },
    publishablePerReviewHourAt10s: round(publishable.central / ((roofs.central * 10) / 3600), 1),
    publishableCapacityMWpDcCentral: round(kWpCentral / 1000, 0),
    imageryTileLoads: imageryTiles,
    imageryCostIllustrationArcgisUsd: {
      note: 'one-off review load if billed as ArcGIS basemap tiles in a single period; licence fit for QA is UNCERTAIN (see notes)',
      oneViewOnePass: arcgisUsd(imageryTiles.oneViewOnePass),
      twoViewsOnePass: arcgisUsd(imageryTiles.twoViewsOnePass),
      twoViewsTwoReviewers: arcgisUsd(imageryTiles.twoViewsTwoReviewers),
      twoViewsTwoReviewersNoFreeTier: round((imageryTiles.twoViewsTwoReviewers * ARCGIS.usdPer1000) / 1000, 0),
    },
  };
}
const scenarios = SCENARIOS.map(scenario);
// Where the scaled Tier A / A+B roofs would be (flat ratio applied per latitude band — see regional caveat in notes).
const scaledByLatBand = Object.fromEntries(
  Object.entries(LAT_BANDS).map(([k, agg]) => {
    const n = GE1000.reduce((s, c) => s + agg[c].n, 0);
    return [k, { msGe1000: n, tierA: Math.round(n * flatRatio.A), tierAB: Math.round(n * (flatRatio.A + flatRatio.B)), tierABC: Math.round(n * flatRatio.candidates) }];
  }),
);
// Rough footprint totals of the separate index Locations, from gz size × Israel's footprints-per-gz-byte.
const fpPerGzByte = finishAgg(national).all.n / rawBytes;
const neighbourEstimates = Object.fromEntries(
  Object.entries(neighbours).map(([k, v]) => [k, { approxGzMB: v.approxGzMB, estFootprints: Math.round(v.approxGzMB * 1e6 * fpPerGzByte * 1.048576) }]),
);

// ─── summary ──────────────────────────────────────────────────────────
const fin = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, finishAgg(v)]));
const summary = {
  generatedAt: new Date().toISOString(),
  source: {
    index: INDEX,
    indexBytes: indexSize,
    indexLastModified,
    datasetRelease: /global-buildings\/(\d{4}-\d{2}-\d{2})\//.exec(rows[0]?.url ?? '')?.[1] ?? null,
    location: COUNTRY,
    licence: 'CDLA-Permissive-2.0 (per brief; repo LICENSE changed 2026-03-11)',
    tiles: rows.map((r) => ({ qk: r.qk, sizeLabel: r.sizeLabel, uploadDate: r.uploadDate, tileBounds: quadkeyBounds(r.qk) })),
    rawGzBytes: rawBytes,
    sizeLabelsAreMiB: true,
    neighbourLocationsInIndex: neighbours,
    neighbourFootprintEstimatesFromGzSize: neighbourEstimates,
    newerRelease,
  },
  method: {
    area: '@turf/area on the footprint geometry (same as pilot)',
    centroid: 'area-weighted centroid of the outer ring (same as pilot)',
    dedupe: 'footprints ≥500 m² deduplicated on (centroid to 1e-6°, rounded area); <500 m² not deduplicated',
    sizeClasses: CLASSES,
  },
  quality: { geomTypes, parseErrors, duplicatesGe500, centroidOutsideFileQuadkey, bboxOfCentroids: bbox.map((x) => round(x, 4)), confidenceGe1000: { withValue: conf.ge1000WithConfidence, missing: conf.ge1000Missing, mean: conf.ge1000WithConfidence ? round(conf.sum / conf.ge1000WithConfidence, 3) : null, below0_8: conf.below0_8 }, geometryGe1000: { avgVertices: round(geomGe1000.vertices / geomGe1000.n, 1), avgGeojsonLineBytes: Math.round(geomGe1000.bytes / geomGe1000.n) } },
  national: nat,
  perQuadkey: Object.fromEntries(Object.entries(perQk).map(([k, v]) => [k, { ...finishAgg(v.agg), gzBytes: v.gzBytes, uploadDate: v.uploadDate, tileBounds: quadkeyBounds(k), bboxOfCentroids: v.bbox.map((x) => round(x, 4)) }])),
  latitudeBands: fin(LAT_BANDS),
  ge1000ByHalfDegreeLatitude: Object.fromEntries(Object.entries(latHalfDeg).sort((a, b) => Number(b[0]) - Number(a[0])).map(([k, v]) => [k, { n: v.n, areaSqm: Math.round(v.areaSqm) }])),
  greenLineCheck: {
    note: 'Approximate hand-drawn outlines (±1–2 km); footprints near the line can be misassigned. Use with the probes.',
    interpretation:
      'Probe boxes beyond the Green Line (East Jerusalem neighbourhoods, WB settlements and their industrial zones, WB Palestinian cities, Golan, Gaza) are empty except the Old City/Sheikh Jarrah box, whose few footprints are the Mount Scopus enclave edge (easternmost centroid ≈35.243E) — the pre-1967 Israeli enclave on Mount Scopus IS populated, while all controls are populated too; the index lists WestBank, GazaStrip, GolanHeights and GolanHeightsSubdistrict as separate Locations. ' +
      'The non-zero byApproxRegion westBank/golan/gaza counts are Israeli towns along the line (Modiin, Rosh HaAyin/Kafr Qasim, Taibe/Tira, Umm al-Fahm/Wadi Ara, Gilboa, Jerusalem corridor, Hula/Dan, Nahal Oz/Eshkol) caught by the coarse outline — see outlineHitsTopCells. ' +
      'Conclusion: Location "Israel" = the 1949 armistice lines (incl. the Mount Scopus enclave), excluding East Jerusalem, the West Bank, the Golan Heights and Gaza.',
    byApproxRegion: fin(regions),
    westBankDeepInside3km: finishAgg(westBankDeep),
    outlineHitsTopCells: Object.fromEntries(Object.entries(outlineCells).sort((a, b) => b[1] - a[1]).slice(0, 20)),
    beyondLineProbes: {
      total: PROBES.filter((p) => !['israel', 'enclave1949'].includes(p.kind)).length,
      withZeroFootprints: PROBES.filter((p) => !['israel', 'enclave1949'].includes(p.kind) && p.footprints === 0).length,
    },
    probes: PROBES.map(({ name, lat, lng, kind, footprints, ge1000, maxLng }) => ({ name, lat, lng, kind, footprints, ge1000, easternmostCentroidLng: maxLng === undefined ? null : round(maxLng, 4) })),
  },
  largestGe1000: largest,
  pilotCalibration: {
    bbox: PILOT_BBOX,
    msByClassMeasuredNow: pilotFin,
    msGe1000MeasuredNow: M_p,
    msGe1000PilotAudit: PILOT.msGe1000Audit,
    pilotFunnel: { rawLargeRoofs: PILOT.rawLargeRoofs, candidates: PILOT.candidates, tierA: PILOT.tierA, tierB: PILOT.tierB, tierC: PILOT.tierC },
    flatRatiosPerMsGe1000: Object.fromEntries(Object.entries(flatRatio).map(([k, v]) => [k, round(v, 4)])),
    pilotTiersBySizeClass: tierByClass,
    sizeClassRatios: Object.fromEntries(Object.entries(classRatio).map(([c, v]) => [c, { pilotMs: v.pilotMs, A: round(v.A, 4), B: round(v.B, 4), C: round(v.C, 4) }])),
    meanCandidateAreaSqmByTier: meanTierArea,
    tierAReview: { ...tr, wilson95: precA },
  },
  nationalScaling: {
    msGe1000National: N,
    flat: Object.fromEntries(Object.entries(scaledFlat).map(([k, v]) => [k, Math.round(v)])),
    sizeStratified: Object.fromEntries(Object.entries(scaledStrat).map(([k, v]) => [k, Math.round(v)])),
    transferUncertainty: { low: TRANSFER_LOW, high: TRANSFER_HIGH, note: 'judgement: pilot is one 188 km² area; national land-use mix and OSM coverage differ' },
    precision: { A: { measured: true, ...PREC.A }, B: { measured: false, ...PREC.B }, C: { measured: false, ...PREC.C }, excluded: { measured: false, ...PREC.excluded } },
    assumptions: { SECONDS_PER_ROOF, PRODUCTIVE_HOURS_PER_DAY, USABLE_RATIO, SQM_PER_KWP, TILES_PER_ROOF, OUTLINE_FIX, ARCGIS },
    scaledByLatitudeBand: scaledByLatBand,
  },
  scenarios,
};
fs.writeFileSync(path.join(DIR, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ national: nat, pilotMsGe1000: M_p, scaledFlat: summary.nationalScaling.flat, sizeStratified: summary.nationalScaling.sizeStratified }, null, 2));
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s → ${path.join(DIR, 'summary.json')}`);
