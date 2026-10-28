// Business-prospect pilot, step 3–4: match businesses to candidate roofs and
// write the admin import file.
// Run from the project root:  node research/prospects-emek-hefer-park/build-import.mjs
//
// Inputs
//   data/roofs.json                 candidate roofs + address evidence (candidates.mjs)
//   discovery/group-*.json          businesses found on official websites / OSM (desk research)
//   data/contact-checks.json        result of verify-contacts.mjs (values re-found on their source page)
// Output
//   data/prospects-import.json      upload in /admin/prospects → "ייבוא אצווה ממחקר"
//   data/matching-report.json       every match decision, for the review notes
//
// Matching evidence, strongest first (each match keeps its basis text):
//   high    the business's own website gives coordinates that fall inside the footprint
//   medium  an OSM business POI lies inside the footprint / a named OSM building overlaps it
//   medium  street + house number equal an address that OSM puts on this building
//   medium  the website's coordinates are within 25 m of the footprint (neighbouring building possible)
//   low     same street only (house number not located) — several candidates kept, never auto-approved
//   low     OSM POI within 60 m of the footprint (may belong to a neighbouring building)
// Relation is always "occupant_unverified": no public source here proves ownership.
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve('research/prospects-emek-hefer-park');
const roofsFile = JSON.parse(fs.readFileSync(path.join(DIR, 'data/roofs.json'), 'utf8'));
const discoveryDir = path.join(DIR, 'discovery');
const groups = fs.existsSync(discoveryDir)
  ? fs.readdirSync(discoveryDir).filter((f) => /^group-.*\.json$/.test(f)).map((f) => ({ file: f, ...JSON.parse(fs.readFileSync(path.join(discoveryDir, f), 'utf8').replace(/^﻿/, '')) }))
  : [];
const checksFile = path.join(DIR, 'data/contact-checks.json');
const checks = fs.existsSync(checksFile) ? JSON.parse(fs.readFileSync(checksFile, 'utf8')) : { results: {} };

// Low-confidence candidates kept per roof (strongest size fit first). Anything cut is logged in the report.
const STREET_ONLY_CAP = 10;

