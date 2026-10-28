# Potential roofs: Phase 1 technical design

*Status:* design proposal. Nothing in the app, migrations or `.env` files has been changed.
*Date:* 2026-10-19. All web facts below were read on 2026-10-19 unless a different date is given. The full list of links is in §14.
*Scope:* the offline pipeline, the database (schema, RLS, triggers, RPCs), the public map layer, the admin review screen, the claim flow, opt-out and privacy mechanics, the audit log, monitoring, imagery costs, the work breakdown and the risks.
*Reads with:* `research/pilot-emek-hefer/*`. The datasources, imagery-licensing and legal workstreams may write their own files under `docs/phase1/`. This document leaves explicit hooks for them (marked **HOOK**).

---

## 0. Decisions at a glance

| Topic | Recommendation for Phase 1 | Why |
|---|---|---|
| Where ingestion runs | A **local Node script** against the **local Supabase Postgres/PostGIS** (already used for dev, port 55322). The prod database gets small staged batches plus a transactional `ingest.apply_batch()`. Package it later as a `workflow_dispatch` GitHub Action. | Parsing Microsoft (MS) footprint tiles means hundreds of MB per z9 tile (the pilot tile `ms-122112223.geojsonl` is 167 MB and holds 408,837 footprints). Supabase Edge Functions are capped at 256 MB RAM and 2 s CPU, so they are unsuitable. |
| Published geometry | **Microsoft Global ML Building Footprints only** (CDLA-Permissive-2.0). The production database never stores OSM or Overture data. | This avoids ODbL share-alike on the public layer. Area, kWp and MWh are "Results", which CDLA leaves unrestricted. |
| Tiering | An ODbL-free score: MS confidence, shape metrics, neighbourhood density from MS itself, own listings, and **HOOKs** for permissive context (e.g. GHS-BUILT-C, CC BY 4.0). Tier only orders the review queue and sets the QA rate; the public never sees it. | Without OSM land use, the pilot pool grows from 992 to about 2,294 roofs (MS ≥1000 m², `audit/recompute-core.json`). The score has to recover that filtering. |
| Publication gate | **Human review is mandatory.** Only `good_bare_roof` and `solar_partial` (with a free share) get published. A deterministic QA sample gets a second blind review. | Pilot: Tier A was only about 42% good (5/12), and about 1 in 4 outlines was wrong. |
| Public serving | **Mapbox Vector Tiles from PostGIS** (`ST_AsMVT`) via a PostgREST RPC, served by a Next route handler on the Vercel CDN (`Vercel-CDN-Cache-Control` plus `Vercel-Cache-Tag`), with **`revalidateTag` purge on opt-out**. Low zoom shows clusters from a small JSON endpoint. | Status changes (opt-out, claim) must show up in minutes. Prebuilt PMTiles would need a rebuild and re-upload for every change. |
| Map library | **Stay on Leaflet 1.9 / react-leaflet 5.** Render MVT with `leaflet-vector-tile-layer` 0.16.3 (SVG, maintained, Dec 2025). Fallback: GeoJSON-per-tile from the same SQL. Moving to MapLibre is a Phase 2 option (8–12 pd). | Leaflet.VectorGrid is unmaintained (last release 1.3.0 in 2017) and its canvas click handling breaks on Leaflet ≥1.8. protomaps-leaflet is "in maintenance mode". |
| Review screen | `/admin/potential` with a **grid mode** (12 roofs, bulk *reject* only) and a **single mode**. Keyboard-driven via `KeyboardEvent.code`, so it works with the Hebrew layout. Queue locks use `FOR UPDATE SKIP LOCKED`. Imagery comes from a provider registry, and each decision records the provider used. | Measured throughput feeds the cost and effort model. Provider provenance matters if a licence later turns out not to cover QA. |
| Claim flow | "זה הגג שלי — לפרסום" → login → `/potential/[pid]/claim` → `start_roof_claim` RPC → `/publish?claim=…` → the existing wizard, pre-filled with the roof polygon → the listing insert carries `potential_roof_id`, which `listings_guard` checks against an open claim and real overlap. After that the roof is hidden (`claimed`), and the existing ownership verification runs unchanged. | Reuses the existing wizard, trust model and verification flow. Linking is enforced in the database. |
| Opt-out | A public form with **no login**, protected by Cloudflare Turnstile (free) and an HMAC'd IP rate limit. An email double opt-in hides the roof immediately on confirmation. A signed-in requester is hidden immediately. Every opt-out adds a **suppression geometry**, so re-ingestion never re-publishes the roof. | Privacy-first, with bounded abuse. |
| Audit | A new append-only `admin_audit_log`, written only by SECURITY DEFINER triggers and RPCs. It also covers **existing** admin actions (hide, tech status, verification decisions, delete), which have no audit trail today. | This gap exists today regardless of this feature. |
| Plans | Before launch, move to **Supabase Pro ($25/mo)** and **Vercel Pro ($20/mo)**. | Supabase Free pauses after one week of inactivity and has no backups. Vercel Hobby is "for personal, non-commercial use". |

Estimated development effort: **about 45–62 person-days**, or 9–12 weeks for one developer (§11). Human review time for the Phase-1 region comes on top (§2).

---

## 1. What the existing codebase dictates

Facts from the repo that shape the design. File references are given so reviewers can check them.

1. **The database is the authority.** Every table has RLS. Trust columns are protected by `SECURITY INVOKER` guard triggers that call `public.is_untrusted_caller()` (`current_user in ('anon','authenticated') and not is_admin()`). Privileged transitions go through `SECURITY DEFINER` RPCs (`review_verification`). Rate limits use per-key `pg_advisory_xact_lock` plus count-then-insert, and errors are raised in Hebrew with `errcode` 22023, 54000, 42501, P0002 or 23505 (`supabase/migrations/20261019010000_review_fixes.sql`). New tables follow exactly this pattern.
2. **The publish wizard writes directly from the browser through PostgREST.** `ListingWizard.submit()` calls `supabase.from('listings').insert({...row, owner_id})`. The claim link therefore has to be enforced in `listings_guard` and AFTER triggers, not in a Server Action.
3. **`listings_guard` already recomputes geodesic area** with `extensions.st_area(footprint)` and caps footprints at 201 points and one ring (`footprint_size_limit`). MS outlines handed to the wizard must stay within 200 vertices (almost all MS outlines have fewer than 20).
4. **The anon role has column-level SELECT on `listings`** (review_fixes §6). A new `listings.potential_roof_id` column is therefore invisible to anon by default, which is good. `listing_feed` is a `security_invoker` view; it is not changed.
5. **`src/proxy.ts` runs on every non-static path, including `/api/*`.** It calls `supabase.auth.getUser()` and may `set-cookie`. Vercel will not CDN-cache a response that carries `set-cookie`, and Routing Middleware runs *before* the CDN cache. **The tile and cluster routes must be excluded from the proxy matcher.**
6. **CSP** (`next.config.ts`): `connect-src 'self' <supabase>`, `img-src … https:`, no `frame-src` (so it falls back to `default-src 'self'`). Same-origin tile routes need no change. **Turnstile needs `script-src` and `frame-src https://challenges.cloudflare.com`.** A later MapLibre move would need `connect-src` for any third-party vector or style host, because MapLibre fetches tiles with `fetch`.
7. **Admin powers come from `profiles.is_admin` through RLS, never from the service role** (`src/app/admin/actions.ts`, `_lib/data.ts`). Admin Server Actions re-check `adminGate()`. The only service-role use today is looking up a notification email (`src/lib/supabase/admin.ts`). Opt-out adds one more narrow service-role path (§8.1), because anonymous callers must not hit PostgREST directly.
8. **There is no audit log.** `setListingAdminHidden`, `setListingTechAssessment`, `deleteListing` (admin) and `review_verification` leave only the latest state (`verification_requests.reviewer_id` is the only trace).
9. **Map stack:** Leaflet 1.9.4 and react-leaflet 5.0.0. Four files import Leaflet (`ExploreMap.tsx`, `mapParts.tsx`, `DrawMap.tsx`, `ListingMapView.tsx`), and the e2e specs reference `.leaflet-*` selectors in 7 places. Base layers come from `NEXT_PUBLIC_MAP_TILE_URL` and `NEXT_PUBLIC_IMAGERY_TILE_URL`, which default to keyless OSM and Esri tiles (`src/lib/config.ts`). Those defaults must be replaced before launch (`docs/DEPLOY.md` §3).
10. **Capacity constants already exist:** `DEFAULT_ASSUMPTIONS.sqmPerKw = 6.5` and the wizard default `USABLE_PCT.default = 65`. The pilot used the same values (0.65 and 6.5 m²/kWp), and the potential layer must reuse them so a claimed roof shows the same numbers on both surfaces. PVGIS is already proxied in `src/app/api/pvgis/route.ts` (v5_3, `optimalangles=1`, 0.01° rounding, 30-day cache).
11. **Explore loads all listings into the client** (`getPublishedListings()`, limit 500). The potential layer must **not** go through that path; it is tile-based and independent.

---

## 2. Scale assumptions (to be replaced by the first real run)

| Quantity | Value | Basis |
|---|---|---|
| Pilot area | 188 km² (32.30–32.42N, 34.85–35.00E) | `data/stats.json` |
| MS footprints in the pilot | 43,124 | stats.json |
| MS footprints ≥1000 m² (pilot) | **2,294** | `audit/recompute-core.json` (`msGe1000`) |
| Candidates after OSM-based exclusions (v2) | 992 (A 238, B 231, C 523) | stats.json. **Not reproducible without OSM** (§3.5) |
| Real opportunities in Tier A (pilot) | about 100–120 | brief (42% of 238 good, plus partials) |
| OSM-only large roofs lost by an MS-only pipeline | 60 of 992 (6%) | stats.json `bySource.osm_only` |
| National MS ≥1000 m² | **about 30k–60k** (UNVERIFIED extrapolation; greenhouse-heavy areas inflate it) | pilot density 12/km² is denser than the national average |
| Prod rows if all national ≥1000 m² are loaded | about 60k × about 1.1 KB (row, 2 geometries, 4 indexes) ≈ **70 MB** | estimate. Supabase Free allows 500 MB, Pro 8 GB |
| Phase-1 geographic scope | Pilot plus neighbouring regions (Sharon / Emek Hefer / Hadera / Valleys): about 3k Tier A+B to review | recommendation |
| Review throughput (planning) | about 200–250 roofs/h in grid mode, 120–180/h in single mode | estimate. **M2 acceptance measures it** |
| Review hours, Phase-1 region | 3,000 / 220 ≈ **14 h**, plus QA (10–20%) ≈ 16–17 h | derived |
| Review hours, national (Tier A+B) | 10k–20k roofs → 45–90 h | derived |

**Important consequence:** without OSM land use, the residential (819) and greenhouse-area (606) exclusions disappear. In the pilot the review pool rises from 992 to about 2,294 unless the ODbL-free score in §3.5 recovers that filtering. Recommendation: review the **entire** pilot MS ≥1000 m² set once (about 2.3k roofs, roughly 10 reviewer hours). This produces the ground-truth labels for tuning and validating the score (§11, M2).

---

## 3. Offline ingestion pipeline

### 3.1 Where it runs

| Option | Fit | Verdict |
|---|---|---|
| **Supabase Edge Function** | Max memory 256 MB, max CPU time 2 s per request, wall clock 150 s (Free) or 400 s (paid) (Supabase docs). A single z9 MS tile is 167 MB of GeoJSONL. | **Rejected** for ingestion. Acceptable only for tiny jobs, and even those are better in Vercel cron. |
| **Local Node script plus local Supabase Postgres (Docker)** | Already set up (`npx supabase start`, PostGIS included). Unlimited memory, free, debuggable, and an operator watches dry-run diffs. | **Phase 1 choice.** |
| **GitHub Actions** | Private repo: 2,000 free minutes/month, `ubuntu-latest` = 2 vCPU / 8 GB / 14 GB SSD, 6 h job limit. Public repos are free on 4 vCPU / 16 GB. Linux overage $0.006/min. Can run a PostGIS service container. | **Phase 1.5:** the same scripts behind `workflow_dispatch`, with the prod DB URL as a repo secret. A national run is estimated at 20–60 min, so $0. |
| Vercel function or cron | Function time limits, no local disk, no PostGIS. | Used only for the daily health job (§8.4). |

### 3.2 Stages and files

New folder `scripts/potential/` (Node ESM, like `scripts/generate-demo-seed.mjs`). One new dev dependency: `pg` (node-postgres) for `COPY`.

