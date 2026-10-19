// Extra checks: small-footprint matching under the naive vs stable centroid, the 500-1000 bucket,
// the OSM/OSM overlap, and MS confidence of MS-only candidates.
import AUDIT from './recompute.mjs';
import fs from 'node:fs';
const { osm, osmAll, ms, msAll, cands, iOsmBB, inside, bboxOf } = AUDIT;
const ROOT = 'C:/Users/idang/solgag/research/pilot-emek-hefer/';
const BB = { s: 32.3, w: 34.85, n: 32.42, e: 35.0 };
const inBB = ([x, y]) => y >= BB.s && y <= BB.n && x >= BB.w && x <= BB.e;
function naive(ring) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length - 1; i++) { const [x0, y0] = ring[i], [x1, y1] = ring[i + 1]; const f = x0 * y1 - x1 * y0; a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f; }
  return [cx / (3 * a), cy / (3 * a)];
}
class Idx { constructor(items, cell = 0.002) { this.items = items; this.cell = cell; this.m = new Map(); items.forEach((it, i) => { const [a, b, c, d] = it.bb; for (let gx = Math.floor(a / cell); gx <= Math.floor(c / cell); gx++) for (let gy = Math.floor(b / cell); gy <= Math.floor(d / cell); gy++) { const k = gx * 1e6 + gy; if (!this.m.has(k)) this.m.set(k, []); this.m.get(k).push(i); } }); }
  at(pt) { return (this.m.get(Math.floor(pt[0] / this.cell) * 1e6 + Math.floor(pt[1] / this.cell)) ?? []).filter((i) => { const b = this.items[i].bb; return pt[0] >= b[0] && pt[0] <= b[2] && pt[1] >= b[1] && pt[1] <= b[3] && inside(pt, this.items[i].ring); }); } }
const out = {};
// all-size MS↔OSM matching, naive vs stable
const osmN = osmAll.map((b) => ({ ...b, c: naive(b.ring) })).filter((b) => inBB(b.c));
const msN = msAll.map((b) => ({ ...b, c: naive(b.ring) })).filter((b) => inBB(b.c));
const iON = new Idx(osmN);
out.msUnmatched_allSizes = { naive: msN.filter((m) => iON.at(m.c).length === 0).length, stable: ms.filter((m) => iOsmBB.at(m.c).length === 0).length, msInBbox_naive: msN.length, msInBbox_stable: ms.length };
const bucket = (osmL, msL, idx) => osmL.filter((b) => b.aSph >= 500 && b.aSph < 1000).length + msL.filter((m) => m.aSph >= 500 && m.aSph < 1000 && idx.at(m.c).length === 0).length;
out.sizeBucket500_1000 = { naiveReplay: bucket(osmN, msN, iON), stable: bucket(osm, ms, iOsmBB) };
// OSM-OSM overlap among candidates
const oc = cands.filter((b) => b.src === 'osm');
const io = new Idx(oc);
const pairs = [];
for (const [i, b] of oc.entries()) for (const j of io.at(b.c)) if (j !== i) pairs.push({ outer: oc[j].id, outerArea: Math.round(oc[j].aSph), outerTag: oc[j].tag, inner: b.id, innerArea: Math.round(b.aSph), innerTag: b.tag, c: b.c.map((v) => +v.toFixed(6)) });
out.osmCandidateContainedInOtherOsmCandidate = pairs;
// MS confidence for MS-only candidates
const wanted = new Map(cands.filter((b) => b.srcKey === 'ms_only').map((b) => [b.line, b]));
const txt = fs.readFileSync(ROOT + 'raw/ms-122112223.geojsonl', 'utf8');
let pos = 0, k = 0;
const conf = [];
while (pos < txt.length) { let nl = txt.indexOf('\n', pos); if (nl < 0) nl = txt.length; const line = txt.slice(pos, nl); pos = nl + 1; if (!line.trim()) continue; if (wanted.has(k)) { const p = JSON.parse(line).properties; conf.push({ c: p.confidence, h: p.height, lu: wanted.get(k).lu, a: wanted.get(k).aSph }); } k++; }
conf.sort((a, b) => a.c - b.c);
const q = (p) => +conf[Math.floor(p * (conf.length - 1))].c.toFixed(3);
out.msOnlyConfidence = { n: conf.length, min: q(0), p10: q(0.1), median: q(0.5), heightKnown: conf.filter((x) => x.h > 0).length, below0_8: conf.filter((x) => x.c < 0.8).length, minusOneConfidence: conf.filter((x) => x.c < 0).length };
console.log('=====X=====');
console.log(JSON.stringify(out, null, 2));
