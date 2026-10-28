// Fetch OpenStreetMap data for the Emek Hefer Industrial Park (OSM way 31978862):
// buildings, address points, named businesses and named streets.
// Run from the project root:  node research/prospects-emek-hefer-park/fetch-osm.mjs
//
// Licence: OpenStreetMap data © OpenStreetMap contributors, ODbL 1.0. Internal
// pilot use; if a derived database is ever made public it must be shared alike.
import fs from 'node:fs';
import path from 'node:path';

const RAW = path.resolve('research/prospects-emek-hefer-park/raw');
fs.mkdirSync(RAW, { recursive: true });

// Park bounding box with a ~150 m margin so street segments just outside are included.
const BB = '32.3933,34.8877,32.4090,34.9052';
const query = `[out:json][timeout:120];
(
  way["building"](${BB});
  relation["building"](${BB});
  nwr["addr:housenumber"](${BB});
  nwr["addr:street"](${BB});
  nwr["name"]["shop"](${BB});
  nwr["name"]["office"](${BB});
  nwr["name"]["craft"](${BB});
  nwr["name"]["amenity"](${BB});
  nwr["name"]["industrial"](${BB});
  nwr["name"]["company"](${BB});
  way["highway"]["name"](${BB});
  way["landuse"](${BB});
);
out geom;`;

const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const UA = 'SolGag-research-pilot/0.1 (internal feasibility study)';

for (let attempt = 0; attempt < 6; attempt++) {
  const url = MIRRORS[attempt % MIRRORS.length];
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
      body: new URLSearchParams({ data: query }),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const json = JSON.parse(buf.toString('utf8'));
    fs.writeFileSync(path.join(RAW, 'osm-park-v2.json'), buf);
    fs.writeFileSync(path.join(path.dirname(RAW), 'overpass-query.txt'), query + '\n');
    console.log(`saved ${json.elements.length} elements from ${url} (osm_base ${json.osm3s?.timestamp_osm_base})`);
    process.exit(0);
  } catch (e) {
    console.warn(`attempt ${attempt + 1} via ${url} failed: ${e.message}`);
    await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
  }
}
process.exit(1);
