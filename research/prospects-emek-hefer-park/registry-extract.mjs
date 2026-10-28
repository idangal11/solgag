// Extract active companies whose registered address is in the Emek Hefer
// Industrial Park from the Israeli Companies Registry (data.gov.il, ica_companies,
// licence "other-open": reuse incl. commercial with attribution).
// Run from the project root:  node research/prospects-emek-hefer-park/registry-extract.mjs
//
// A registered address is where the company receives official mail. It is often an
// accountant's or lawyer's office and is NOT evidence that the company operates
// from, rents or owns a building there. The "c/o" (אצל) field is dropped because it
// can contain private individuals' names.
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve('research/prospects-emek-hefer-park');
const RESOURCE = 'f004176c-b85f-4542-8901-7b3176f9a054';
const filters = JSON.stringify({ 'שם עיר': 'פארק תעשיות עמק חפר' });
const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${RESOURCE}&limit=1000&filters=${encodeURIComponent(filters)}`;
const res = await fetch(url, { headers: { 'User-Agent': 'SolGag-research-pilot/0.1' } });
if (!res.ok) throw new Error(`data.gov.il ${res.status}`);
const rows = (await res.json()).result.records;
const clean = (s) => String(s ?? '').replace(/~/g, '"').replace(/\s+/g, ' ').trim();
const active = rows
  .filter((r) => r['סטטוס חברה'] === 'פעילה')
  .map((r) => ({
    companyNumber: String(r['מספר חברה']),
    name: clean(r['שם חברה']),
    nameEn: clean(r['שם באנגלית']) || null,
    type: clean(r['סוג תאגיד']),
    purpose: clean(r['מטרת החברה']) || null,
    description: clean(r['תאור חברה']) || null,
    incorporated: clean(r['תאריך התאגדות']) || null,
    lastAnnualReport: r['שנה אחרונה של דוח שנתי (שהוגש)'] ?? null,
    street: clean(r['שם רחוב']).replace(/^אין רחובות$/, '') || null,
    houseNumber: clean(r['מספר בית']).replace(/^0$/, '') || null,
    postcode: r['מיקוד'] ? String(r['מיקוד']) : null,
    sourceUrl: `https://data.gov.il/dataset/ica_companies/resource/${RESOURCE}`,
  }));
const out = { fetchedAt: new Date().toISOString(), source: 'רשם החברות — data.gov.il ica_companies', licence: 'other-open (data.gov.il terms: reuse permitted with attribution)', total: rows.length, active: active.length, companies: active };
fs.writeFileSync(path.join(DIR, 'data', 'registry-park-active.json'), JSON.stringify(out, null, 1));
const byStreet = {};
for (const c of active) byStreet[c.street ?? '(no street)'] = (byStreet[c.street ?? '(no street)'] ?? 0) + 1;
console.log(`registry rows ${rows.length}, active ${active.length}`, byStreet);
