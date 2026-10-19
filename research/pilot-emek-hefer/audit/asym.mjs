// Asymmetric matching: MS-only candidates that nevertheless contain the centroid of an OSM building.
import AUDIT from './recompute.mjs';
const { osm, cands, inside } = AUDIT;
class Idx { constructor(items, cell = 0.002) { this.items = items; this.cell = cell; this.m = new Map(); items.forEach((it, i) => { const [a, b, c, d] = it.bb; for (let gx = Math.floor(a / cell); gx <= Math.floor(c / cell); gx++) for (let gy = Math.floor(b / cell); gy <= Math.floor(d / cell); gy++) { const k = gx * 1e6 + gy; if (!this.m.has(k)) this.m.set(k, []); this.m.get(k).push(i); } }); }
  at(pt) { return (this.m.get(Math.floor(pt[0] / this.cell) * 1e6 + Math.floor(pt[1] / this.cell)) ?? []).filter((i) => { const b = this.items[i].bb; return pt[0] >= b[0] && pt[0] <= b[2] && pt[1] >= b[1] && pt[1] <= b[3] && inside(pt, this.items[i].ring); }); } }
const msOnly = cands.filter((b) => b.srcKey === 'ms_only');
const im = new Idx(msOnly);
const hit = new Map();
for (const o of osm) for (const j of im.at(o.c)) { if (!hit.has(j)) hit.set(j, []); hit.get(j).push(o); }
const containsOsmCand = [...hit.entries()].filter(([, os]) => os.some((o) => cands.includes(o)));
console.log('=====A=====');
console.log(JSON.stringify({
  msOnlyContainingAnyOsmCentroid: hit.size,
  area: Math.round([...hit.keys()].reduce((s, j) => s + msOnly[j].aSph, 0)),
  msOnlyContainingAnOsmCandidateCentroid: containsOsmCand.length,
  areaOfThose: Math.round(containsOsmCand.reduce((s, [j]) => s + msOnly[j].aSph, 0)),
  osmCandidatesWhoseCentroidIsInAnMsOnlyCandidate: containsOsmCand.reduce((s, [, os]) => s + os.filter((o) => cands.includes(o)).length, 0),
}, null, 2));