```
scripts/potential/
  README.md                 runbook (commands, env, dry-run/apply, rollback)
  config.mjs                regions (bbox/polygons), thresholds, tier weights, enabled context providers
  run.mjs                   orchestrator: --release --region --steps --target local
  01-fetch-ms.mjs           versioned index lookup + range-request binary search (from research/.../fetch-ms.mjs), sha256 manifest
  02-load.mjs               stream GeoJSONL → filter → COPY into local pipeline.ms_large; density grid in-stream
  sql/00-schema.sql         local-only schema "pipeline" (NOT in supabase/migrations)
  sql/03-features.sql       area, shape and neighbourhood metrics (EPSG:2039 Israeli TM for metres)
  context/<provider>.mjs    HOOK: permissive context layers → pipeline.context_features
  04-tier.mjs               ODbL-free score → tier A/B/C (+ licence gate)
  05-pvgis.mjs              PVGIS per 0.1° cell (cached), ≤1 req/s
  06-stage.mjs              write pipeline.out → prod ingest.potential_batch (COPY), create ingest_runs row
  07-apply.mjs              prod: BEGIN; select ingest.apply_batch(run); COMMIT | ROLLBACK (--dry-run default)
  lib/{quadkey,geojsonl,hash,pg}.mjs
.github/workflows/potential-ingest.yml   (Phase 1.5, workflow_dispatch only)
```

Environment (operator machine or GitHub secret only; `.env*` is already gitignored):
- `PIPELINE_LOCAL_DB_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres` (local stack default)
- `PIPELINE_PROD_DB_URL`: the Supavisor **session** pooler URI, port 5432, IPv4. Secret, never a `NEXT_PUBLIC_*`.

**Stage details**

1. **Fetch (01).** MS now publishes a **dated index**. The 2026-08-13 refresh lives at `https://bfppub.blob.core.windows.net/$web/2026-08-13/dataset-links.csv`, and dataset hosting moved on 2026-07-24 (MS README, read 2026-10-19). The pilot's `fetch-ms.mjs` uses the older `minedbuildings…/dataset-links.csv` and must be pointed at the dated index. Steps:
   - Binary-search the `Israel` rows with HTTP range requests.
   - Download only the quadkeys that intersect the configured regions to `data/potential/raw/<release>/<quadkey>.geojsonl.gz`. This path must be gitignored; extend the existing `/research/**/raw/` rule with `/data/potential/`.
   - Write `manifest.json` with `{quadkey, url, bytes, sha256}`.
   - A re-run with an identical manifest is a no-op.
2. **Load (02).** Stream line by line, which needs constant memory. For every feature:
   - Compute a cheap planar area estimate.
   - Keep the polygon only if its estimated area is ≥ 800 m² (20% under the 1000 m² threshold, to tolerate the estimate) and its centroid falls inside the region mask.
   - Increment a 100 m density grid for **all** buildings (count of small, count of large, summed area). This makes neighbourhood context available without storing millions of rows.
   - `COPY` the survivors into `pipeline.ms_large(release, quadkey, geom geometry(Polygon,4326), confidence, height, source_key)`.
   - `source_key = md5(ST_AsBinary(ST_SnapToGrid(geom, 1e-7)))` is a deterministic identity within a release, because MS has no feature ids.
3. **Features (03, SQL in local PostGIS).**
   - `area_sqm = ST_Area(geom::geography)`. This is the same geodesic method as `listings_guard`; the pilot audit found the sphere/ellipsoid ratio is 1.00065.
   - `rectangularity = ST_Area(g2039) / ST_Area(ST_OrientedEnvelope(g2039))`.
   - `elongation` = long side / short side of the oriented envelope.
   - `n_vertices`.
   - `n_large_300m`: the count of large buildings within 300 m.
   - `parallel_neighbours_50m`: neighbours whose envelope azimuth is within 5° and whose elongation is > 3. This is the tunnel-greenhouse signature.
   - From the density grid: `small_bldg_density_200m`, which is residential-ness.
   - `ms_confidence`.
4. **Context hooks.** Each `context/*.mjs` exports `{ id, license, licenseUrl, allowedInPublishedLayer, run(db, region) }` and writes `pipeline.context_features(source_key, provider, key, value)`. Candidates:
   - **GHS-BUILT-C R2023A** (10 m, 2018). It splits the built domain into residential and non-residential (JRC/AWS registry). Its licence is listed as CC BY 4.0 on the AWS registry and as "EC reuse notice, attribution" in the Earth Engine catalogue. `allowedInPublishedLayer: true`, needs attribution.
   - ESA WorldCover (CC BY 4.0) for cropland vs built-up. UNVERIFIED for the greenhouse distinction.
   - Israeli government open data (data.gov.il industrial zones or zoning). Licence UNVERIFIED; leave for the datasources workstream.
   - An **OSM** provider for research only: `allowedInPublishedLayer: false`.
5. **Licence gate (04).** When `--target` is a prod run, `04-tier.mjs` refuses to emit if any enabled provider has `allowedInPublishedLayer: false`. This covers OSM, Overture and anything unreviewed, and it guards against accidentally mixing ODbL data into the published layer. An `osm_assisted` mode exists **only** for local research comparisons (§3.5).
6. **PVGIS (05).** Use one call per 0.1° cell (about 11 × 9 km). Israel's bbox has 18 × 40 = 720 cells, of which at most about 300 hold candidates.
   - The PVGIS limit is **30 calls/s per IP**, with HTTP 429 above it. The script stays at **≤1 req/s**, so a full refresh takes about 5–12 minutes.
   - Parameters: `peakpower=1&loss=14&mountingplace=building&angle=10&aspect=0&pvtechchoice=crystSi&outputformat=json`. This is a conservative low-tilt rooftop case, unlike the pilot's optimistic `optimalangles=1` (E_y 1,677 kWh/kWp at 32.36N, 34.92E).
   - Cache in `pvgis_cells` (prod) keyed by cell plus `params_hash`. The rooftop-parameter E_y for Israel has not been computed here (UNVERIFIED; expect it below 1,677).
7. **Stage (06) and apply (07).** See §3.7. The pipeline **never publishes**. New candidates always land as `candidate`. Only an existing `published` roof whose new geometry matches with IoU ≥ 0.9 stays `published`.

### 3.3 Source releases, idempotency, re-runs

- `source_releases.id = 'ms-gmlbf-<YYYY-MM-DD>'` is the dated index folder. It stores the licence (`CDLA-Permissive-2.0`) and the licence URL. MS's README is inconsistent about imagery years: the intro says 2014–2024, the FAQ says 2014–2021. Store the text; the public "data vintage" copy uses the conservative wording "צילומים מהשנים 2014–2024".
- `ingest_runs(id, release_id, region, git_sha, params, started_at, staged_at, applied_at, status, counts jsonb, error)`.
- Idempotency comes from four guards:
  1. The fetch is keyed by the manifest sha256.
  2. Loading truncates `pipeline.*` for `(release, region)` and reloads, so local runs are deterministic.
  3. Rows in `ingest.potential_batch` are keyed by `(run_id, source_key)`.
  4. `apply_batch` refuses a run that is already `applied`. A *new* run with unchanged content produces zero inserts and zero updates, because matched rows with an equal `source_key` are skipped. Re-running is safe by construction, and the operator sees a dry-run diff first.
- When MS publishes a new release, re-run only the quadkeys whose URL or size changed in the new index. Roof identity carries across releases by geometry matching (§3.7), so review decisions are not lost.

### 3.4 Area, capacity, yield

These are computed in prod by the `potential_roofs_guard` trigger, so the database is the only place the numbers come from. This mirrors `listings_guard`.

```
area_sqm        = round(ST_Area(footprint::geography), 1)        -- geodesic
est_kwp         = round(area_sqm * usable_ratio / 6.5, 1)          -- usable_ratio default 0.65 (= wizard default)
est_kwp_public  = round(est_kwp * free_share, 1)                   -- free_share from review (solar_partial: 0.25/0.5/0.75)
est_mwh_year    = est_kwp_public * pvgis_cells.e_y / 1000          -- computed on read (public fn), shown as ±15% range
```

What the public sees is rounded: area to the nearest 50 m², kWp to the nearest 10. It is labelled **"גבול עליון טכני, DC"** (technical upper bound, DC), matching the pilot copy. No ₪ figures appear on unclaimed roofs, because `DEPLOY.md` §6 flags securities/investment-advice risk.

### 3.5 Tiering without ODbL

The score is computed locally and stored in `tier_score`. The features go into `tier_features`, which is admin-only.

```
score = w1·logit(ms_confidence)
      + w2·clamp(rectangularity) − w3·[elongation > 4] − w4·log1p(parallel_neighbours_50m)
      − w5·small_bldg_density_200m + w6·log1p(n_large_300m) + w7·log(area_sqm)
      + Σ context weights (e.g. + w8·ghsl_nonres_share)          -- HOOK
tier  = A if score ≥ q70, B if ≥ q40, else C                       -- quantiles per region, re-fit on labels
```

- **Initial weights** are hand-set and validated on the 48 existing pilot labels. They are then **re-fit with logistic regression** on the full pilot review (M2). Labels come from prod via an `export-labels` script that reads `review_decisions` over the privileged connection.
- **Acceptance (M2):** Tier A+B must contain **≥85% of all `good_bare_roof` plus `solar_partial` labels** while holding **≤50% of the candidates**. If it does not, add the GHS-BUILT-C hook, or legal decides on `osm_assisted` (see the next bullet).
- **`osm_assisted` mode (grey zone, off by default):** OSM land use is used *only* to order the internal review queue, never stored in prod and never shipped. Whether a published "Microsoft geometry plus human decision" layer selected with OSM help is a Derivative Database is UNVERIFIED and goes to legal (brief). The licence gate (§3.2.5) blocks this mode in prod runs until a config flag is flipped with a recorded legal sign-off reference.
- Each roof's `provenance` jsonb records `{release, context_providers, pvgis_params_hash, scorer_version}`. This feeds the methodology page and any licence audit.

### 3.6 Exclusions and dedup (inside `apply_batch` in prod, where the authoritative data lives)

| Rule | Implementation |
|---|---|
| Below threshold | `area_sqm < 1000` → not staged (configurable per region) |
| Existing real listing | A candidate whose footprint contains `listings.location`, or overlaps a listing footprint by ≥30% of the roof area, for non-fictional listings → inserted as `claimed` with `listing_id`, never shown |
| Opted out or suppressed | Overlap ≥30% with any `roof_suppressions.footprint` → skipped and counted |
| Sensitive sites | Overlap with an admin-maintained `exclusion_zones` geometry → skipped. Reviewers can also choose `sensitive_site`, which proposes a zone. Do **not** derive zones by tracing imagery (licence) |
| Outside Israel | The same `st_makeenvelope(34.2, 29.4, 35.95, 33.4)` as `listings_guard`, plus the region mask |

### 3.7 Identity across releases and the apply step

The prod-side schema `ingest` is **not** in PostgREST's exposed schemas (`config.toml`: `schemas = ["public","graphql_public"]`):

```sql
-- supabase/migrations/20261101000400_ingest.sql (sketch)
create schema if not exists ingest;
revoke all on schema ingest from public, anon, authenticated;

create table ingest.potential_batch (
  run_id        bigint not null references public.ingest_runs (id) on delete cascade,
  source_key    text   not null,
  footprint     extensions.geometry(Polygon, 4326) not null,
  tier          char(1) not null check (tier in ('A','B','C')),
  tier_score    real not null,
  tier_features jsonb not null,
  source_confidence real,
  pvgis_cell    text,
  provenance    jsonb not null,
  primary key (run_id, source_key)
);

-- Runs as the privileged pipeline connection. One transaction; 07-apply.mjs wraps it in
-- BEGIN … ROLLBACK for --dry-run and prints the returned counts.
create function ingest.apply_batch(p_run bigint) returns jsonb
language plpgsql set search_path = '' as $$
declare v_release text; c jsonb := '{}';
begin
  select release_id into v_release from public.ingest_runs where id = p_run and status = 'staged' for update;
  if v_release is null then raise exception 'run % not staged (already applied?)', p_run; end if;

  -- 1. Match each staged footprint to an existing roof (IoU ≥ 0.7, best match wins).
  create temp table m on commit drop as
  select distinct on (b.source_key) b.source_key, r.id as roof_id, r.status,
         extensions.st_area(extensions.st_intersection(b.footprint, r.footprint::extensions.geometry)::extensions.geography)
       / nullif(extensions.st_area(extensions.st_union(b.footprint, r.footprint::extensions.geometry)::extensions.geography), 0) as iou
    from ingest.potential_batch b
    join public.potential_roofs r
      on r.footprint operator(extensions.&&) b.footprint::extensions.geography
     and extensions.st_intersects(r.footprint, b.footprint::extensions.geography)
   where b.run_id = p_run
   order by b.source_key, iou desc;
  delete from m where iou < 0.7;

  -- 2. Matched: refresh source fields. Geometry change (IoU < 0.9) on a reviewed roof → back to review.
  -- 3. New: insert 'candidate' unless suppressed / sensitive (skip) or covered by a real listing ('claimed').
  -- 4. Roofs in the run's region not matched by any staged row and still candidate/published/rejected → 'superseded'.
  -- 5. Upsert pvgis cells (staged separately), write counts, mark run 'applied'.
  update public.ingest_runs set status = 'applied', applied_at = now(), counts = c where id = p_run;
  return c;
end $$;
```

