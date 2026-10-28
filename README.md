# סולגג (SolGag)

A Hebrew/RTL marketplace that connects owners of large rooftops in Israel (warehouses, factories,
dairy barns, commercial buildings) with solar investors: discover rooftops on a map, assess them
with a transparent calculator, and contact the owner.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Supabase (Postgres + PostGIS, Auth,
Storage, RLS) · Leaflet · Turf.js · Resend · Vercel.

## Run locally

Requirements: Node 22+, Docker Desktop (for the local Supabase stack).
This machine has portable Node and Git in `.tools/` — in PowerShell:

```
$env:Path = "$PWD\.tools\node;$PWD\.tools\git\cmd;$env:Path"
```

```
npm install
npx supabase start          # local Postgres/Auth/Storage + Mailpit (http://127.0.0.1:55324)
                            # (ports 553xx: Windows/Hyper-V may reserve the default 543xx range)
npx supabase db reset       # applies migrations + 12 FICTIONAL demo listings (supabase/seed.sql)
copy .env.example .env.local   # then paste the anon + service_role keys printed by `supabase status`
npm run dev                 # http://localhost:3000
```

Sign-in uses a 6-digit email code. Locally, read it in Mailpit at http://127.0.0.1:55324.
Make yourself admin: `update public.profiles set is_admin = true where contact_email = 'you@example.com';`
(Supabase Studio at http://127.0.0.1:55323 → SQL editor).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` · `npm run lint` | Type and lint checks |
| `npm test` | Unit tests (calculator, geo, validation) |
| `npx vitest run --config tests/vitest.rls.config.ts` | Database security (RLS) tests against local Supabase |
| `npm run test:e2e` | End-to-end browser tests (Playwright + Edge) |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` |
| `node scripts/generate-demo-seed.mjs` | Regenerate the fictional demo listings |

## Project layout

```
supabase/migrations/   schema, RLS policies, triggers, storage buckets (source of truth)
supabase/seed.sql      fictional demo listings — local only
src/app/               routes: / (map), /listing/[id], /publish, /dashboard, /inquiries/[id],
                       /admin, /login, /account, /calculator, /about, /terms, /privacy, /api/*
src/components/        shared UI (shell, cards, calculator, map parts) + per-feature folders
src/lib/               domain types, labels, finance model, geo, validation, data access, Supabase clients
src/proxy.ts           session refresh + protected routes (Next.js 16 "proxy", formerly middleware)
docs/DEPLOY.md         production deployment guide
prototype/             the original click-through prototype (reference only)
```

## Trust & honesty rules (enforced in the database)

- Ownership is "verified" only after an admin approves a submitted document (`review_verification`).
- Owners cannot set verification, the fictional flag, or a technical "assessed" status themselves.
- Roof areas from drawn polygons are recomputed with PostGIS (geodesic m²) — client values are ignored.
- Fictional/demo listings are labelled and cannot receive inquiries.
- The calculator is illustrative: split after opex + reserve, before investment recovery, tax and financing.

See `docs/DEPLOY.md` to go live.
