# Deploying SolGag to production

Production = **Vercel** (Next.js app) + **Supabase** (Postgres/PostGIS, Auth, Storage) + **Resend** (email).
Both Vercel functions (`fra1`, see `vercel.json`) and the Supabase project should be in Frankfurt
(`eu-central-1`) — the closest regions to Israel — so database round-trips stay fast.

> Steps marked 👤 need the account owner (creating accounts, logging in, entering passwords or
> payment details). Everything else can be run by a developer/agent once those are done.

## 1. Supabase project

1. 👤 Create an account at https://supabase.com and a new project:
   - Region: **Central EU (Frankfurt)**
   - Save the **database password** in a password manager.
2. 👤 In a terminal in this folder, log in and link (the CLI opens a browser; `link` asks for the DB password):
   ```
   npx supabase login
   npx supabase link --project-ref <project-ref>
   ```
3. Apply the schema (all tables, RLS policies, triggers, storage buckets):
   ```
   npx supabase db push
   ```
   `supabase/seed.sql` (12 fictional demo listings) is **not** applied by `db push`. Do not load it
   in production unless you deliberately want labelled demo content.
4. 👤 Dashboard → **Authentication**:
   - **URL Configuration**: Site URL = `https://<your-domain>`; Redirect URLs add `https://<your-domain>/**`
     (and the Vercel preview pattern `https://*-<team>.vercel.app/**` if you use previews).
   - **Email Templates** → "Magic Link" and "Confirm signup": subject `קוד הכניסה שלך לסולגג`,
     body = contents of `supabase/templates/otp.html` (it shows the 6-digit `{{ .Token }}`).
   - **SMTP Settings**: enable custom SMTP (Supabase's built-in mailer is limited to a few
     emails per hour and is not for production). With Resend: host `smtp.resend.com`, port `465`,
     user `resend`, password = Resend API key, sender = `no-reply@<your-domain>`.
   - **Rate limits**: raise "emails sent per hour" to match expected sign-ins (e.g. 100).
   - Optional phone login: **Providers → Phone** with an SMS provider (Twilio / Vonage / MessageBird),
     then set `NEXT_PUBLIC_AUTH_PHONE_ENABLED=true` in Vercel.
5. Copy from **Project Settings → API**: Project URL, `anon`/publishable key, `service_role` key (secret).

## 2. Email (Resend)

1. 👤 Create an account at https://resend.com, add and verify your domain (DNS records).
2. 👤 Create an API key. Use it for both Supabase SMTP (above) and `RESEND_API_KEY` (below).

## 3. Map tiles (required — production builds refuse to ship without them)

The free OpenStreetMap tile server and Esri's keyless World Imagery are not licensed for
commercial traffic. `next.config.ts` fails a production build unless both providers below
are configured (temporary escape hatch: `ALLOW_KEYLESS_TILES=true`).

1. 👤 **MapTiler** (street map + address search) — https://cloud.maptiler.com
   - Plan: **Flex** (/month, 500k requests, then .15/1k; set a spending limit). Free is non-commercial.
   - Key 1 → `NEXT_PUBLIC_MAPTILER_KEY`: restrict **Allowed HTTP origins** to your site URLs
     (`https://<your-domain>`, `https://www.<your-domain>`, `https://solgag-mu.vercel.app`, `http://localhost:3000`).
   - Key 2 → `MAPTILER_GEOCODING_KEY` (server only, no origin restriction, mark Sensitive). Without it,
     address search falls back to OpenStreetMap Nominatim (low volume only).
2. 👤 **Esri ArcGIS Location Platform** (aerial imagery) — https://location.arcgis.com
   - Free account: 2M basemap tiles/month included, then .15/1k (pay-as-you-go needs billing details).
   - Create an **API key** with the **Basemaps** privilege, **referrer restrictions** set to the same site
     URLs, and an expiration date (put a renewal reminder in your calendar) → `NEXT_PUBLIC_ESRI_API_KEY`.
   - Display only: Esri's terms forbid downloading/extracting imagery or deriving data from it outside
     ArcGIS apps. The site's terms page passes this restriction on to users.