---

## 4. Database schema

Four migrations, named like the existing ones:
- `supabase/migrations/20261101000000_potential_roofs.sql`: enums, tables, guard triggers, RLS, layer state
- `…000100_potential_rpcs.sql`: tile, cluster, public detail, claim, review and removal RPCs
- `…000200_listing_potential_link.sql`: listings column, guard additions, link triggers
- `…000300_admin_audit_log.sql`: audit table, helper, triggers on existing and new tables
- `…000400_ingest.sql`: §3.7

Then run `npm run db:types` to regenerate `src/lib/database.types.ts`.

### 4.1 Enums and core tables (SQL sketch)

```sql
create type public.potential_status as enum (
  'candidate',   -- from pipeline, never public
  'in_review',   -- locked by a reviewer (locked_by/locked_until)
  'qa_pending',  -- decided, waiting for blind second review (sampled)
  'published',   -- the ONLY publicly visible state
  'rejected',    -- not publishable (greenhouse, covered, wrong outline, …)
  'claimed',     -- a real listing now covers it (claim or organic), hidden
  'withdrawn',   -- its linked listing was deleted, hidden; admin decides
  'opted_out',   -- removal request confirmed, hidden + suppressed
  'superseded'   -- not present in a newer source release, hidden
);
create type public.roof_category as enum (
  'good_bare_roof', 'solar_partial', 'solar_full', 'greenhouse', 'outline_wrong',
  'residential', 'not_building', 'sensitive_site', 'unclear');
create type public.review_kind as enum ('primary', 'qa', 'adjudication');
create type public.claim_status as enum ('open', 'listing_created', 'verified', 'conflict', 'expired', 'withdrawn', 'rejected');
create type public.claim_relation as enum ('owner', 'lessee', 'manager', 'authorized_rep');
create type public.removal_status as enum ('unconfirmed', 'confirmed', 'upheld', 'restored_abuse', 'expired', 'dispute');
create type public.removal_reason as enum ('not_interested', 'privacy', 'wrong_data', 'security', 'other');

create table public.source_releases (
  id text primary key check (id ~ '^[a-z0-9-]{3,60}$'),     -- 'ms-gmlbf-2026-08-13'
  source text not null,
  release_date date not null,
  license text not null,                                       -- 'CDLA-Permissive-2.0'
  license_url text not null,
  index_url text not null,
  imagery_years text,
  created_at timestamptz not null default now()
);

create table public.ingest_runs (
  id bigint generated always as identity primary key,
  release_id text not null references public.source_releases (id),
  region text not null,
  git_sha text, params jsonb not null default '{}',
  status text not null default 'staged' check (status in ('staged', 'applied', 'failed', 'rolled_back')),
  counts jsonb not null default '{}', error text,
  started_at timestamptz not null default now(), applied_at timestamptz
);

create table public.pvgis_cells (
  cell_key text primary key,                                    -- '32.35:34.95'
  lat numeric(6,3) not null, lon numeric(6,3) not null,
  params_hash text not null,
  e_y_kwh_per_kwp numeric(7,1) not null check (e_y_kwh_per_kwp between 800 and 2500),
  pvgis_version text not null default '5.3',
  fetched_at timestamptz not null default now()
);

create table public.potential_roofs (
  id uuid primary key default gen_random_uuid(),
  tile_fid bigint generated always as identity unique,          -- integer feature id for MVT
  public_id text not null unique default left(replace(gen_random_uuid()::text, '-', ''), 12),
  footprint extensions.geography(Polygon, 4326) not null,
  geom_3857 extensions.geometry(Polygon, 3857) not null,        -- trigger-maintained, tiles
  centroid extensions.geography(Point, 4326) not null,          -- st_pointonsurface, trigger-maintained
  area_sqm numeric(10,1) not null,                               -- trigger-maintained (geodesic)
  usable_ratio numeric(3,2) not null default 0.65 check (usable_ratio between 0.2 and 0.95),
  free_share numeric(3,2) not null default 1 check (free_share between 0 and 1),
  est_kwp numeric(8,1) not null,
  est_kwp_public numeric(8,1) not null,
  pvgis_cell text references public.pvgis_cells (cell_key),
  tier char(1) not null check (tier in ('A','B','C')),
  tier_score real not null default 0,
  tier_features jsonb not null default '{}' check (pg_column_size(tier_features) < 4096),
  provenance jsonb not null default '{}',
  status public.potential_status not null default 'candidate',
  category public.roof_category,
  review_count smallint not null default 0,
  unclear_count smallint not null default 0,
  qa_required boolean not null default false,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  locked_by uuid references public.profiles (id) on delete set null,
  locked_until timestamptz,
  published_at timestamptz,
  listing_id uuid references public.listings (id) on delete set null,   -- covering listing (claim or organic)
  source_release text not null references public.source_releases (id),
  source_key text not null,
  source_confidence real,
  first_seen_release text not null,
  last_seen_release text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint potential_footprint_size check (
    extensions.st_npoints(footprint::extensions.geometry) <= 401
    and extensions.st_nrings(footprint::extensions.geometry) = 1),
  constraint potential_area_range check (area_sqm between 500 and 500000),
  unique (source_release, source_key)
);

create index potential_roofs_tiles_idx   on public.potential_roofs using gist (geom_3857) where status = 'published';
create index potential_roofs_fp_idx      on public.potential_roofs using gist (footprint);
create index potential_roofs_queue_idx   on public.potential_roofs (status, tier, tier_score desc) where status in ('candidate', 'qa_pending');
create index potential_roofs_listing_idx on public.potential_roofs (listing_id) where listing_id is not null;

create table public.review_decisions (
  id bigint generated always as identity primary key,
  roof_id uuid not null references public.potential_roofs (id) on delete cascade,
  reviewer_id uuid references public.profiles (id) on delete set null,
  kind public.review_kind not null,
  category public.roof_category not null,
  free_share numeric(3,2) check (free_share between 0 and 1),
  notes text not null default '' check (char_length(notes) <= 500),
  imagery_provider text not null check (char_length(imagery_provider) <= 40),   -- provenance (§9)
  imagery_zoom smallint check (imagery_zoom between 10 and 22),
  ui_mode text not null check (ui_mode in ('grid', 'single')),
  duration_ms int check (duration_ms between 0 and 3600000),
  tiles_loaded int check (tiles_loaded between 0 and 10000),                     -- measured imagery use
  superseded boolean not null default false,                                     -- undone
  created_at timestamptz not null default now()
);
create index review_decisions_roof_idx on public.review_decisions (roof_id, created_at);
create index review_decisions_reviewer_idx on public.review_decisions (reviewer_id, created_at desc);

create table public.roof_claims (
  id uuid primary key default gen_random_uuid(),
  roof_id uuid not null references public.potential_roofs (id) on delete cascade,
  claimant_id uuid not null references public.profiles (id) on delete cascade,
  relation public.claim_relation not null,
  status public.claim_status not null default 'open',
  listing_id uuid references public.listings (id) on delete set null,
  admin_note text check (char_length(admin_note) <= 1000),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index roof_claims_one_active on public.roof_claims (roof_id, claimant_id)
  where status in ('open', 'listing_created', 'conflict');
create index roof_claims_claimant_idx on public.roof_claims (claimant_id, created_at desc);

create table public.removal_requests (
  id uuid primary key default gen_random_uuid(),
  roof_id uuid references public.potential_roofs (id) on delete set null,
  roof_public_id text not null check (char_length(roof_public_id) <= 20),
  relation text not null check (relation in ('owner','lessee','manager','authorized_rep','neighbor','other')),
  reason public.removal_reason not null,
  message text check (char_length(message) <= 1000),
  contact_email text check (char_length(contact_email) <= 254),
  requester_id uuid references public.profiles (id) on delete set null,   -- when signed in
  confirm_token_hash text,                                                -- sha256(token), token only in the email
  confirmed_at timestamptz,
  ip_hash text not null check (char_length(ip_hash) = 64),               -- HMAC-SHA256(secret, ip); never raw IP
  status public.removal_status not null default 'unconfirmed',
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  decision_note text check (char_length(decision_note) <= 1000),
  pii_purge_after timestamptz,                                            -- email/message nulled by cron
  created_at timestamptz not null default now()
);
create index removal_requests_ip_idx on public.removal_requests (ip_hash, created_at desc);
create index removal_requests_status_idx on public.removal_requests (status, created_at);

create table public.roof_suppressions (           -- read by apply_batch; never public
  id bigint generated always as identity primary key,
  footprint extensions.geography(Polygon, 4326) not null,
  reason text not null check (reason in ('opt_out', 'sensitive_site', 'admin')),
  removal_request_id uuid references public.removal_requests (id) on delete set null,
  created_at timestamptz not null default now()
);
create index roof_suppressions_fp_idx on public.roof_suppressions using gist (footprint);

create table public.exclusion_zones (
  id bigint generated always as identity primary key,
  zone extensions.geography(MultiPolygon, 4326) not null,
  label text not null check (char_length(label) <= 120),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.potential_layer_state (       -- single row; version = tile cache-buster
  id boolean primary key default true check (id),
  version bigint not null default 1,
  published_count int not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.potential_layer_state default values;
```

Optional stretch (P2, 1–2 pd): `potential_roof_interests(user_id, roof_id, created_at, primary key (user_id, roof_id))`. Investors could press "עדכנו אותי אם הגג יפורסם" (notify me if this roof is listed), and the claimant would see only the aggregate count ("3 משקיעים התעניינו בגג"), which is a strong incentive to claim. RLS: own rows only. Rate limit 50/day.

### 4.2 Guard and transition triggers

`potential_roofs_guard()` follows `listings_guard`, but no API role can write to `potential_roofs` at all, so it guards integrity rather than untrusted callers:

```sql
create function public.potential_transition_ok(a public.potential_status, b public.potential_status)
returns boolean language sql immutable set search_path = '' as $$
  select a = b or (a::text || '>' || b::text) = any (array[
    'candidate>in_review', 'in_review>candidate', 'in_review>published', 'in_review>rejected', 'in_review>qa_pending',
    'qa_pending>published', 'qa_pending>rejected', 'qa_pending>in_review',
    'published>claimed', 'published>opted_out', 'published>rejected', 'published>candidate', 'published>superseded',
    'claimed>withdrawn', 'claimed>published', 'claimed>opted_out',
    'withdrawn>published', 'withdrawn>opted_out', 'rejected>candidate', 'opted_out>published',
    'candidate>superseded', 'rejected>superseded', 'candidate>opted_out', 'rejected>opted_out',
    'candidate>claimed', 'rejected>claimed', 'in_review>claimed', 'qa_pending>claimed'
  ]);
$$;

create function public.potential_roofs_guard() returns trigger
language plpgsql set search_path = '' as $$
declare
  supported_area extensions.geometry := extensions.st_makeenvelope(34.2, 29.4, 35.95, 33.4, 4326);
  g extensions.geometry := new.footprint::extensions.geometry;
begin
  if tg_op = 'INSERT' or new.footprint::text is distinct from old.footprint::text then
    if not extensions.st_isvalid(g) or not extensions.st_within(g, supported_area) then
      raise exception 'גאומטריית גג לא תקינה' using errcode = '22023';
    end if;
    new.geom_3857 := extensions.st_transform(g, 3857);
    new.centroid  := extensions.st_pointonsurface(g)::extensions.geography;
    new.area_sqm  := round(extensions.st_area(new.footprint)::numeric, 1);
  end if;
  new.est_kwp        := round(new.area_sqm * new.usable_ratio / 6.5, 1);
  new.est_kwp_public := round(new.est_kwp * new.free_share, 1);
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if not public.potential_transition_ok(old.status, new.status) then
      raise exception 'מעבר סטטוס לא חוקי: % → %', old.status, new.status using errcode = '22023';
    end if;
    if new.status = 'published' then new.published_at := now(); end if;
    if new.status not in ('in_review') then new.locked_by := null; new.locked_until := null; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger potential_roofs_guard before insert or update on public.potential_roofs
  for each row execute function public.potential_roofs_guard();
```

The layer version is bumped in a **statement-level** trigger with transition tables, so a bulk apply or bulk review does one update, not N:

