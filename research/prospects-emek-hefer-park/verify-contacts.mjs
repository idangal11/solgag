// Business-prospect pilot: independent check of every collected contact detail.
// Re-fetches each source page and confirms the phone number / e-mail actually
// appears on it. Anything not re-found is dropped by build-import.mjs and shown
// as "unavailable". Never adds values of its own.
// Run from the project root:  node research/prospects-emek-hefer-park/verify-contacts.mjs
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve('research/prospects-emek-hefer-park');
const discoveryDir = path.join(DIR, 'discovery');
const OUT = path.join(DIR, 'data/contact-checks.json');
const UA = 'Mozilla/5.0 (compatible; SolGag-research-pilot/0.1; contact-verification, low volume)';

const groups = fs.readdirSync(discoveryDir).filter((f) => /^group-.*\.json$/.test(f)).map((f) => JSON.parse(fs.readFileSync(path.join(discoveryDir, f), 'utf8').replace(/^﻿/, '')));
const items = [];
for (const g of groups) {
  for (const b of g.businesses ?? []) {
    if (b.phone?.value && b.phone?.sourceUrl) items.push({ kind: 'phone', value: b.phone.value, sourceUrl: b.phone.sourceUrl, business: b.name });
    if (b.email?.value && b.email?.sourceUrl) items.push({ kind: 'email', value: b.email.value, sourceUrl: b.email.sourceUrl, business: b.name });
    // Addresses from official sites are checked too: street name and house number must both appear on the page.
    if (b.address?.street && b.address?.sourceUrl && b.address.sourceType === 'official_website') {
      items.push({ kind: 'address', value: `${b.address.street}|${b.address.houseNumber ?? ''}`, sourceUrl: b.address.sourceUrl, business: b.name });
    }
  }
}

const pages = new Map();
async function page(url) {
  if (pages.has(url)) return pages.get(url);
  let result;
  try {
    const ctrl = AbortSignal.timeout(25_000);
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'he,en;q=0.8' }, redirect: 'follow', signal: ctrl });
    if (res.ok) {
      // Older Hebrew sites are windows-1255 / iso-8859-8; decode with the declared charset, not blindly as UTF-8.
      const bytes = Buffer.from(await res.arrayBuffer());
      const head = bytes.subarray(0, 4096).toString('latin1');
      const charset = (/charset=["']?([\w-]+)/i.exec(res.headers.get('content-type') ?? '')?.[1] ?? /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ?? 'utf-8').toLowerCase();
      let html;
      try {
        html = new TextDecoder(charset).decode(bytes);
      } catch {
        html = bytes.toString('utf8');
      }
      result = { ok: true, html, status: res.status, charset };
    } else {
      result = { ok: false, status: res.status };
    }
  } catch (e) {
    result = { ok: false, error: e.message };
  }
  pages.set(url, result);
  await new Promise((r) => setTimeout(r, 800));
  return result;
}

