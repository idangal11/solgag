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
 */
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

  async function insertListing(user: TestUser, over: Record<string, unknown> = {}): Promise<string> {
    const { data, error } = await user.client.from('listings').insert(listingRow(over)).select('id').single();
    if (error) throw new Error(`insert listing failed: ${error.message}`);
    return (data as { id: string }).id;
  }

  /** The row as stored, read with the service role. */
  async function stored(table: string, id: string, columns = '*') {
    const { data, error } = await db.from(table).select(columns).eq('id', id).single();
    if (error) throw new Error(`read ${table} ${id}: ${error.message}`);
    return data as unknown as Record<string, unknown>;
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
    if (!res.error) uploads.push({ bucket, path });
    return res;
  }

  async function fileExists(bucket: string, path: string): Promise<boolean> {
    const slash = path.lastIndexOf('/');
    const { data, error } = await db.storage.from(bucket).list(path.slice(0, slash), { search: path.slice(slash + 1) });
    if (error) throw new Error(`list ${bucket}: ${error.message}`);
    return (data ?? []).some((f) => f.name === path.slice(slash + 1));
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

    openListing = await insertListing(owner, { agreement: 'fixed_rent', rent_per_sqm_year: 18 });

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
      const feed = await anon.from('listing_feed').select('id, is_mine, status, owner_verification').eq('id', openListing).single();
      expectOk(feed);
      expect(feed.data).toMatchObject({ id: openListing, is_mine: false, status: 'published', owner_verification: 'not_verified' });

      const table = await anon.from('listings').select('id').eq('status', 'published').limit(5);
      expectOk(table);
      expect(table.data?.length).toBeGreaterThan(0);
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
      });
      // The server stamps the declaration and creation time itself.
      expect(new Date(String(row.declaration_accepted_at)).getFullYear()).toBeGreaterThan(2001);
      expect(new Date(String(row.created_at)).getFullYear()).toBeGreaterThan(2001);

      const mine = await owner.client.from('listing_feed').select('is_mine').eq('id', row.id as string).single();
      expect(mine.data).toEqual({ is_mine: true });
    });

    it('an owner cannot create a listing in someone else’s name', async () => {
      const res = await owner.client.from('listings').insert(listingRow({ owner_id: investor.id })).select('id').single();
      if (!res.error) expect((await stored('listings', (res.data as { id: string }).id)).owner_id).toBe(owner.id);
      const { count } = await db.from('listings').select('id', { count: 'exact', head: true }).eq('owner_id', investor.id);
      expect(count).toBe(0);
    });

    it('an owner cannot mark their own listing verified, fictional or engineering-assessed', async () => {
      await owner.client
        .from('listings')
        .update({
          owner_verification: 'verified',
          is_fictional: true,
          polygon_illustrative: true,
          tech_assessment: 'assessed',
          owner_id: investor.id,
        })
        .eq('id', openListing);
      expect(await stored('listings', openListing)).toMatchObject({
        owner_id: owner.id,
        owner_verification: 'not_verified',
        is_fictional: false,
        polygon_illustrative: false,
        tech_assessment: 'not_assessed',
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

    it('hidden listings are visible only to their owner', async () => {
      const hidden = await insertListing(owner, { status: 'hidden' });
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

  // ─── Inquiries ──────────────────────────────────────────────────────
  describe('inquiries', () => {
    let inquiryId: string;

    it('cannot be sent to a fictional listing', async () => {
      expectRefused(await investor.client.from('inquiries').insert(inquiryRow(fictionalListing, investor)), '42501');
    });

    it('cannot be sent to an unavailable or hidden listing', async () => {
      const unavailable = await insertListing(owner, { availability: 'unavailable' });
      expectRefused(await investor.client.from('inquiries').insert(inquiryRow(unavailable, investor)), '42501');
      const hidden = await insertListing(owner, { status: 'hidden' });
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
      expectOk(await upload(owner, 'ownership-docs', documentPath, PDF, 'application/pdf'));

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
          .insert({ listing_id: openListing, owner_id: investor.id, document_path: `${investor.id}/fake.pdf` }),
        '42501',
      );
      expect((await investor.client.from('verification_requests').select('id').eq('id', requestId)).data).toEqual([]);
      expectRefused(await investor.client.storage.from('ownership-docs').download(documentPath));
      expectOk(await owner.client.storage.from('ownership-docs').download(documentPath));
      expectOk(await adminUser.client.storage.from('ownership-docs').download(documentPath));
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
  });

  // ─── Storage & listing images ──────────────────────────────────────
  describe('storage', () => {
    it('users can upload listing photos only into their own folder', async () => {
      const ownPhoto = `${owner.id}/${openListing}/photo-${RUN}.png`;
      expectOk(await upload(owner, 'listing-images', ownPhoto, PNG, 'image/png'));

      expectRefused(await upload(investor, 'listing-images', `${owner.id}/${openListing}/intruder-${RUN}.png`, PNG, 'image/png'));
      expectRefused(await upload(null, 'listing-images', `${owner.id}/anon-${RUN}.png`, PNG, 'image/png'));
      expectOk(await upload(investor, 'listing-images', `${investor.id}/own-${RUN}.png`, PNG, 'image/png'));

      // Removing someone else's file silently matches nothing.
      await investor.client.storage.from('listing-images').remove([ownPhoto]);
      expect(await fileExists('listing-images', ownPhoto)).toBe(true);
    });

    it('ownership documents can only be uploaded into the user’s own folder', async () => {
      expectRefused(await upload(investor, 'ownership-docs', `${owner.id}/${openListing}/fake-${RUN}.pdf`, PDF, 'application/pdf'));
    });

    it('listing_images rows must point into the owner’s folder, on the owner’s listing', async () => {
      expectRefused(
        await owner.client.from('listing_images').insert({ listing_id: openListing, storage_path: `${investor.id}/own-${RUN}.png` }),
        '42501',
      );
      expectOk(await owner.client.from('listing_images').insert({ listing_id: openListing, storage_path: `${owner.id}/${openListing}/photo-${RUN}.png` }));
      expectRefused(
        await investor.client.from('listing_images').insert({ listing_id: openListing, storage_path: `${investor.id}/own-${RUN}.png` }),
        '42501',
      );
      expectRefused(await anon.from('listing_images').insert({ listing_id: openListing, storage_path: `${owner.id}/x.png` }), '42501');
    });
  });
});
