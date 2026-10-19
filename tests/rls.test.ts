/**
 * Row-level security integration tests — talk to the LOCAL Supabase stack.
 *
 * Run (PowerShell):
 *   npx supabase start                 # and `npx supabase db reset` for a clean schema + demo seed
 *   npx supabase status -o env         # prints ANON_KEY and SERVICE_ROLE_KEY
 *   $env:SUPABASE_ANON_KEY = '<ANON_KEY>'
 *   $env:SUPABASE_SERVICE_ROLE_KEY = '<SERVICE_ROLE_KEY>'
 *   npx vitest run --config tests/vitest.rls.config.ts
 *
 * SUPABASE_URL defaults to http://127.0.0.1:54321. Without both keys every test is skipped.
 * The suite creates and deletes users, so it refuses a non-local URL unless RLS_ALLOW_REMOTE=1.
 * Everything it creates (users → listings/inquiries/favorites by cascade, uploaded files,
 * a fallback fictional listing) is removed in afterAll.
 *
 * Listing fixtures are created with the service role (seedListing): an API user may only
 * publish 5 listings per hour, so insertListing() is reserved for tests about that path.
 */
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pointEWKT, polygonAreaSqm, polygonEWKT } from '@/lib/geo';
import type { LatLng } from '@/lib/types';

const SUPABASE_URL = (process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321').replace(/\/$/, '');
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const IS_LOCAL = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(SUPABASE_URL);

const SKIP_REASON =
  !ANON_KEY || !SERVICE_KEY
    ? 'set SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY (from `npx supabase status -o env`) to run them'
    : !IS_LOCAL && process.env.RLS_ALLOW_REMOTE !== '1'
      ? `SUPABASE_URL=${SUPABASE_URL} is not local; these tests create and delete users (set RLS_ALLOW_REMOTE=1 to override)`
      : null;
if (SKIP_REASON) console.warn(`\n[rls] Skipping RLS integration tests: ${SKIP_REASON}\n`);

const CLIENT_OPTIONS = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const PASSWORD = `Rls-${RUN}-Pw9`;

const EARTH_RADIUS_M = 6_371_008.8;
const DEG = Math.PI / 180;
const POINT: LatLng = [32.09025, 34.8803]; // industrial zone, Petah Tikva

// Messages raised by the listings_guard trigger (supabase/migrations/20261019010000_review_fixes.sql).
const MSG = {
  footprintTooComplex: 'פוליגון הגג מורכב מדי (עד 200 נקודות, ללא חורים)',
  hourlyLimit: 'פרסמת מודעות רבות בזמן קצר. נסו שוב מאוחר יותר.',
  dailyLimit: 'הגעת למספר המודעות המרבי ליום. נסו שוב מחר.',
  accountLimit: 'הגעת למספר המודעות המרבי לחשבון. פנו אלינו להגדלת המכסה.',
  approveChangedListing: 'המודעה השתנתה מאז הגשת המסמך — לא ניתן לאשר את הבקשה הזו',
  requestNotPending: 'הבקשה לא נמצאה או שכבר נבדקה',
} as const;

/** widthM (east–west) × heightM (north–south) rectangle with its south-west corner at `sw`. */
function rectangle([lat, lng]: LatLng, widthM: number, heightM: number): LatLng[] {
  const dLat = heightM / (EARTH_RADIUS_M * DEG);
  const dLng = widthM / (EARTH_RADIUS_M * Math.cos(lat * DEG) * DEG);
  return [
    [lat, lng],
    [lat, lng + dLng],
    [lat + dLat, lng + dLng],
    [lat + dLat, lng],
  ];
}

/** A regular n-gon of radius `radiusM` around `center` (a valid, convex ring). */
function circle([lat, lng]: LatLng, radiusM: number, n: number): LatLng[] {
  const dLat = radiusM / (EARTH_RADIUS_M * DEG);
  const dLng = radiusM / (EARTH_RADIUS_M * Math.cos(lat * DEG) * DEG);
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return [lat + dLat * Math.sin(a), lng + dLng * Math.cos(a)] as LatLng;
  });
}

