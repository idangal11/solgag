// Diagnose the count differences: is the pipeline's centroid (shoelace on raw, untranslated
// lon/lat) numerically unstable? Compare it with a translated (stable) centroid.
import AUDIT from './recompute.mjs';
import fs from 'node:fs';
const { osm, osmAll, ms, msAll, gj, inside, iMsBB, iOsmBB, cands, pool } = AUDIT;
const ROOT = 'C:/Users/idang/solgag/research/pilot-emek-hefer/';
const BB = { s: 32.3, w: 34.85, n: 32.42, e: 35.0 };
const inBB = ([x, y]) => y >= BB.s && y <= BB.n && x >= BB.w && x <= BB.e;

// Naive formula as written in the textbook (no translation) — for diagnosis only.
function naive(ring) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[i + 1];
    const f = x0 * y1 - x1 * y0;
    a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  return [cx / (3 * a), cy / (3 * a)];
}
const dist = (p, q) => Math.hypot((p[0] - q[0]) * 111320 * Math.cos(p[1] * Math.PI / 180), (p[1] - q[1]) * 110900);
const pct = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(p * arr.length))];

const out = {};
for (const [name, list] of [['osmAll', osmAll], ['msAll', msAll]]) {
  const d = list.map((b) => ({ b, d: dist(naive(b.ring), b.c), n: naive(b.ring) }));
  const ds = d.map((x) => x.d).sort((a, b) => a - b);
  const byArea = (lo, hi) => {
    const s = d.filter((x) => x.b.aSph >= lo && x.b.aSph < hi).map((x) => x.d).sort((a, b) => a - b);
    return { n: s.length, median: +pct(s, 0.5).toFixed(3), p95: +pct(s, 0.95).toFixed(3), max: +s[s.length - 1].toFixed(3) };
  };
  out[name] = {
    median_m: +pct(ds, 0.5).toFixed(3), p95_m: +pct(ds, 0.95).toFixed(3), p99_m: +pct(ds, 0.99).toFixed(3), max_m: +ds[ds.length - 1].toFixed(2),
    over1m: ds.filter((x) => x > 1).length, over5m: ds.filter((x) => x > 5).length,
    area_lt100: byArea(0, 100), area_100_500: byArea(100, 500), area_500_1000: byArea(500, 1000), area_1000_5000: byArea(1000, 5000), area_ge5000: byArea(5000, 1e12),
    naiveCentroidOutsideOwnPolygon: d.filter((x) => !inside(x.n, x.b.ring)).length,
    stableCentroidOutsideOwnPolygon: d.filter((x) => !inside(x.b.c, x.b.ring)).length,
    inBbox_naive: d.filter((x) => inBB(x.n)).length,
    inBbox_stable: d.filter((x) => inBB(x.b.c)).length,
  };
}
// Does the published file carry the naive centroid? (lat/lng property vs both centroids of its own geometry)
let closerNaive = 0, closerStable = 0, pubD = [];
for (const f of gj.features) {
  const ring = f.geometry.coordinates[0];
  const p = [f.properties.lng, f.properties.lat];
  const dn = dist(p, naive(ring));
  // stable centroid of the published ring
  const [lx, ly] = ring[0]; const k = Math.cos(ly * Math.PI / 180);
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length - 1; i++) { const x0 = (ring[i][0] - lx) * k, y0 = ring[i][1] - ly, x1 = (ring[i + 1][0] - lx) * k, y1 = ring[i + 1][1] - ly; const c = x0 * y1 - x1 * y0; a += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c; }
  const st = [lx + cx / (3 * a) / k, ly + cy / (3 * a)];
  const ds = dist(p, st);
  pubD.push(ds);
  if (dn < ds) closerNaive++; else closerStable++;
}
pubD.sort((a, b) => a - b);
out.published = { closerToNaive: closerNaive, closerToStable: closerStable, pubCentroidOffsetFromStable_median_m: +pct(pubD, 0.5).toFixed(3), p95: +pct(pubD, 0.95).toFixed(3), max: +pubD[pubD.length - 1].toFixed(2) };

// Replay the pipeline with the naive centroid to see whether it reproduces stats.json exactly.
const osmN = osmAll.map((b) => ({ ...b, c: naive(b.ring) })).filter((b) => inBB(b.c));
const msN = msAll.map((b) => ({ ...b, c: naive(b.ring) })).filter((b) => inBB(b.c));
class Idx { constructor(items, cell = 0.002) { this.items = items; this.cell = cell; this.m = new Map(); items.forEach((it, i) => { const [a, b, c, d] = it.bb; for (let gx = Math.floor(a / cell); gx <= Math.floor(c / cell); gx++) for (let gy = Math.floor(b / cell); gy <= Math.floor(d / cell); gy++) { const k = gx * 1e6 + gy; if (!this.m.has(k)) this.m.set(k, []); this.m.get(k).push(i); } }); }
  at(pt) { return (this.m.get(Math.floor(pt[0] / this.cell) * 1e6 + Math.floor(pt[1] / this.cell)) ?? []).filter((i) => { const b = this.items[i].bb; return pt[0] >= b[0] && pt[0] <= b[2] && pt[1] >= b[1] && pt[1] <= b[3] && inside(pt, this.items[i].ring); }); } }
const iO = new Idx(osmN), iM = new Idx(msN);
const osmL = osmN.filter((b) => b.aSph >= 1000), msL = msN.filter((b) => b.aSph >= 1000);
out.replayNaive = {
  osmInBbox: osmN.length, msInBbox: msN.length, osmGe1000: osmL.length, msGe1000: msL.length,
  msGe1000_noOsm: msL.filter((m) => iO.at(m.c).length === 0).length,
  osmGe1000_noMs: osmL.filter((o) => iM.at(o.c).length === 0).length,
};
// Which OSM buildings flip in/out of bbox?
out.osmBboxFlips = osmAll.filter((b) => inBB(b.c) !== inBB(naive(b.ring))).map((b) => ({ id: b.id, area: Math.round(b.aSph), stable: b.c.map((v) => +v.toFixed(6)), naive: naive(b.ring).map((v) => +v.toFixed(6)), shift_m: +dist(b.c, naive(b.ring)).toFixed(1) }));
out.msBboxFlips = msAll.filter((b) => inBB(b.c) !== inBB(naive(b.ring))).map((b) => ({ line: b.line, area: Math.round(b.aSph), stableIn: inBB(b.c), shift_m: +dist(b.c, naive(b.ring)).toFixed(1) }));
fs.writeFileSync(ROOT + 'audit/centroid-check.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