```sql
create function public.potential_layer_bump() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from new_rows n left join old_rows o using (id)
              where (n.status = 'published') is distinct from (o.status = 'published')
                 or (n.status = 'published' and (n.footprint::text is distinct from o.footprint::text
                      or n.est_kwp_public is distinct from o.est_kwp_public or n.category is distinct from o.category))) then
    update public.potential_layer_state
       set version = version + 1,
           published_count = (select count(*) from public.potential_roofs where status = 'published'),
           updated_at = now();
  end if;
  return null;
end $$;
create trigger potential_layer_bump_upd after update on public.potential_roofs
  referencing old table as old_rows new table as new_rows for each statement execute function public.potential_layer_bump();
-- plus an INSERT variant with an empty old_rows (separate function; Postgres does not allow transition tables on multi-event triggers)
```

### 4.3 RLS and privileges (the full matrix)

| Table | anon | authenticated (non-admin) | admin | writes |
|---|---|---|---|---|
| `potential_roofs` | none (revoke all) | none | SELECT (`is_admin()`) | definer RPCs, pipeline (`postgres`) |
| `review_decisions` | none | none | SELECT | `submit_review_decisions` / `undo_review_decision` only |
| `roof_claims` | none | SELECT own (`claimant_id = auth.uid()`) | SELECT all | `start_roof_claim`, `withdraw_roof_claim`, listing triggers, admin RPC |
| `removal_requests` | none | none | SELECT | service-role server code → definer RPCs |
| `roof_suppressions`, `exclusion_zones` | none | none | SELECT (zones: admin INSERT/DELETE via RPC) | definer RPCs, pipeline |
| `source_releases`, `ingest_runs`, `pvgis_cells` | none | none | SELECT | pipeline |
| `potential_layer_state` | none | none | SELECT | trigger |
| `admin_audit_log` | none | none | SELECT | definer triggers/RPCs only, **append-only** |

The **public sees only `published` rows, and only through definer functions** that return a fixed, minimal column set (§5.2): `public_id`, simplified geometry, rounded area, rounded kWp, partial/bare flag. Never the tier, score, features, reviewer, notes, source ids or confidence.

```sql
alter table public.potential_roofs enable row level security;
create policy "potential_roofs: admins read" on public.potential_roofs for select to authenticated using (public.is_admin());
revoke all on public.potential_roofs from anon;
revoke insert, update, delete, truncate, trigger, references on public.potential_roofs from authenticated;
-- identical pattern for review_decisions, removal_requests, roof_suppressions, exclusion_zones, source_releases,
-- ingest_runs, pvgis_cells, potential_layer_state

alter table public.roof_claims enable row level security;
create policy "roof_claims: claimant or admin reads" on public.roof_claims
  for select to authenticated using (claimant_id = (select auth.uid()) or public.is_admin());
revoke all on public.roof_claims from anon;
revoke insert, update, delete on public.roof_claims from authenticated;
```

Every new definer function gets `set search_path = ''`, `revoke execute … from public, anon`, and an explicit `grant` that matches the matrix. The service-role-only functions also check `coalesce(auth.jwt() ->> 'role','') = 'service_role'` inside the body (defence in depth).

### 4.4 Listing link (changes to existing objects)

```sql
alter table public.listings
  add column potential_roof_id uuid references public.potential_roofs (id) on delete set null;
create unique index listings_potential_roof_uniq on public.listings (potential_roof_id)
  where potential_roof_id is not null;            -- race backstop: one claim-created listing per roof

-- Claimant-only check used by listings_guard (which runs as the caller). Definer, because the
-- claimant cannot read potential_roofs. Serialises per roof so two claimants cannot race.
create function public.check_claim_link(p_roof uuid, p_location extensions.geography, p_footprint extensions.geography)
returns text                                     -- null = ok, else a Hebrew error
language plpgsql security definer set search_path = '' as $$
declare r public.potential_roofs;
begin
  perform pg_advisory_xact_lock(hashtextextended('roof-link:' || p_roof::text, 0));
  if not exists (select 1 from public.roof_claims c where c.roof_id = p_roof and c.claimant_id = auth.uid()
                  and c.status = 'open' and c.expires_at > now()) then
    return 'לא נמצאה בקשת שיוך פעילה לגג זה. התחילו מחדש מהמפה.';
  end if;
  if exists (select 1 from public.listings l where l.potential_roof_id = p_roof) then
    return 'לגג זה כבר קיימת מודעה. אם אתם הבעלים, פנו אלינו ונבדוק.';
  end if;
  select * into r from public.potential_roofs where id = p_roof and status = 'published';
  if not found then return 'הגג אינו זמין לשיוך כרגע.'; end if;
  if not (extensions.st_intersects(r.footprint, p_location)
          or (p_footprint is not null and extensions.st_area(extensions.st_intersection(r.footprint, p_footprint))
                                         >= 0.3 * r.area_sqm)) then
    return 'המיקום או שרטוט הגג אינם חופפים לגג שנבחר.';
  end if;
  return null;
end $$;
revoke execute on function public.check_claim_link(uuid, extensions.geography, extensions.geography) from public, anon;
grant execute on function public.check_claim_link(uuid, extensions.geography, extensions.geography) to authenticated;
```

Additions to `listings_guard()`, in the untrusted branch:

```sql
-- INSERT:
if new.potential_roof_id is not null then
  v_err := public.check_claim_link(new.potential_roof_id, new.location, new.footprint);
  if v_err is not null then raise exception '%', v_err using errcode = '22023'; end if;
end if;
-- UPDATE: the link is immutable for owners
new.potential_roof_id := old.potential_roof_id;
```

The errors are Hebrew with code 22023, so `saveErrorMessage()` shows them unchanged (`hasHebrew` branch). The unique index raises 23505 only on a true race; add a `CHECK_MESSAGES`-style mapping for `listings_potential_roof_uniq` in `src/components/publish/saveErrors.ts`.

AFTER triggers on `listings` (definer):

```sql
-- after insert: claim path or organic dedup
create function public.listings_potential_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.is_fictional then return null; end if;
  if new.potential_roof_id is not null then
    update public.roof_claims set status = 'listing_created', listing_id = new.id, updated_at = now()
     where roof_id = new.potential_roof_id and claimant_id = new.owner_id and status = 'open';
    update public.roof_claims set status = 'conflict', updated_at = now()
     where roof_id = new.potential_roof_id and claimant_id <> new.owner_id and status = 'open';
    update public.potential_roofs set status = 'claimed', listing_id = new.id
     where id = new.potential_roof_id and status = 'published';
  else
    update public.potential_roofs r set status = 'claimed', listing_id = new.id
     where r.status in ('published', 'candidate', 'rejected')
       and (extensions.st_intersects(r.footprint, new.location)
            or (new.footprint is not null
                and extensions.st_area(extensions.st_intersection(r.footprint, new.footprint)) >= 0.3 * r.area_sqm));
  end if;
  return null;
end $$;
```

Roofs that are `in_review` or `qa_pending` when a covering listing appears are caught at decision time: `submit_review_decisions` re-runs the same overlap test and moves the roof to `claimed` instead of `published`.

The remaining listing triggers:
- **after update when the location or footprint moved:** if the listing no longer overlaps its linked roof, the roof goes back to its previous public state (`claimed→published` when its category is publishable), `potential_roofs.listing_id` is set to null, and the change is audited. The owner has effectively said "this is not my building".
- **after delete:** `potential_roofs.listing_id` is set null by the FK. A `before delete` trigger on listings moves linked roofs `claimed→withdrawn` first. A roof whose owner removed their listing is **never auto-republished**; an admin decides, which is privacy-safe.
- **after update `owner_verification → 'verified'`:** the claim becomes `verified`, and competing `conflict` claims on the same roof are flagged in the admin queue. This is a separate trigger with its own `WHEN` clause; do not repeat the column-specific trigger pitfall fixed in `20261019020000_fix_verification_cancel_trigger.sql`.

The `listing_feed` view is **unchanged**. The link stays private (anon has column-level grants only). If authenticated non-owners should not see it either, switch `listings` SELECT for `authenticated` to a column list as well. That is optional; the link reveals little.

### 4.5 State machine summary

```
candidate ──lock──> in_review ──publishable──> published ──claim/listing──> claimed ──listing deleted──> withdrawn
    ▲   (lock expiry/unclear)  │  └─sampled──> qa_pending ──agree──┘     │  └─moved off roof──> published
    └──────────────────────────┤                └─disagree→adjudication   ├─opt-out confirmed──> opted_out (+ suppression)
                               └─not publishable──> rejected              └─new release, no match──> superseded
```

---

## 5. Public layer

### 5.1 Options

