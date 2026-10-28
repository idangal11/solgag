import { deflateSync } from 'node:zlib';
import { expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Shared helpers for the e2e specs. They assume the LOCAL Supabase stack (see playwright.config.ts).

export const MAILPIT_URL = (process.env.MAILPIT_URL ?? 'http://127.0.0.1:55324').replace(/\/$/, '');
const SUPABASE_URL = (process.env.SUPABASE_URL ?? 'http://127.0.0.1:55321').replace(/\/$/, '');
const LOCAL_URL = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/;

/** The 12 FICTIONAL demo listings from supabase/seed.sql. */
export const SEED_TITLES = [
  'רפת חלב משפחתית בעמק',
  'מבנה ייצור באזור תעשייה',
  'מרכז לוגיסטי — גג רחב',
  'מבנה מסחרי עם חניון',
  'מפעל מתכת בגליל',
  'לולי הטלה במושב',
  'מחסן קירור ליד הנמל',
  'בית אריזה חקלאי',
  'מבנה תעשייה עתירת ידע',
  'מחסן הפצה במפרץ',
  'רפת בקיבוץ בנגב',
  'מרכז מסחרי שכונתי',
] as const;

/** Ribbon shown on every fictional listing (src/components/ui.tsx). */
export const FICTIONAL_RIBBON = 'מודעה לדוגמה — בדויה';

/** Status badge of a fictional listing (SAMPLE_STATUS in src/components/ui.tsx) — never an availability. */
export const SAMPLE_STATUS_LABEL = 'מודעה לדוגמה';

/** Status badge of a real listing that is open to inquiries (AVAILABILITY.available in src/lib/labels.ts). */
export const OPEN_STATUS_LABEL = 'פתוח לפניות';

/** The seeded fictional fixed-rent listing: 18 ₪/m² × 4,110 usable m² = 73,980 ₪ a year. */
export const FIXED_RENT_SAMPLE = { title: 'מבנה ייצור באזור תעשייה', yearlyRent: 73_980 } as const;

/** A fresh address per run and project, e.g. owner-desktop-m1x2y3abc@example.test. */
export function uniqueEmail(role: string, project: string): string {
  return `${role}-${project}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}@example.test`;
}

export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ─── Mailpit (local Supabase inbox) ─────────────────────────────────────

async function mailpit(path: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${MAILPIT_URL}${path}`, init);
  } catch {
    throw new Error(`Mailpit is not reachable at ${MAILPIT_URL}. The e2e tests need the local Supabase stack: npx supabase start`);
  }
  if (!res.ok) throw new Error(`Mailpit ${init?.method ?? 'GET'} ${path} → HTTP ${res.status}`);
  return res;
}

interface MailpitSummary {
  ID: string;
}

async function searchInbox(email: string): Promise<MailpitSummary[]> {
  const res = await mailpit(`/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
  const body = (await res.json()) as { messages?: MailpitSummary[] | null };
  return body.messages ?? []; // newest first
}

/** Deletes earlier messages to this address, so the next code read is the new one. */
export async function clearInbox(email: string): Promise<void> {
  const ids = (await searchInbox(email)).map((m) => m.ID);
  // Never send an empty list — Mailpit deletes EVERY message when no IDs are given.
  if (!ids.length) return;
  await mailpit('/api/v1/messages', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ IDs: ids }),
  });
}

/** First standalone 6-digit number in a text. */
export function extractOtp(text: string): string | null {
  return text.match(/(?<!\d)(\d{6})(?!\d)/)?.[1] ?? null;
}