3. Attribution ("© MapTiler © OpenStreetMap contributors" / "Powered by Esri | Source: Esri, Vantor,
   Earthstar Geographics…") is added automatically by `src/lib/config.ts`.
## 4. Vercel

1. 👤 Create an account at https://vercel.com, then in this folder:
   ```
   npx vercel login
   npx vercel link
   ```
2. Set environment variables (Production + Preview) — Dashboard → Project → Settings →
   Environment Variables, or `npx vercel env add <NAME> production`:

   | Name | Value | Secret? |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | no |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key | no |
   | `NEXT_PUBLIC_SITE_URL` | `https://<your-domain>` | no |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key | **yes** |
   | `RESEND_API_KEY` | Resend API key | **yes** |
   | `NOTIFY_FROM_EMAIL` | `סולגג <no-reply@<your-domain>>` | no |
   | `NEXT_PUBLIC_MAPTILER_KEY` | MapTiler key (origin-restricted) | no |
   | `MAPTILER_GEOCODING_KEY` | MapTiler key for server geocoding | **yes** |
   | `NEXT_PUBLIC_ESRI_API_KEY` | Esri API key (referrer-restricted) | no |
   | `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | 32-byte base64 key, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` | **yes** |

   The fixed Server Actions key keeps forms working for visitors who still have the
   previous version open during a deploy. Also enable **Skew Protection** (Project →
   Settings → Advanced) so old browser tabs keep talking to the deployment they loaded.

3. Deploy:
   ```
   npx vercel deploy --prod
   ```
4. 👤 Add your domain in Vercel → Domains and update DNS.

## 5. After the first deploy

1. Sign in on the live site with your email (creates your profile).
2. Make yourself an admin — Supabase → SQL Editor:
   ```sql
   update public.profiles set is_admin = true
   where id = (select id from auth.users where email = 'you@example.com');
   ```
3. Smoke test: publish a rooftop, sign in as a second user, send an inquiry, reply, submit an
   ownership document and approve it in `/admin`.

## 6. Business-prospect pilot (admin-only)

`/admin/prospects` shows candidate commercial roofs and the businesses publicly listed at them
(research in `research/prospects-emek-hefer-park/`, licences in its `LICENSES-AND-CHECKS.md`).
The tables are admin-only (RLS) and nothing appears on the public site.

1. Schema: migrations `20261020000000_prospects.sql` and `20261020010000_prospects_import_prune.sql`
   (already pushed to production with `npx supabase db push`).
2. Data: sign in as an admin, open `/admin/prospects` → „ייבוא אצווה ממחקר” → upload
   `research/prospects-emek-hefer-park/data/prospects-import.json`. Re-importing is safe: reviewed
   rows are never overwritten. No service-role key is needed.
3. Vercel previews get the public Supabase URL/key at deploy time
   (`vercel deploy --build-env NEXT_PUBLIC_SUPABASE_URL=… --build-env NEXT_PUBLIC_SUPABASE_ANON_KEY=…`),
   or set them once for the Preview environment in Vercel. Supabase Auth allows
   `https://solgag-*-solgag.vercel.app/**` as a redirect, so sign-in works on previews.
4. Do not contact businesses from this data before a legal check (Communications Law §30A,
   Privacy Protection Law incl. Amendment 13).

## 7. Before a public launch (non-technical)

- Legal review of `/terms` and `/privacy` (drafts) — Israeli Privacy Protection Law incl.
  Amendment 13, database registration/notification duties if applicable, Data Security Regulations.
- Securities/investment-advice check: if the platform will match investors to projects for a fee
  or show projected returns, get advice regarding Israel Securities Authority rules.
- Fill the operator details in **`src/components/site/legalInfo.tsx`** (company name and number,
  address, contact and privacy emails, court district, hosting regions, email/SMTP provider,
  log and backup retention). They feed `/terms`, `/privacy` and `/about`; until they are filled,
  the pages show highlighted placeholders and a draft banner, and the production build logs a warning.
- Enable Supabase **Point-in-Time Recovery / daily backups** (paid plans) and set up uptime alerts.

## Updating production later

```
git pull                 # or your normal workflow
npx supabase db push     # only if supabase/migrations changed
npx vercel deploy --prod
```