| Option | Freshness after opt-out | Infra | Client | Verdict |
|---|---|---|---|---|
| A. Load all published roofs as GeoJSON (like listings) | immediate | none | trivial | Fine for under 1k roofs. Grows linearly (about 400 KB gzipped at 5k); polygons render at all zooms. **No.** |
| B. **MVT from PostGIS** (`ST_AsMVT`) → PostgREST RPC → Next route → Vercel CDN, tag purge | **seconds** (tag purge) | none new | `leaflet-vector-tile-layer` (SVG) | **Yes** |
| C. Prebuilt PMTiles on Supabase Storage (range requests work out of the box per Supabase's own guide) | needs rebuild + upload + CDN expiry; minutes to hours | tippecanoe in the pipeline | protomaps-leaflet (maintenance mode) or MapLibre | Not for Phase 1. A good option later for a static national layer. |
| D. GeoJSON per tile (same SQL, `json_agg`) | seconds | none | ~150 lines of custom Leaflet layer, canvas renderer | **Fallback** if B's 1-day spike fails |

### 5.2 SQL: tile and cluster functions

PostgREST v14.18 runs locally (`supabase/.temp/rest-version`). PostgREST serves a function's raw bytes when its return type is a **domain over `bytea` named after the media type** and the request sends a matching `Accept` header (PostgREST media type handler docs).

```sql
create domain public."application/vnd.mapbox-vector-tile" as bytea;

create function public.potential_roofs_mvt(z int, x int, y int)
returns public."application/vnd.mapbox-vector-tile"
language plpgsql stable parallel safe security definer set search_path = '' as $$
declare
  env extensions.geometry;
  tile bytea;
begin
  if z < 13 or z > 20 or x < 0 or y < 0 or x >= (1 << z) or y >= (1 << z) then
    return ''::bytea;                              -- valid empty tile
  end if;
  env := extensions.st_tileenvelope(z, x, y);
  select extensions.st_asmvt(t, 'potential', 4096, 'geom', 'fid') into tile
    from (
      select r.tile_fid as fid,
             r.public_id as pid,
             (round(r.area_sqm / 50) * 50)::int as a,               -- m², rounded
             (round(r.est_kwp_public / 10) * 10)::int as k,         -- kWp DC, rounded
             case when r.category = 'solar_partial' then 1 else 0 end as p,
             extensions.st_asmvtgeom(r.geom_3857, env, 4096, 64, true) as geom
        from public.potential_roofs r
       where r.status = 'published'
         and r.geom_3857 operator(extensions.&&) extensions.st_tileenvelope(z, x, y, margin => 64.0 / 4096)
    ) t
   where t.geom is not null;
  return coalesce(tile, ''::bytea);
end $$;
revoke execute on function public.potential_roofs_mvt(int, int, int) from public;
grant execute on function public.potential_roofs_mvt(int, int, int) to anon, authenticated;

-- Low-zoom clusters: a few hundred cells, < 50 KB, one request per layer version.
create function public.potential_roofs_clusters()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'v', (select version from public.potential_layer_state),
    'bands', jsonb_build_object(
      '0.25', public._potential_grid(0.25), '0.1', public._potential_grid(0.1), '0.03', public._potential_grid(0.03)));
$$;
-- _potential_grid(cell): [[lat, lng, count, sum_kwp], …] from centroids of published roofs, grouped by floor(x/cell), floor(y/cell)
```

Notes:
- `operator(extensions.&&)` is required because `search_path = ''` and PostGIS lives in `extensions`.
- At z ≥ 13 a tile is about 4.1 km wide at 32°N. Dense industrial zones hold at most a few hundred roofs per tile, so the SVG node count stays manageable.
- `ST_AsMVTGeom` snaps to the 4096 grid. No extra `ST_Simplify` is needed at these zooms, because MS outlines are mostly fewer than 20 vertices.
- A public detail function, `potential_roof_public(p_public_id text)`, returns `{public_id, centroid, bbox, a, k, p, mwh_low, mwh_high, published_at}` for `?potential=<pid>` deep links and the preview panel. It is definer and returns a row only when the roof is `published`.

### 5.3 Next route handlers

New: `src/app/api/potential/tiles/[v]/[z]/[x]/[y]/route.ts` (sketch):

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { publicConfig } from '@/lib/config';
import { SUPPORTED_BOUNDS as B } from '@/lib/geo';

const tx = (lng: number, z: number) => Math.floor(((lng + 180) / 360) * 2 ** z);
const ty = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};
const CDN_DAY = 'public, s-maxage=86400, stale-while-revalidate=3600';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ v: string; z: string; x: string; y: string }> }) {
  const p = await ctx.params;
  const [z, x, y] = [p.z, p.x, p.y.replace(/\.mvt$/, '')].map(Number);
  const inIsrael = Number.isInteger(z) && z >= 13 && z <= 20 &&
    x >= tx(B.minLng, z) && x <= tx(B.maxLng, z) && y >= ty(B.maxLat, z) && y <= ty(B.minLat, z);
  if (!inIsrael) return new NextResponse(null, { status: 404, headers: { 'Vercel-CDN-Cache-Control': CDN_DAY } });

  const res = await fetch(`${publicConfig.supabaseUrl}/rest/v1/rpc/potential_roofs_mvt?z=${z}&x=${x}&y=${y}`, {
    // Same headers supabase-js sends for the anon role (check the exact header for the project's key type).
    headers: { apikey: publicConfig.supabaseAnonKey, Accept: 'application/vnd.mapbox-vector-tile' },
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return new NextResponse(null, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  return new NextResponse(await res.arrayBuffer(), {
    headers: {
      'Content-Type': 'application/vnd.mapbox-vector-tile',
      'Cache-Control': 'public, max-age=300',             // browser
      'Vercel-CDN-Cache-Control': CDN_DAY,                // Vercel CDN only
      'Vercel-Cache-Tag': 'potential-tiles',
      'X-Robots-Tag': 'noindex',
    },
  });
}
```

- `src/app/api/potential/clusters/[v]/route.ts` works the same way: it calls `potential_roofs_clusters`, uses the same tag, and returns JSON.
- **`src/proxy.ts`:** add `api/potential/` to the matcher's negative lookahead, i.e. `'/((?!_next/static|_next/image|api/potential/|favicon.ico|…).*)'`. Otherwise the proxy runs on every tile, calls Auth, and may attach `set-cookie`. Vercel does not cache responses with `set-cookie`, and middleware runs before the cache.
- **Cacheability checklist (Vercel CDN docs):**
  - GET only, no `Authorization` on the incoming request, no `set-cookie`.
  - Status 200 or 404 (204 is **not** cacheable, so return an empty 200 body).
  - Under 10 MB.
  - Cache is per region and best-effort; the cache key includes the deployment URL, so each deploy starts cold.
- **Version segment `[v]`:** `ExplorePage` is already dynamic (it reads `searchParams`). It reads `potential_layer_state.version` server-side, through `potential_roofs_clusters().v` or a tiny `potential_layer_version()` RPC, and passes it to the client. After any status change, new page loads reference fresh URLs. Old-version URLs simply return current data on a miss.
- **Privacy-critical purge:** the opt-out confirm route, the admin hide/reject of a published roof, and the admin "restore" call `revalidateTag('potential-tiles')`. Server Actions can use `updateTag('potential-tiles')` instead. In Next.js 16 the one-argument form **deletes** cache entries, and Vercel purges the CDN, Runtime and Data caches for that tag (Vercel purge docs; rate limit 50/s on Hobby, 200/s on Pro). Claims created from the browser cannot trigger a purge. Their tiles roll over through the version change within one page load, and stale cached tiles expire within ≤24 h. That is acceptable, because a claimed roof simply appears twice for a while (potential plus real listing). If tighter, add a nightly `revalidateTag('potential-tiles','max')` (stale-while-revalidate form).
- Tile traffic estimate: about 30–80 tile requests per explore session with the layer on. Vercel Pro includes 10M CDN requests and 1 TB transfer per month, so origin invocations happen only on misses.

### 5.4 Leaflet integration

New dependency: `leaflet-vector-tile-layer@0.16.3` (BSD-3-Clause, published 2025-12-16, peer `leaflet ^1.0.0`). Its README says it supports a per-feature `style` function, `filter`, `minDetailZoom`/`maxDetailZoom`, mouse events with access to the `feature` when `interactive: true`, `setFeatureStyle` compatibility, and **SVG rendering only**.

**Spike (1 pd, first task of component 3).** Exit criteria:
- (a) click returns `pid` on Leaflet 1.9.4;
- (b) 300 polygons in view pan at ≥ 50 fps on a mid-range laptop;
- (c) the selected-feature restyle works.

If the spike fails, switch to option D (GeoJSON tiles drawn with Leaflet's canvas renderer and a shared `L.canvas()`; same SQL wrapped in `json_agg`).

New and changed files:
- `src/components/explore/PotentialLayer.tsx`: `createLayerComponent` from `@react-leaflet/core` wrapping `vectorTileLayer('/api/potential/tiles/{v}/{z}/{x}/{y}', { minZoom: 13, minDetailZoom: 13, maxDetailZoom: 16, style, interactive: true })`. On click it calls `onSelectPotential(pid)`.
- `src/components/explore/PotentialClusters.tsx`: for zoom < 13, fetches `/api/potential/clusters/{v}` once and renders grey hexagon `divIcon` badges with the count (via `react-leaflet` `Marker`, like `pinIcon`). Click zooms in by 2.
- `src/components/explore/PotentialPreview.tsx`: the DOM panel, reusing the `.map-preview` layout. It is accessible, and Escape closes it, as in `MapPreview`.
- `ExploreMap.tsx`: render both layers when `showPotential`.
- `ExploreClient.tsx`:
  - state `potentialOn` (persisted per viewer in `localStorage`, wrapped in try/catch) and `selectedPotential`;
  - URL param `?potential=<pid>`, written with the existing `replaceQuery`;
  - the side list is **not** mixed with potentials; add only a line "ועוד {n} גגות פוטנציאליים במפה (לא הוצעו ע״י בעלים)".
- `ExploreFilters.tsx` or `MapLegend.tsx`: a toggle chip "גגות פוטנציאליים ({n})". **Default off** for the first launch; revisit with data.
- `src/app/page.tsx`: pass `potentialVersion`, `potentialCount` and the feature flag `NEXT_PUBLIC_POTENTIAL_LAYER` (`off | admins | public`). With `admins`, the server passes the version only when `profile.isAdmin`. The tiles themselves are not secret, so this is a soft gate for the beta.

### 5.5 Visual distinction and copy

| Element | Real listing (today) | Potential roof |
|---|---|---|
| Marker | sun pin (`pinIcon`), colour by availability | **no pin**. A grey hexagon badge with a count, low zoom only |
| Outline | solid (or dashed = illustrative), availability colour | **slate `#5b6b7a`, 1.5–2 px, dash `2 4`** |
| Fill | colour at 0.22 | **diagonal hatch**: SVG `<pattern id="potential-hatch">` injected once; `.potential-roof { fill: url(#potential-hatch) }`. CSS overrides Leaflet's `fill` presentation attribute |
| Tooltip | title | "גג פוטנציאלי · לא הוצע להשכרה" |
| Legend | existing items | new item with a hatched swatch: "גג פוטנציאלי: זוהה מנתונים פתוחים ונבדק חזותית. הבעלים **לא** הציעו אותו." |

Preview panel copy (Hebrew; the legal workstream may adjust it):
- **Title:** "גג פוטנציאלי (לא מוצע)".
- **Facts:** "שטח גג משוער: כ-{a} מ״ר" · "הספק טכני משוער: עד כ-{k} kWp (DC)" · "ייצור שנתי משוער: {low}–{high} MWh". When `p=1`, add "על חלק מהגג כבר מותקנת מערכת".
- **Disclaimer:** "הנתונים מבוססים על טביעות מבנים של Microsoft (CDLA-Permissive-2.0), חישוב PVGIS ובדיקה חזותית של צוות סולגג. הם עשויים להיות שגויים או לא עדכניים (למשל מערכת שהותקנה לאחר הצילום). אין לנו פרטי קשר של הבעלים."
- **CTAs:**
  - owner: "זה הגג שלי — לפרסום", linking to `/potential/{pid}/claim`;
  - "הסרת הגג מהמפה", linking to `/potential/remove?roof={pid}`;
  - investors, stretch only: "עדכנו אותי אם יפורסם".
- No calculator ₪ on potential roofs. No per-roof pages, so no SEO surface. `sitemap.ts` is unchanged, and the tile responses send `X-Robots-Tag: noindex`.

New page `src/app/potential/about/page.tsx` ("מהם גגות פוטנציאליים?") covers the methodology, the limitations, attributions (Microsoft footprints under CDLA-Permissive-2.0 with a link to the licence text, which CDLA §2.1 requires when Data is shared; "PVGIS © European Union"; the imagery provider), and how to remove a roof.

### 5.6 Cost of switching to MapLibre GL (Phase 2 option, not recommended now)

`maplibre-gl` 6.15.0 is BSD-3-Clause with an unpacked size of 28.8 MB on npm; the browser bundle is much smaller (not measured here).

Work:
- rewrite `ExploreMap` (markers, polygons, tooltips, `flyToBounds` with overlay padding);
- rewrite `mapParts` (`LayersControl`, divIcon pins);
- rewrite `DrawMap`, which is custom vertex editing; it would need a replacement such as terra-draw (UNVERIFIED fit);
- rewrite `ListingMapView`;
- update 7 e2e selectors;
- update CSP `connect-src` for any external style or tile host;
- add the RTL text plugin if vector basemaps with Hebrew labels are used.

**Estimate: 8–12 pd.** The benefits are GPU rendering of tens of thousands of features, native MVT/PMTiles and smooth clustering. Revisit once potentials exceed about 20k published or if the Leaflet spike fails.

---

## 6. Admin review screen

### 6.1 Routes and files

```
src/app/admin/potential/page.tsx            queue (mode=grid|single, tier filter, region filter), server-rendered shell
src/app/admin/potential/stats/page.tsx      progress + QA metrics
src/app/admin/potential/[id]/page.tsx       single roof history (decisions, claims, removals, audit)
src/app/admin/claims/page.tsx               open / conflict claims
src/app/admin/removals/page.tsx             removal requests, abuse patterns
src/app/admin/audit/page.tsx                audit log viewer (filters: actor, entity, action, date)
src/app/admin/potential/actions.ts          Server Actions: adminGate() + RPC; revalidateTag on public-affecting changes
src/app/admin/_lib/potential.ts             admin reads (counts, stats, queue snapshot)
src/components/admin/review/ReviewGrid.tsx, ReviewSingle.tsx, ReviewMap.tsx, useReviewKeys.ts, categories.ts
src/components/admin/AdminNav.tsx           + "גגות פוטנציאליים" (badge: in queue), "שיוכים", "בקשות הסרה" (badge), "יומן פעולות"
src/lib/imagery.ts                          provider registry (§9.1)
```

Admin reads and actions follow the existing rule: they run **under the admin's own session**, never with the service role.

### 6.2 Queue mechanics (RPCs, all `is_admin()`-checked definer functions)

```sql
-- Locks up to p_n roofs for the caller (20 min), releasing expired locks first. QA mode is blind and
-- never returns a roof the caller already decided.
create function public.next_review_batch(p_mode text, p_n int default 12, p_tiers text[] default '{A,B}', p_region text default null)
returns table (id uuid, public_id text, footprint jsonb, area_sqm numeric, est_kwp numeric, tier char,
               tier_score real, source_confidence real, tier_features jsonb, review_count smallint)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if p_n not between 1 and 48 or p_mode not in ('primary', 'qa', 'adjudication') then
    raise exception 'bad request' using errcode = '22023';
  end if;
  update public.potential_roofs set status = 'candidate', locked_by = null, locked_until = null
   where status = 'in_review' and locked_until < now();
  return query
  with picked as (
    select r.id from public.potential_roofs r
     where ((p_mode = 'primary' and r.status = 'candidate' and r.tier = any (p_tiers))
         or (p_mode in ('qa', 'adjudication') and r.status = 'qa_pending'
             and not exists (select 1 from public.review_decisions d
                              where d.roof_id = r.id and d.reviewer_id = auth.uid() and not d.superseded)))
       and (r.locked_until is null or r.locked_until < now() or r.locked_by = auth.uid())
     order by r.tier, r.tier_score desc, r.id
     limit p_n
     for update skip locked
  ), locked as (
    update public.potential_roofs r
       set status = case when p_mode = 'primary' then 'in_review'::public.potential_status else r.status end,
           locked_by = auth.uid(), locked_until = now() + interval '20 minutes'
      from picked where r.id = picked.id
    returning r.*
  )
  select l.id, l.public_id, extensions.st_asgeojson(l.footprint, 7)::jsonb, l.area_sqm, l.est_kwp, l.tier,
         l.tier_score, l.source_confidence, l.tier_features, l.review_count
    from locked l;
end $$;

-- p_items: [{roof_id, category, free_share?, notes?, duration_ms?, tiles_loaded?}] (≤ 48), plus imagery provider/zoom/mode
create function public.submit_review_decisions(p_kind public.review_kind, p_items jsonb, p_provider text, p_zoom int, p_mode text)
returns jsonb   -- {published, rejected, qa_pending, requeued, refused:[roof_id…]}
```

`submit_review_decisions` handles each item as follows:
1. Lock the row and require `status='in_review' and locked_by=auth.uid()` for primary decisions, or `status='qa_pending'` for QA and adjudication decisions.
2. Insert the `review_decisions` row.
3. For a **primary** decision:
   - `unclear` → `unclear_count+1`; back to `candidate` (deprioritised), or `rejected` after 2 unclear decisions.
   - Publishable (`good_bare_roof`, or `solar_partial` with `free_share ≥ 0.25`) → `qa_pending` if `public.qa_sampled(roof, reviewer)`, else `published`.
   - Anything else → `rejected`, or `qa_pending` if sampled (QA on rejections measures recall).
4. For **qa**: compare publishability with the primary decision. If they agree, apply the outcome. If they disagree, the roof stays `qa_pending` with `review_count` now 2 and waits for an `adjudication` decision from a third admin, which is final.
5. Update `category`, `free_share`, `reviewed_by`, `reviewed_at` and `review_count`, and clear the lock.
6. Writes are audited by the trigger (§8.3).

The Server Action calls `revalidateTag('potential-tiles')` only when the batch published something, so a purge is never triggered for a pure-reject batch.

`qa_sampled(roof, reviewer)` is deterministic:

```sql
select (abs(hashtext(roof.id::text)) % 100) < 10                                   -- 10% random
    or (select count(*) from public.review_decisions where reviewer_id = reviewer and kind = 'primary') < 200   -- calibration
    or (roof.tier = 'C' and <publishable>)                                            -- low-precision tier
-- disabled automatically while fewer than 2 admins exist (then logged as 'qa_skipped' in stats)
```

`undo_review_decision(p_decision)` is allowed only for your own decision, within 10 minutes, and only while the roof is still in the state that decision produced. It marks the decision `superseded` and re-locks the roof to you.

`admin_set_potential_status(p_roof, p_status, p_note)` is the manual override (restore, hide, republish a withdrawn roof). It must follow `potential_transition_ok`, a note is mandatory, and it is audited.

### 6.3 Interaction design

| Mode | Layout | Keys (by `KeyboardEvent.code`, so they work in the Hebrew layout) |
|---|---|---|
| **Grid** (default for Tier B/C, and for first-pass labelling) | 12 cells (4×3, like `qa.html`). Each cell is a Leaflet mini-map at z18 fitted to the roof (outline yellow `#ffea00`, no fill), labelled with `#n · area · tier` | `Tab`/`J`/`K` move focus; digits `1–8`/`0` set the category for the focused cell and advance; **`Shift`+digit applies a *reject* category to all unset cells** (bulk "everything else is a greenhouse"); `Space` submits the page (only when every cell is set); `U` undo; `[`/`]` switch imagery provider; `?` help |
| **Single** (default for Tier A, QA and adjudication) | Large map (z17–19), context inset at z16, facts sidebar (area, kWp, MS confidence, tier features as chips), previous decisions (hidden in QA mode = blind) | digits set the category and auto-advance; for `2` (partial) follow with `Q/W/E` = 25/50/75% free; `Z` context zoom; `A` imagery ↔ street; `N` skip (= unclear); `U` undo |

Categories, mapping to the pilot's photo-review classes:

| Key | Category | Hebrew label | Outcome |
|---|---|---|---|
| 1 | `good_bare_roof` | גג חשוף מתאים | publish |
| 2 | `solar_partial` | מערכת על חלק מהגג (+ % פנוי) | publish with `free_share` |
| 3 | `solar_full` | מכוסה בפאנלים | reject |
| 4 | `greenhouse` | חממה / בית רשת | reject |
| 5 | `outline_wrong` | קו מתאר שגוי/מאוחד | reject (re-check on the next MS release; no outline editing in Phase 1, since tracing over imagery is a licence question) |
| 6 | `residential` | מגורים | reject |
| 7 | `not_building` | לא מבנה / אחר | reject |
| 8 | `sensitive_site` | אתר רגיש / ביטחוני | reject + propose an exclusion zone |
| 0 | `unclear` | לא ברור | requeue (max 2) |

Safety rules:
- Bulk actions can only *reject*. Every publication is an explicit per-roof key press.
- The server re-validates the lock owner on every decision.
- Next-page imagery is prefetched (warms the browser cache; counted in `tiles_loaded`).
- `detectRetina` stays off on review maps, because it quadruples tile requests.

Stats page (`/admin/potential/stats`), from SQL views over `review_decisions` and `potential_roofs`:
- remaining by status, tier and region;
- decisions per reviewer per day;
- median seconds per decision by mode;
- publish rate by tier, which is the measured precision of each tier;
- QA percent agreement and Cohen's κ on publish vs not (rolling 200), with the pilot benchmark of 33/36 blind agreement;
- adjudication backlog;
- tiles per decision, which feeds the imagery cost model;
- ETA at the current pace.

---

## 7. Claim flow

```
Map preview "זה הגג שלי — לפרסום"
  → /potential/[pid]/claim            (add to PROTECTED paths in src/lib/supabase/proxy.ts → /login?next=…)
      shows roof facts + map, relation radio (owner / lessee / manager / authorized rep), short notice:
      "הפרסום יוצג כ'בעלות לא אומתה' עד שתגישו מסמך בעלות". Submit = Server Action startClaim()
  → RPC start_roof_claim(pid, relation)  → {claim_id, status}
      status 'open'     → redirect /publish?claim=<claim_id>
      status 'conflict' → page: "לגג זה כבר קיימת מודעה" + contact/dispute instructions (admin is notified)
  → /publish?claim=…  (src/app/publish/page.tsx): server calls get_claim_prefill(claim) (claimant-only, definer)
      → ListingWizard gets prefill: polygon (≤200 vertices; ST_SimplifyPreserveTopology if needed), roof uuid,
        area; draft = draftFromPotential(prefill, profile.fullName): areaMode 'polygon', location null (centroid),
        usablePct 65; region/locality/title left for the owner (no reverse geocoding at scale; Nominatim policy)
      banner: "מילאנו את גבולות הגג מהגג הפוטנציאלי. בדקו ותקנו את השרטוט על גבי תצלום האוויר."
      storage key: solgag:publish-draft:<uid>:claim:<claimId> (no mixing with a plain /publish draft)
  → submit: insert includes potential_roof_id → listings_guard → check_claim_link (claim open, not taken, overlap ≥30%)
      → AFTER INSERT: claim 'listing_created', competing open claims 'conflict', roof 'claimed' (hidden; version bump)
  → existing VerificationBox on the dashboard (unchanged) → review_verification approve
      → claim 'verified' (trigger) → competing claims shown to admins for closure
```

```sql
create function public.start_roof_claim(p_public_id text, p_relation public.claim_relation)
returns table (claim_id uuid, claim_status public.claim_status)
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_roof public.potential_roofs; v_id uuid; v_status public.claim_status;
begin
  if v_uid is null then raise exception 'נדרשת התחברות' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('roof-claim:' || v_uid::text, 0));
  update public.roof_claims set status = 'expired', updated_at = now()
   where claimant_id = v_uid and status = 'open' and expires_at < now();
  select * into v_roof from public.potential_roofs where public_id = p_public_id and status in ('published', 'claimed');
  if not found then raise exception 'הגג אינו זמין לשיוך' using errcode = 'P0002'; end if;
  select c.id, c.status into v_id, v_status from public.roof_claims c
   where c.roof_id = v_roof.id and c.claimant_id = v_uid and c.status in ('open', 'listing_created', 'conflict');
  if found then return query select v_id, v_status; return; end if;               -- idempotent
  if (select count(*) from public.roof_claims where claimant_id = v_uid and created_at > now() - interval '1 day') >= 5 then
    raise exception 'התחלתם שיוך של גגות רבים היום. נסו שוב מחר או פנו אלינו.' using errcode = '54000';
  end if;
  if (select count(*) from public.roof_claims where claimant_id = v_uid and status in ('open', 'listing_created', 'conflict')) >= 20 then
    raise exception 'הגעתם למספר השיוכים הפעילים המרבי. פנו אלינו להגדלה.' using errcode = '54000';
  end if;
  v_status := case when v_roof.status = 'claimed' then 'conflict' else 'open' end;
  insert into public.roof_claims (roof_id, claimant_id, relation, status)
  values (v_roof.id, v_uid, p_relation, v_status) returning id into v_id;
  return query select v_id, v_status;
end $$;
```

**Conflicts.**
- Several *open* claims on one roof are allowed, so a squatter cannot lock out the real owner by claiming first.
- The first claimant to create a **linked listing** wins the link, enforced by `check_claim_link` under a per-roof advisory lock with the unique index as backstop. Others become `conflict`, and admins are emailed (`notifyAdminsClaimConflict` in `src/lib/notify.ts`).
- Resolution is manual in Phase 1, in `/admin/claims`. If the disputing party proves ownership (by email to staff), the admin:
  1. hides the squatter listing (`admin_hidden`, existing action);
  2. unlinks it with `admin_unlink_listing`, which sets the roof back to `published`;
  3. reopens the disputer's claim.
  All of this is audited.
- Verified ownership always wins.

**Rate limits** (all serialised with advisory locks):
- 5 new claims per day and 20 active claims per account;
- the existing 5 per hour, 20 per day and 100 per account limits on listing inserts;
- open claims expire after 14 days (the daily cron and the lazy check in `start_roof_claim`).

**Code touch points:**
- `src/app/potential/[pid]/claim/page.tsx` and `actions.ts`;
- `src/app/publish/page.tsx`: parse `claim`, load the prefill;
- `src/components/publish/ListingWizard.tsx`: `prefill` prop, storage key, `potential_roof_id` in the insert row;
- `draft.ts`: `draftFromPotential`;
- `listing-payload.ts`: `potential_roof_id` pass-through for inserts only;
- `saveErrors.ts`: unique-index mapping;
- `src/lib/supabase/proxy.ts`: protect `/potential/[^/]+/claim`;
- `OwnerPanel.tsx`: an "open claims" list with a "continue publishing" link, from `get_my_claims()`.

---

## 8. Privacy, opt-out, audit, monitoring

### 8.1 Opt-out (no login required)

**Page:** `src/app/potential/remove/page.tsx` plus `actions.ts`, and `src/app/potential/remove/confirm/route.ts`.

**Form:** roof id (prefilled from `?roof=`), relation, reason, optional message (≤1000 characters), email (required unless signed in), the Turnstile widget, and a privacy notice explaining what is stored, why, and for how long.

The Server Action (Node runtime):
1. Verifies the Turnstile token server-side with `TURNSTILE_SECRET_KEY`. The Turnstile free plan has "Unlimited challenges" and up to 20 widgets.
2. Computes `ip_hash = HMAC_SHA256(OPTOUT_HMAC_SECRET, x-forwarded-for first hop)`.
3. Generates a 32-byte token and stores `sha256(token)`.
4. Calls `request_roof_removal(...)` with the **service-role client**. This is a narrow server-only use and does not grant access to anon, and the RPC itself checks the `service_role` JWT role.
5. Emails the confirm link (Resend, `src/lib/notify.ts`).

Limits inside the RPC: 5 requests per IP hash per day, 5 per email per day, and an admin alert when there are more than 30 per day globally.

The **confirm** route hashes the token and calls `confirm_roof_removal` (service role). That function:
- sets the request to `confirmed`;
- moves the roof from `published`, `candidate`, `in_review`, `qa_pending` or `rejected` to **`opted_out`**;
- inserts a `roof_suppressions` row;
- returns, after which the route calls `revalidateTag('potential-tiles')` and shows "הגג הוסר מהמפה".

A **signed-in** requester (whose email is OTP-verified) skips the email step and the roof is hidden at once. Unconfirmed requests expire after 7 days.

**If the roof is already `claimed`** (a listing exists), the request becomes a **`dispute`** for admins, and no automatic action is taken on someone else's listing.

**Admin** (`/admin/removals`) can:
- `upheld`, the default, which keeps the roof hidden;
- `restored_abuse`, which needs a note: the roof goes back to `published`, the suppression is deleted, and the change is audited. This is for patterns such as one IP hash or email domain removing many roofs, or a competing installer.

**Retention:** `pii_purge_after = decided_at + 90 days`. After that the daily cron nulls `contact_email` and `message`. The suppression geometry and the reason code are kept indefinitely so the roof is never republished; they contain no personal data. The legal workstream must confirm the retention periods (UNVERIFIED).

**Privacy items that follow from the brief** (Amendment 13; this design does not verify them, it implements them as constraints):
- no owner names and no Tabu or company joins anywhere in the schema;
- no address strings stored;
- polygons and rounded figures only;
- a privacy notice section for the layer: update `src/app/privacy/page.tsx` and the legal details in `src/components/site/legalInfo.tsx` (privacy contact);
- opt-out and removal as above;
- possible database registration if leads are transferred as a business, which is out of scope for Phase 1 because nothing is transferred.

The whole published layer is scrapeable by design (tiles). Legal must treat it as a publication.

`NEXT_PUBLIC_POTENTIAL_LAYER` (`off`, `admins` or `public`) is the kill switch.

### 8.2 CSP and configuration changes

- `next.config.ts`: add `https://challenges.cloudflare.com` to `script-src` and a new `frame-src` directive. These are the two directives Turnstile's CSP page requires.
- New env vars, to be documented in `docs/DEPLOY.md` and `.env.example`:
  - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`
  - `OPTOUT_HMAC_SECRET`
  - `CRON_SECRET`
  - `NEXT_PUBLIC_POTENTIAL_LAYER`
  - `NEXT_PUBLIC_REVIEW_IMAGERY` (JSON provider list; §9.1)

### 8.3 Audit log (new, also covers existing admin actions)

```sql
create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,                                  -- auth.uid(); null for pipeline/system
  actor_role text not null,                       -- jwt role: authenticated | service_role | system
  action text not null check (char_length(action) <= 60),   -- 'listing.admin_hidden', 'verification.decide', 'potential.status', ...
  entity text not null, entity_id text not null,
  diff jsonb not null default '{}' check (pg_column_size(diff) < 8192),   -- {col: [old, new]}
  note text check (char_length(note) <= 1000)
);
create index admin_audit_log_entity_idx on public.admin_audit_log (entity, entity_id, at desc);
create index admin_audit_log_actor_idx on public.admin_audit_log (actor_id, at desc);

create function public.audit_write(p_action text, p_entity text, p_entity_id text, p_diff jsonb, p_note text default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.admin_audit_log (actor_id, actor_role, action, entity, entity_id, diff, note)
  values (auth.uid(), coalesce(auth.jwt() ->> 'role', 'system'), p_action, p_entity, p_entity_id, p_diff, p_note);
$$;
revoke execute on function public.audit_write(text, text, text, jsonb, text) from public, anon, authenticated;

create function public.audit_log_immutable() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'audit log is append-only' using errcode = '42501'; end $$;
create trigger admin_audit_log_immutable before update or delete on public.admin_audit_log
  for each row execute function public.audit_log_immutable();

alter table public.admin_audit_log enable row level security;
create policy "audit: admins read" on public.admin_audit_log for select to authenticated using (public.is_admin());
revoke all on public.admin_audit_log from anon;
revoke insert, update, delete, truncate on public.admin_audit_log from authenticated, service_role;
```

The audit trigger functions are SECURITY DEFINER, so they can call the revoked `audit_write`. They identify the actor from `auth.uid()` and `auth.jwt()`, **not** `current_user`, which inside a definer function is always the owner (the caveat on `is_untrusted_caller` in `20261018000000_init.sql` applies here too).

| Trigger | Fires when | Logged |
|---|---|---|
| `listings` AFTER UPDATE | `is_admin()` or system, and any of `admin_hidden, tech_assessment, owner_verification, is_fictional, potential_roof_id` changed | diff of those columns |
| `listings` AFTER DELETE | `is_admin()` | `{title, locality, owner_id}` snapshot (minimal) |
| `verification_requests` AFTER UPDATE OF status | any | `status`, `review_note` length only (not the text) |
| `profiles` AFTER UPDATE | `is_admin` changed (via SQL editor = system) | diff |
| `potential_roofs` statement-level | status changed | aggregated `{from→to: n}` per statement, plus a per-row entry for manual overrides |
| `review_decisions`, `roof_claims`, `removal_requests`, `exclusion_zones` | admin decisions | key fields |

Retention: keep everything for 24 months, then delete with a superuser maintenance script that temporarily disables the immutability trigger. The period is UNVERIFIED and goes to legal.

### 8.4 Monitoring

- **Daily health cron:** `src/app/api/cron/potential-health/route.ts`, scheduled in `vercel.json` `crons`. Hobby allows only once a day with ±59 min precision; Pro allows once a minute. It checks `Authorization: Bearer ${CRON_SECRET}` and calls a definer RPC `potential_maintenance()` (service role) that:
  - expires claims and unconfirmed removals;
  - releases stale locks;
  - purges PII past retention;
  - returns counts.
  It then emails an admin digest through Resend with:
  - the review backlog by tier;
  - the QA disputes waiting;
  - removals waiting and the oldest one;
  - claim conflicts;
  - claims started and listings created;
  - the database size (`pg_database_size`, alert at >70% of the plan);
  - the last `ingest_runs` status.
- **Admin overview KPIs** in `src/app/admin/page.tsx`: potential published, in queue, claims to listings (conversion), removals in the last 30 days.
- **Route logging:** tiles log only misses, with duration (`console.info('[potential-tiles] miss', z, ms)`), visible in Vercel logs. Watch `x-vercel-cache` in the browser. Targets: hit ratio >90% and p95 miss <400 ms.
- **Pipeline:** `ingest_runs` counts and errors. The GitHub Action fails loudly. Every run's dry-run diff is pasted into the PR or issue that approves the apply.

---

## 9. Imagery: provider abstraction and costs

### 9.1 Abstraction

```ts
// src/lib/imagery.ts
export interface ImageryProvider {
  id: string;                    // 'esri-alp' | 'mapbox-satellite' | 'maptiler-satellite' | …
  label: string;                 // Hebrew
  url: string;                   // {z}/{x}/{y} template incl. a DOMAIN-RESTRICTED key/token
  attribution: string;
  tileSize: 256 | 512; zoomOffset?: number; maxNativeZoom: number;
  uses: { publicMap: boolean; adminReview: boolean };   // licence-driven switches
  termsUrl: string; vintage?: string;
}
// Parsed (zod) from NEXT_PUBLIC_REVIEW_IMAGERY (JSON array). The public map keeps NEXT_PUBLIC_IMAGERY_TILE_URL.
```

Every `review_decisions` row stores `imagery_provider` and `imagery_zoom`. If legal later rules that a provider's terms do not cover review, a query finds every affected decision so those roofs can be re-reviewed with another provider. The keyless Esri default in `src/lib/config.ts` must **never** be used in `/admin` in production. `ReviewMap` refuses providers where `uses.adminReview` is false.

### 9.2 Volume model

| Mode | Tiles per decision | Basis |
|---|---|---|
| Single, 960×640 map, z19, 256 px | about 20, plus about 10 for context zoom ⇒ **~30** | (⌈960/256⌉+1)×(⌈640/256⌉+1) = 5×4 |
| Grid, 12 cells of 320×240 at z18 | about 8 per roof (100 per page) | 2–3 × 2–3 tiles per cell |
| QA and re-views | ×1.2 | 10–20% sampled |

| Scope | Grid-first (80% grid / 20% single) | All single |
|---|---|---|
| Pilot full labelling (2.3k) | 2.3k × 12.4 × 1.2 ≈ **34k tiles** | 83k |
| Phase-1 region (3k) | ≈ **45k** | 108k |
| National Tier A+B (20k) | ≈ **300k** | 720k |

These are one-off review volumes. Ongoing monthly volume is small (new releases, re-reviews).

### 9.3 Price check

| Provider | Free per month | Beyond | Cost for national review (≤720k tiles) | Licence notes for *review* use |
|---|---|---|---|---|
| ArcGIS Location Platform (basemap tiles) | **2M tiles** | **$0.15 / 1,000 tiles** (or 1k sessions free, then $4/1k sessions) | **$0** | Brief: commercial visualisation allowed; extraction/derivation outside ArcGIS apps forbidden; no combining with ODbL layers; whether human QA counts as "visualisation" is UNCERTAIN |
| Mapbox Raster Tiles API (satellite) | **750k tiles** | $0.25/1k (750k–2M), $0.20, $0.15 | **$0** | The main ToS page has no explicit derivation clause; the separate Product Terms were **not** reviewed (UNVERIFIED) |
| MapTiler Cloud | Free: 100k requests and 5k sessions, "testing, PoC, prototyping, personal, or non-commercial use" | **Flex $30/mo**: 500k requests, $0.15/1k requests, $2.50/1k sessions | about $30 plus about $33 overage for one month | Commercial terms and derived-data clause not verified; satellite quality over Israel UNVERIFIED |
| Google Map Tiles API, 2D | 100k events | **$0.60 / 1,000** | about $370 | Secondary sources quote §3.2.4(b): "No Creating Content From Google Maps Content… tracing, digitizing, or creating other datasets", which is likely incompatible with labelling. **Avoid** (primary text not retrieved) |
| Esri World Imagery keyless | none | n/a | n/a | Not licensed for commercial use (brief). Remove from defaults |
| Survey of Israel / GovMap orthophoto | n/a | royalties | n/a | Impractical (brief) |

**Conclusion:** at Phase-1 scale, review imagery costs **about $0–$65 one-off** on any of the first three providers. Cost is not the decision driver; **licence fit is**. The imagery and legal workstreams pick the provider, and the design only needs the env JSON.

---

## 10. Monthly run-rate after launch

| Item | Phase 1 | Source / note |
|---|---|---|
| Supabase Pro | **$25/mo** (8 GB DB, 250 GB egress, daily backups 7 days, no pausing) | Free plan: 500 MB DB, pauses after 1 week of inactivity, no backups |
| Vercel Pro | **$20/mo** (1 TB transfer, 10M CDN requests; whether the price is per seat was not checked) | Hobby is "personal, non-commercial use" |
| Basemap + public aerial | **$0–30/mo** (ALP 2M free tiles; or MapTiler Flex $30) | public tile volume about 200k–400k tiles/month at about 3k–5k sessions (UNVERIFIED traffic assumption) |
| Review imagery | about $0 per month after the first pass | §9.3 |
| Turnstile | $0 | free plan |
| PVGIS | $0 | free API, 30 req/s per IP |
| GitHub Actions | $0 | ≤2,000 min/month on private repos |
| Resend | existing | unchanged volume (+ removal confirmations) |
| **Total infra delta** | **about $45–75/mo** | excludes legal review and reviewer labour |

---

## 11. Work breakdown, sequence, milestones

### 11.1 Effort (person-days, one developer who knows the codebase)

| # | Component | Tasks | pd |
|---|---|---|---|
| 1 | Pipeline | fetch with dated index and manifest (1); streaming loader and density grid (1.5); features SQL (1.5); context hook framework and licence gate (1); scorer, fit script and label export (1.5–2.5); PVGIS cells (0.5); stage and `apply_batch` with IoU identity (2–3); runbook (0.5) | **9–12** |
| 2 | Schema / RLS / triggers / RPCs | 5 migrations; listings guard changes; claim, review and removal RPCs; RLS test suites in `tests/rls.test.ts` (permission matrix, rate limits, link races, append-only audit) | **7–9** |
| 3 | Public layer | 1-day spike; tile and cluster RPCs; route handlers; proxy matcher; tag purge; `PotentialLayer`/`Clusters`/`Preview`; legend, toggle, URL state; methodology page; e2e `e2e/potential.spec.ts` | **6–8** |
| 4 | Review screen | queue RPC integration; grid and single modes; keyboard hook; imagery registry; QA/adjudication flow; undo; stats page; per-roof history page | **7–10** |
| 5 | Claim flow | claim page and action; prefill RPC; wizard prefill and storage key; error mapping; conflicts admin page; owner-panel claims; emails | **5–7** |
| 6 | Opt-out and privacy | form, Turnstile, HMAC, confirm route; service-role RPC calls; removals admin page; suppression; privacy and terms copy hooks; CSP | **4–6** |
| 7 | Audit log | table, helper and triggers on new and **existing** tables; `/admin/audit` viewer | **2–3** |
| 8 | Monitoring | daily cron, maintenance RPC, digest email, KPIs | **1.5–2** |
| 9 | Licensed tiles | public basemap/aerial env switch, attribution, review provider config, DEPLOY.md | **1–1.5** |
| 10 | Hardening | security review pass (`/security-review`), load test of tiles (k6 or autocannon), docs | **3–4** |
| | **Total** | | **45.5–62.5 pd** |

Not development effort:
- reviewer time, about 10 h for pilot labelling plus about 16 h for the Phase-1 region (§2);
- external legal review (privacy, ODbL grey zone, imagery terms) and its lead time;
- Hebrew copy review.

**Lean cut** (about 32–38 pd): single mode only, no clusters (polygons from z13 with a "התקרבו כדי לראות גגות פוטנציאליים" hint), email-only opt-out with no Turnstile but admin-reviewed (slower hiding), no interest feature, no stats page beyond counts.

### 11.2 Sequence and acceptance criteria

| Milestone | Weeks (1 dev) | Content | Acceptance criteria |
|---|---|---|---|
| **M0: decisions** | 0–1 | Legal questions sent (§13); review imagery provider chosen; Supabase Pro and Vercel Pro; staging Supabase project (or local only); tile-render spike | Written provider choice with terms link; spike exit criteria (§5.4) met or fallback D chosen |
| **M1: data foundation** | 1–3 | Migrations 1–5 on staging; pipeline on the pilot bbox; nothing public (flag `off`) | `test:rls` green, including: anon reads 0 rows from all new tables; `potential_roofs_mvt` never returns non-published roofs; claim and removal RPC permission matrix; audit log update and delete refused. Pipeline: a second run of the same release gives 0 inserts and 0 updates; MS ≥1000 m² count on the pilot = 2,294 ±1% (vs `audit/recompute-core.json`); `area_sqm` within 0.1% of ST_Area; licence gate blocks an OSM provider in prod mode |
| **M2: review** | 3–5 | Review screen; label the whole pilot set (about 2.3k); fit the scorer | Median grid throughput ≥200 roofs/h over ≥500 decisions; QA agreement on publish vs not ≥85% (pilot blind benchmark 92%); Tier A+B covers ≥85% of publishable labels with ≤50% of candidates; every decision has provider and zoom recorded and an audit row |
| **M3: flagged beta** | 5–8 | Public layer, claim flow, opt-out, privacy and methodology pages; flag `admins` | Tile miss p95 <400 ms and hit ratio >90% after warm-up; e2e: confirmed opt-out removes the roof from tiles within 60 s; claim → listing with prefilled polygon in <3 min; a second linked listing on the same roof is refused with the Hebrew message; listing deletion makes the roof `withdrawn`; potentials never render with pin or listing styling; axe check on the new panels |
| **M4: launch (pilot + neighbours)** | after legal sign-off | Flag `public` for the configured regions; licensed tiles in prod; daily digest live; weekly ingest and review cadence | Legal sign-off recorded (reference stored in `provenance`/config); no keyless OSM or Esri URLs in prod env; removal backlog <48 h in the digest; first 30-day KPIs reported (claims started, listings from claims, removals, review precision by tier) |

---

## 12. Risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| Privacy law (Amendment 13): the layer is personal data about single-owner buildings; database registration duties | Med / **High (launch blocker)** | No owner data, rounded figures, opt-out with suppression, notice, retention, kill switch, legal sign-off gate at M4 |
| ODbL contamination of the public layer | Low with the licence gate / High | MS-only geometry; prod never stores OSM; `osm_assisted` blocked in prod; provenance per roof |
| Imagery terms do not cover human QA labelling (Esri ALP "visualisation" uncertain; Google likely prohibits) | Med / High | Provider registry plus per-decision provenance, so affected decisions can be re-reviewed; choose a provider with an explicit permission |
| Low precision or recall of the ODbL-free score (no OSM land use; greenhouses) | **High** / Med | Full pilot labelling at M2, GHS-BUILT-C hook, logistic fit, QA on rejections to measure recall |
| Wrong or merged outlines (~25%) and stale imagery (MS 2014–2024; PV installed since) | High / Med | `outline_wrong` reject; "data vintage" disclaimer; partial or full PV categories; owner claims correct the polygon; re-review on new releases |
| Misleading investors (a potential roof looks like an offer) | Med / High | No pins, hatched slate style, "לא מוצע" everywhere, no ₪, default off, separate list line |
| Abuse: mass opt-outs, fake claims, scraping | Med / Med | Turnstile, HMAC IP and email limits, admin restore, claim and listing rate limits, conflict flow; scraping is accepted by design and legal is told |
| Owner backlash or complaints | Med / Med | One-click removal, fast hiding, polite copy, privacy contact |
| Sensitive or military sites published | Low / **High** | Exclusion zones, `sensitive_site` category, reviewers briefed |
| Single-maintainer Leaflet MVT library | Med / Low | Day-1 spike with fallback D; a MapLibre path exists |
| Plan limits (Supabase Free pausing, 500 MB; Vercel Hobby non-commercial; Hobby cron once a day) | High if not upgraded | Upgrade at M0 |
| Pipeline credentials leak (prod DB URL on a laptop) | Low / High | Session-pooler role scoped to the `ingest` schema (Phase 1.5: a dedicated `pipeline` role with grants on `ingest.*` and `apply_batch` only), stored in a password manager or GitHub secret |
| Review labour underestimated | Med / Med | Measured throughput at M2 re-baselines the national plan; grid-first workflow |

---

## 13. Open questions (owner: legal / product / imagery workstream)

1. **Legal:**
   - Is publishing MS-geometry potential roofs (area, kWp) without owner data acceptable under Amendment 13 with this opt-out design?
   - Is database registration needed?
   - What retention applies to removal requests and the audit log?
   - Should polygon-level detail be login-gated (`NEXT_PUBLIC_POTENTIAL_LAYER=signed_in` variant; note this disables shared CDN caching)?
2. **Legal (ODbL):** May OSM land use be used *only* to order the internal review queue (`osm_assisted`)? If not, does the GHS-BUILT-C hook suffice? This is decided at M2.
3. **Imagery:** Which provider's terms explicitly permit human visual classification of roofs whose results are stored and published as a category? If it is ALP, does an OSM-based street basemap in the same Leaflet layer switcher count as "combining with ODbL layers"?
4. **Product:**
   - Default the layer on or off?
   - Should investors get "notify me / interest" in Phase 1?
   - Which regions are in Phase-1 scope?
   - Do potential roofs appear as a count in the side list or not at all?
5. **Ops:** Who are the reviewers? QA needs at least 2 admins, plus a third for adjudication. What is the SLA for removal decisions?
6. **Data:** Confirm PVGIS E_y for `mountingplace=building, angle=10` across Israel (not computed here). Confirm whether the MS 2026-08-13 refresh touched Israeli quadkeys (check the index `UploadDate`/size per quadkey).

---

## 14. Sources (all seen 2026-10-19 unless noted)

**Repository** (read in full or in part): `supabase/migrations/20261018000000_init.sql`, `20261019000000_hardening.sql`, `20261019010000_review_fixes.sql`, `20261019020000_fix_verification_cancel_trigger.sql`, `supabase/config.toml`, `src/lib/{config,geo,finance,types,validation,listing-payload}.ts`, `src/lib/data/*`, `src/lib/supabase/*`, `src/proxy.ts`, `next.config.ts`, `vercel.json`, `src/components/explore/*`, `src/components/map/mapParts.tsx`, `src/components/publish/{ListingWizard,draft,draftStorage,LocationStep,saveErrors}.ts(x)`, `src/app/admin/**`, `src/components/admin/*`, `src/app/dashboard/actions.ts`, `src/components/dashboard/VerificationBox.tsx`, `src/app/listing/[id]/page.tsx`, `src/app/api/{pvgis,geocode}/route.ts`, `src/app/sitemap.ts`, `docs/DEPLOY.md`, `research/pilot-emek-hefer/{analyze.mjs,fetch-ms.mjs,qa.html,index.html,overpass-queries.txt,data/stats.json,audit/recompute-core.json}`. Local stack versions from `supabase/.temp`: PostgREST v14.18, Postgres 17.

**Platforms and pricing**
- Supabase pricing (Free 500 MB, 5 GB egress, "Free projects are paused after 1 week of inactivity"; Pro from $25, 8 GB, $0.125/GB, 250 GB egress, daily backups 7 days): https://supabase.com/pricing
- Supabase Edge Function limits (256 MB, 2 s CPU, 150 s / 400 s wall clock): https://supabase.com/docs/guides/functions/limits
- Supabase Storage supports HTTP range requests (PMTiles guide): https://supabase.com/blog/self-host-maps-storage-protomaps
- Supabase pg_cron (platform supports it; availability on Free not explicitly stated, UNVERIFIED): https://supabase.com/docs/guides/cron/install
- Vercel pricing (Hobby "personal, non-commercial use"; Pro $20, 1 TB, 10M CDN requests, overage $0.15/GB, $2/1M requests): https://vercel.com/pricing
- Vercel CDN cache (s-maxage, cacheable criteria, set-cookie, 10 MB, per region, Vercel-CDN-Cache-Control): https://vercel.com/docs/caching/cdn-cache
- Vercel cache purge (Vercel-Cache-Tag; Next 16 `revalidateTag(tag)` deletes; rate limits): https://vercel.com/docs/caching/cdn-cache/purge
- Vercel Routing Middleware runs before the cache: https://docs.vercel.com/docs/edge-middleware (via search summary; primary text not quoted)
- Vercel cron limits (Hobby once a day ±59 min; Pro once a minute): https://vercel.com/docs/cron-jobs/usage-and-pricing
- GitHub Actions billing (2,000 min private, $0.006/min Linux 2-core, public free): https://docs.github.com/en/billing/concepts/product-billing/github-actions
- GitHub-hosted runners (private 2 vCPU / 8 GB / 14 GB; public 4 / 16 / 14): https://docs.github.com/en/actions/reference/runners/github-hosted-runners
- GitHub Actions limits (6 h per job): https://docs.github.com/en/actions/reference/limits
- Cloudflare Turnstile plans (Free: unlimited challenges, 20 widgets): https://developers.cloudflare.com/turnstile/plans/
- Turnstile CSP (script-src and frame-src https://challenges.cloudflare.com): https://developers.cloudflare.com/turnstile/reference/content-security-policy/

**Data and licences**
- Microsoft GlobalMLBuildingFootprints (CDLA Permissive 2.0; 2026-08-13 refresh; dated index; hosting moved 2026-07-24; height and confidence properties; imagery years stated inconsistently): https://github.com/microsoft/GlobalMLBuildingFootprints
- CDLA-Permissive-2.0 (§2.1 share with the agreement text; §3.1 no restrictions on Results; no attribution requirement): https://cdla.dev/permissive-2-0/
- Geofabrik Israel and Palestine extract (114 MB, ODbL 1.0, data up to 2026-10-18): https://download.geofabrik.de/asia/israel-and-palestine.html
- GHS-BUILT-C R2023A (10 m, residential vs non-residential; CC BY 4.0 per AWS registry): https://registry.opendata.aws/ghs-built-c/ and https://developers.google.com/earth-engine/datasets/catalog/JRC_GHSL_P2023A_GHS_BUILT_C
- PVGIS non-interactive API (30 calls/s per IP; PVcalc parameters incl. `mountingplace=building`; v5.3): https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/getting-started-pvgis/api-non-interactive-service_en
- Brief-provided licensing and legal findings (Esri ALP terms, keyless Esri, MAPI/GovMap, ODbL grey zone, Overpass, Amendment 13): **not re-verified in this document**

**Libraries and specs**
- PostGIS ST_AsMVT (example with ST_TileEnvelope, ST_AsMVTGeom, extent 4096): https://postgis.net/docs/ST_AsMVT.html
- PostgREST media type handlers (domain over bytea named after the media type): https://docs.postgrest.org/en/v12/references/api/media_type_handlers.html
- Leaflet.VectorGrid on npm (latest 1.3.0, 2017-08-28): https://registry.npmjs.org/leaflet.vectorgrid ; Leaflet ≥1.8 click bug (`fakeStop`): https://github.com/Leaflet/Leaflet.VectorGrid/issues/274
- protomaps-leaflet (5.1.0, 2025-06-18; "now in maintenance mode… recommended only for legacy Leaflet-based systems"): https://registry.npmjs.org/protomaps-leaflet , https://github.com/protomaps/protomaps-leaflet
- leaflet-vector-tile-layer (0.16.3, 2025-12-16, BSD-3-Clause; SVG only; style, filter, events): https://registry.npmjs.org/leaflet-vector-tile-layer , https://cdn.jsdelivr.net/npm/leaflet-vector-tile-layer@0.16.3/README.md
- maplibre-gl (6.15.0, BSD-3-Clause, unpacked 28.8 MB): https://registry.npmjs.org/maplibre-gl/latest

**Imagery pricing and terms**
- ArcGIS Location Platform ("2M free then $0.15 per 1,000 tiles"; sessions "1K free then $4 per 1,000"): https://location.arcgis.com/pricing/
- Mapbox pricing (Raster Tiles 750k free, then $0.25/$0.20/$0.15 per 1k): https://www.mapbox.com/pricing ; Mapbox ToS (no explicit derivation clause on that page; Product Terms not reviewed): https://www.mapbox.com/legal/tos
- MapTiler Cloud pricing (Free: 100k requests and 5k sessions, non-commercial wording; Flex $30, 500k requests, $0.15/1k): https://www.maptiler.com/cloud/pricing/
- Google Maps Platform pricing (Map Tiles API 2D: 100k free, $0.60/1k): https://developers.google.com/maps/billing-and-pricing/pricing ; "No Creating Content From Google Maps Content" clause via a secondary source (primary text not retrieved, UNVERIFIED): https://wpgeodirectory.com/support/topic/changes-to-google-maps-platform-terms-of-service/
