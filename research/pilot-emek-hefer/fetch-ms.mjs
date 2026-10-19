// Finds the Microsoft Global ML Building Footprints tiles that cover the pilot
// bbox and downloads them, without downloading the 1 GB+ index: the index CSV is
// sorted by Location, so we binary-search it with HTTP range requests.
// Run from the project root:  node research/pilot-emek-hefer/fetch-ms.mjs

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const INDEX = 'https://minedbuildings.z5.web.core.windows.net/global-buildings/dataset-links.csv';
const RAW = path.resolve('research/pilot-emek-hefer/raw');
const BBOX = { s: 32.3, w: 34.85, n: 32.42, e: 35.0 };
const COUNTRY = 'Israel';

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

async function range(start, end) {
  const res = await fetch(INDEX, { headers: { Range: `bytes=${start}-${end}` } });
  if (res.status !== 206) throw new Error(`range not supported: ${res.status}`);
  return res.text();
}

const head = await fetch(INDEX, { method: 'HEAD' });
const size = Number(head.headers.get('content-length'));
console.log(`index size: ${(size / 1e6).toFixed(0)} MB`);

/** Location of the first complete row at or after `offset`. */
async function locationAt(offset) {
  const chunk = await range(offset, Math.min(size - 1, offset + 4096));
  const lines = chunk.split('\n');
  const line = offset === 0 ? lines[1] : lines[1] ?? lines[0];
  return line?.split(',')[0] ?? '';
}

// Binary search for the first byte offset whose row Location >= COUNTRY.
let lo = 0;
let hi = size;
while (hi - lo > 65536) {
  const mid = Math.floor((lo + hi) / 2);
  const loc = await locationAt(mid);
  if (loc.localeCompare(COUNTRY, 'en') < 0) lo = mid;
  else hi = mid;
}
// Read forward from lo until we pass the country's rows.
const rows = [];
let offset = lo;
let done = false;
while (!done && offset < size) {
  const chunk = await range(offset, Math.min(size - 1, offset + 1_000_000));
  const lines = chunk.split('\n');
  lines.pop(); // possibly partial
  if (offset !== 0) lines.shift(); // possibly partial
  for (const line of lines) {
    const [loc, qk, url, sz] = line.split(',');
    if (loc === COUNTRY) rows.push({ qk, url, sz });
    else if (rows.length && loc.localeCompare(COUNTRY, 'en') > 0) {
      done = true;
      break;
    }
  }
  offset += chunk.lastIndexOf('\n') + 1;
}
console.log(`${COUNTRY} tiles in index: ${rows.length}`);

const zoom = rows[0]?.qk.length ?? 9;
const needed = new Set(
  [
    [BBOX.s, BBOX.w],
    [BBOX.s, BBOX.e],
    [BBOX.n, BBOX.w],
    [BBOX.n, BBOX.e],
  ].map(([la, ln]) => quadkey(la, ln, zoom)),
);
const picks = rows.filter((r) => needed.has(r.qk));
console.log(`needed quadkeys (z${zoom}): ${[...needed].join(', ')} → found ${picks.length}`);

for (const p of picks) {
  console.log(`downloading ${p.qk} (${p.sz}) …`);
  const res = await fetch(p.url);
  const buf = Buffer.from(await res.arrayBuffer());
  const text = zlib.gunzipSync(buf).toString('utf8');
  fs.writeFileSync(path.join(RAW, `ms-${p.qk}.geojsonl`), text);
  console.log(`  ${text.split('\n').filter(Boolean).length} footprints`);
}