/** Cloudflare "email protection" hides addresses in data-cfemail; decode them like the browser does. */
function cfEmails(html) {
  const out = [];
  for (const m of html.matchAll(/data-cfemail="([0-9a-f]+)"|\/cdn-cgi\/l\/email-protection#([0-9a-f]+)/gi)) {
    const hex = m[1] ?? m[2];
    const key = parseInt(hex.slice(0, 2), 16);
    let s = '';
    for (let i = 2; i < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
    out.push(s.toLowerCase());
  }
  return out;
}
const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"');
/** Israeli phone in a canonical digits-only form: +972 / 972 prefix → 0. */
const phoneDigits = (s) => {
  let d = String(s).replace(/[^\d*]/g, '');
  if (d.startsWith('972')) d = '0' + d.slice(3);
  return d;
};
function phonesOn(html) {
  const text = decode(html);
  const found = new Set();
  const re = /(?:\+?972[\s\-.]?|0)(?:\(?\d{1,2}\)?)[\s\-.]?\d{3}[\s\-.]?\d{3,4}|\*\d{4}|1[\s\-]?[5789]00(?:[\s\-]?\d{2,4}){2,3}/g;
  for (const m of text.matchAll(re)) found.add(phoneDigits(m[0]));
  for (const m of text.matchAll(/tel:([+\d\-\s().*]+)/gi)) found.add(phoneDigits(m[1]));
  return found;
}

const pageText = (html) => decode(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
/** Up to ~120 characters of the page's own text around a match; other mobile numbers in it are blanked. */
function around(text, index, length, keep) {
  const s = text.slice(Math.max(0, index - 50), index + length + 50).trim();
  return s.replace(/(?:\+?972[\s-]?|0)5\d[\s-]?\d{3}[\s-]?\d{4}/g, (m) => (phoneDigits(m) === keep ? m : '[…]'));
}

const results = {};
for (const it of items) {
  const p = await page(it.sourceUrl);
  let found = false;
  let how = null;
  let snippet = null;
  if (p.ok) {
    if (it.kind === 'phone') {
      found = phonesOn(p.html).has(phoneDigits(it.value));
      how = found ? 'phone number found in the page text or a tel: link' : 'number not present in the fetched HTML';
      if (found) {
        const text = pageText(p.html);
        const re = /(?:\+?\s?972[\s\-.]?|0)(?:\(?\d{1,2}\)?)[\s\-.]?\d{3}[\s\-.]?\d{3,4}|\*\d{4}|1[\s\-]?[5789]00(?:[\s\-]?\d{2,4}){2,3}/g;
        const m = [...text.matchAll(re)].find((x) => phoneDigits(x[0]) === phoneDigits(it.value));
        snippet = m ? around(text, m.index, m[0].length, phoneDigits(it.value)) : 'tel: link on the page';
      }
    } else if (it.kind === 'address') {
      const text = decode(p.html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
      const [street, num] = it.value.split('|');
      // Hebrew sites write the same street with or without the definite article ("בית הראשונים" / "בית ראשונים").
      const core = street
        .replace(/^(רחוב|רח'|דרך)\s+/, '')
        .split(/\s+/)
        .map((w) => `ה?${w.replace(/^ה/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
        .join('\\s+');
      // The house number must sit next to the street name (within 25 characters), not anywhere on the page.
      const re = num ? new RegExp(`${core}[^\\d]{0,25}(?<!\\d)${num}(?!\\d)|(?<!\\d)${num}(?!\\d)[^\\d]{0,6}(?:רח'?|רחוב)?\\s*${core}`) : new RegExp(core);
      found = re.test(text);
      how = found ? `street${num ? ' and house number' : ''} found together in the page text` : `street${num ? '/house number' : ''} not found together in the page text`;
    } else {
      const html = decode(p.html).toLowerCase();
      const v = it.value.toLowerCase().trim();
      found = html.includes(v) || cfEmails(p.html).includes(v);
      how = found ? 'address found in the page HTML (incl. mailto: / Cloudflare-protected)' : 'address not present in the fetched HTML';
      if (found) {
        const text = pageText(p.html);
        const i = text.toLowerCase().indexOf(v);
        snippet = i >= 0 ? around(text, i, v.length, null) : 'mailto: link on the page (address not shown as text)';
      }
    }
  } else {
    how = `source page could not be fetched (${p.status ?? p.error})`;
  }
  results[`${it.kind}|${it.value}|${it.sourceUrl}`] = { ...it, found, how, snippet, checkedAt: new Date().toISOString() };
  console.log(`${found ? '✓' : '✗'} ${it.kind} ${it.value} — ${it.business} — ${how}`);
}
// Values a second, independent fetch confirmed (sites that refuse automated requests) — see data/manual-checks.json.
const manualFile = path.join(DIR, 'data/manual-checks.json');
if (fs.existsSync(manualFile)) {
  for (const m of JSON.parse(fs.readFileSync(manualFile, 'utf8')).results) {
    const key = `${m.kind}|${m.value}|${m.sourceUrl}`;
    if (results[key] && !results[key].found) {
      results[key] = { ...results[key], found: m.found, how: m.how, snippet: m.found ? (m.how.match(/"([^"]+)"/)?.[1] ?? null) : null, secondCheck: true };
      console.log(`${m.found ? '✓' : '✗'} (second check) ${m.kind} ${m.value} — ${m.how}`);
    }
  }
}
fs.writeFileSync(OUT, JSON.stringify({ checkedAt: new Date().toISOString(), method: 're-fetched each source page with Node fetch and searched its HTML; second fetch for sites that refused it (manual-checks.json)', results }, null, 1));
const vals = Object.values(results);
console.log(`checked ${vals.length}: confirmed ${vals.filter((v) => v.found).length}, not confirmed ${vals.filter((v) => !v.found).length}`);
