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

## 3. Map tiles (required before real traffic)

The defaults (OpenStreetMap public tiles, Esri World Imagery) are fine for development but their
usage policies do not allow production traffic without an agreement/account.

1. 👤 Create a MapTiler account (https://www.maptiler.com) — free tier to start.
2. 👤 Create a key restricted to your domain, then set:
   ```
   NEXT_PUBLIC_MAP_TILE_URL=https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=KEY
   NEXT_PUBLIC_MAP_TILE_ATTRIBUTION=<a href="https://www.maptiler.com/copyright/">© MapTiler</a> <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>
   NEXT_PUBLIC_IMAGERY_TILE_URL=https://api.maptiler.com/maps/satellite/256/{z}/{x}/{y}.jpg?key=KEY
   NEXT_PUBLIC_IMAGERY_TILE_ATTRIBUTION=<a href="https://www.maptiler.com/copyright/">© MapTiler</a> © Maxar
   ```
   For sharper rooftop imagery consider licensed orthophotos (Survey of Israel / GovMap) later.
3. Optional: `GOOGLE_MAPS_API_KEY` (Geocoding API, server-side only, restricted by API) for better
   Hebrew address search. Without it the app uses OpenStreetMap Nominatim, which is OK for low volume.

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
   | `NEXT_PUBLIC_MAP_TILE_URL` … | see step 3 | no (restrict key by domain) |
   | `GOOGLE_MAPS_API_KEY` | optional | **yes** |
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

## 6. Before a public launch (non-technical)

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