const htmlToText = (html: string) =>
  html
    .replace(/<(style|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ');

/** Polls Mailpit until the sign-in email for `email` arrives and returns its 6-digit code. */
export async function waitForOtp(email: string, timeoutMs = 30_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [latest] = await searchInbox(email);
    if (latest) {
      const msg = (await (await mailpit(`/api/v1/message/${latest.ID}`)).json()) as { Text?: string; HTML?: string };
      const code = extractOtp(msg.Text ?? '') ?? extractOtp(htmlToText(msg.HTML ?? ''));
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No sign-in code for ${email} arrived in Mailpit within ${timeoutMs / 1000}s`);
}

// ─── Hydration ──────────────────────────────────────────────────────────

/**
 * Waits until React has hydrated the element (its props/handlers are attached).
 * Server-rendered pages are visible before that, and in `next dev` hydration can take
 * seconds — a click or a typed value before it would be lost.
 */
export async function waitForHydration(locator: Locator): Promise<void> {
  await expect
    .poll(() => locator.evaluate((el) => Object.keys(el).some((k) => k.startsWith('__reactProps$'))), {
      message: 'waiting for React to hydrate the page',
      timeout: 45_000,
    })
    .toBe(true);
}

// ─── Sign-in ────────────────────────────────────────────────────────────

export interface LoginOptions {
  /** Page to land on afterwards (default "/"). */
  next?: string;
  /** Brand-new accounts pass through onboarding, which asks for a name and a main role. */
  name?: string;
  role?: 'owner' | 'investor';
}

/**
 * Signs in through the real /login form with a 6-digit email code read from Mailpit,
 * completes the onboarding step for new accounts, and waits until `next` is shown.
 */
export async function loginWithEmailOtp(page: Page, email: string, opts: LoginOptions = {}): Promise<void> {
  const next = opts.next ?? '/';
  await clearInbox(email);

  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  const emailInput = page.getByLabel(/כתובת דוא/);
  await waitForHydration(emailInput);
  await emailInput.fill(email);
  await page.getByRole('button', { name: 'שליחת קוד כניסה' }).click();
  await expect(page.getByRole('heading', { name: 'הזנת קוד כניסה' })).toBeVisible();

  const code = await waitForOtp(email);
  // The form verifies by itself once the sixth digit is entered.
  await page.getByLabel('קוד כניסה', { exact: true }).fill(code);
  await page.waitForURL((url) => url.pathname !== '/login');

  if (new URL(page.url()).pathname === '/account') {
    await expect(page.getByRole('heading', { level: 1, name: 'ברוכים הבאים לסולגג' })).toBeVisible();
    const nameInput = page.getByLabel('שם מלא');
    await waitForHydration(nameInput);
    await nameInput.fill(opts.name ?? 'משתמש/ת בדיקה');
    // The radio itself is visually hidden inside its card-like label.
    await page.getByRole('radio', { name: opts.role === 'owner' ? /בעלי גג/ : /משקיע\/ה/ }).check({ force: true });
    await page.getByRole('button', { name: 'שמירה והמשך' }).click();
  }

  const target = new URL(next, 'http://localhost').pathname;
  await page.waitForURL((url) => url.pathname === target);
}

export type Session = Awaited<ReturnType<BrowserContext['storageState']>>;

export function saveSession(page: Page): Promise<Session> {
  return page.context().storageState();
}

/** The Supabase session lives in cookies (@supabase/ssr), so restoring them signs the page in. */
export async function restoreSession(page: Page, session: Session): Promise<void> {
  await page.context().addCookies(session.cookies);
}

// ─── Page checks ────────────────────────────────────────────────────────

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'the page scrolls horizontally').toBeLessThanOrEqual(1);
}

/** Clicks a Leaflet map at pixel offsets from its centre (x to the right, y down). */
export async function clickMap(page: Page, map: Locator, offsets: [number, number][]): Promise<void> {
  await map.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const box = await map.boundingBox();
  if (!box) throw new Error('the map is not visible');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  for (const [dx, dy] of offsets) {
    await page.mouse.click(cx + dx, cy + dy);
    await page.waitForTimeout(150);
  }
}

// ─── Test data ──────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** A valid RGB PNG (a sky-to-roof gradient) generated in memory, for setInputFiles. */
export function makePng(width = 640, height = 400): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: truecolour RGB
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const i = y * stride + 1 + x * 3;
      const roof = y > height * 0.45;
      raw[i] = roof ? 120 + ((x >> 4) % 2) * 40 : 140 + Math.round((y / height) * 80);
      raw[i + 1] = roof ? 130 : 190;
      raw[i + 2] = roof ? 140 : 235;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Service role (optional) ────────────────────────────────────────────

/**
 * A service-role client for the LOCAL stack, or null without SUPABASE_SERVICE_ROLE_KEY
 * (or for a non-local SUPABASE_URL). Tests that need it skip that part when it is null.
 */
export function localAdminClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !LOCAL_URL.test(SUPABASE_URL)) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ─── Cleanup (optional) ─────────────────────────────────────────────────

async function removeFolder(admin: SupabaseClient, bucket: string, prefix: string, depth = 0): Promise<void> {
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data) return;
  const files = data.filter((f) => f.id).map((f) => `${prefix}/${f.name}`);
  if (files.length) await admin.storage.from(bucket).remove(files);
  if (depth < 3) for (const folder of data.filter((f) => !f.id)) await removeFolder(admin, bucket, `${prefix}/${folder.name}`, depth + 1);
}

/**
 * Deletes the users this run created (cascading to their listings, inquiries and favorites)
 * plus their uploaded files. No-op without SUPABASE_SERVICE_ROLE_KEY or for a non-local URL.
 */
export async function deleteTestUsers(emails: string[]): Promise<void> {
  const admin = localAdminClient();
  if (!admin || !emails.length) return;
  const wanted = new Set(emails.map((e) => e.toLowerCase()));
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    console.warn(`[e2e] cleanup skipped: ${error.message}`);
    return;
  }
  for (const user of data.users) {
    if (!user.email || !wanted.has(user.email.toLowerCase())) continue;
    await removeFolder(admin, 'listing-images', user.id);
    await removeFolder(admin, 'ownership-docs', user.id);
    const { error: delError } = await admin.auth.admin.deleteUser(user.id);
    if (delError) console.warn(`[e2e] could not delete ${user.email}: ${delError.message}`);
  }
}