/** EWKT polygon with one or more rings (the first is the outer boundary, the rest are holes). */
function polygonWithRingsEWKT(...rings: LatLng[][]): string {
  const ringText = (ring: LatLng[]) => `(${[...ring, ring[0]].map(([lat, lng]) => `${lng} ${lat}`).join(',')})`;
  return `SRID=4326;POLYGON(${rings.map(ringText).join(',')})`;
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

// 1×1 transparent PNG and a minimal PDF — Storage checks the declared MIME type, not the bytes.
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
const PDF = Uint8Array.from(Buffer.from('%PDF-1.4\n%RLS test document\n%%EOF\n', 'utf8'));

interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

interface DbError {
  code?: string;
  message: string;
}

/** The database (or Storage) must have refused the request. */
function expectRefused(res: { error: DbError | null }, code?: string) {
  expect(res.error, 'expected the request to be refused').not.toBeNull();
  if (code) expect(res.error?.code).toBe(code);
}

function expectOk(res: { error: DbError | null }) {
  expect(res.error?.message ?? null, 'expected the request to succeed').toBeNull();
}

describe.skipIf(SKIP_REASON !== null)(SKIP_REASON ? `row-level security — SKIPPED: ${SKIP_REASON}` : 'row-level security (local Supabase)', () => {
  let db: SupabaseClient; // service role — bypasses RLS; used only for setup, checks and cleanup
  let anon: SupabaseClient;
  let owner: TestUser;
  let investor: TestUser;
  let stranger: TestUser;
  let adminUser: TestUser;
  let spammer: TestUser;

  let openListing: string; // real, published, available listing of `owner`
  let investorListing: string; // a listing of `investor` (so `investor` has an own upload folder)
  let fictionalListing: string;

  const userIds: string[] = [];
  const createdFictional: string[] = [];
  const uploads: { bucket: string; path: string }[] = [];

  function listingRow(over: Record<string, unknown> = {}) {
    return {
      title: `גג בדיקת הרשאות ${RUN}`,
      locality: 'פתח תקווה',
      region: 'center',
      building_type: 'warehouse',
      location: pointEWKT(POINT),
      area_source: 'manual_estimate',
      total_area_sqm: 1200,
      usable_area_sqm: 800,
      agreement: 'open',
      availability: 'available',
      owner_display_name: 'בעלים לבדיקה',
      declaration_accepted_at: new Date().toISOString(),
      ...over,
    };
  }

  /** Through the API as `user` — counts towards that user's listing rate limit (5 per hour). */
  async function insertListing(user: TestUser, over: Record<string, unknown> = {}): Promise<string> {
    const { data, error } = await user.client.from('listings').insert(listingRow(over)).select('id').single();
    if (error) throw new Error(`insert listing failed: ${error.message}`);
    return (data as { id: string }).id;
  }

  /**
   * Fixture listing of `user`, created with the service role: no rate limit, and trust columns
   * (owner_verification, tech_assessment, created_at …) are stored as given. It is dated two days
   * back by default, so fixtures never count towards the user's hourly or daily listing limit.
   */
  async function seedListing(user: TestUser, over: Record<string, unknown> = {}): Promise<string> {
    const { data, error } = await db
      .from('listings')
      .insert({ ...listingRow({ created_at: hoursAgo(48), ...over }), owner_id: user.id })
      .select('id')
      .single();
    if (error) throw new Error(`seed listing failed: ${error.message}`);
    return (data as { id: string }).id;
  }

  /** `count` hidden fixture listings of `user` created `createdHoursAgo` hours ago. */
  async function seedManyListings(user: TestUser, count: number, createdHoursAgo: number) {
    const rows = Array.from({ length: count }, (_, i) => ({
      ...listingRow({ title: `גג ותיק ${i + 1} ${RUN}`, status: 'hidden', created_at: hoursAgo(createdHoursAgo) }),
      owner_id: user.id,
    }));
    const { error } = await db.from('listings').insert(rows);
    if (error) throw new Error(`seed ${count} listings failed: ${error.message}`);
  }

  /** The row as stored, read with the service role. */
  async function stored(table: string, id: string, columns = '*') {
    const { data, error } = await db.from(table).select(columns).eq('id', id).single();
    if (error) throw new Error(`read ${table} ${id}: ${error.message}`);
    return data as unknown as Record<string, unknown>;
  }

  /** Service-role write used to put a fixture into a state an API user cannot reach. */
  async function forceListing(id: string, values: Record<string, unknown>) {
    const { error } = await db.from('listings').update(values).eq('id', id);
    if (error) throw new Error(`force listing ${id}: ${error.message}`);
  }

  function inquiryRow(listingId: string, sender: TestUser, over: Record<string, unknown> = {}) {
    return {
      listing_id: listingId,
      sender_id: sender.id,
      sender_name: 'משקיעה לבדיקה',
      sender_contact: sender.email,
      sender_role: 'investor',
      message: `שלום, אשמח לפרטים על הגג (${RUN}).`,
      ...over,
    };
  }

  async function createUser(label: string): Promise<TestUser> {
    const email = `rls-${label}-${RUN}@example.test`;
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: `בדיקה ${label}` },
    });
    if (error || !data.user) throw new Error(`createUser(${label}) failed: ${error?.message}`);
    userIds.push(data.user.id);
    const client = createClient(SUPABASE_URL, ANON_KEY, CLIENT_OPTIONS);
    const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (signInError) throw new Error(`signIn(${label}) failed: ${signInError.message}`);
    return { id: data.user.id, email, client };
  }

  async function upload(user: TestUser | null, bucket: string, path: string, body: Uint8Array, contentType: string) {
    const client = user?.client ?? anon;
    const res = await client.storage.from(bucket).upload(path, body, { contentType, upsert: false });
    // Clean up by the key Storage actually stored (it may normalise the path we sent).
    const stored = res.data?.fullPath?.startsWith(`${bucket}/`) ? res.data.fullPath.slice(bucket.length + 1) : path;
    if (!res.error) uploads.push({ bucket, path: stored });
    return res;
  }

  /** Storage refused the upload by policy — not merely because that file name is already taken. */
  function expectUploadRefused(res: { error: DbError | null }) {
    expectRefused(res);
    expect(res.error?.message).not.toMatch(/already exists|duplicate/i);
  }

  const uploadPhoto = (user: TestUser | null, path: string) => upload(user, 'listing-images', path, PNG, 'image/png');
  const uploadDoc = (user: TestUser | null, path: string) => upload(user, 'ownership-docs', path, PDF, 'application/pdf');

  async function fileExists(bucket: string, path: string): Promise<boolean> {
    const slash = path.lastIndexOf('/');
    const { data, error } = await db.storage.from(bucket).list(path.slice(0, slash), { search: path.slice(slash + 1) });
    if (error) throw new Error(`list ${bucket}: ${error.message}`);
    return (data ?? []).some((f) => f.name === path.slice(slash + 1));
  }

  /** File names in a folder, as `client` is allowed to list them. */
  async function listNames(client: SupabaseClient, bucket: string, folder: string): Promise<string[]> {
    const { data, error } = await client.storage.from(bucket).list(folder, { limit: 100 });
    if (error) return [];
    return (data ?? []).filter((f) => f.id).map((f) => f.name);
  }

  /** The owner uploads a document and submits it for `listingId`; returns the request id. */
  async function submitVerification(listingId: string, label: string): Promise<string> {
    const path = `${owner.id}/${listingId}/${label}-${RUN}.pdf`;
    expectOk(await uploadDoc(owner, path));
    const res = await owner.client
      .from('verification_requests')
      .insert({ listing_id: listingId, owner_id: owner.id, document_path: path })
      .select('id')
      .single();
    expectOk(res);
    expect((await stored('listings', listingId)).owner_verification).toBe('pending');
    return (res.data as { id: string }).id;
  }

  beforeAll(async () => {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: ANON_KEY } });
    } catch {
      throw new Error(`Local Supabase is not reachable at ${SUPABASE_URL}. Start it with: npx supabase start`);
    }

    db = createClient(SUPABASE_URL, SERVICE_KEY, CLIENT_OPTIONS);
    anon = createClient(SUPABASE_URL, ANON_KEY, CLIENT_OPTIONS);

    owner = await createUser('owner');
    investor = await createUser('investor');
    stranger = await createUser('stranger');
    adminUser = await createUser('admin');
    spammer = await createUser('spammer');

    const { error: adminError } = await db.from('profiles').update({ is_admin: true }).eq('id', adminUser.id);
    if (adminError) throw new Error(`could not make the admin user: ${adminError.message}`);

    openListing = await seedListing(owner, { agreement: 'fixed_rent', rent_per_sqm_year: 18 });
    investorListing = await seedListing(investor, { title: `גג של המשקיעה ${RUN}`, status: 'hidden' });

    // Prefer a seeded demo listing; create one only if the seed was not loaded.
    const { data: seeded } = await db
      .from('listings')
      .select('id')
      .eq('is_fictional', true)
      .eq('status', 'published')
      .neq('availability', 'unavailable')
      .limit(1);
    if (seeded?.length) {
      fictionalListing = (seeded[0] as { id: string }).id;
    } else {
      const { data, error } = await db
        .from('listings')
        .insert(listingRow({ is_fictional: true, polygon_illustrative: true, declaration_accepted_at: null, owner_display_name: 'בדוי (בדיקה)' }))
        .select('id')
        .single();
      if (error) throw new Error(`could not create a fictional listing: ${error.message}`);
      fictionalListing = (data as { id: string }).id;
      createdFictional.push(fictionalListing);
    }
  });

  afterAll(async () => {
    if (!db) return;
    for (const { bucket, path } of uploads) {
      const { error } = await db.storage.from(bucket).remove([path]);
      if (error) console.warn(`[rls] cleanup: could not remove ${bucket}/${path}: ${error.message}`);
    }
    if (createdFictional.length) await db.from('listings').delete().in('id', createdFictional);
    // Deleting the auth user cascades to the profile, listings, inquiries, messages, favorites and requests.
    for (const id of userIds) {
      const { error } = await db.auth.admin.deleteUser(id);
      if (error) console.warn(`[rls] cleanup: could not delete user ${id}: ${error.message}`);
    }
  });

  // ─── Listings ───────────────────────────────────────────────────────
  describe('listings', () => {
    it('anon can read published listings (table and listing_feed)', async () => {
      const feed = await anon.from('listing_feed').select('id, is_mine, status, owner_verification, admin_hidden').eq('id', openListing).single();
      expectOk(feed);
      expect(feed.data).toMatchObject({ id: openListing, is_mine: false, status: 'published', owner_verification: 'not_verified', admin_hidden: false });

      const table = await anon.from('listings').select('id').eq('status', 'published').limit(5);
      expectOk(table);
      expect(table.data?.length).toBeGreaterThan(0);
    });

    it('anon cannot read, or filter by, the owner’s account id — listing_feed does not expose it', async () => {
      expectRefused(await anon.from('listings').select('id, owner_id').eq('id', openListing), '42501');
      expectRefused(await anon.from('listings').select('id').eq('owner_id', owner.id), '42501');

      const feed = await anon.from('listing_feed').select('*').eq('id', openListing).single();
      expectOk(feed);
      expect(feed.data).not.toHaveProperty('owner_id');
      expect(feed.data).toMatchObject({ id: openListing, is_mine: false });

      // Signed-in owners still see their own listings as theirs.
      expect((await owner.client.from('listing_feed').select('is_mine').eq('id', openListing).single()).data).toEqual({ is_mine: true });
    });

    it('anon cannot create, change or delete listings', async () => {
      expectRefused(await anon.from('listings').insert(listingRow()), '42501');
      expectRefused(await anon.from('listings').update({ title: 'שינוי אנונימי' }).eq('id', openListing), '42501');
      expectRefused(await anon.from('listings').delete().eq('id', openListing), '42501');
      expect((await stored('listings', openListing)).title).toBe(`גג בדיקת הרשאות ${RUN}`);
    });

    it('an owner can create a listing, but the trigger sets every trust-sensitive column', async () => {
      const res = await owner.client
        .from('listings')
        .insert(
          listingRow({
            owner_verification: 'verified',
            is_fictional: true,
            polygon_illustrative: true,
            tech_assessment: 'assessed',
            admin_hidden: true,
            created_at: '2001-01-01T00:00:00Z',
            declaration_accepted_at: '2001-01-01T00:00:00Z',
          }),
        )
        .select('id')
        .single();
      expectOk(res);
      const row = await stored('listings', (res.data as { id: string }).id);
      expect(row).toMatchObject({
        owner_id: owner.id,
        owner_verification: 'not_verified',
        is_fictional: false,
        polygon_illustrative: false,
        tech_assessment: 'not_assessed',
        admin_hidden: false,
      });
      // The server stamps the declaration and creation time itself.
      expect(new Date(String(row.declaration_accepted_at)).getFullYear()).toBeGreaterThan(2001);
      expect(new Date(String(row.created_at)).getFullYear()).toBeGreaterThan(2001);

      const mine = await owner.client.from('listing_feed').select('is_mine').eq('id', row.id as string).single();
      expect(mine.data).toEqual({ is_mine: true });
    });

    it('an owner cannot create a listing in someone else’s name', async () => {
      const title = `גג בשם של אחר ${RUN}`;
      const res = await owner.client.from('listings').insert(listingRow({ title, owner_id: investor.id })).select('id').single();
      if (!res.error) expect((await stored('listings', (res.data as { id: string }).id)).owner_id).toBe(owner.id);
      const { count } = await db.from('listings').select('id', { count: 'exact', head: true }).eq('owner_id', investor.id).eq('title', title);
      expect(count).toBe(0);
    });

    it('an owner cannot mark their own listing verified, fictional, engineering-assessed or un-moderated', async () => {
      await owner.client
        .from('listings')
        .update({
          owner_verification: 'verified',
          is_fictional: true,
          polygon_illustrative: true,
          tech_assessment: 'assessed',
          admin_hidden: true,
          owner_id: investor.id,
        })
        .eq('id', openListing);
      expect(await stored('listings', openListing)).toMatchObject({
        owner_id: owner.id,
        owner_verification: 'not_verified',
        is_fictional: false,
        polygon_illustrative: false,
        tech_assessment: 'not_assessed',
        admin_hidden: false,
      });

      // Ordinary fields and the self-reported tech status stay editable.
      expectOk(await owner.client.from('listings').update({ tech_assessment: 'owner_reported', roof_type: 'בטון' }).eq('id', openListing));
      expect(await stored('listings', openListing)).toMatchObject({ tech_assessment: 'owner_reported', roof_type: 'בטון' });
    });

    it('recomputes a polygon area with PostGIS and ignores the client’s numbers', async () => {
      const ring = rectangle(POINT, 100, 50);
      const id = await insertListing(owner, {
        area_source: 'polygon',
        footprint: polygonEWKT(ring),
        total_area_sqm: 99_999,
        usable_area_sqm: 99_999,
      });
      const row = await stored('listings', id);
      const total = Number(row.total_area_sqm);
      expect(total).toBeGreaterThan(5000 * 0.99);
      expect(total).toBeLessThan(5000 * 1.01);
      expect(Math.abs(total - polygonAreaSqm(ring)) / total).toBeLessThan(0.01); // PostGIS ≈ Turf.js
      expect(Number(row.usable_area_sqm)).toBeLessThanOrEqual(total);
    });

    it('rejects invalid geometry with Hebrew messages', async () => {
      const [a, b, c, d] = rectangle(POINT, 60, 60);
      const bowtie = await owner.client
        .from('listings')
        .insert(listingRow({ area_source: 'polygon', footprint: polygonEWKT([a, c, b, d]) }));
      expectRefused(bowtie, '22023');
      expect(bowtie.error?.message).toBe('פוליגון הגג אינו תקין (קווים חוצים?)');

      const outside = await owner.client.from('listings').insert(listingRow({ location: pointEWKT([40.71, -74.0]) }));
      expectRefused(outside, '22023');
      expect(outside.error?.message).toBe('המיקום מחוץ לאזור הנתמך');

      const noShape = await owner.client.from('listings').insert(listingRow({ area_source: 'polygon', footprint: null }));
      expectRefused(noShape, '22023');
    });

    it('accepts a roof outline of up to 200 points and refuses a larger one in Hebrew', async () => {
      const ok = await stranger.client
        .from('listings')
        .insert(listingRow({ title: `גג מעוגל ${RUN}`, area_source: 'polygon', footprint: polygonEWKT(circle(POINT, 60, 200)) }))
        .select('id')
        .single();
      expectOk(ok);

      const tooMany = await owner.client
        .from('listings')
        .insert(listingRow({ area_source: 'polygon', footprint: polygonEWKT(circle(POINT, 60, 201)) }));
      expectRefused(tooMany, '22023');
      expect(tooMany.error?.message).toBe(MSG.footprintTooComplex);

      // The limit also applies to edits, and to an outline sent without area_source = 'polygon'.
      const edit = await owner.client
        .from('listings')
        .update({ footprint: polygonEWKT(circle(POINT, 60, 5000)) })
        .eq('id', openListing);
      expectRefused(edit, '22023');
      expect(edit.error?.message).toBe(MSG.footprintTooComplex);
      expect((await stored('listings', openListing)).footprint).toBeNull();
    });

    it('refuses a roof outline with holes (more than one ring)', async () => {
      const outer = rectangle(POINT, 100, 60);
      const hole = rectangle([POINT[0] + 0.0001, POINT[1] + 0.0002], 20, 10);
      const res = await owner.client
        .from('listings')
        .insert(listingRow({ area_source: 'polygon', footprint: polygonWithRingsEWKT(outer, hole) }));
      expectRefused(res, '22023');
      expect(res.error?.message).toBe(MSG.footprintTooComplex);
    });

    it('hidden listings are visible only to their owner', async () => {
      const hidden = await seedListing(owner, { status: 'hidden' });
      expect((await anon.from('listings').select('id').eq('id', hidden)).data).toEqual([]);
      expect((await investor.client.from('listing_feed').select('id').eq('id', hidden)).data).toEqual([]);
      expect((await owner.client.from('listing_feed').select('id').eq('id', hidden)).data).toHaveLength(1);
    });

    it('another user cannot change or delete someone else’s listing', async () => {
      const update = await investor.client.from('listings').update({ title: 'נחטף על ידי משתמש אחר' }).eq('id', openListing).select('id');
      expect(update.data ?? []).toEqual([]);
      const del = await investor.client.from('listings').delete().eq('id', openListing).select('id');
      expect(del.data ?? []).toEqual([]);
      expect((await stored('listings', openListing)).title).toBe(`גג בדיקת הרשאות ${RUN}`);
    });
  });

  // ─── Listing creation limits ───────────────────────────────────────
  describe('listing creation limits', () => {
    it('a user can publish 5 listings per hour; the 6th is refused with 54000 in Hebrew', async () => {
      const publisher = await createUser('publisher');
      for (let i = 1; i <= 5; i++) await insertListing(publisher, { title: `גג מספר ${i} ${RUN}` });

      const sixth = await publisher.client.from('listings').insert(listingRow({ title: `גג מספר 6 ${RUN}` }));
      expectRefused(sixth, '54000');
      expect(sixth.error?.message).toBe(MSG.hourlyLimit);

      const { count } = await db.from('listings').select('id', { count: 'exact', head: true }).eq('owner_id', publisher.id);
      expect(count).toBe(5);
    });

    it('parallel requests cannot race past the hourly limit', async () => {
      const racer = await createUser('racer');
      const results = await Promise.all(
        Array.from({ length: 8 }, (_, i) => racer.client.from('listings').insert(listingRow({ title: `גג במקביל ${i + 1} ${RUN}` }))),
      );
      expect(results.filter((r) => !r.error)).toHaveLength(5);
      for (const r of results.filter((r) => r.error)) expect(r.error?.code).toBe('54000');

      const { count } = await db.from('listings').select('id', { count: 'exact', head: true }).eq('owner_id', racer.id);
      expect(count).toBe(5);
    });

    it('a user can publish at most 20 listings per day', async () => {
      const daily = await createUser('daily');
      await seedManyListings(daily, 20, 2); // outside the 1-hour window, inside the day
      const res = await daily.client.from('listings').insert(listingRow());
      expectRefused(res, '54000');
      expect(res.error?.message).toBe(MSG.dailyLimit);
    });

    it('an account can hold at most 100 listings', async () => {
      const veteran = await createUser('veteran');
      await seedManyListings(veteran, 100, 72);
      const res = await veteran.client.from('listings').insert(listingRow());
      expectRefused(res, '54000');
      expect(res.error?.message).toBe(MSG.accountLimit);
    });
  });

  // ─── Admin moderation ──────────────────────────────────────────────
  describe('admin moderation (admin_hidden)', () => {
    let moderated: string;
    let moderatedImage: string;

    beforeAll(async () => {
      moderated = await seedListing(owner, { title: `גג למודרציה ${RUN}` });
      moderatedImage = `${owner.id}/${moderated}/photo-${RUN}.png`;
      expectOk(await owner.client.from('listing_images').insert({ listing_id: moderated, storage_path: moderatedImage }));
    });

    it('only an admin can hide a listing', async () => {
      expectOk(await owner.client.from('listings').update({ admin_hidden: true }).eq('id', moderated));
      expect((await stored('listings', moderated)).admin_hidden).toBe(false);

      const res = await adminUser.client.from('listings').update({ admin_hidden: true }).eq('id', moderated).select('admin_hidden');
      expectOk(res);
      expect(res.data).toEqual([{ admin_hidden: true }]);
      expect((await stored('listings', moderated)).admin_hidden).toBe(true);
    });

    it('a moderated listing is invisible to anon and other users, and takes no inquiries', async () => {
      expect((await anon.from('listings').select('id').eq('id', moderated)).data).toEqual([]);
      expect((await anon.from('listing_feed').select('id').eq('id', moderated)).data).toEqual([]);
      expect((await anon.from('listing_images').select('id').eq('listing_id', moderated)).data).toEqual([]);
      expect((await investor.client.from('listings').select('id').eq('id', moderated)).data).toEqual([]);
      expect((await investor.client.from('listing_feed').select('id').eq('id', moderated)).data).toEqual([]);

      expectRefused(await investor.client.from('inquiries').insert(inquiryRow(moderated, investor)), '42501');

      // The owner and staff still see it, flagged.
      expect((await owner.client.from('listing_feed').select('admin_hidden, is_mine').eq('id', moderated).single()).data).toEqual({
        admin_hidden: true,
        is_mine: true,
      });
      expect((await adminUser.client.from('listing_feed').select('admin_hidden').eq('id', moderated).single()).data).toEqual({ admin_hidden: true });
    });

    it('the owner cannot undo the moderation, also not by re-publishing', async () => {
      expectOk(await owner.client.from('listings').update({ admin_hidden: false }).eq('id', moderated));
      expectOk(await owner.client.from('listings').update({ status: 'hidden' }).eq('id', moderated));
      expectOk(await owner.client.from('listings').update({ status: 'published', title: `גג למודרציה (פורסם שוב) ${RUN}` }).eq('id', moderated));
      expect(await stored('listings', moderated)).toMatchObject({ admin_hidden: true, status: 'published' });
      expect((await anon.from('listing_feed').select('id').eq('id', moderated)).data).toEqual([]);
      expectRefused(await investor.client.from('inquiries').insert(inquiryRow(moderated, investor)), '42501');
    });

    it('an admin can lift the moderation', async () => {
      expectOk(await adminUser.client.from('listings').update({ admin_hidden: false }).eq('id', moderated));
      expect((await anon.from('listing_feed').select('id, admin_hidden').eq('id', moderated)).data).toEqual([{ id: moderated, admin_hidden: false }]);
      expect((await anon.from('listing_images').select('storage_path').eq('listing_id', moderated)).data).toEqual([{ storage_path: moderatedImage }]);
    });
  });

  // ─── Inquiries ──────────────────────────────────────────────────────
  describe('inquiries', () => {
    let inquiryId: string;

    it('cannot be sent to a fictional listing', async () => {
      expectRefused(await investor.client.from('inquiries').insert(inquiryRow(fictionalListing, investor)), '42501');
    });

    it('cannot be sent to an unavailable or hidden listing', async () => {
      const unavailable = await seedListing(owner, { availability: 'unavailable' });
      expectRefused(await investor.client.from('inquiries').insert(inquiryRow(unavailable, investor)), '42501');
      const hidden = await seedListing(owner, { status: 'hidden' });
      expectRefused(await investor.client.from('inquiries').insert(inquiryRow(hidden, investor)), '42501');
    });

    it('cannot be sent to your own listing', async () => {
      expectRefused(await owner.client.from('inquiries').insert(inquiryRow(openListing, owner)), '42501');
    });

    it('cannot be sent anonymously', async () => {
      expectRefused(await anon.from('inquiries').insert(inquiryRow(openListing, investor)), '42501');
    });

    it('can be sent to a real, open listing — status is always "new"', async () => {
      const res = await investor.client
        .from('inquiries')
        .insert(inquiryRow(openListing, investor, { status: 'closed' }))
        .select('id, status, sender_id')
        .single();
      expectOk(res);
      expect(res.data).toMatchObject({ status: 'new', sender_id: investor.id });
      inquiryId = (res.data as { id: string }).id;
    });

    it('is not readable by a third user or anon', async () => {
      expect((await stranger.client.from('inquiries').select('id').eq('id', inquiryId)).data).toEqual([]);
      expectRefused(await anon.from('inquiries').select('id').eq('id', inquiryId));
    });

    it('the listing owner can read it and update its status, but not the message', async () => {
      const read = await owner.client.from('inquiries').select('id, message, sender_contact').eq('id', inquiryId);
      expectOk(read);
      expect(read.data).toHaveLength(1);
      expect(read.data?.[0]).toMatchObject({ sender_contact: investor.email });

      const status = await owner.client.from('inquiries').update({ status: 'closed' }).eq('id', inquiryId).select('status');
      expectOk(status);
      expect(status.data).toEqual([{ status: 'closed' }]);

      expectRefused(await owner.client.from('inquiries').update({ message: 'הודעה ששונתה' }).eq('id', inquiryId), '42501');
      expect((await stored('inquiries', inquiryId)).message).toBe(`שלום, אשמח לפרטים על הגג (${RUN}).`);
    });

    it('the sender cannot change its status or delete it', async () => {
      const res = await investor.client.from('inquiries').update({ status: 'new' }).eq('id', inquiryId).select('id');
      expect(res.data ?? []).toEqual([]);
      expectRefused(await investor.client.from('inquiries').delete().eq('id', inquiryId), '42501');
      expect((await stored('inquiries', inquiryId)).status).toBe('closed');
    });

    it('thread messages are limited to the two participants; an owner reply moves a new inquiry to "in progress"', async () => {
      const second = await investor.client.from('inquiries').insert(inquiryRow(openListing, investor)).select('id').single();
      expectOk(second);
      const thread = (second.data as { id: string }).id;

      expectOk(await investor.client.from('inquiry_messages').insert({ inquiry_id: thread, sender_id: investor.id, body: 'שאלה נוספת' }));
      expect((await stored('inquiries', thread)).status).toBe('new');

      expectRefused(await stranger.client.from('inquiry_messages').insert({ inquiry_id: thread, sender_id: stranger.id, body: 'התערבות' }), '42501');
      expect((await stranger.client.from('inquiry_messages').select('id').eq('inquiry_id', thread)).data).toEqual([]);
      expectRefused(await anon.from('inquiry_messages').select('id').eq('inquiry_id', thread));

      expectOk(await owner.client.from('inquiry_messages').insert({ inquiry_id: thread, sender_id: owner.id, body: 'תשובה מבעלי הגג' }));
      expect((await stored('inquiries', thread)).status).toBe('in_progress');

      for (const user of [investor, owner]) {
        const msgs = await user.client.from('inquiry_messages').select('body').eq('inquiry_id', thread).order('created_at');
        expect(msgs.data?.map((m) => m.body)).toEqual(['שאלה נוספת', 'תשובה מבעלי הגג']);
      }

      // Messages are append-only.
      expectRefused(await investor.client.from('inquiry_messages').update({ body: 'נערך' }).eq('inquiry_id', thread), '42501');
    });

    it('a sender is limited to 10 inquiries per hour', async () => {
      for (let i = 1; i <= 10; i++) {
        const res = await spammer.client.from('inquiries').insert(inquiryRow(openListing, spammer, { message: `פנייה מספר ${i}` }));
        expectOk(res);
      }
      const eleventh = await spammer.client.from('inquiries').insert(inquiryRow(openListing, spammer, { message: 'פנייה מספר 11' }));
      expectRefused(eleventh, '54000');
      expect(eleventh.error?.message).toMatch(/שלחת פניות רבות/);
    });

    it('parallel requests cannot race past the hourly inquiry limit', async () => {
      const burst = await createUser('burst');
      const results = await Promise.all(
        Array.from({ length: 14 }, (_, i) => burst.client.from('inquiries').insert(inquiryRow(openListing, burst, { message: `פנייה במקביל ${i + 1}` }))),
      );
      expect(results.filter((r) => !r.error)).toHaveLength(10);
      for (const r of results.filter((r) => r.error)) expect(r.error?.code).toBe('54000');

      const { count } = await db.from('inquiries').select('id', { count: 'exact', head: true }).eq('sender_id', burst.id);
      expect(count).toBe(10);
    });
  });

  // ─── Favorites & profiles ──────────────────────────────────────────
  describe('favorites', () => {
    it('are private to their user', async () => {
      expectOk(await investor.client.from('favorites').insert({ user_id: investor.id, listing_id: openListing }));
      expect((await investor.client.from('favorites').select('listing_id')).data).toEqual([{ listing_id: openListing }]);

      expect((await stranger.client.from('favorites').select('listing_id').eq('user_id', investor.id)).data).toEqual([]);
      expectRefused(await stranger.client.from('favorites').insert({ user_id: investor.id, listing_id: fictionalListing }));
      const del = await stranger.client.from('favorites').delete().eq('user_id', investor.id).select('listing_id');
      expect(del.data ?? []).toEqual([]);
      expectRefused(await anon.from('favorites').select('listing_id'));

      const { count } = await db.from('favorites').select('listing_id', { count: 'exact', head: true }).eq('user_id', investor.id);
      expect(count).toBe(1);
    });
  });

  describe('profiles', () => {
    it('a user can edit their name but not make themselves admin or read other profiles', async () => {
      expectOk(await owner.client.from('profiles').update({ full_name: 'בעלת גג לבדיקה' }).eq('id', owner.id));
      expectRefused(await owner.client.from('profiles').update({ is_admin: true }).eq('id', owner.id), '42501');
      expect((await stored('profiles', owner.id)).is_admin).toBe(false);
      expect((await owner.client.from('profiles').select('id').eq('id', investor.id)).data).toEqual([]);
      expect((await anon.from('profiles').select('id').eq('id', owner.id)).data ?? []).toEqual([]);
    });
  });

  // ─── Ownership verification ────────────────────────────────────────
  describe('ownership verification', () => {
    let requestId: string;
    let documentPath: string;

    it('submitting documents moves the listing to "pending"', async () => {
      documentPath = `${owner.id}/${openListing}/deed-${RUN}.pdf`;
      expectOk(await uploadDoc(owner, documentPath));

      const res = await owner.client
        .from('verification_requests')
        .insert({ listing_id: openListing, owner_id: owner.id, document_path: documentPath, note: 'נסח טאבו', status: 'approved' })
        .select('id, status')
        .single();
      expectOk(res);
      expect((res.data as { status: string }).status).toBe('pending');
      requestId = (res.data as { id: string }).id;
      expect((await stored('listings', openListing)).owner_verification).toBe('pending');
    });

    it('a second pending request for the same listing is refused in Hebrew', async () => {
      const res = await owner.client
        .from('verification_requests')
        .insert({ listing_id: openListing, owner_id: owner.id, document_path: documentPath });
      expectRefused(res, '23505');
      expect(res.error?.message).toBe('כבר קיימת בקשת אימות ממתינה למודעה זו');
    });

    it('other users cannot submit for, or see, someone else’s verification', async () => {
      expectRefused(
        await investor.client
          .from('verification_requests')
          .insert({ listing_id: openListing, owner_id: investor.id, document_path: `${investor.id}/${openListing}/fake-${RUN}.pdf` }),
        '42501',
      );
      expect((await investor.client.from('verification_requests').select('id').eq('id', requestId)).data).toEqual([]);
      expectRefused(await investor.client.storage.from('ownership-docs').download(documentPath));
      expectOk(await owner.client.storage.from('ownership-docs').download(documentPath));
      expectOk(await adminUser.client.storage.from('ownership-docs').download(documentPath));
    });

    it('owners have no RPC to cancel their own pending request', async () => {
      expectRefused(await owner.client.rpc('cancel_pending_verifications', { p_listing: openListing }));
      expect((await stored('verification_requests', requestId)).status).toBe('pending');
      expect((await stored('listings', openListing)).owner_verification).toBe('pending');
    });

    it('non-admins cannot review a request', async () => {
      for (const user of [owner, investor]) {
        expectRefused(await user.client.rpc('review_verification', { p_request: requestId, p_approve: true }), '42501');
      }
      expectRefused(await anon.rpc('review_verification', { p_request: requestId, p_approve: true }));
      expect((await stored('listings', openListing)).owner_verification).toBe('pending');
      expect((await stored('verification_requests', requestId)).status).toBe('pending');
    });

    it('an admin approval is what makes the listing "verified"', async () => {
      expectOk(await adminUser.client.rpc('review_verification', { p_request: requestId, p_approve: true, p_note: 'נבדק מול נסח' }));
      expect((await stored('listings', openListing)).owner_verification).toBe('verified');
      expect(await stored('verification_requests', requestId)).toMatchObject({ status: 'approved', reviewer_id: adminUser.id });

      // A reviewed request cannot be reviewed again.
      expectRefused(await adminUser.client.rpc('review_verification', { p_request: requestId, p_approve: false }));
    });

    it('moving the building resets the verification', async () => {
      expectOk(await owner.client.from('listings').update({ location: pointEWKT([32.1, 34.9]) }).eq('id', openListing));
      expect((await stored('listings', openListing)).owner_verification).toBe('not_verified');
    });

    it('changing the publisher name or the locality resets "verified"; other edits keep it', async () => {
      const id = await seedListing(owner, { owner_verification: 'verified' });

      expectOk(await owner.client.from('listings').update({ title: `כותרת חדשה ${RUN}`, description: 'תיאור מעודכן', availability: 'in_talks' }).eq('id', id));
      expect((await stored('listings', id)).owner_verification).toBe('verified');

      expectOk(await owner.client.from('listings').update({ owner_display_name: 'שם מפרסם אחר' }).eq('id', id));
      expect((await stored('listings', id)).owner_verification).toBe('not_verified');

      await forceListing(id, { owner_verification: 'verified' });
      expectOk(await owner.client.from('listings').update({ locality: 'ראש העין' }).eq('id', id));
      expect((await stored('listings', id)).owner_verification).toBe('not_verified');

      await forceListing(id, { owner_verification: 'verified' });
      expectOk(await owner.client.from('listings').update({ area_source: 'polygon', footprint: polygonEWKT(rectangle(POINT, 40, 30)) }).eq('id', id));
      expect((await stored('listings', id)).owner_verification).toBe('not_verified');
    });

    it.each([
      ['the publisher name', { owner_display_name: 'מפרסם שהתחלף' }],
      ['the locality', { locality: 'כפר סבא' }],
      ['the location', { location: pointEWKT([32.105, 34.885]) }],
    ])('changing %s cancels a pending request, which the admin can then no longer approve', async (_label, change) => {
      const id = await seedListing(owner);
      const request = await submitVerification(id, 'cancel');

      // Edits that do not touch who/where keep the request under review.
      expectOk(await owner.client.from('listings').update({ title: `גג בבדיקת בעלות ${RUN}`, description: 'עודכן בזמן הבדיקה' }).eq('id', id));
      expect((await stored('listings', id)).owner_verification).toBe('pending');
      expect((await stored('verification_requests', request)).status).toBe('pending');

      expectOk(await owner.client.from('listings').update(change).eq('id', id));
      expect((await stored('listings', id)).owner_verification).toBe('not_verified');
      const cancelled = await stored('verification_requests', request);
      expect(cancelled).toMatchObject({ status: 'rejected' });
      expect(String(cancelled.review_note)).toMatch(/^בוטל אוטומטית/);

      const approve = await adminUser.client.rpc('review_verification', { p_request: request, p_approve: true });
      expectRefused(approve, 'P0002');
      expect(approve.error?.message).toBe(MSG.requestNotPending);
      expect((await stored('listings', id)).owner_verification).toBe('not_verified');

      // The owner is not stuck: new documents can be submitted for the new details.
      await submitVerification(id, 'resubmit');
    });

    it('an approval is refused when the listing is no longer pending; a rejection still works', async () => {
      const id = await seedListing(owner);
      const request = await submitVerification(id, 'stale');
      await forceListing(id, { owner_verification: 'rejected' });

      const approve = await adminUser.client.rpc('review_verification', { p_request: request, p_approve: true });
      expectRefused(approve, '22023');
      expect(approve.error?.message).toBe(MSG.approveChangedListing);
      expect((await stored('verification_requests', request)).status).toBe('pending');
      expect((await stored('listings', id)).owner_verification).toBe('rejected');

      expectOk(await adminUser.client.rpc('review_verification', { p_request: request, p_approve: false, p_note: 'המודעה השתנתה' }));
      expect((await stored('verification_requests', request)).status).toBe('rejected');
    });

    it('parallel submissions cannot open more than one pending request per listing', async () => {
      const id = await seedListing(owner);
      const results = await Promise.all(
        [1, 2, 3, 4].map((n) =>
          owner.client
            .from('verification_requests')
            .insert({ listing_id: id, owner_id: owner.id, document_path: `${owner.id}/${id}/race-${n}-${RUN}.pdf` }),
        ),
      );
      expect(results.filter((r) => !r.error)).toHaveLength(1);
      for (const r of results.filter((r) => r.error)) expect(r.error?.code).toBe('23505');

      const { count } = await db.from('verification_requests').select('id', { count: 'exact', head: true }).eq('listing_id', id).eq('status', 'pending');
      expect(count).toBe(1);
    });
  });

  // ─── Technical assessment ──────────────────────────────────────────
  describe('technical assessment', () => {
    let assessed: string;

    beforeAll(async () => {
      assessed = await seedListing(owner, { tech_assessment: 'assessed', roof_type: 'בטון', shading: 'ללא', grid_connection: 'חיבור קיים', roof_age_years: 10 });
    });

    it('edits that do not touch the roof data keep an "assessed" status', async () => {
      expectOk(await owner.client.from('listings').update({ title: `גג שנבדק ${RUN}`, description: 'נבדק בשטח', owner_display_name: 'שם חדש' }).eq('id', assessed));
      expect((await stored('listings', assessed)).tech_assessment).toBe('assessed');
    });

    it.each([
      ['roof type', { roof_type: 'פח' }],
      ['shading', { shading: 'הצללה חלקית' }],
      ['grid connection', { grid_connection: 'נדרש שדרוג' }],
      ['roof age', { roof_age_years: 25 }],
      ['total area', { total_area_sqm: 1500 }],
      ['usable area', { usable_area_sqm: 700 }],
      ['location', { location: pointEWKT([32.095, 34.882]) }],
    ])('changing the %s downgrades "assessed" and "survey planned" to "owner reported"', async (_label, change) => {
      for (const status of ['assessed', 'survey_planned']) {
        await forceListing(assessed, { tech_assessment: status, roof_type: 'בטון', shading: 'ללא', grid_connection: 'חיבור קיים', roof_age_years: 10, total_area_sqm: 1200, usable_area_sqm: 800, location: pointEWKT(POINT) });
        expectOk(await owner.client.from('listings').update(change).eq('id', assessed));
        expect((await stored('listings', assessed)).tech_assessment, status).toBe('owner_reported');
      }
    });

    it('the owner cannot restore an "assessed" status', async () => {
      expectOk(await owner.client.from('listings').update({ tech_assessment: 'assessed' }).eq('id', assessed));
      expect((await stored('listings', assessed)).tech_assessment).toBe('owner_reported');
    });
  });

  // ─── Storage & listing images ──────────────────────────────────────
  describe('storage', () => {
    let folderListing: string; // receives the per-folder file caps

    beforeAll(async () => {
      folderListing = await seedListing(owner, { title: `גג עם תמונות רבות ${RUN}`, status: 'hidden' });
    });

    it('photos can only be uploaded into "<own id>/<own listing id>/<file>"', async () => {
      const ownPhoto = `${owner.id}/${openListing}/photo-${RUN}.png`;
      expectOk(await uploadPhoto(owner, ownPhoto));
      expectOk(await uploadPhoto(investor, `${investor.id}/${investorListing}/own-${RUN}.png`));

      // Someone else's folder.
      expectUploadRefused(await uploadPhoto(investor, `${owner.id}/${openListing}/intruder-${RUN}.png`));
      // Own folder, but a listing of someone else, or a listing that does not exist.
      expectUploadRefused(await uploadPhoto(investor, `${investor.id}/${openListing}/intruder-${RUN}.png`));
      expectUploadRefused(await uploadPhoto(investor, `${investor.id}/${randomUUID()}/ghost-${RUN}.png`));
      // Not tied to any listing (the old "<uid>/<file>" layout), or anonymous.
      expectUploadRefused(await uploadPhoto(investor, `${investor.id}/loose-${RUN}.png`));
      expectUploadRefused(await uploadPhoto(null, `${owner.id}/${openListing}/anon-${RUN}.png`));

      // Removing someone else's file silently matches nothing.
      await investor.client.storage.from('listing-images').remove([ownPhoto]);
      expect(await fileExists('listing-images', ownPhoto)).toBe(true);
    });

    it('ownership documents follow the same folder rule', async () => {
      expectUploadRefused(await uploadDoc(investor, `${owner.id}/${openListing}/fake-${RUN}.pdf`));
      expectUploadRefused(await uploadDoc(investor, `${investor.id}/${openListing}/fake-${RUN}.pdf`));
      expectUploadRefused(await uploadDoc(investor, `${investor.id}/loose-${RUN}.pdf`));
      expectOk(await uploadDoc(investor, `${investor.id}/${investorListing}/deed-${RUN}.pdf`));
    });

    it.each([
      ['a ".." in the name', `photo..${RUN}.png`],
      ['a leading dot', `.photo-${RUN}.png`],
      ['an extra folder level', `nested/photo-${RUN}.png`],
      // (A doubled "/" is not listed: Storage collapses it, so "<id>/<listing>//x.png" is stored as a valid "<id>/<listing>/x.png".)
      ['a "../" segment', `../photo-${RUN}.png`],
      ['a URL-encoded "../"', `%2e%2e%2fphoto-${RUN}.png`],
      ['a backslash', `sub\\photo-${RUN}.png`],
      ['a space', `photo ${RUN}.png`],
      ['non-ASCII characters', `תמונה-${RUN}.png`],
      ['a name over 121 characters', `${'a'.repeat(130)}.png`],
    ])('refuses a file name with %s', async (_label, name) => {
      const path = `${owner.id}/${openListing}/${name}`;
      expectUploadRefused(await uploadPhoto(owner, path));
      expectUploadRefused(await uploadDoc(owner, path.replace(/\.png$/, '.pdf')));
    });

    it('a listing folder holds at most 12 photos', async () => {
      for (let i = 1; i <= 12; i++) expectOk(await uploadPhoto(owner, `${owner.id}/${folderListing}/f-${String(i).padStart(2, '0')}.png`));
      expectUploadRefused(await uploadPhoto(owner, `${owner.id}/${folderListing}/f-13.png`));
      expect(await fileExists('listing-images', `${owner.id}/${folderListing}/f-13.png`)).toBe(false);
    });

    it('a listing folder holds at most 10 ownership documents', async () => {
      for (let i = 1; i <= 10; i++) expectOk(await uploadDoc(owner, `${owner.id}/${folderListing}/doc-${String(i).padStart(2, '0')}.pdf`));
      expectUploadRefused(await uploadDoc(owner, `${owner.id}/${folderListing}/doc-11.pdf`));
    });

    it('owners can list and remove their own photos; others cannot list them', async () => {
      const folder = `${owner.id}/${folderListing}`;
      expect(await listNames(owner.client, 'listing-images', folder)).toHaveLength(12);
      expect(await listNames(investor.client, 'listing-images', folder)).toEqual([]);
      expect(await listNames(anon, 'listing-images', folder)).toEqual([]);

      const res = await owner.client.storage.from('listing-images').remove([`${folder}/f-12.png`]);
      expectOk(res);
      expect(await fileExists('listing-images', `${folder}/f-12.png`)).toBe(false);
      // The cap counts the files that are there now.
      expectOk(await uploadPhoto(owner, `${folder}/f-13.png`));
    });

    it('admins can list and delete photos and ownership documents', async () => {
      const folder = `${owner.id}/${folderListing}`;
      expect((await listNames(adminUser.client, 'listing-images', folder)).length).toBeGreaterThan(0);
      expect((await listNames(adminUser.client, 'ownership-docs', folder)).length).toBe(10);

      const photo = await adminUser.client.storage.from('listing-images').remove([`${folder}/f-11.png`]);
      expectOk(photo);
      expect(photo.data).toHaveLength(1);
      expect(await fileExists('listing-images', `${folder}/f-11.png`)).toBe(false);

      const doc = await adminUser.client.storage.from('ownership-docs').remove([`${folder}/doc-10.pdf`]);
      expectOk(doc);
      expect(doc.data).toHaveLength(1);
      expect(await fileExists('ownership-docs', `${folder}/doc-10.pdf`)).toBe(false);
    });

    it('owners can delete ownership documents no request refers to, but not a submitted one', async () => {
      const spare = `${owner.id}/${folderListing}/doc-09.pdf`;
      await owner.client.storage.from('ownership-docs').remove([spare]);
      expect(await fileExists('ownership-docs', spare)).toBe(false);

      const submitted = `${owner.id}/${openListing}/deed-${RUN}.pdf`;
      await owner.client.storage.from('ownership-docs').remove([submitted]);
      expect(await fileExists('ownership-docs', submitted)).toBe(true);
    });

    it('listing_images rows must point at "<owner id>/<that listing id>/<safe file name>"', async () => {
      const insert = (user: TestUser, storagePath: string, listingId = openListing) =>
        user.client.from('listing_images').insert({ listing_id: listingId, storage_path: storagePath });

      expectOk(await insert(owner, `${owner.id}/${openListing}/photo-${RUN}.png`));

      for (const bad of [
        `${investor.id}/${investorListing}/own-${RUN}.png`, // someone else's folder
        `${owner.id}/${folderListing}/f-01.png`, // another listing's folder
        `${owner.id}/photo-${RUN}.png`, // no listing folder
        `${owner.id}/${openListing}/photo..${RUN}.png`,
        `${owner.id}/${openListing}/../${folderListing}/f-01.png`,
        `${owner.id}/${openListing}/nested/photo-${RUN}.png`,
        `${owner.id}/${openListing}/.photo-${RUN}.png`,
      ]) {
        expectRefused(await insert(owner, bad), '42501');
      }

      expectRefused(await insert(investor, `${investor.id}/${openListing}/own-${RUN}.png`), '42501');
      expectRefused(await anon.from('listing_images').insert({ listing_id: openListing, storage_path: `${owner.id}/${openListing}/x.png` }), '42501');
    });

    it('a listing has at most 8 photos, also when they are added in parallel', async () => {
      const id = await seedListing(owner, { title: `גג עם 8 תמונות ${RUN}` });
      const results = await Promise.all(
        Array.from({ length: 11 }, (_, i) =>
          owner.client.from('listing_images').insert({ listing_id: id, storage_path: `${owner.id}/${id}/p-${String(i + 1).padStart(2, '0')}.png` }),
        ),
      );
      expect(results.filter((r) => !r.error)).toHaveLength(8);
      for (const r of results.filter((r) => r.error)) {
        expect(r.error?.code).toBe('22023');
        expect(r.error?.message).toBe('ניתן לצרף עד 8 תמונות למודעה');
      }
      const { count } = await db.from('listing_images').select('id', { count: 'exact', head: true }).eq('listing_id', id);
      expect(count).toBe(8);
    });

    it('verification requests must point at "<owner id>/<that listing id>/<safe file name>"', async () => {
      for (const bad of [
        `${owner.id}/${folderListing}/../${openListing}/deed-${RUN}.pdf`,
        `${owner.id}/${folderListing}/deed..${RUN}.pdf`,
        `${owner.id}/${openListing}/deed-${RUN}.pdf`, // a document filed under another listing
        `${owner.id}/deed-${RUN}.pdf`,
      ]) {
        expectRefused(
          await owner.client.from('verification_requests').insert({ listing_id: folderListing, owner_id: owner.id, document_path: bad }),
          '42501',
        );
      }
      expect((await stored('listings', folderListing)).owner_verification).toBe('not_verified');
    });
  });
});
