// Loads data/prospects-import.json into the LOCAL Supabase stack through the same
// admin-only RPC the /admin/prospects upload uses (import_prospect_batch), as a local
// test admin (pilot-admin@example.test, created here; sign in with an email code from Mailpit).
// Run from the project root:
//   $env:SUPABASE_SERVICE_ROLE_KEY = (npx supabase status -o json | ConvertFrom-Json).SERVICE_ROLE_KEY
//   node research/prospects-emek-hefer-park/load-local.mjs
// Refuses any non-local Supabase URL. Production data is loaded by an admin through the upload form.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const URL_ = (process.env.SUPABASE_URL ?? 'http://127.0.0.1:55321').replace(/\/$/, '');
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(URL_)) throw new Error(`refusing non-local Supabase URL ${URL_}`);
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_ANON_KEY ?? fs.readFileSync('.env.local', 'utf8').match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
if (!SERVICE || !ANON) throw new Error('set SUPABASE_SERVICE_ROLE_KEY (local) and have NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');

const EMAIL = 'pilot-admin@example.test';
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const db = createClient(URL_, SERVICE, opts);

const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
let user = list.users.find((u) => u.email === EMAIL);
if (!user) {
  const { data, error } = await db.auth.admin.createUser({ email: EMAIL, email_confirm: true, user_metadata: { full_name: 'מנהל/ת פיילוט (מקומי)' } });
  if (error) throw error;
  user = data.user;
}
const { error: adminErr } = await db.from('profiles').update({ is_admin: true, full_name: 'מנהל/ת פיילוט (מקומי)' }).eq('id', user.id);
if (adminErr) throw adminErr;

// Sign in as that admin without a password: a one-time magic-link token, verified directly.
const { data: link, error: linkErr } = await db.auth.admin.generateLink({ type: 'magiclink', email: EMAIL });
if (linkErr) throw linkErr;
const client = createClient(URL_, ANON, opts);
const { error: otpErr } = await client.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
if (otpErr) throw otpErr;

const payload = JSON.parse(fs.readFileSync(path.resolve('research/prospects-emek-hefer-park/data/prospects-import.json'), 'utf8'));
const { generatedAt, sources, ...p } = payload;
const { data, error } = await client.rpc('import_prospect_batch', { p });
if (error) throw error;
console.log('imported', data);