// ─── helpers ───────────────────────────────────────────────────────────
const MX = 111320 * Math.cos((32.4 * Math.PI) / 180);
const MY = 110574;
function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function segDist([px, py], [ax, ay], [bx, by]) {
  [px, py, ax, ay, bx, by] = [px * MX, py * MY, ax * MX, ay * MY, bx * MX, by * MY];
  const dx = bx - ax, dy = by - ay;
  const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
const distToRoof = (pt, ring) => (pointInRing(pt, ring) ? 0 : Math.min(...ring.slice(0, -1).map((v, i) => segDist(pt, v, ring[i + 1]))));
// The park operator and the businesses write "המזח"; OpenStreetMap has "המזרח" for the same street.
const STREET_ALIASES = { מזרח: 'מזח' };
/** Street names compared without punctuation, spaces, the "רחוב"/"דרך" prefix or the definite article. */
const normStreet = (s) => {
  const n = String(s ?? '')
    .replace(/["'״׳`.,\-]/g, '')
    .replace(/^\s*(רחוב|רח|דרך)\s+/, '')
    .split(/\s+/)
    .map((w) => w.replace(/^ה/, ''))
    .join('');
  return STREET_ALIASES[n] ?? n;
};
const normNum = (s) => String(s ?? '').replace(/[^\d]/g, '');
const normName = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/בע"?מ|בע״מ|ltd\.?|limited|\(.*?\)/g, '')
    .replace(/["'״׳`.,\-\s]/g, '');
const slug = (s) => normName(s).slice(0, 80) || 'unnamed';
const host = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
};

// ─── businesses from desk research ─────────────────────────────────────
/** Name words, without legal suffixes and punctuation ("אודאון - גן אירועים" → אודאון, גן, אירועים). */
const nameTokens = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/בע"?מ|בע״מ|ltd\.?|limited|\(.*?\)/g, ' ')
    .split(/[\s"'״׳`.,\-—–|/]+/)
    .filter((t) => t.length > 1);
/** Same business: same website host, or every word of the shorter name appears in the longer one. */
function sameBusiness(a, b) {
  const ha = host(a.officialWebsite ?? a.website), hb = host(b.officialWebsite ?? b.website);
  if (ha && hb) return ha === hb;
  const [s, l] = [nameTokens(a.name), nameTokens(b.name)].sort((x, y) => x.length - y.length);
  return s.join('').length >= 4 && s.every((t) => l.includes(t));
}
// Keep the record with more evidence when several groups found the same business.
const score = (x) => [x.address, x.location, x.phone, x.email, x.officialWebsite].filter(Boolean).length;
const businesses = [];
for (const g of groups) {
  for (const b of g.businesses ?? []) {
    const item = { ...b, group: g.group ?? g.file };
    const i = businesses.findIndex((e) => sameBusiness(e, item));
    if (i < 0) businesses.push(item);
    else if (score(item) > score(businesses[i])) businesses[i] = { ...item, leads: [...(item.leads ?? []), ...(businesses[i].leads ?? [])] };
  }
}

/**
 * Was the business's stated address re-found on its source page? Registry and OSM
 * addresses are taken as the record says ("as_recorded"); official-site addresses
 * must have been re-found by verify-contacts.mjs to support a street+number match.
 */
function addressStatus(b) {
  if (!b.address?.street) return 'none';
  if (b.address.sourceType !== 'official_website') return 'as_recorded';
  const r = checks.results[`address|${b.address.street}|${b.address.houseNumber ?? ''}|${b.address.sourceUrl}`];
  return r?.found ? 'verified' : 'unverified';
}

/** A contact value is kept only if verify-contacts.mjs found it on its source page. */
function checked(kind, value, sourceUrl) {
  if (!value || !sourceUrl) return { value: null, source: null };
  const r = checks.results[`${kind}|${value}|${sourceUrl}`];
  // The snippet shown to reviewers is the verifier's own excerpt of the page, not the researcher's quote.
  return r?.found ? { value, source: sourceUrl, checkedAt: r.checkedAt, snippet: r.snippet ?? null } : { value: null, source: null, dropped: r ? 'not found on source page' : 'not checked' };
}

function toImportBusiness(b, matchConfidence, matchBasis) {
  const phone = checked('phone', b.phone?.value, b.phone?.sourceUrl);
  const email = checked('email', b.email?.value, b.email?.sourceUrl);
  const site = b.officialWebsite ? { value: b.officialWebsite, source: b.address?.sourceType === 'official_website' ? b.address.sourceUrl : b.officialWebsite } : { value: null, source: null };
  const sources = [];
  const add = (url, kind, label) => url && !sources.some((s) => s.url === url) && sources.push({ url, kind, label });
  add(b.address?.sourceUrl, b.address?.sourceType === 'osm' ? 'osm' : b.address?.sourceType === 'registry_registered_address' ? 'registry' : 'official', 'כתובת העסק');
  add(b.location?.sourceUrl, 'official', 'מיקום שפורסם באתר העסק');
  add(b.phone?.sourceUrl, 'official', 'טלפון');
  add(b.email?.sourceUrl, 'official', 'דוא״ל');
  add(b.facilityArea?.sourceUrl, 'official', `שטח מתקן מוצהר: ${b.facilityArea?.m2 ?? '?'} מ״ר`);
  for (const l of (b.leads ?? []).slice(0, 5)) if (/^https?:\/\//.test(l)) add(l, 'lead', 'מקור לאיתור בלבד (לא הועתקו ממנו פרטים)');
  const checkedAt = [phone.checkedAt, email.checkedAt].filter(Boolean).sort().at(-1) ?? null;
  return {
    dedupeKey: host(b.officialWebsite) ?? slug(b.name),
    name: b.name,
    nameEn: b.nameEn ?? null,
    category: b.category ?? null,
    companyNumber: /^\d{9}$/.test(String(b.companyNumber ?? '')) ? String(b.companyNumber) : null,
    relation: 'occupant_unverified',
    relationEvidence: null,
    matchConfidence,
    matchBasis,
    // Researcher notes (e.g. "may have moved", "glass roof") travel with the record for the reviewer.
    _note: b.notes ? String(b.notes).slice(0, 400) : null,
    businessAddress: b.address?.verbatim ?? (b.address ? `${b.address.street ?? ''} ${b.address.houseNumber ?? ''}`.trim() : null),
    businessAddressSourceUrl: b.address?.sourceUrl ?? null,
    website: site.value,
    websiteSourceUrl: site.value ? site.source : null,
    phone: phone.value,
    phoneSourceUrl: phone.source,
    phoneSnippet: phone.snippet?.slice(0, 300) ?? null,
    email: email.value,
    emailSourceUrl: email.source,
    emailSnippet: email.snippet?.slice(0, 300) ?? null,
    contactsCheckedAt: checkedAt,
    sources,
    _dropped: { phone: phone.dropped ?? null, email: email.dropped ?? null },
  };
}

// ─── match ─────────────────────────────────────────────────────────────
const report = [];
const RANK = { high: 3, medium: 2, low: 1 };
const roofs = roofsFile.roofs.map((r) => ({ ...r, ring: r.geometry.coordinates[0], matches: new Map() }));
function attach(roof, item, confidence, basis) {
  const key = item.dedupeKey;
  const prev = roof.matches.get(key);
  if (prev && RANK[prev.matchConfidence] >= RANK[confidence]) {
    if (!prev.matchBasis.includes(basis)) prev.matchBasis = `${prev.matchBasis}; ${basis}`.slice(0, 1000);
    return;
  }
  roof.matches.set(key, { ...item, matchConfidence: confidence, matchBasis: prev ? `${basis}; ${prev.matchBasis}`.slice(0, 1000) : basis });
}

for (const b of businesses) {
  const base = (c, basis) => toImportBusiness(b, c, basis);
  let placed = false;
  // 1. Coordinates published on the business's own website. A point taken from
  //    OpenStreetMap is crowd-sourced evidence, so it can support at most "medium".
  if (b.location && Number.isFinite(b.location.lat) && Number.isFinite(b.location.lon)) {
    const pt = [b.location.lon, b.location.lat];
    const fromOsm = /openstreetmap\.org/.test(b.location.sourceUrl ?? '') || /osm/i.test(b.location.how ?? '');
    const ranked = roofs.map((r) => ({ r, d: distToRoof(pt, r.ring) })).sort((x, y) => x.d - y.d);
    const best = ranked[0];
    const what = fromOsm ? `נקודה ב-OpenStreetMap (${b.location.how ?? 'OSM'})` : `מיקום שפורסם באתר העסק (${b.location.how ?? 'קישור מפה'})`;
    if (best && best.d === 0) {
      const c = fromOsm ? 'medium' : 'high';
      attach(best.r, base(c, 'x'), c, `${what} נמצא בתוך טביעת הרגל של המבנה`);
      placed = true;
    } else if (best && best.d <= 25) {
      const c = fromOsm ? 'low' : 'medium';
      attach(best.r, base(c, 'x'), c, `${what} נמצא ${Math.round(best.d)} מ׳ מהמבנה — ייתכן שמדובר במבנה סמוך`);
      placed = true;
    } else if (best && best.d <= 80 && !fromOsm) {
      // A pin near (not on) several roofs: all of them stay candidates. A stated facility
      // size that fits exactly one of them (±15%) makes that one "medium".
      const near = ranked.filter((x) => x.d <= 80).slice(0, 4);
      const size = b.facilityArea?.m2;
      const fits = size ? near.filter((x) => Math.abs(x.r.areaM2 - size) / size <= 0.15) : [];
      for (const x of near) {
        const sizeNote = size ? `; שטח מתקן מוצהר ${size} מ״ר מול טביעת רגל ${x.r.areaM2} מ״ר${fits.includes(x) ? ' (תואם)' : ''}` : '';
        const c = fits.length === 1 && fits[0] === x ? 'medium' : 'low';
        attach(x.r, { ...base(c, 'x'), _sizeFit: size ? Math.abs(Math.log(size / x.r.areaM2)) : 9 }, c, `${what} נמצא ${Math.round(x.d)} מ׳ מהמבנה — אחד מ-${near.length} מבנים ברדיוס 80 מ׳${sizeNote}`);
      }
      placed = true;
    }
    report.push({ business: b.name, rule: fromOsm ? 'osm_coordinates' : 'website_coordinates', nearestRoof: best?.r.id, distanceM: best ? Math.round(best.d) : null, placed });
  }
  // 2. Street + house number equal to an address OSM puts on a building.
  const street = normStreet(b.address?.street);
  const num = normNum(b.address?.houseNumber);
  const addrState = addressStatus(b);
  const registryOnly = b.address?.sourceType === 'registry_registered_address';
  if (street && num && addrState !== 'unverified' && !registryOnly) {
    for (const r of roofs) {
      const hit = r.addressCandidates.find((a) => a.houseNumber && normStreet(a.street) === street && normNum(a.houseNumber) === num && a.confidence !== 'low');
      if (hit) {
        attach(r, base('medium', 'x'), 'medium', `כתובת העסק (${b.address.street} ${b.address.houseNumber}) זהה לכתובת שמסומנת על המבנה ב-${hit.source}`);
        placed = true;
        report.push({ business: b.name, rule: 'street_and_number', roof: r.id });
      }
    }
  }
  // 3. Same street only — ambiguous; several candidates per roof are kept.
  if (!placed && street) {
    const onStreet = roofs.filter((r) => r.addressCandidates.some((a) => normStreet(a.street) === street && (a.distanceM == null || a.distanceM <= 60)));
    const size = b.facilityArea?.m2;
    for (const r of onStreet) {
      let basis = `אותו רחוב בלבד (${b.address.street}${b.address.houseNumber ? ` ${b.address.houseNumber}` : ''}); מספר הבית לא אותר על המפה — אחד מ-${onStreet.length} גגות ברחוב`;
      if (registryOnly) basis += '; הכתובת היא כתובת רשומה ברשם החברות (ייתכן משרד רו״ח), לא בהכרח מקום הפעילות';
      if (addrState === 'unverified') basis += '; הכתובת לא נמצאה מחדש בעמוד המקור בבדיקה האוטומטית';
      if (size) basis += `; שטח מתקן מוצהר ${size} מ״ר מול טביעת רגל ${r.areaM2} מ״ר`;
      attach(r, { ...base('low', 'x'), _sizeFit: size ? Math.abs(Math.log(size / r.areaM2)) : 9, _large: b.largePremises === true }, 'low', basis);
    }
    report.push({ business: b.name, rule: 'street_only', roofs: onStreet.map((r) => r.id) });
  }
  if (!placed && !street) report.push({ business: b.name, rule: 'unplaced', reason: b.address ? 'address has no street' : 'no address found' });
}

// 4. OSM businesses on or near each roof (from candidates.mjs).
for (const r of roofs) {
  for (const p of r.osmBusinesses ?? []) {
    const disc = businesses.find((b) => sameBusiness(b, { name: p.name, website: p.website }));
    const item = disc
      ? toImportBusiness(disc, 'medium', 'x')
      : {
          dedupeKey: host(p.website) ?? slug(p.name),
          name: p.name,
          nameEn: p.nameEn,
          category: p.kind,
          companyNumber: null,
          relation: 'occupant_unverified',
          relationEvidence: null,
          businessAddress: p.address ?? null,
          businessAddressSourceUrl: p.address ? `https://www.openstreetmap.org/${p.osmId}` : null,
          // OSM tags are a permitted contact source, but they are still re-checked like the others.
          website: p.website ?? null,
          websiteSourceUrl: p.website ? `https://www.openstreetmap.org/${p.osmId}` : null,
          phone: null,
          phoneSourceUrl: null,
          phoneSnippet: null,
          email: null,
          emailSourceUrl: null,
          emailSnippet: null,
          contactsCheckedAt: null,
          sources: [{ url: `https://www.openstreetmap.org/${p.osmId}`, kind: 'osm', label: `OpenStreetMap ${p.osmId}` }],
        };
    const conf = p.relation === 'nearby_ambiguous' ? 'low' : 'medium';
    const basis =
      p.relation === 'inside_footprint'
        ? `נקודת עסק ב-OpenStreetMap (${p.osmId}) נמצאת בתוך טביעת הרגל`
        : p.relation === 'named_osm_building_overlapping'
          ? `המבנה ב-OpenStreetMap (${p.osmId}) שחופף לגג נושא את שם העסק`
          : `נקודת עסק ב-OpenStreetMap (${p.osmId}) נמצאת ${p.distanceM} מ׳ מהגג — ייתכן שהיא שייכת למבנה סמוך`;
    attach(r, item, conf, basis);
  }
}

// ─── output ────────────────────────────────────────────────────────────
const dropped = [];
const out = {
  batch: 'emek-hefer-park-2026-10',
  isDemo: false,
  generatedAt: new Date().toISOString(),
  sources: ['Microsoft Global ML Building Footprints (CDLA-Permissive-2.0)', 'OpenStreetMap contributors (ODbL)', 'Nominatim', 'data.gov.il ica_companies', 'official business websites'],
  roofs: roofs.map((r) => {
    let list = [...r.matches.values()].sort((a, b) => RANK[b.matchConfidence] - RANK[a.matchConfidence] || (a._sizeFit ?? 9) - (b._sizeFit ?? 9) || Number(b._large) - Number(a._large));
    const strong = list.filter((x) => x.matchConfidence !== 'low');
    const lows = list.filter((x) => x.matchConfidence === 'low');
    for (const cut of lows.slice(STREET_ONLY_CAP)) report.push({ business: cut.name, rule: 'cut_by_cap', roof: r.id });
    list = [...strong, ...lows.slice(0, STREET_ONLY_CAP)];
    return {
      ref: r.id,
      sourceKey: r.sourceKey,
      geometry: r.geometry,
      buildingSource: r.building.source,
      buildingSourceUrl: r.building.sourceUrl,
      buildingLicense: r.building.license,
      buildingConfidence: r.building.confidence,
      buildingBasis: r.building.basis,
      buildingEvidence: { modelConfidence: r.building.modelConfidence, osmMatches: r.building.osmMatches },
      address: r.address ? { ...r.address, houseNumber: r.address.houseNumber ?? null, locality: r.address.locality ?? null } : null,
      addressCandidates: r.addressCandidates.map(({ corroboratedBy, ...a }) => ({ ...a, method: corroboratedBy ? `${a.method} (also: ${corroboratedBy.join(', ')})`.slice(0, 500) : a.method })),
      suitability: { usableAreaM2: r.suitability.usableAreaM2, estKwpDc: r.suitability.estKwpDc, assumptions: r.suitability.assumptions, existingPvMappedInOsm: r.suitability.existingPvMappedInOsm },
      businesses: list.map(({ _sizeFit, _large, _dropped, _note, ...b }) => {
        if (_dropped?.phone || _dropped?.email) dropped.push({ roof: r.id, business: b.name, ..._dropped });
        const notes = [_dropped?.phone && 'טלפון שנמצא במחקר לא אומת מחדש בעמוד המקור ולכן הושמט', _dropped?.email && 'דוא״ל שנמצא במחקר לא אומת מחדש בעמוד המקור ולכן הושמט', _note && `הערת מחקר: ${_note}`].filter(Boolean);
        return notes.length ? { ...b, matchBasis: `${b.matchBasis} | ${notes.join(' | ')}`.slice(0, 1000) } : b;
      }),
    };
  }),
};
// Minified: the admin upload goes through a Server Action, capped at 1 MB.
fs.writeFileSync(path.join(DIR, 'data/prospects-import.json'), JSON.stringify(out));
fs.writeFileSync(path.join(DIR, 'data/matching-report.json'), JSON.stringify({ businesses: businesses.length, decisions: report, droppedContacts: dropped }, null, 1));

const all = out.roofs.flatMap((r) => r.businesses);
const tally = (f) => all.reduce((m, x) => ((m[f(x)] = (m[f(x)] ?? 0) + 1), m), {});
console.log(`discovery groups: ${groups.map((g) => g.file).join(', ') || 'none'}; distinct businesses: ${businesses.length}`);
console.log(`roofs: ${out.roofs.length}; with ≥1 candidate: ${out.roofs.filter((r) => r.businesses.length).length}; with medium/high: ${out.roofs.filter((r) => r.businesses.some((b) => b.matchConfidence !== 'low')).length}`);
console.log('match confidence', tally((b) => b.matchConfidence));
console.log(`distinct businesses placed: ${new Set(all.map((b) => b.dedupeKey)).size}; with phone ${new Set(all.filter((b) => b.phone).map((b) => b.dedupeKey)).size}, email ${new Set(all.filter((b) => b.email).map((b) => b.dedupeKey)).size}, website ${new Set(all.filter((b) => b.website).map((b) => b.dedupeKey)).size}`);
console.log(`contacts dropped (not re-found on source): ${dropped.length}`);
