// Audit: structural inspection of raw inputs (independent of analyze.mjs).
import fs from 'node:fs';
const RAW = 'C:/Users/idang/solgag/research/pilot-emek-hefer/raw/';
const j = (f) => JSON.parse(fs.readFileSync(RAW + f, 'utf8'));

const cnt = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);
const top = (m, n = 40) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

for (const f of ['osm-buildings.json', 'osm-landuse.json', 'osm-solar.json']) {
  const d = j(f);
  const els = d.elements;
  const types = new Map();
  const roles = new Map();
  const relInfo = [];
  let openWays = 0, shortWays = 0, noGeomWays = 0;
  const tagKeys = new Map();
  for (const e of els) {
    cnt(types, e.type);
    if (e.type === 'way') {
      if (!e.geometry) noGeomWays++;
      else {
        if (e.geometry.length < 4) shortWays++;
        const a = e.geometry[0], b = e.geometry[e.geometry.length - 1];
        if (a.lat !== b.lat || a.lon !== b.lon) openWays++;
      }
    }
    if (e.type === 'relation') {
      const mem = e.members ?? [];
      let outerClosed = 0, outerOpen = 0, inner = 0;
      for (const m of mem) {
        cnt(roles, `${m.type}:${m.role}`);
        if (m.role === 'outer' && m.geometry) {
          const a = m.geometry[0], b = m.geometry[m.geometry.length - 1];
          if (a.lat === b.lat && a.lon === b.lon) outerClosed++; else outerOpen++;
        }
        if (m.role === 'inner') inner++;
      }
      relInfo.push({ id: e.id, tags: e.tags?.type + '/' + (e.tags?.building ?? e.tags?.landuse ?? e.tags?.power), outerClosed, outerOpen, inner, n: mem.length });
    }
    if (f === 'osm-buildings.json') cnt(tagKeys, e.tags?.building ?? '(none)');
    if (f === 'osm-landuse.json') cnt(tagKeys, e.tags?.landuse ?? '(none)');
    if (f === 'osm-solar.json') cnt(tagKeys, JSON.stringify([e.tags?.power, e.tags?.['generator:source'], e.tags?.['plant:source']]));
  }
  console.log('=====', f, 'elements', els.length);
  console.log('types', Object.fromEntries(types));
  console.log('ways: noGeom', noGeomWays, 'short(<4 pts)', shortWays, 'open', openWays);
  console.log('relation member roles', Object.fromEntries(roles));
  console.log('relations with open outer members (need stitching):', relInfo.filter((r) => r.outerOpen > 0).length, '/', relInfo.length);
  console.log('relations with inner rings:', relInfo.filter((r) => r.inner > 0).length);
  console.log('relations sample', relInfo.slice(0, 15));
  console.log('tag dist', top(tagKeys, 60));
}

// MS file
const lines = fs.readFileSync(RAW + 'ms-122112223.geojsonl', 'utf8').split('\n');
let n = 0, polys = 0, multi = 0, holes = 0, other = 0, crlf = 0, unclosed = 0;
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (const line of lines) {
  if (!line.trim()) continue;
  if (line.endsWith('\r')) crlf++;
  n++;
  const f = JSON.parse(line);
  const g = f.geometry;
  if (g.type === 'Polygon') {
    polys++;
    if (g.coordinates.length > 1) holes++;
    const r = g.coordinates[0];
    const a = r[0], b = r[r.length - 1];
    if (a[0] !== b[0] || a[1] !== b[1]) unclosed++;
    for (const [x, y] of r) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
  } else if (g.type === 'MultiPolygon') multi++;
  else other++;
}
console.log('===== MS', { n, polys, multi, holes, other, crlf, unclosed, extent: [minX, minY, maxX, maxY] });
