# SolGag (סולגג): Phase 1 plan for the "potential roofs" layer

| | |
|---|---|
| **Status** | **v2, 2026-10-19.** Revised after the cost, legal and technical reviews (every issue and its handling is in Appendix K). Ready for the owner's decisions (§0, §12). Read §0–§12 (about 15 minutes); details are in Appendices A–K. |
| **Author** | Lead planner. Combines the five workstream notes [`phase1/imagery-costs.md`](phase1/imagery-costs.md), [`phase1/data-sources.md`](phase1/data-sources.md), [`phase1/israel-scale.md`](phase1/israel-scale.md), [`phase1/technical-design.md`](phase1/technical-design.md), [`phase1/product-legal.md`](phase1/product-legal.md), plus sources re-checked for v2 (Appendix J). |
| **Evidence** | Pilot `research/pilot-emek-hefer/` (`data/stats.json`, `data/candidates.geojson`, `analyze.mjs`, `audit/*`), national files `research/israel-scale/`, repo `supabase/migrations/*`, `src/*`, `docs/DEPLOY.md` |
| **Changed** | Nothing in application code, migrations or `.env`. This is a plan only. Not legal advice. |

**Conventions.**
- Tags: **UNVERIFIED** (no primary source confirmed it), **ESTIMATE** (planner's model or judgement), **[LAWYER]** (needs Israeli counsel), **[OWNER]** (owner's decision, §12).
- Money is USD excluding VAT unless marked ₪. One rate is used throughout: **₪3.11 per $** (Bank of Israel representative rate, [boi.org.il/PublicApi/GetExchangeRates](https://www.boi.org.il/PublicApi/GetExchangeRates), lastUpdate 2026-10-19). Israeli suppliers (lawyer, printing) add **18% VAT** (in force since 2025-01-01, [chamber.org.il](https://www.chamber.org.il/serviceslobby/finance/1427/154872/), seen 2026-10-19). Whether SolGag can reclaim it depends on its VAT status (עוסק מורשה or not), which the accountant must confirm. VAT on foreign SaaS and card FX fees are **UNVERIFIED**.
- Traffic unit: a **map page view** is one page load that mounts a Leaflet map, *including* the panning, zooming and listing selections on that page. It is not one viewport fill (§8.2).
- Prices were seen on 2026-10-19 unless marked otherwise. Each has a source URL here or in the workstream note named next to it.

---

## 0. Executive summary

| | |
|---|---|
| **What Phase 1 delivers** | A **public pilot in the Emek Hefer box (188 km²)**, in four parts: (1) a pipeline that turns Microsoft footprints (CDLA-P-2.0) into about 2,300 candidate roofs ≥1,000 m², classified by XPLAN land use (CC BY), with no OSM in the published data; (2) an **admin review screen**, where Israel-based reviewers label every candidate on purchased Airbus 30 cm imagery with blind QA, giving about **100–120 publishable roofs**; (3) a **potential-roofs map layer, off by default**: anonymous visitors see coarse hexagon counts (≥5 hidden roofs per hexagon); phone-verified, invited or business-verified investors see outlines (area ±20%, kWp range) **only for roofs whose owner opted in or whose company ownership is confirmed**; they register interest and SolGag passes it on, free of charge; (4) **owner letters with a code**, through which the owner claims the roof (it becomes a listing, held until ownership is verified), allows display, corrects it or removes it |
| **Timeline** (ESTIMATE, start 2026-11-02) | **M-1 now:** licensed tiles on the live site (needed regardless). **Build ends** about mid-March to late April 2027 with 1 developer, or mid-January to early February with 2. **Public pilot (S3)** about **late May to late July 2027** with 1 developer, or late March to early May with 2. **Gate 2** (national go/no-go) about Dec 2027 to Jan 2028 |
| **Build effort** | **81–107 person-days + 15% contingency = 93–123 pd** (lean cut 74–89 pd). Operations about **85–140 h** over the pilot. Labour = pd × the owner's day rate (§9.4) |
| **Recurring cost / month** (USD excl. VAT) | **Pilot traffic, ≈10k map page views: $115–280 cash, plus $150–350 imagery refresh amortised.** At 100k: $215–2,140, planning case ≈ $670; the main driver is tiles per page view (20–150), measured at M-1. 1M is not a Phase 1 scenario ($3.0k–22.7k). Only ≈$160–370 of the 10k figure is caused by potential roofs; the rest is needed before any public launch (§9.2) |
| **One-off cash, first 12 months** | Airbus imagery **$3.6k–4.2k** ($5.5k if new capture is needed) · legal, two opinions, **$11k–32k (placeholder, UNVERIFIED; 2–3 fixed-fee quotes at M0)** · postage ≈ $400. **12-month total at 10k views ≈ $16.6k–41k** before VAT and labour (≈ $18.6k–47k if VAT on legal fees cannot be reclaimed). Rate ₪3.11/$ |
| **Recommended imagery setup** | **Street map:** MapTiler Cloud Flex ($30/mo, spending limit). **Public aerial:** Esri ArcGIS Location Platform (ALP) World Imagery (2M tiles/mo free, then $0.15/1k; usage alert at 70%), **display only**: no labelling or owner drawing on it until Esri confirms in writing. **Review:** Airbus Pléiades Neo 30 cm archive, Standard licence, full pilot box in 2 orders, **stored and served inside Israel** (AWS Tel Aviv) to Israel-based reviewers. The Airbus licence forbids transfer outside the licensee's territory without authorisation. **Never** keyless `tile.openstreetmap.org` or `server.arcgisonline.com` (today's defaults) |

**The five decisions the owner must make now** (all decisions: §12)
1. **Lawful basis (D3).** Show building outlines only after the owner opts in, or after company ownership is confirmed. Notice letter + 30-day opt-out only if counsel confirms it in writing against the Privacy Protection Authority's (PPA) Feb 2026 consent opinion. *Recommended.*
2. **Scope (D2, D15).** Emek Hefer pilot only. **No national load or review in Phase 1.** National needs counsel's written answer on storing data about individually owned roofs, plus $28k–57k of imagery per refresh, or Esri's written OK. *Recommended.*
3. **Review imagery (D5, D20).** Buy the Airbus pilot archive ($3.6k–4.2k), host it in Israel, and ask Airbus in parallel whether EU hosting is allowed. *Recommended.*
4. **Delivery and budget (D13, D14, D21).** 1 developer on the full plan (93–123 pd), 2 developers, or the lean cut. Set the day rate, approve the cash above, and choose between point-in-time recovery (PITR, +$105/mo) and the included daily backups. *Recommended: full plan, daily backups for the pilot.*
5. **People (D6, D7).** Name 3 Israel-based reviewers (2 for QA, 1 adjudicator); contractors sign the Airbus undertakings. Name who handles letters, claims and removals (SLA: 1 business day). *Recommended: at M0.*

**What changed since v1.**
- Opt-in visibility, with k≥5 hexagons over hidden roofs only.
- Rollout mode, claim hold and the legal sign-off are enforced in the database.
- Costs re-modelled: tiles per page view; Airbus per-order minimums; backups and staging; SMS sender; domain; amortised imagery; labour; one currency with VAT.
- The full Airbus licence was read, so the review imagery is hosted in Israel.
- No owner drawing over Esri imagery.
- Effort rises from 63–83 to 93–123 pd, and S3 moves about 6–8 weeks later.

Appendix K lists every review issue and how it was handled.

---

## 1. Scope and design decisions

### 1.1 Decisions that resolve the conflicts between workstreams

| # | Topic | Decision in v2 | Why |
|---|---|---|---|
| R1 | Who sees what | **Anonymous visitors:** H3 hexagon statistics over *aggregate-only* roofs only, at least 5 per hexagon, banded counts, area rounded to 5,000 m². Building-visible roofs are counted separately. **Building outlines** go only to gated users (phone OTP, Outreach Code, and an invitation in S2 or a business check in S3), and only for roofs with a positive signal (R8). Every RPC enforces the mode itself. | Amendment 13 makes building-level data about individually owned roofs likely personal data. The k≥3 rule over mixed sets allowed a differencing attack (App. K, L3/T6) |
| R2 | Tiering | XPLAN land use (CC BY) is the main signal. The Microsoft geometry score orders the queue. OSM never enters production. | Keeps the published layer free of ODbL |
| R3 | Review imagery | Purchased Airbus Pléiades Neo 30 cm, hosted in Israel. Esri ALP or ArcGIS Online is used for labelling **only with Esri's written confirmation**. | Licence fit and recency. Esri's "Uses Permitted" allows tracing only inside ArcGIS apps, with public sharing only through open-data routes (App. G.6) |
| R4 | Claims | A claim-linked listing is **held in RLS** (row-level security) until ownership is verified. Roof status: `claim_pending` → `claimed` on approval, with auto-revert after 30 days. An ordinary listing drawn over a published roof becomes an implicit claim. | Stops squatting and roof hiding (App. B.7) |
| R5 | Precision | Area rounded to 100 m² with ±20%. Capacity is a range, area×0.40/6.5 to area×0.65/6.5 (× free share), rounded to 10 kWp. No ₪ figures. | About 25% of outlines are wrong |
| R6 | Public bodies | Reviewed, never published in Phase 1 | They lease by tender [LAWYER] |
| R7 | Geography | **Pilot box only.** No national load or review until counsel answers Q2 in writing *and* a national imagery route is funded (D15, D19). | Privacy basis is uncertain. Imagery for national review costs $28k–57k per refresh |
| R8 | Notice and lawful basis | The postal letter is an **ethical notice**, not the lawful basis. **Model O (default):** building level only after the owner opts in on `/roof/<code>`, or after company ownership is confirmed under a data-sharing agreement. **Model N** (letter + 30 days → building level for corporate or kibbutz roofs) only if counsel affirms it in writing against the PPA primary text. Returned letters never count. | Secondary summaries of the PPA's final opinion (25 Feb 2026):
- "שתיקה או היעדר מחאה אינם מספיקים" (silence or lack of objection is not enough), and active opt-in may be required for direct-mailing services and for profiling not tied to the service ([Shibolet](https://www.shibolet.com/?p=24351), posted 9 Mar 2026, seen 2026-10-19).
- Direct marketing for third parties needs opt-in (AYR via Legalink, 27 Apr 2026, as quoted by the legal review).

The primary text returned 403 (**UNVERIFIED**) |

### 1.2 Users

| User | Gets | Does not get |
|---|---|---|
| Anonymous visitor | Hexagon bands of hidden roofs (5–9 / 10–19 / 20+, Σ area to 5,000 m²), a count of building-visible roofs, and "register interest in this area" (after a plain sign-in) | Outlines, per-roof figures |
| Gated investor or installer (phone OTP + Outreach Code + invitation in S2, or company-number check in S3) | Outlines of opted-in or confirmed-corporate roofs at zoom ≥15: area ±20%, kWp range, bare or partial-PV label, imagery date. Buttons "אני מעוניין/ת בגג הזה" (roof) and area interest | Owner identity, address, block/parcel (גוש/חלקה), ₪, export, other parties' interest |
| Owner or holder | Letter with a code; `/roof/<code>` with claim, allow display, correct or remove; the claim flow | Investors' identities, except with the investor's consent |
| Admin or reviewer (≤10 accounts) | Review queue, QA, letters, claims, removals, audit log, stats | — |

### 1.3 Non-goals and deferrals
- **Never in Phase 1:**
  - ₪, ROI or "investment" wording;
  - fees;
  - owner names or Tabu joins;
  - electronic cold outreach by SolGag;
  - tracing over third-party imagery;
  - per-roof public pages or SEO;
  - export or API;
  - Tier C;
  - MapLibre.
- **Phase 2:**
  - ML on imagery (allowed on purchased Airbus imagery, EULA Art. 1.1(e));
  - national publication;
  - anonymous building-level tiles;
  - paid analytics;
  - Ofek, GovMap or Electricity Authority inputs.
- **Phase 1.5 option (D11):** admins correct wrong outlines on Airbus imagery. Under the EULA such outlines are "derivative works", which may be distributed. This recovers part of the ~25% of Tier A lost to bad outlines. Needs counsel's confirmation, +2 pd.

---

## 2. Data pipeline (Appendix A)
- **Inputs:**
  - Microsoft footprints, release 2026-08-13, as published geometry;
  - XPLAN land use and zone (CC BY), queried from an Israeli IP at ≤2 requests/s;
  - PVGIS yield.
- **Mask and lookup lists.**
  - The service-area mask comes from Microsoft's own `Location=Israel` rows. geoBoundaries ISR is **ODbL** ([API](https://www.geoboundaries.org/api/current/gbOpen/ISR/ADM0/), seen 2026-10-19), so it is dropped.
  - The kibbutz list must come from a licence-clean source (**UNVERIFIED**). Until one is confirmed, reviewers set the class.
  - The licence gate now covers every input that filters or labels published rows.
- **Runs** from a local Node script against local PostGIS, then stages into prod. `ingest.apply_batch` is `SECURITY DEFINER` and granted only to the `pipeline` role. Each run is applied per quadkey with a 20-minute timeout.
- **Identity matching:**
  - greedy one-to-one IoU matching;
  - splits and merges go to an admin queue;
  - supersede is scoped to the run's quadkeys;
  - published and claimed roofs are never auto-superseded.
- **Tiers:**
  - A = XPLAN employment, commerce, industry or storage codes, or farm buildings, with clean geometry;
  - B = public buildings and agricultural land;
  - C = not reviewed.
- **Zone labels** come from a whitelist; strings with digits, גוש, חלקה, נחלה, מגרש or משפחת are rejected.
- **Volume and cost:** pilot ≈2,300 rows. Data stack $0.

## 3. Data model and security (Appendix B)
The database itself enforces these rules:
1. **Rollout mode.** `potential_layer_state` holds `mode` (off, admins, invited, public), `visibility_model`, `building_level_enabled` and `legal_signoff_ref`.
   - Every public RPC checks them.
   - The cron publishes nothing without the sign-off.
   - Changes go through an audited RPC that also purges the hexagon cache.
   - The `NEXT_PUBLIC_` flag only hides UI.
2. **Hexagon privacy.** k≥5, computed over hidden (aggregate) roofs only, with bands, 5,000 m² rounding and weekly batches. A property test runs at M1.
3. **Visibility** is recomputed on every change of owner class, status, letter status (returned letters never count), consent or mode.
4. **Claim hold in RLS** on `listings`, inquiries and images.
   - The owner still sees their own held listing.
   - The guard forces `claim_release_at = null` on insert.
5. **Status machine** adds:
   - `claim_pending`, with auto-revert after 30 days or on deletion;
   - `withdrawn`, only for verified listings;
   - `stale`, for an overdue re-review.
   An overlapping organic listing becomes a held implicit claim.
6. **Bbox RPC.**
   - Validated input, ≤0.08°×0.06°, outlines at zoom ≥15.
   - ≤100 calls and ≤150 distinct roofs a day, plus canary roofs.
   - Licence fields in every response.
7. **Housekeeping.**
   - Helpers live in a non-exposed `private` schema.
   - Missing indexes are added; advisors must be clean at M1.
   - The audit log records the DB role and `application_name`, plus a daily hash chain.
   - Storage files are purged by a Node step, with an alert if it fails.

## 4. Review screen (Appendix C)
- **Modes:** grid (12 roofs, ≥200/h) and single (120–180/h). Blind QA on 10% plus each reviewer's first 200 decisions, a third adjudicator, and a 200-roof precision study.
- **Imagery:** **Airbus only** in the review map (no street toggle; MapTiler §4.3). Every decision logs every layer shown.
- **Airbus hosting:**
  - tiles live in a private S3 bucket in `il-central-1`, served by a Lambda in the same region that checks a 30-minute HMAC token issued after one `is_admin` check;
  - `Cache-Control: private, no-store`;
  - reviewers work from Israel; contractors sign the Art. 1.1(f) undertakings;
  - "© Airbus DS" credit.
- **Pilot workload** at the plan's own throughput targets: **17–22 reviewer-hours**, up to 26 h. National Tier A, not in Phase 1: 46–69 h.

## 5. Public layer (Appendix D)
| | Anonymous | Gated (S2: invited · S3: invited or business-verified) |
|---|---|---|
| Zoom <15 | Hexagons: bands of hidden roofs (k≥5), plus a count of building-visible roofs | Same |
| Zoom ≥15 | Hexagons | Outlines of building-visible roofs (dashed slate, hatched), area ±20%, kWp range |
| Interest | Per area | Per roof and per area. Release emails need an opt-in checkbox (s.30א) |

- **Hexagon serving.**
  - A JSON route keyed by version: a stale version gets 404.
  - `s-maxage=3600`, purged by tag on every change, with retry and an alert.
  - Boundaries are computed on the server (h3-js is 65 KB gzipped).
- **Gated outlines** come from an authenticated RPC, uncached, drawn imperatively in a pane below real listings.
- **Access gate.**
  - Phone OTP via `updateUser`: a phone identity, not MFA, so no $75 add-on.
  - SMS-pumping defence: a Send SMS hook (+972 only, counters), Auth CAPTCHA (Turnstile), Twilio Geo Permissions, a usage alert, and the SMS limit raised on purpose from 30/h.
  - Outreach Code with the new s.30א clauses.
- **Copy fixes:**
  - letters no longer call the display "non-identifying";
  - no invented interest counts;
  - the source is called "מיפוי פתוח של מבנים (Microsoft)";
  - the removal text says what is kept.

## 6. Owner flows (Appendix E)
- **Letters (S1)** are sent only after Gate 0, by post or hand delivery.
  - Intermediaries get a **generic flyer and hexagon counts only**. Per-building data never goes to the regional council (a tax and enforcement body).
  - Kibbutz secretariats and the industrial-park manager are exceptions only with counsel and a data-sharing agreement.
  - Letters carry the Microsoft outline as SVG, the CDLA notice, the opt-in choice and the code.
- **Claim:**
  - `claim_pending` plus a held listing;
  - several typed documents (`verification_documents`, `needs_info`);
  - release on approval with a letter code, or 14 days after the claim-notice letter is sent;
  - **the prefill keeps the Microsoft outline**, with no redrawing over Esri until Esri answers question 1(e).
- **Removal:**
  - hidden at once;
  - the permanent suppression (geometry plus an enum) is written when an admin upholds it or after 7 quiet days; letter-code removals are instant;
  - limits, plus an s.13 access route.
- **Interest release:** one opt-in email with a link. The investor sends the inquiry. Tenant-interest records are never shared.

## 7. Legal and privacy (Appendix F)
- **Before M3:** file the PPA opinion's primary text and get counsel's **written** answer to Q1 (Model N). Model O is built and is the default.
- **Gate 0 (before any letter):** checklist L1–L16, including fixed-fee legal quotes, privacy and terms pages, the Outreach Code, CDLA notices on every surface, retention, letter approval, Esri and Airbus answers, and contractor undertakings. v1's "letters during M4" shortcut is removed, and the cron enforces it.
- **New counsel questions:** owner drawing over provider imagery; intermediaries; defence-industry sites and the Military Censor; an Airbus extract in letters; s.30א exposure for users' messages; "allow display" authority; geocoding.
- **Fix now (M-1):** keyless tiles; Google geocoding results shown on a non-Google map. Policy: "Geocoding API results displayed on a map must be shown on a Google Map".

## 8. Imagery and maps (Appendix G)

### 8.1 Recommendation by use
| Use | Recommended | Licence limits |
|---|---|---|
| Street map | MapTiler Flex: $30/mo for 500k requests, then $0.15 per 1k, with a **spending limit** ([pricing](https://www.maptiler.com/cloud/pricing/)) | §4.3 "you may not produce commercial derivative works" ([terms](https://www.maptiler.com/terms/)), so display only |
| Public aerial | Esri ALP World Imagery: 2M tiles/mo free, then $0.15 per 1k ([pricing](https://location.arcgis.com/pricing/)) | Visualization only. The pricing page shows **no spending limit**. M0 decides on pay-as-you-go and gets Esri's written answer on what happens at 2M (**UNVERIFIED**). Daily usage alert at 70% |
| Owner drawing (wizard, claim) | **M3 gate on Esri question 1(e).** If the answer is no: claims keep the Microsoft outline; organic listings use footprint selection (+1.5–2 pd), the Airbus Background Layer (by quote), or street-only drawing with MapTiler's written OK | Esri "Uses Permitted" allows digitizing only in ArcGIS apps, with public sharing only via open-data routes |
| Review | Airbus Pléiades Neo 30 cm, Standard licence, **hosted in Israel** | EULA Nov 2025: internal use (1.1(a)); derivative works distributable (1.1(g)); ML allowed (1.1(e)); no transfer outside the licensee's territory without authorisation (1.2(a)) |
| Review fallback | Wait for Airbus. ArcGIS Online (~$0.7k–1.4k per reviewer per year, **UNVERIFIED**) only with Esri's written OK | Same Uses Permitted limits |

### 8.2 Tiles per map page view
- **Unit.** MapTiler's "10–16 requests" is one 256 px viewport, not a page view. On `/explore` one fill is about 34–40 tiles at 1920×1080 (the map minus the 360–430 px side column, `globals.css:317`), about 18 at 1366 px and about 10 on a phone.
- **Today's code.** Selecting a listing calls `flyToBounds` (`ExploreMap.tsx:75`). With Leaflet's default `updateWhenZooming: true` (`GridLayer.js:95–97`), one click from z8 to z17 can load 100–300 tiles.
- **Planning case: 60 tiles per page view** after the M-1 fixes. The range is 20–150, and M-1 measures it.

### 8.3 Costs at a glance (details G.1, G.4)
| | 10k page views | 100k | 1M |
|---|---|---|---|
| **C2 MapTiler Flex + Esri ALP**, 60 tiles [20 … 150] | **$30** [30 … 68] | **$555** [105 … 1,905] | **$8,655** [2,655 … 22,155] |
| C8 Stadia streets + Esri, 60 tiles | $20 | $230 | $4,525 |

| Review imagery (one-off) | Cost |
|---|---|
| **Pilot: full box, 2 orders, 188 km²**, archive at $19–22.50/km² | **$3.6k–4.2k** |
| Pilot, new capture ($29/km², 25 km² minimum) | ≈ $5.5k |
| National Tier A per refresh (not Phase 1), with the 5 km² minimum per order | **$28k–57k (ESTIMATE)**; upper bound $65k–93k |

Sources: [SkyWatch data](https://skywatch.com/data) and its [AOI rules](https://intercom.help/skywatch-ab92e82e1a0a/en/articles/9917241); the $22.50 rate is **UNVERIFIED**. The Background Layer is dropped from Phase 1.

### 8.4 M-1 map hygiene (now, 2.5–3 pd)
1. Licensed tile URLs in production.
2. The production build fails if a tile URL is unset or keyless.
3. Leaflet tile behaviour:
   - `updateWhenZooming: false`;
   - `fitBounds` instead of `flyToBounds`;
   - unmount the map while the list view hides it.
4. A Playwright tile counter at 1920, 1366 and 375 px.
5. The MapTiler spending limit, the Esri alert and key-expiry alerts.
6. The geocoder fix.
7. Test 512 px Esri tiles. MapTiler bills a 512 px tile as 4 requests, so there is no saving there.

---

## 9. Cost

### 9.1 Build effort (person-days for one developer who knows the codebase; ESTIMATE; per-component changes in H.4)
| # | Component | Full | Lean |
|---|---|---|---|
| 1 | Pipeline | 13–17 | 9.5–11.5 |
| 2 | Schema, RLS, RPCs | 13–16.5 | 12–14.5 |
| 3 | Review screen and Airbus tiles in Israel | 10–13.5 | 6.5–8.5 |
| 4 | Public layer and access gate (including SMS hardening) | 10.5–13.5 | 8.5–10.5 |
| 5 | Claim flow and multi-document verification | 9–12 | 7–8.5 |
| 6 | Removal, correction, retention | 6–8 | 4–5 |
| 7 | Owner letters and display opt-in | 3.5–5.5 | 2.5–3.5 |
| 8 | Audit log | 2.5–3.5 | 2.5 |
| 9 | Monitoring | 3–4 | 2 |
| 10 | Map hygiene (M-1) | 2.5–3 | 2.5 |
| 11 | Legal and content pages | 2–2.5 | 2 |
| 12 | Hardening and tests | 4.5–5.5 | 3.5–4 |
| 13 | Environments (staging, CI, accounts) | 1.5–2.5 | 1.5 |
| | **Total / with 15% contingency** | **81–107 / 93–123** | **64–77 / 74–89** |

The lean cut keeps every safety and legal control. It drops grid review mode, the scorer fit, the conflicts UI, PDF mail merge and Sentry.

### 9.2 Recurring monthly costs (USD, excluding VAT; prices seen 2026-10-19)
| Item | **10k** views | **100k** | **1M** | Basis |
|---|---|---|---|---|
| Tiles, C2 (60 tiles [20 … 150]) | $30 [30 … 68] | $555 [105 … 1,905] | $8,655 [2,655 … 22,155] | §8.3 |
| Supabase Pro + staging project (Micro) | $35 | $35 | $40–85 | [pricing](https://supabase.com/pricing): Pro $25 with $10 compute credit; each extra project adds its full compute (Micro $10) |
| … optional PITR, 7 days (+ Small compute, $5 net) | +$105 | +$105 | +$100 | [backups](https://supabase.com/docs/guides/platform/backups): $100 per 7 days; needs "at least a Small compute add-on". Pro keeps 7 daily backups; **Storage files are not backed up** (D21) |
| Vercel Pro, 1 seat | $20 | $20 | $60–120 | [vercel.com/pricing](https://vercel.com/pricing) |
| Resend Pro (needs a verified domain) | $20 | $20 | $35 | [pricing](https://resend.com/pricing); [domain rule](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain) |
| Domain `solgag.co.il` + DNS ($25–90/yr) | $2–8 | $2–8 | $2–8 | **UNVERIFIED** |
| SMS, 20 / 100 / 500 verifications × 1.3 segments | $7 | $34 | $168 | $0.2575/segment ([Twilio IL](https://www.twilio.com/en-us/sms/pricing/il)); Twilio Messaging, not Verify (+$0.05 each, [Verify](https://www.twilio.com/en-us/verify/pricing)) |
| SMS sender | $0–15 | $0–15 | $0–15 | Alphanumeric ID free, but domestic registration takes about 1 week; or a $15/mo Israeli number ([guidelines](https://www.twilio.com/en-us/guidelines/il/sms)) |
| Review tiles in Israel (S3 + Lambda) | <$1 | <$1 | <$1 | S3 il-central-1 $0.025/GB-month ([AWS price list](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/il-central-1/index.json)); egress and Lambda **UNVERIFIED** |
| Monitoring, Turnstile, PVGIS, CI | $0 | $0 | $0 | free tiers |
| **Cash total** | **$115–280** (planning ≈ $120) | **$215–2,140** (≈ $670) | **$3.0k–22.7k** | low: 20 tiles, no PITR; high: 150 tiles, PITR, $15 number |
| Imagery refresh, amortised (12–24 months) | +$150–350 | +$150–350 | +$150–350 | §8.3 |
| **Of which caused by potential roofs** | ≈ $160–370 | ≈ $185–550 | ≈ $320–900 | SMS, sender, imagery, hosting, extra aerial tiles |

### 9.3 One-off costs (₪3.11/$)
| Item | USD | Status |
|---|---|---|
| Airbus pilot archive (188 km², Standard) | **$3,580–4,240** (tasking ≈ $5,460) | $19/km² verified; $22.50 and cloud-free coverage **UNVERIFIED** |
| Legal, Gate 0 (₪20k–60k) | $6.4k–19.3k (with 18% VAT $7.6k–22.8k) | **placeholder, UNVERIFIED**; 2–3 fixed-fee quotes at M0 |
| Legal, Gate 2 national opinion (₪15k–40k) | $4.8k–12.9k (with VAT $5.7k–15.2k) | **placeholder, UNVERIFIED**; about Oct–Dec 2027 |
| Postage and printing, about 120 letters + reminder + claim notices (≈ ₪1,200) | ≈ $390 | ≥ ₪3.60 per letter ([ice.co.il](https://www.ice.co.il/consumerism/news/article/997421); current rate **UNVERIFIED**) |
| Optional: ArcGIS Online seats; phone line for farmers | $0.7k–1.4k per reviewer per year; — | **UNVERIFIED** |

### 9.4 Labour (the owner sets the rates)
- **Development:** 93–123 pd (lean 74–89) × day rate. Each ₪1,000/day of rate adds ₪93k–123k.
- **Operations, about 85–140 h** × hourly rate:

| Task | Hours |
|---|---|
| Review | 17–22 (up to 26) |
| Address lookup | 10–20 |
| Intermediaries | 4–8 |
| Printing and mailing | 3–5 |
| Claim verification | 16–20 |
| Removals and disputes | 20–40 |
| Monitoring | 10–20 |
| Business checks | 3–7 |

### 9.5 First 12 months, cash (USD, excluding labour; ESTIMATE)
| Traffic | Recurring × 12 | Imagery | Legal | Postage | **Total before VAT** | If legal VAT cannot be reclaimed |
|---|---|---|---|---|---|---|
| 10k views | $1.4k–3.3k | $3.6k–5.5k | $11.2k–32.2k | $0.4k | **$16.6k–41.3k** (₪52k–128k) | $18.6k–47.1k |
| 100k views | $2.6k–25.7k (planning $8.0k) | same | same | same | **$17.8k–63.7k** | $19.8k–69.5k |

---

## 10. Plan and calendar (Appendix H)
| Milestone | pd (before contingency) | Content | Exit (abridged) |
|---|---|---|---|
| **M-1 now** | 2.5–3 | §8.4 | No keyless URL can reach production; tiles measured; limits set |
| **M0** | 1.5–2.5 | Decisions, accounts, staging, domain, Twilio registration, lawyer quotes, PPA text, Esri / Airbus (hosting and territory) / Ofek RFQs, undertakings, XPLAN email | RFQs tracked; reviewers named |
| **M1** | 29.5–38.5 | Migrations (mode off), pilot pipeline, audit | Fixtures; RLS in every mode; held-listing matrix; k-anonymity test; advisors clean |
| **M2** | 10–13.5 + 17–22 h review | Airbus in Israel, full labelling, precision study | ≥200/h; QA ≥85%; tile 401 tests |
| **Gate into M3** | — | Counsel's written Q1; Esri 1(e) or a chosen fallback | — |
| **M3** | 34–45.5 | Letters, `/roof`, claims, removal, gated layer, hexagons, interest, monitoring | E2e matrix (H.1) |
| **M4 / Gate 0** | 4.5–5.5 | Security review, load test, sign-off | F.1 done; `legal_signoff_ref` set |
| **S1 → S2 → S3** | ops | 30 days of notice (45 if it overlaps Passover, 22–29 Apr 2027) → 6–8 weeks invited beta → 6-month public pilot | Gate 1, then Gate 2 |

| Start 2026-11-02, 5 pd/week, contingency included | 1 dev, full | 2 devs, full | 1 dev, lean |
|---|---|---|---|
| Build ends | 12 Mar – 30 Apr 2027 | 12 Jan – 5 Feb 2027 | 14 Feb – 7 Mar 2027 |
| S3 starts | **late May – late July 2027** | late March – early May 2027 | late April – early June 2027 |
| Gate 2 | late Nov 2027 – late Jan 2028 | late Sep – early Nov 2027 | late Oct – early Dec 2027 |

---

## 11. Risks, KPIs and gates (Appendix I)
| Top risk | Mitigation |
|---|---|
| No lawful basis for outlines (PPA) | Model O default; Q1 answered before M3; DB kill switch |
| Tile bill (tiles per view; no Esri cap) | M-1 fixes and measurement; limits; 70% alert |
| Airbus territory or contractor clauses | Israeli hosting; reviewers in Israel; undertakings |
| Re-identification or harvesting | k≥5 over hidden roofs; quotas; canaries; invitation or business check |
| Roof hiding; SMS pumping; silent cron failure | `claim_pending` revert; delayed suppression; SMS hook; dead-man switch and invariants |
| Low opt-in under Model O | Area interest feeds follow-up letters; claims do not need visibility; judged at Gate 2 |

**Pilot GO thresholds** (ESTIMATE; about 120 letters, so directional):
- claims ≥6% of letters;
- display opt-ins ≥15%;
- building-level roofs with interest ≥40%;
- removals ≤5%;
- precision ≥90%;
- complaints ≤2 per 100 roofs, and none about trespass or from a regulator.

Gate 2 also needs the regional XPLAN samples, the national legal opinion and a funded imagery route. **Hard stops** (any PPA inquiry, >10% removals, ≥2 trespass reports, a fraudulent claim, a broken invariant) set `mode = 'off'` through the audited RPC.

---

## 12. Decisions for the owner
| # | Decision | Recommendation | By |
|---|---|---|---|
| **D3** ★ | Model O (opt-in or confirmed corporate) vs Model N (notice + 30-day opt-out) | **Model O**; Model N only with counsel's written OK against the PPA text | M0, confirmed before M3 |
| **D2/D15** ★ | Scope | **Pilot only; no national load or review** until Q2 is answered and D19 is funded | M0 |
| **D5/D20** ★ | Review imagery and hosting | **Airbus full box, 2 orders, Standard, $3.6k–4.2k; host in AWS il-central-1**; ask Airbus about EU hosting | wk 1 |
| **D13/D14/D21** ★ | Delivery, day rate, budget, backups | Full plan, 1 developer; approve §0 cash; daily backups for the pilot (PITR +$105/mo optional) | M0 |
| **D6/D7** ★ | Reviewers and operations | 3 Israel-based reviewers with undertakings; named owner for letters, claims and removals; SLA 1 business day | M0 |
| D1 | Geography | Israel within the 1949 lines only | M0 |
| D4 | Letters as an ethical notice; intermediaries get flyers only | Yes | M0 |
| D8 / D9 | Layer default; mediated interest | Off; yes (roof + area, opt-in emails) | M3 |
| D10 | Phone verification; sender | Yes; registered alphanumeric ID | M0 |
| D11 | Wrong outlines | Reject; Phase 1.5 admin correction on Airbus after counsel (+2 pd) | M2 |
| D12 | Second review | All publishable pilot roofs | M2 |
| D16 / D19 | National XPLAN queries; national imagery route ($28k–57k per refresh, Esri OK, or ArcGIS Online) | Decide at Gate 2 | Gate 2 |
| D17 | Positioning against the GovMap tool and Ofek | Review quality, claims, matchmaking | before S3 |
| D18 | Phase 2 ML | Airbus ML allowed (1.1(e)); decide at Gate 2 | Gate 2 |
| D22 | Staging | Separate Supabase project, $10/mo | M0 |
| D23 | Domain | Register `solgag.co.il`; update `site_url` (`supabase/config.toml:427`) | M0 |
| D24 | S3 building-level access | Invitation or company-number check | before S3 |
| D25 | Esri pay-as-you-go | On, with the 70% alert and a ceiling agreed in writing | M0 |
| D26 | Owner drawing if Esri says no | Claims: Microsoft outline only; organic: footprint selection (+1.5–2 pd) | M3 gate |
| D27 | Industrial-park data-sharing agreement | Only if the manager is not a council body, and counsel clears it | M3 |

★ = the five decisions in §0.

---

# Appendices

## Appendix A. Data pipeline

### A.1 Sources and licences (publish path)

| Element | Source | Licence (checked 2026-10-19) | Used for | Obligations |
|---|---|---|---|---|
| Roof geometry | **Microsoft Global ML Building Footprints**, pinned release **2026-08-13**, index `https://bfppub.blob.core.windows.net/%24web/2026-08-13/dataset-links.csv` (6,382,044 B, ETag `0x8DEF978ED1693F9`) | **CDLA-Permissive-2.0** since commit `ef94ee3` (2026-03-11) | Published polygon ("Data"); area, kWp, MWh ("Results") | §2.1: "so long as the Data Recipient makes available the text of this agreement with the shared Data" ([cdla.dev](https://cdla.dev/permissive-2-0/)). There is no link-only option, so the text goes with the `/data-sources` page, every RPC response (`license`, `license_url`), letters (short notice and URL), `/roof/<code>`, and listing pages whose polygon came from a claim. Results are unrestricted (§3.1) |
| Land use | XPLAN layer 4 "יעודי קרקע" (`ags.iplan.gov.il/arcgisiplan/rest/services/PlanningPublic/Xplan/MapServer/4`) | CC BY (data.gov.il `xplan`) | Tier, owner-class proposal, exclusions; only a derived class is stored | Attribution, "indicate changes", and a disclaimer that it is not binding planning information |
| Zone label | XPLAN layer 1 | CC BY | Whitelisted label only (A.5) | Same |
| **Service-area mask** | **Microsoft `Location=Israel` partition rows** (CDLA, already in the manifest). Cross-checked against a public-domain or CC BY outline; Natural Earth (public domain) works only as a coarse sanity check, because at 1:10m it cannot carry the line at Mount Scopus or Atarot | CDLA | Clip to Israel within the 1949 lines | Provenance and licence recorded in `manifest.json`. **geoBoundaries ISR is ODbL** ("OpenStreetMap, Wambacher", [API](https://www.geoboundaries.org/api/current/gbOpen/ISR/ADM0/)) and is **not used** |
| Kibbutz lookup | A licence-clean locality list, for example an open data.gov.il locality dataset (**dataset and licence UNVERIFIED**). **Not** Hebrew Wikipedia (CC BY-SA), OSM place nodes (ODbL) or the CBS file (licence UNVERIFIED; CBS forbids identifying combinations) | as recorded | `owner_class_proposed = kibbutz` | Until a source is confirmed, the list is empty and the reviewer sets the class |
| Yield | PVGIS v5.3, one call per 0.1° cell | EC reuse with acknowledgement (API terms **UNVERIFIED**) | MWh range (details only) | "PVGIS © European Union" |
| Optional screens | GHSL; Global-PCG-10 (Israel coverage **UNVERIFIED**; the 326 MB download needs approval) | CC BY 4.0 | Internal flags | Attribution if used |
| Existing PV | Our own reviewer labels plus owner confirmation | ours | `category`, `free_share` | — |

**Never on the publish path:**
- OSM, Overpass, Geofabrik and Overture (all ODbL);
- Google Open Buildings (no Israel coverage) and GlobalBuildingAtlas (NC/ODbL);
- Nominatim, Google and Mapbox geocoding;
- GovMap and Survey of Israel (proprietary);
- ILA, the Ministry of Agriculture plot database, and CBS per-roof data;
- the contact persons in the Ministry of Economy list.

**Licence gate:** prod mode refuses to run if *any* input that filters or labels published rows (provider, mask, lookup list, thresholds file) lacks a cleared licence entry in `scripts/potential/config/inputs.json`. **Test:** the potential layer never needs "© OpenStreetMap contributors".

### A.2 Flow
```
operator laptop (Israeli IP) + local PostGIS :54322
 01 fetch-ms   dated index → 15 Israel z9 quadkeys (+ other Location rows of the same keys) → raw/<release>/<qk>.geojsonl.gz,
               manifest.json {index ETag, per-tile sha256, licence commit, CDLA text, mask + lookup provenance}
 02 load       streaming; area ≥800 m², centroid inside the MS-Israel mask → pipeline.ms_large (+100 m density grid)
 03 features   EPSG:2039 metrics: rectangularity, elongation, vertices, parallel_neighbours_50m, densities, dedup
 04 xplan      1 point query per candidate, ≤2 req/s, cached 12 months; L1 → whitelisted zone label
 05 classify   tier A/B/C · owner_class_proposed · h3 r8/r7 · region · LICENCE GATE (all inputs)
 06 pvgis      ≤300 cells
 07 stage      COPY → prod ingest.potential_batch (all pipeline-owned columns, incl. h3_r8/h3_r7, region, zoning, owner_class_proposed)
 08 apply      ingest.apply_batch(run, quadkeys[]) — SECURITY DEFINER, owner postgres, search_path='', EXECUTE only to `pipeline`;
               per quadkey; statement_timeout 20 min (alter role pipeline set statement_timeout = '20min')
               · greedy one-to-one IoU matching in EPSG:2039 with GiST prefilter (pairs sorted by IoU; each roof and each staged row used once)
               · 1-to-many or many-to-1 with IoU ≥0.3 → admin "geometry changed" queue
               · skip: suppressed (overlap ≥30%), exclusion zones, covered ≥30% by a live listing (logged as skipped_listed), outside mask
               · unmatched existing roofs IN THE RUN'S QUADKEYS → superseded, except notice_pending/published/claim_pending/claimed → flagged
```
The `pipeline` role has only COPY into `ingest.*` and EXECUTE on `apply_batch`, with no other privilege. Its credentials live in a password manager. Runs set `application_name = 'potential-pipeline'`.

### A.3 Steps, volumes and times

| Step | Detail | Volume and time |
|---|---|---|
| 01 | Download the index whole; fetch every Location row for the 15 keys; sha256 each; an identical manifest means no-op | ≈140 MB gz, ~3 min (national; Phase 1 fetches only the pilot key) |
| 02 | `source_key = md5(ST_AsBinary(ST_SnapToGrid(geom,1e-7)))` | Pilot ≈2.3k kept |
| 04 | `outFields=mavat_code,mavat_name,pl_number,station_desc`; stores approved and in-process codes and status. **Must run from Israel** | Pilot ≈20 min |
| 06 | `peakpower=1&loss=14&mountingplace=building&angle=10&aspect=0`; E_y **UNVERIFIED** | minutes |
| 07–08 | Idempotent on `(run_id, source_key)`; an applied run is refused; a reviewed roof whose geometry changes (IoU <0.9) is flagged | seconds per quadkey |

### A.4 Tiering (unchanged from v1)

| Tier | Rule | Handling |
|---|---|---|
| **A** | Designation ∈ {200, 210, 220, 230, 240, 250, 260, 1050, 1502, 1630} or 300 מבני משק, **and** clean geometry: rectangularity ≥0.6, elongation ≤4, `parallel_neighbours_50m` ≤2, area 1,000–60,000 m² (thresholds ESTIMATE, re-fitted at M2) | Reviewed; publishable |
| **B** | 400–463 public; or 660/661 agricultural land with no greenhouse flag; or Tier A codes with weak geometry | Reviewed. Public: never published. Agricultural: aggregate only unless the owner opts in |
| **C** | Everything else (residential, 280, roads, open space, 995–999, no designation) | Not reviewed or published |

The queue is ordered by `tier_score` (MS geometry features plus XPLAN approved vs in-process), re-fitted on the M2 labels. **M2 acceptance:** Tier A+B holds ≥85% of publishable labels in ≤50% of candidates. Known gap: 40 of the 56 XPLAN pilot hits came from one unapproved plan. Repeat the 60-point coverage sample in 3–4 regions before any national wave.

### A.5 Owner class, zone label and exclusions

| `owner_class` | Proposed when | Visibility under Model O (default) | Under Model N (only with counsel's OK) |
|---|---|---|---|
| `corporate_zone` | Tier A industry, commerce or storage codes; whitelisted zone token | aggregate; **building** after an owner opt-in or a confirmed corporate holding | building after a valid notice (post or hand, not returned) + 30 days |
| `kibbutz` | Code 300 or Tier A in a listed kibbutz locality | aggregate; building after opt-in by the kibbutz | as above |
| `individual_likely` | 300 or 660 in a moshav or private farm | aggregate; building only after the owner opts in | aggregate |
| `unknown` | otherwise | aggregate; building after opt-in | aggregate |
| `public` | 400–463 | never published | never |
| `residential_condo` | residential codes or reviewer | never published | never |

**Zone label (whitelist only).**
- Built as `<jurisdiction name> · <zone token> [<vetted locality>]`.
- Zone tokens are limited to אזה״ת, אזור תעשייה and פארק, followed by a name from a reviewed dictionary.
- **Reject** any candidate string containing digits, גוש, חלקה, נחלה, מגרש, משפחת, or any word not in the dictionary.
- Plan numbers and raw plan names are stored internally only (`tier_features`), never shown.
- The label is shown only when ≥3 published roofs share it.

**Hard exclusions in `apply_batch`:**
- overlap ≥30% with `roof_suppressions`;
- `exclusion_zones`, seeded from public lists of defence-industry and security facilities using **MS footprints plus a buffer** (never tracing), and maintained by admins. Whether publishing such sites needs Military Censor review is [LAWYER] Q22;
- coverage by a live listing;
- outside the mask or the envelope.

### A.6 Area, capacity and yield (computed in the DB trigger)
```
area_sqm   = ST_Area(footprint::geography)
kwp_low    = area_sqm × 0.40 / 6.5 × free_share        kwp_high = area_sqm × 0.65 / 6.5 × free_share
shown      = round(area,-2) "±20%", floor(kwp_low/10)*10 … ceil(kwp_high/10)*10 kWp DC; MWh range in details only
```

### A.7 Cadence
| Event | Cadence | Action |
|---|---|---|
| Microsoft release check | Monthly diff of per-tile size and sha256 | Re-run changed quadkeys only; supersede is scoped to them |
| XPLAN cache | 12 months | Re-query stale rows |
| Re-review | Review >12 months or imagery >24 months | `re_review_due_at`: the roof stays published and queued; `stale` (hidden) if not re-reviewed within 60 days; no new letter if a valid notice exists |
| Review imagery | Re-buy every 12–24 months for published areas | ≈ $3.6k–4.2k per pilot refresh (amortised in §9.2) |
| Suppressions | Permanent once upheld | Read by every apply |

### A.8 Outputs and where it runs
- `public.potential_roofs`: about 2.3k rows for the pilot. `source_releases`, `ingest_runs` (counts, skipped_listed, flags, git SHA, params including the quadkey list), `pvgis_cells`. A dry-run diff is attached to the issue that approves each apply.
- Runs as a local Node script; it writes to prod via the Supavisor session pooler as `pipeline`. Edge Functions are ruled out (256 MB RAM, 2 s CPU). A GitHub Action is Phase 1.5; whether GitHub runners can reach XPLAN is **UNVERIFIED**.
- New dev dependencies: `pg` and `h3-js@4.5.0` (Apache-2.0; pipeline and server only, not shipped to the browser).

### A.9 Pipeline acceptance (M1)
- A second run gives 0 inserts and 0 updates. The manifest reproduces the same sha256.
- The pilot MS ≥1,000 m² count is 2,294 ±1%. `area_sqm` is within 0.1% of `ST_Area`.
- The licence gate refuses an enabled OSM provider, an unlicensed mask and an unlicensed lookup list.
- XPLAN returns a designation for ≥90% of pilot candidates.
- **Fixtures** (`scripts/potential/__tests__/`, GeoJSON):
  - split: 1 roof becomes 2, so the roof goes to the queue and is never updated twice;
  - merge: 2 become 1;
  - a boundary roof across quadkeys;
  - a partial re-run that leaves roofs in untouched quadkeys unchanged;
  - a published roof missing from a new release is flagged, not superseded;
  - a statement-timeout run per quadkey.

## Appendix B. Database schema and security

### B.1 Migrations (conventions as in `supabase/migrations/20261019010000_review_fixes.sql`)
| File | Content |
|---|---|
| `20261101000000_potential_roofs.sql` | enums; `private` schema (usage and execute to authenticated, **not exposed**: `config.toml [api] schemas` stays `public, graphql_public`); core tables, guards, visibility, layer state, RLS, indexes (B.9) |
| `…000100_potential_rpcs.sql` | review queue and decisions; hex, bbox, detail, version; interests; Outreach Code; mode RPC |
| `…000200_listing_potential_link.sql` | `listings.potential_roof_id`, `claim_hold`, `claim_release_at`; RLS policy changes; guard; link triggers; `listing_feed` column |
| `…000300_claims_removals_letters.sql` | claims, removals, suppressions, letters, display consents, `verification_documents`, `verification_status` + `needs_info`, retention SQL |
| `…000400_admin_audit_log.sql` | audit table, triggers on new and existing tables, hash chain |
| `…000500_ingest.sql` | `ingest` schema, `apply_batch` (definer) |

Then run `npm run db:types`.

### B.2 Enums and core table (sketch)
```sql
create type public.potential_status as enum ('candidate','in_review','qa_pending','notice_pending','published',
  'claim_pending','claimed','stale','rejected','withdrawn','opted_out','superseded');
create type public.potential_visibility as enum ('aggregate','building');
create type public.owner_class as enum ('corporate_zone','kibbutz','individual_likely','public','residential_condo','unknown');
create type public.roof_category as enum ('good_bare_roof','solar_partial','solar_full','greenhouse','outline_wrong',
  'residential','not_building','sensitive_site','unclear');

create table public.potential_roofs (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default left(replace(gen_random_uuid()::text,'-',''),12),
  footprint extensions.geography(Polygon,4326) not null, centroid extensions.geography(Point,4326) not null,
  area_sqm numeric(10,1) not null, free_share numeric(3,2) not null default 1 check (free_share between 0 and 1),
  kwp_low numeric(8,1) not null, kwp_high numeric(8,1) not null,
  pvgis_cell text references public.pvgis_cells(cell_key),
  tier char(1) not null check (tier in ('A','B','C')), tier_score real not null default 0,
  tier_features jsonb not null default '{}' check (pg_column_size(tier_features) < 4096),
  zoning_class text, zoning_status text, zone_label text check (char_length(zone_label) <= 120),
  region text not null,                                             -- set by the pipeline (pilot | north | centre | south)
  owner_class_proposed public.owner_class not null default 'unknown', owner_class public.owner_class,
  corporate_confirmed_at timestamptz, corporate_confirmed_ref text, -- park data-sharing agreement reference (admin only)
  h3_r8 text not null, h3_r7 text not null,
  status public.potential_status not null default 'candidate',
  visibility public.potential_visibility,                           -- recomputed by private.compute_visibility()
  category public.roof_category, imagery_provider text, imagery_date date,
  review_count smallint not null default 0, unclear_count smallint not null default 0,
  reviewed_by uuid references public.profiles(id) on delete set null, reviewed_at timestamptz,
  locked_by uuid references public.profiles(id) on delete set null, locked_until timestamptz,
  publish_after timestamptz, published_at timestamptz, re_review_due_at timestamptz,
  geometry_flag text check (geometry_flag in ('changed','split','merged','missing_in_release')),
  source_release text not null references public.source_releases(id), source_key text not null, source_confidence real,
  first_seen_release text not null, last_seen_release text not null, provenance jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint potential_footprint_size check (extensions.st_npoints(footprint::extensions.geometry) <= 401
                                             and extensions.st_nrings(footprint::extensions.geometry) = 1),
  unique (source_release, source_key)
);
-- No potential_roofs.listing_id: listings.potential_roof_id is the single source of truth for links (B.7).
```

### B.3 Supporting tables (beyond technical-design §4.1)
- `roof_letters(id, roof_id, kind notice|reminder|claim_notice, code_hash unique, channel post|hand, postal_address ≤200, address_purge_after, status draft|sent|returned|used|expired, sent_at, used_at, expires_at default +24 months, created_by)`. Intermediary contacts are logged separately in `intermediary_contacts(org, kind, sent_at, material)`, which holds **no roof ids**.
- `roof_display_consents(roof_id, granted_via letter_code|claim, relation, granted_at, revoked_at)`. This is the owner's "allow display" choice and can be revoked at any time.
- `roof_interests(user_id, roof_id, note ≤500, notify_opt_in bool, status open|notified|closed, created_at)` and `area_interests(user_id, h3 text, res smallint, notify_opt_in, created_at)`.
- `outreach_acceptances(user_id, code_version, accepted_at)`; `potential_usage(user_id, day, bbox_calls, detail_views, interests, removals)`; `potential_bbox_seen(user_id, day, roof_id, primary key (user_id, day, roof_id))`; `potential_detail_views(id, user_id, roof_id, at)`.
- `verification_documents(id, request_id → verification_requests, path, doc_type, sha256, uploaded_at, purged_at)`. Add the `needs_info` value to `verification_status`, raise the ownership-docs folder cap from 10 to 20 (`can_upload_listing_file(..., 20)`), and keep `document_path` for old requests.
- `profiles` additions, all guard-protected and admin-set, with no column grants to authenticated: `company_name`, `company_number`, `business_verified_at`, `potential_invited bool`, `outreach_suspended_until`.
- `potential_layer_state` (one row): `version`, `hex_cutoff` (the weekly batch boundary), `mode off|admins|invited|public`, `visibility_model opt_in|notice_optout`, `building_level_enabled`, `legal_signoff_ref`, `outreach_code_version`, `last_maintenance_at`. It is changed only through `admin_set_potential_mode(...)`, which is audited; its Server Action also purges the hex tag.

### B.4 Gate functions
```sql
create function public.can_view_building_level() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or (
        exists (select 1 from public.potential_layer_state s where s.mode in ('invited','public') and s.building_level_enabled)
    and exists (select 1 from auth.users u where u.id = auth.uid() and u.phone_confirmed_at is not null)
    and exists (select 1 from public.outreach_acceptances a join public.potential_layer_state s
                  on a.code_version = s.outreach_code_version where a.user_id = auth.uid())
    and exists (select 1 from public.profiles p cross join public.potential_layer_state s
                 where p.id = auth.uid() and coalesce(p.outreach_suspended_until, '-infinity') <= now()
                   and (p.potential_invited or (s.mode = 'public' and p.business_verified_at is not null))));
$$;
create function public.potential_layer_version() returns bigint      -- anon; one row; used by ExplorePage and the hex route
language sql stable security definer set search_path = '' as $$ select version from public.potential_layer_state $$;
```

### B.5 Status machine and visibility
```
candidate ─lock─► in_review ─publishable─► [qa_pending ─agree / adjudicated─►] notice_pending
notice_pending ─publish_after passed ∧ legal_signoff_ref ∧ mode≠off─► published      (cron; batch released at the next hex_cutoff)
in_review ─not publishable─► rejected ; lock expiry / unclear ≤2 ─► candidate
notice_pending | published ─removal─► opted_out   (letter code: suppression at once; form or signed-in: hidden at once, suppression on uphold or after 7 quiet days)
notice_pending | published ─claim-linked or overlapping listing INSERT─► claim_pending
claim_pending ─verification approved─► claimed
claim_pending ─30 days without approval │ listing deleted │ verification rejected─► published (or notice_pending)   [auto-revert]
claimed ─verified listing deleted─► withdrawn (admin decides; never auto-republished)
published ─re_review_due_at passed─► (stays published, queued) ─60 days, no decision─► stale ─re-reviewed OK─► published
candidate | in_review | qa_pending | rejected ─new release, no match─► superseded       (others: geometry_flag set for admins)
```
`potential_transition_ok(a,b)` encodes exactly these edges.

`private.compute_visibility(roof)` runs in the guard on every insert and every update of `owner_class` or `status`. It also runs from AFTER triggers on `roof_letters(status)` and `roof_display_consents`, and as a bulk recompute when `visibility_model` changes. Each run bumps the version only when the result changes.
```sql
case
  when r.status <> 'published' then null
  when r.owner_class in ('public','residential_condo') then null
  when exists (select 1 from public.roof_display_consents c where c.roof_id = r.id and c.revoked_at is null) then 'building'
  when r.owner_class = 'corporate_zone' and r.corporate_confirmed_at is not null then 'building'
  when s.visibility_model = 'notice_optout' and s.legal_signoff_ref is not null
       and r.owner_class in ('corporate_zone','kibbutz')
       and exists (select 1 from public.roof_letters l where l.roof_id = r.id and l.kind = 'notice'
                     and l.channel in ('post','hand') and l.status in ('sent','used'))   -- 'returned' never counts
    then 'building'
  else 'aggregate' end
```
Roofs with no deliverable address get `publish_after = decided_at + 30 days` and stay aggregate unless the owner opts in. Whether intermediary notices count under Model N is a [LAWYER]/[OWNER] decision; the default is that they do not.

The layer version bumps only when the published set, area, kWp, h3 or visibility changes (the transition-table condition of technical-design §4.2). Lock and queue updates never bump it.

### B.6 Public read functions
**Hexagons (anonymous).** k-anonymity is computed over aggregate-only roofs. Building-visible roofs appear only as a separate count.
```sql
-- returns {v, r8:[[h3, band, area5k, kwpLo, kwpHi]], r7:[...], b:[[h3, n_building]]}; empty arrays unless mode='public' (admins always)
with p  as (select h3_r8, h3_r7, visibility, area_sqm * free_share af from public.potential_roofs
             where status = 'published' and published_at <= s.hex_cutoff),          -- weekly batches
     a8 as (select h3_r8 c, h3_r7 parent, count(*) n, sum(af) a from p where visibility = 'aggregate' group by 1, 2),
     a7 as (select parent c, sum(n) n, sum(a) a from a8 where n < 5 group by 1 having sum(n) >= 5),
     b8 as (select h3_r8 c, count(*) n from p where visibility = 'building' group by 1)
-- band(n): 5–9 | 10–19 | 20+ ; area5k = round(a/5000)*5000 ; kWp = floor(area5k*0.40/6.5/100)*100 … ceil(area5k*0.65/6.5/100)*100
-- r8 rows only where n ≥ 5; r7 rows for the remainder where Σn ≥ 5; everything else hidden
```
Removals and claims take effect immediately, not in batches. The hex route returns polygons computed on the server with h3-js. **Property test (M1):** for every hexagon and every subset of building-level roofs in it, the published aggregate statistics are unchanged, because building-level roofs never enter them. Every shown aggregate cell has n ≥ 5.

**Bbox (gated).**
- Refuse unless `can_view_building_level()`.
- Validate that all four values are finite, `w < e`, `s < n`, `e − w ≤ 0.08`, `n − s ≤ 0.06`, and the box lies inside `(34.2, 29.4, 35.95, 33.4)`. The client clamps the request to the viewport centre on very wide screens.
- Quotas, all counted inside the function: 100 calls per day; distinct roofs logged in `potential_bbox_seen`, refused above 150 per day or 600 per 30 days.
- Results: `order by r.public_id limit 300`, plus a `truncated` flag.
- Fields returned: `pid`, outline (6 decimals), area rounded to 100, kWp range, partial flag, imagery month and review month, `license: "CDLA-Permissive-2.0"`, `license_url`.
- Each account has its own seeded canary roof, a believable fake, so a leaked list can be traced.
- Tests cover inverted, NaN, Infinity, oversized and out-of-envelope boxes.

**Others.**
- `potential_roof_detail(pid)`: requires the gate; 50 per day; logs to `potential_detail_views`; adds the zone label and the MWh range.
- `record_roof_interest(pid, note, notify_opt_in)` and `record_area_interest(h3, notify_opt_in)`: 20 per day.
- `accept_outreach_code(version)`.
- **Never returned:** tier, score, features, XPLAN codes, owner class, reviewer, notes, source ids, confidence, interest counts.

### B.7 Listing link and claim hold (changes to existing objects)
```sql
alter table public.listings
  add column potential_roof_id uuid references public.potential_roofs(id) on delete set null,
  add column claim_hold boolean not null default false,
  add column claim_release_at timestamptz;                   -- null = held; set only by review_verification / cron
create unique index listings_potential_roof_uniq on public.listings (potential_roof_id) where potential_roof_id is not null;

-- RLS replaces the v1 listing_feed filter (anon has column grants on listings, review_fixes.sql:223-230):
drop policy "listings: read published, own, or admin" on public.listings;
create policy "listings: read published, own, or admin" on public.listings for select to anon, authenticated
  using ((status = 'published' and not admin_hidden and not claim_hold) or owner_id = (select auth.uid()) or public.is_admin());
-- inquiries INSERT policy (review_fixes.sql:163-177): add  "and not l.claim_hold"
grant select (claim_hold) on public.listings to anon;       -- needed because listing_feed is security_invoker
-- listing_feed: append claim_hold as the LAST column (create or replace keeps column order; the is_mine trap at :179-180)
-- getPublishedListings (src/lib/data/queries.ts) and src/app/sitemap.ts add .eq('claim_hold', false), so an owner's own
-- held listing is not mixed into the explore feed. getListing / getMyListings keep showing it to its owner with "ממתין לאימות".
```
**`listings_guard`, untrusted branch.**
- On INSERT: `new.claim_release_at := null`, then run `private.check_claim_link(...)`. It verifies an open claim by the caller, a roof that is published or notice_pending and not linked, overlap ≥30%, and takes the advisory lock `hashtextextended('roof-link:'||roof_id, 0)`.
- **Implicit claim:** an insert *without* `potential_roof_id` whose footprint or location overlaps a published or notice_pending roof by ≥30% takes the same lock. It sets `potential_roof_id` to that roof and creates an `implicit` claim row, and admins are notified.
- `new.claim_hold := (new.potential_roof_id is not null)`.
- On UPDATE, all three columns are copied from `old`.
- Candidate and rejected roofs are not touched; they are re-checked at decision time.

**AFTER triggers.**
- On insert: the roof becomes `claim_pending`, and other open claims become `conflict`.
- `review_verification(approve)`: the roof becomes `claimed`. With a letter code, `claim_release_at = now()` and `claim_hold` is cleared. Without a code, a `claim_notice` letter is enqueued, and `claim_release_at` is set to `sent_at + 14 days` when the letter is marked sent.
- The daily cron clears `claim_hold` when `claim_release_at < now()`, and reverts `claim_pending` after 30 days. The listing stays held and unlinked until it is verified.
- Deleting a listing before approval reverts the roof. Deleting a verified listing makes it `withdrawn`.

**RLS tests** cover anon, a stranger, the owner and an admin, across the table, `listing_feed`, `listing_images`, `inquiries` and the sitemap query. They include an insert with a past `claim_release_at` or `claim_hold = false`, which must stay invisible to anon.

### B.8 Privilege matrix
| Object | anon | authenticated | admin | Writes only via |
|---|---|---|---|---|
| `potential_roofs`, `review_decisions` | – | – | SELECT | pipeline (`apply_batch`), definer RPCs |
| `roof_claims` | – | own | all | claim RPCs, triggers, admin RPCs |
| `removal_requests`, `roof_suppressions`, `exclusion_zones` | – | – | SELECT | service-role server code → definer RPCs; admin RPCs |
| `roof_letters`, `intermediary_contacts`, `roof_display_consents` | – | – | SELECT | admin RPCs; `/roof/[code]` server page (service role) |
| `roof_interests`, `area_interests`, `outreach_acceptances`, `potential_usage` | – | own | SELECT | definer RPCs |
| `potential_bbox_seen`, `potential_detail_views` | – | – | SELECT | definer RPCs |
| `potential_layer_state` | via `potential_layer_version()` only | same | SELECT | `admin_set_potential_mode`, triggers |
| `admin_audit_log` | – | – | SELECT | `private.audit_write()` from triggers; append-only |
| `private.*` helpers | – | EXECUTE (for triggers), not routable by PostgREST | – | — |

Every new definer function sets `search_path = ''`, revokes from `public, anon`, and grants explicitly. Service-role-only functions also check `auth.jwt()->>'role' = 'service_role'`.

### B.9 Indexes (in `20261101000000`)
```sql
create index on public.potential_roofs using gist (footprint);
create index on public.potential_roofs using gist (footprint) where status = 'published' and visibility = 'building';
create index on public.potential_roofs (h3_r8) where status = 'published';
create index on public.potential_roofs (status, region, tier, tier_score desc) where status in ('candidate','qa_pending');
create index on public.potential_roofs (status, publish_after);
create index on public.potential_roofs (status, reviewed_at); create index on public.potential_roofs (imagery_date);
create index on public.potential_roofs (reviewed_by); create index on public.potential_roofs (locked_by);
create index on public.listings (potential_roof_id);           -- the unique partial index also covers it
create index on public.roof_letters (roof_id, kind, status);
create index on public.roof_interests (roof_id);
create index on public.potential_detail_views (at); create index on public.potential_detail_views (user_id, at);
create index on public.exclusion_zones using gist (zone);
create index on public.admin_audit_log (at);
```
M1 acceptance: `supabase db lint` and the dashboard advisors report **0 unindexed foreign keys and 0 security warnings**.

### B.10 Audit log
- `public.admin_audit_log(at, actor_uid, actor_role, session_user, application_name, entity, entity_id, action, old, new, note)`.
- Append-only: an immutability trigger refuses UPDATE and DELETE.
- The pipeline, cron and SQL-editor connections set `application_name`.
- **Tamper evidence:** a daily row stores sha256 of the previous day's rows, and the hash goes into the digest email.
- Coverage:
  - existing admin actions with no trail today (`admin_hidden`, `tech_assessment`, `owner_verification`, `is_fictional`, admin delete, `review_verification`);
  - all new actions;
  - layer-mode changes.
- Retention: 24 months for admin events; 7 years for claim and removal metadata [LAWYER].

### B.11 Retention and maintenance (daily Vercel cron with `CRON_SECRET`; `vercel.json` has no crons today)
| Job | Where | Rule |
|---|---|---|
| Removal PII | SQL | Null contact and message 90 days after the decision. The suppression keeps geometry and a reason enum only |
| Unconfirmed removals; open claims; locks; letter addresses (30 days after the last letter); codes (24 months) | SQL | as v1 |
| Claim hold release, `claim_pending` revert, notice publication, weekly `hex_cutoff`, `stale` | SQL | refuses to publish while `legal_signoff_ref` is null |
| **Ownership documents** (approved: 90 days; rejected: 30 days) | **Node step** in the cron route: service-role Storage API `remove()` (pattern in `src/app/account/actions.ts:70-86`), then `verification_documents.purged_at` | SQL deletes from `storage.objects` would orphan files ([Supabase](https://supabase.com/docs/guides/storage/management/delete-objects)). sha256 is computed at submit time server-side. The admin UI says "נמחק לפי מדיניות שמירה". **Alert on any failure** (a missed purge is a retention breach) |
| Usage logs | SQL | 12 months |
| Heartbeat | SQL + HTTP | `last_maintenance_at` and a dead-man ping (H.3) |

### B.12 Security level
- The data is probably "medium" content under the Data Security Regulations. It qualifies for the basic level if ≤10 people have authorised access. Keep admins at ≤10; the digest alerts above that.
- Whether gated end users count as authorised users is [LAWYER] Q5.
- Update the database definitions document and run a yearly minimisation review.

## Appendix C. Review screen

### C.1 Workflow
```
/admin/potential?mode=grid|single&tier=A,B&region=pilot
  next_review_batch(mode, n, tiers, region) → FOR UPDATE SKIP LOCKED, 20-min locks, blind in QA mode
  category (+ free share) + owner class → submit_review_decisions(kind, items, layers_shown[], zoom, mode)
     publishable & sampled  → qa_pending → blind second reviewer → agree: apply · disagree: third admin (final)
     publishable & not sampled → notice_pending
     not publishable → rejected (10% QA-sampled for recall)
  undo own decision ≤10 min · admin override with mandatory note (audited) · re-review queue (re_review_due_at)
```
Files:
- `src/app/admin/potential/{page,stats/page,[id]/page,actions}.tsx`
- `src/components/admin/review/{ReviewGrid,ReviewSingle,ReviewMap,useReviewKeys,categories}.ts(x)`
- `src/lib/imagery.ts` (the provider registry)
- `AdminNav` entries: גגות פוטנציאליים, מכתבים, שיוכים, בקשות הסרה, יומן פעולות

Admin reads run under the admin's own session.

### C.2 Layers allowed in ReviewMap
| Layer | Status | Why |
|---|---|---|
| Airbus Pléiades Neo 30 cm (main map and z16 inset) | **Only imagery layer** | Purchased; internal use (Art. 1.1(a)); our labels are derivative works (Art. 1.1(c), (g)) |
| Neighbouring Microsoft outlines (vector) | Allowed | CDLA |
| Esri ALP World Imagery | Hidden until Esri confirms question 1(a) in writing; decisions then record `esri-alp` | ALP §3.1.d.3 "only … visualization" |
| ArcGIS Online (outside our app) | Fallback only with the same written confirmation; decisions tagged `esri-agol` and held back from publication | Uses Permitted allows public sharing of traced data only via open-data routes |
| MapTiler streets, OSM, keyless Esri, Google, Mapbox, Stadia, Azure | **Never** (no street toggle, no inset from `BaseLayers`) | MapTiler §4.3 "no commercial derivative works"; others similar |

The registry (`uses.adminReview`) covers *every* layer, including the main map, the inset and any toggle. The admin build **hard-fails** when the review tile URL is unset or keyless. Each decision stores `layers_shown[]` (provider, imagery date) and the zoom.

### C.3 Airbus tiles: processing, hosting and serving
1. **Order spec (RFQ line):**
   - orthorectified, pansharpened, 8-bit RGB GeoTIFF;
   - captured 2025–2026 with cloud cover under 10%;
   - 2 orders covering the pilot box (each about 7 × 13.4 km);
   - Standard licence.
   Also ask in writing for (a) authorisation to host in the EU (Cloudflare R2 EU jurisdiction, Vercel fra1), and (b) confirmation that the reseller's licence is the Airbus Standard EULA (Nov 2025).
2. **Processing** on the operator laptop in Israel: GDAL (OSGeo4W or conda on Windows), `gdal_translate` to COG, then `gdal2tiles --xyz -z 12-19` to JPEG q80.
   - Check co-registration on 50 Microsoft outlines. An off-nadir lean of more than 2 m causes false `outline_wrong` labels; correct it by shifting the overlay, never by editing pixels.
   - Size ≈ 5–8 MB per km², so 1–1.5 GB for the pilot (ESTIMATE).
3. **Hosting (default, inside Israel):**
   - A private S3 bucket in `il-central-1`.
   - A Lambda function URL in the same region verifies an HMAC token (user id, expiry ≤30 min) and streams `/{z}/{x}/{y}.jpg`.
   - A Server Action issues the token after a single `is_admin` check, so tile requests make no Supabase or Vercel calls.
   - Responses carry `Cache-Control: private, no-store`.
   - The CSP `img-src https:` already allows the host.
   - Lambda availability and pricing in il-central-1 are **UNVERIFIED**. The fallback is batch-signed S3 URLs per grid page.
4. **If Airbus authorises EU hosting:** a private R2 bucket behind a Cloudflare Worker that checks the same token (R2 egress is free).
5. **Access rules:**
   - reviewers access the tiles only from Israel;
   - non-employee reviewers first sign the Art. 1.1(f) undertaking (same limits, return the material and keep no copy at the end);
   - the UI shows "© Airbus DS <year>" (Art. 2.1 credits "conspicuously displayed");
   - the client logs `tiles_loaded`.
6. **M2 tests:**
   - an unauthenticated request returns 401;
   - an expired token returns 401;
   - a cache-busting replay without a token returns 401;
   - no CDN copy exists.

### C.4 Categories and keys (`KeyboardEvent.code`, so they work with a Hebrew layout)
| Key | Category | Hebrew label | Outcome |
|---|---|---|---|
| `1` | `good_bare_roof` | גג חשוף מתאים | publishable |
| `2` + `Q/W/E` | `solar_partial` | מערכת על חלק מהגג: 25/50/75% פנוי | publishable with `free_share` ≥0.25 |
| `3` | `solar_full` | מכוסה בפאנלים | reject |
| `4` | `greenhouse` | חממה / בית רשת | reject |
| `5` | `outline_wrong` | קו מתאר שגוי / מאוחד | reject (Phase 1.5: admin correction on Airbus) |
| `6` | `residential` | מגורים | reject |
| `7` | `not_building` | לא מבנה / אחר | reject |
| `8` | `sensitive_site` | אתר רגיש / ביטחוני | reject and propose an exclusion zone |
| `0` | `unclear` | לא ברור | requeue (at most 2 times) |

- **Owner class:** `C`, `K`, `I`, `P`, `R`, `X`; `Enter` accepts the proposal.
- **Navigation:** `Tab`/`J`/`K`, `Space` submits the page, `Shift+digit` bulk-*rejects* unset cells, `U` undo, `Z` context zoom on Airbus, `N` skip, `?` help. v1's `A` (aerial ↔ street) and `[`/`]` (switch imagery) are removed.
- Bulk actions can only reject. The server re-checks the lock owner on every decision.

### C.5 Modes
- **Grid** (first pass, Tier B): 12 cells at z18 with a yellow `#ffea00` outline, about 8 tiles per roof.
- **Single** (Tier A, QA, adjudication): z17–19, an Airbus inset at z16, and a facts sidebar. About 30 tiles per decision.

### C.6 QA
- **Sample:** `abs(hashtext(id)) % 100 < 10`, plus each reviewer's first 200 decisions, plus every publishable Tier B decision, plus 10% of rejections.
- **Blind:** the second reviewer does not see the first decision. A third admin adjudicates disagreements, and that decision is final.
- **Staffing:** fewer than 2 QA reviewers means `qa_skipped`, and publication beyond S2 is blocked.
- **Second review:** every publishable pilot roof gets one.

### C.7 Throughput and workload (ESTIMATE)

| Pilot activity | Decisions | Rate | Hours |
|---|---|---|---|
| First pass, all ~2,294 roofs (grid) | 2,294 | 200–220/h (the M2 target) | 10.4–11.5 |
| QA: 10% sample and each of 3 reviewers' first 200 (overlapping) | ≈ 600–800 | 120–180/h (single) | 3.3–6.7 |
| Second review: publishable roofs and publishable Tier B | ≈ 120–200 | 120–180/h | 0.7–1.7 |
| Recall sample: 10% of rejections | ≈ 200 | 120–180/h | 1.1–1.7 |
| Precision study: 200 roofs × 2 reviewers | 400 | 120–180/h | 2.2–3.3 |
| Adjudication | ≈ 60–120 | ~1 min each | 1–2 |
| **Total** | | | **≈ 17–22 h central** (≈ 19–27 h with no overlap between samples) |

**National Tier A (not in Phase 1; for D19 and Gate 2):**
- **Roofs:** ~5,535 (2,768–8,303).
- **Reviewer time:** single pass at 120–180/h is 31–46 h. Second review of ~2,768 accepted roofs adds 15–23 h. Total **46–69 h (8–11.5 pd)**, plus a 200-roof regional precision study of 2–3 h.
- **Expected output:** ~2,768 publishable roofs (703–6,194), about 745 MWp DC.
- **Imagery:** $28k–57k per refresh, or Esri's written OK (App. G.4).
- **XPLAN:** the scale figures come from OSM-based pilot tiers and are re-measured at M2.

Stats page:
- remaining by status, tier and region;
- decisions per reviewer per day;
- median seconds by mode;
- publish rate by tier;
- QA agreement and Cohen's κ (target ≥0.7);
- adjudication backlog;
- tiles per decision;
- ETA.

### C.8 Precision study (M2)
- 200 roofs, stratified by size class (and by region once a national wave exists), each reviewed by two reviewers.
- It narrows the 12-roof Wilson interval of 25–75% to about ±7 points.
- In the pilot it doubles as the validation set for the scorer.

## Appendix D. Public layer

### D.1 Hexagon design
- **Cells:** res 8 (~0.74 km²), with res-7 parents (~5.16 km²) for the remainder.
- **Statistics:** computed only over `visibility = 'aggregate'` roofs, and shown only where the cell has ≥5 of them.
- **Values shown:** a count band (5–9, 10–19, 20+); Σ(area × free share) rounded to 5,000 m²; a kWp range derived from the *rounded* area, rounded to 100 kWp. This keeps partial-PV roofs consistent with the per-roof ranges.
- **Building-visible roofs:** a separate integer per res-8 cell. These roofs are visible to gated users anyway, and their owners agreed or are companies.
- **Timing:** publications enter the hexagons in weekly batches (`hex_cutoff`); removals take effect at once.
- **r7 cells** have a lighter style ("אזור") and count only the roofs not shown at r8.

### D.2 Serving
| Part | Implementation | Caching |
|---|---|---|
| Version | `potential_layer_version()` (anon, one row), read in `ExplorePage`, which is already dynamic | — |
| Hexagons | `GET /api/potential/hex/[v]`. If `v` is not current: 404 with `Vercel-CDN-Cache-Control: public, s-maxage=60`. Otherwise RPC → polygons computed on the server with h3-js on Node → JSON | `Vercel-CDN-Cache-Control: public, s-maxage=3600, stale-while-revalidate=600`, `Vercel-Cache-Tag: potential-hex`, `X-Robots-Tag: noindex` |
| Purge | On publish batch, removal, claim, mode change and admin hide: in route handlers and cron, `revalidateTag('potential-hex', { expire: 0 })` (Next 16 requires a second argument: `revalidate.d.ts:13`); in Server Actions, `updateTag`; for the CDN tag, `@vercel/functions` tag deletion. Retry 3 times and alert if it still fails (Vercel returns 429 and "the cache is left unchanged" when rate-limited, [purge docs](https://vercel.com/docs/caching/cdn-cache/purge)). The exact semantics are verified by the preview smoke test | — |
| Building level | Browser `rpc('potential_roofs_in_bbox')` with the user's JWT, at zoom ≥15, debounced 300 ms, `AbortController` and a sequence number | not cached |
| Detail | `rpc('potential_roof_detail', {pid})` | not cached |
| Proxy | Add `api/potential/` to the negative lookahead in `src/proxy.ts` | — |
| CSP | Turnstile adds `https://challenges.cloudflare.com` to `script-src` and `frame-src` | — |

### D.3 Leaflet integration
- react-leaflet's `<GeoJSON data>` is immutable after mount. Use `L.geoJSON` imperatively (`clearLayers()` then `addData()`), or key the layer by the request sequence.
- Create a `potential` pane with z-index 350, below `overlayPane` (400), so real listings from `ExploreMap.tsx` stay on top and keep their clicks.
- Inject the `<pattern id="potential-hatch">` defs once in an absolutely positioned 0×0 inline SVG, not under `display:none`.
- Load the potential module lazily, only when the toggle is on. There is no h3-js in the client: it is 213 KB minified, 65.5 KB gzipped, and has side effects ([bundlephobia](https://bundlephobia.com/api/size?package=h3-js@4.5.0)).

### D.4 Shown and hidden
| Field | Anonymous | Gated |
|---|---|---|
| Hexagon band, Σ area (5,000 m²), kWp range; building-visible count | ✅ | ✅ |
| Outline (building-visible only), area ±20%, kWp range, bare or partial label, imagery and review month | ❌ | ✅ at z≥15 |
| Annual production range; whitelisted zone label (≥3 roofs share it) | ❌ | details only |
| ₪, address, block/parcel, owner, tenant or business name, phone, website, interest counts | ❌ | ❌ |

### D.5 Hebrew copy deck (final wording [LAWYER])
| Location | Text |
|---|---|
| Layer toggle | גגות עם פוטנציאל (לא פורסמו) |
| Legend | קו מקווקו אפור — גג גדול שזוהה במיפוי פתוח של מבנים ונבדק חזותית. הוא אינו מודעה ואינו מוצע להשכרה. |
| Status chip | לא מוצע · הבעלים לא פרסמו מודעה |
| Popup (owner allowed display) | הבעלים אישרו להציג את הגג במפה, אך לא פרסמו אותו כמודעה. ניתן לרשום עניין, וסולגג תעביר אותו לבעלים. |
| Popup (confirmed corporate) | הגג זוהה במיפוי פתוח של מבנים (Microsoft) ונבדק בתצלום לוויין על ידי צוות סולגג. הבעלים לא פרסמו את הגג, ולא ידוע אם הם מעוניינים בהתקשרות. |
| Metrics, dates, disclaimer, zoning disclaimer | as in v1: שטח גג משוער … (±20%) · הספק אפשרי משוער … (DC) · נבדק בתצלום מתאריך … · הנתונים הם הערכה גסה בלבד … · סיווג השימוש מבוסס על נתוני XPLAN … אינו מידע תכנוני מחייב |
| Hexagon (has building-visible roofs) | באזור זה כ־[5–9] גגות גדולים עם פוטנציאל שמיקומם אינו מוצג (כ־[10,000] מ״ר), ועוד [2] גגות שמוצגים במפה. התחברו ואמתו חשבון כדי לראות אותם. |
| Hexagon (aggregate only) | באזור זה כ־[5–9] גגות גדולים עם פוטנציאל (כ־[10,000] מ״ר, כ־[600–1,000] קילוואט). כדי להגן על פרטיות הבעלים, המיקום המדויק אינו מוצג. אפשר לרשום עניין באזור. |
| Investor CTA | אני מעוניין/ת בגג הזה · אני מעוניין/ת בגגות באזור |
| After CTA | שמרנו את העניין שלכם. איננו מוסרים לבעלים את פרטיכם בלי הסכמתכם, ואיננו מוסרים לכם את פרטי הבעלים. ☐ אני מסכים/ה לקבל מסולגג הודעת דוא״ל אחת אם הגג יפורסם כמודעה (אפשר לבטל בכל עת). |
| Gate prompt | כדי לראות גגות בודדים יש לאמת מספר טלפון, לאשר את קוד ההתנהגות, ולקבל הזמנה או לאמת עסק (מספר ח.פ.). |
| Attribution | מבנים: Microsoft Global ML Building Footprints (CDLA‑Permissive‑2.0 — נוסח הרישיון) · ייעודי קרקע: מינהל התכנון – XPLAN (CC BY), עובד ע״י סולגג · PVGIS © האיחוד האירופי · מפה: © MapTiler © OpenStreetMap contributors · תצלומים: Esri, Vantor, Earthstar Geographics (exact Esri string **UNVERIFIED**) |

**Words to avoid** (as v1): זמין, פנוי להשכרה, מוצע (except negated), למכירה, הזדמנות השקעה, תשואה, רווח, הכנסה צפויה, בעלים מעוניינים, מאומת, נבדק הנדסית. The source is never called "מיפוי ציבורי".

### D.6 Access gate (`/potential/access`)
1. **Sign in** with email OTP. Supabase Auth CAPTCHA (Turnstile) is enabled, so the existing login form passes `captchaToken`.
2. **Phone:** `auth.updateUser({ phone })` and verify. This is a phone identity, not MFA, so the $75/mo add-on does not apply. The Hebrew SMS stays at ≤70 characters (one UCS-2 segment).
3. **SMS hardening:**
   - the **Send SMS Auth Hook** ([docs](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook)) refuses any number that is not +972 and enforces per-user and per-IP-hash daily counters (refusal semantics **UNVERIFIED**);
   - Twilio Geo Permissions are limited to Israel, with a usage trigger at $50/month;
   - the project SMS limit is raised on purpose from 30/h to about 100/h;
   - e2e tests use `[auth.sms.test_otp]`.
4. **Profile:** name, company, role. In S3, the company number (ח.פ.) can be entered for business verification: an admin checks it against the Companies Registrar by hand (corporate data) and sets `business_verified_at`.
5. **Outreach Code** shown in full, with acceptance stored by version. The additions are in E.6.
6. **Unlock:** the user is unlocked if `potential_invited` is set (S2 or S3), or if `business_verified_at` is set (S3).

Suspension: one substantiated complaint gives a warning; two set `outreach_suspended_until` (audited).

### D.7 Mediated interest
- **Recording interest:** at roof level (gated) or area level (anyone signed in), 20 per day, idempotent. A notification is sent only when `notify_opt_in` is set, with the sender identity and an unsubscribe link (s.30א).
- **On release** of a claimed roof's listing: one email per opted-in investor with a link to the listing. The investor sends the inquiry through the existing `InquiryDialog` (`inquiries_before_insert` forces `sender_id`), and SolGag marks the interest `notified`.
- **On removal:** interests are closed silently.
- **Owners** see only counts, and only real logged counts with their scope stated: "בגג זה" or "באזור".
- **Tenant-interest records** (claim step 2) are **never shared**. Sharing them later would need an opt-in that names the recipients, and no fee may be charged.

### D.8 Performance targets
| Metric | Target |
|---|---|
| Hexagon payload | ≤50 KB gzipped (pilot: a few KB) |
| CDN hit ratio | >90%; p95 miss <400 ms |
| bbox | p95 <300 ms at ≤300 features; ≤150 KB |
| Rendering | 300 SVG polygons at ≥50 fps; no `/explore` LCP impact while the layer is off |
| Removal latency | building level immediate; hexagons ≤60 s (purge), ≤1 h worst case (`s-maxage`) |

### D.9 Anti-scraping and accountability
- Quotas: 100 bbox calls, 150 distinct roofs a day and 600 per 30 days, 50 detail views, 20 interests.
- Every returned roof is logged in `potential_bbox_seen`.
- A per-account canary roof is seeded.
- **Sweep alert:** more than 40 distinct res-7 cells per user per day, or more than 80% of a region's building-level roofs within 7 days.
- No per-roof routes. `/roof/<code>` is `noindex` and its code has ≥10 characters. `sitemap.ts` is unchanged.
- Outreach Code clause 6 forbids scraping and lead lists.

### D.10 Styling (unchanged)
- Real listings keep the sun pin and solid colours.
- Potential roofs have **no pin**; low zoom shows hexagons (slate `#5b6b7a`, 1 px, fill 0.12).
- Outlines are slate, 1.5–2 px, dashed `2 4`, with a diagonal hatch.
- The side list adds one line: "ועוד {n} גגות עם פוטנציאל באזור (לא פורסמו על ידי הבעלים)".
- Potential roofs never appear in listing counts, favourites, search or the sitemap.

## Appendix E. Owner flows

### E.1 Notice letters (S1; only after Gate 0, enforced by `legal_signoff_ref`)
1. **Address lookup:**
   - manual, one roof at a time, in `/admin/letters`. Never bulk reverse geocoding;
   - the address is stored in `roof_letters.postal_address` and purged 30 days after the last letter;
   - lookup sources (for example the GovMap viewer) are [LAWYER] Q7. GovMap terms are **UNVERIFIED**, and Google Maps is never used.
2. **Channels:**
   - (1) post addressed "לכבוד המחזיקים בנכס";
   - (2) hand delivery to industrial reception desks;
   - never email, SMS or WhatsApp.
   **Intermediaries get a generic flyer and hexagon counts only** ("check the map; owners can request a personal code"). They never get per-building lists, addresses or codes. The exceptions:
   - a **kibbutz secretariat** may get information about the kibbutz's own buildings, through its authorised signatory, after counsel clears it (Q24);
   - an **industrial-park manager** may confirm company holdings for `corporate_zone` roofs only, under a written data-sharing agreement (purpose, deletion, no onward use), cleared by counsel, and only if it is not a council-controlled body. Who manages the Emek Hefer park is **UNVERIFIED**.
   **Never** share building data with a body that has tax or enforcement powers, such as the regional council (arnona and building enforcement). Under Model N, intermediary notices do not count toward visibility unless counsel and the owner decide otherwise.
3. **Letter content (Model O default; template in product-legal §5.6, with these changes):**
   > **למה קיבלתם את המכתב?** לפי מיפוי פתוח של מבנים (Microsoft) ובדיקה חזותית בתצלום לוויין, הגג במבנה זה גדול (כ־[1,900] מ״ר) ועשוי להתאים למערכת סולארית של כ־[120–190] קילוואט. זו הערכה גסה בלבד.
   > **מה אפשר לעשות?** בכתובת [דומיין]/roof/[קוד]: לפרסם את הגג כמודעה בחינם · לאפשר הצגה של הגג במפה · לתקן נתונים · להסיר את הגג.
   > **אם לא תעשו דבר:** הגג ייספר רק בסטטיסטיקה אזורית (מספר גגות ושטח כולל באזור), בלי קו מתאר, בלי כתובת ובלי שם הבעלים.
   > **אם תאפשרו הצגה:** קו המתאר של המבנה יוצג על המפה למשתמשים רשומים ומאומתים, בלי כתובת ובלי שם הבעלים. אפשר לבטל בכל עת.
   > **מקור הנתונים:** נתוני מבנים © Microsoft, ברישיון CDLA‑Permissive‑2.0 ([כתובת הרישיון]).
   > **הסרה ופרטיות:** [דומיין]/roof/[קוד] · [טלפון] · [privacy@…] · [שם החברה, ח.פ., כתובת].

   - **Model N wording** (only with counsel's OK): "אם לא תעשו דבר: בעוד 30 יום, קו המתאר של המבנה יוצג על המפה למשתמשים רשומים ומאומתים, בלי כתובת ובלי שם הבעלים."
   - **No interest count N in S1 letters.** Later letters may state only a real, logged count with its scope.
   - The domain is a placeholder until D23.
   - The letter carries an SVG outline from Microsoft footprints. An Airbus EXTRACT (≤2048×2048 px, non-georeferenced, credited; Art. 1.1(h)) only if counsel agrees (Q19).
4. **Timing:** `publish_after = sent_at + 30 days`, or 45 days if the window overlaps Passover (22–29 Apr 2027). One reminder after ≥60 days, then nothing for 12 months. With no deliverable address, `publish_after = decided_at + 30 days`, and the roof stays aggregate.
5. **Cost:** ≥₪3.60 postage plus about ₪1 printing per letter, so ≈₪560–600 per 120-letter wave and ≈₪1,150 with the reminder. Address lookup takes 5–10 minutes per roof.

### E.2 `/roof/<code>`
- **Server page:** service-role `roof_by_letter_code`, IP-hash rate limit, `noindex`, and failed lookups counted toward a lockout.
- **Shows:** the SVG outline, the figures and the CDLA notice.
- **Four actions:**
  - **לפרסם:** claim, which needs sign-in.
  - **לאפשר הצגה:** the user states a relation (owner, authorised representative or manager) and ticks a box confirming authority. Email confirmation is required. This writes `roof_display_consents`, which can be revoked from the same page. Whether a tenant's consent suffices is [LAWYER] Q23; the default is owner or authorised representative only.
  - **לתקן:** correction ("זו חממה", "כבר יש מערכת", "קו המתאר שגוי"). The roof is hidden until it is re-reviewed.
  - **להסיר:** no login needed. The roof is hidden at once and the suppression is written.

### E.3 Claim, step by step
```
Entry A: /roof/<code> → "לפרסם"      Entry B: gated popup "זה הגג שלי — לפרסם, לתקן או להסיר" → /potential/[pid]/claim
 1. Login (existing OTP; /potential/*/claim added to PROTECTED_PREFIXES in src/lib/supabase/proxy.ts)
 2. Relation: owner / long lessee / manager / authorised representative / tenant
      tenant → tenant-interest record (never shared), unless landlord consent is uploaded
 3. start_roof_claim(pid | code, relation): 5/day, 20 active, idempotent, 14-day expiry for 'open' claims;
      failed code lookups counted per user + IP hash (lockout ≈20/day); code → used_code = true
 4. /publish?claim=<id> → get_claim_prefill: the MICROSOFT outline (≤200 vertices), area, usable 65%.
      Banner: "מילאנו את גבולות הגג ממיפוי פתוח של מבנים. אם קו המתאר שגוי, סמנו זאת ונבדוק אותו."
      Until Esri answers 1(e): no redrawing over aerial imagery in the claim flow (D26); owner confirms PV status and locality/title.
 5. INSERT listing (potential_roof_id) → guard: claim_release_at := null, claim_hold := true, check_claim_link (lock, overlap ≥30%)
      AFTER: roof → claim_pending; other open claims → conflict (admins emailed)
 6. Documents via the extended VerificationBox → verification_documents (2–4 typed files, sha256), folder cap 20
 7. Admin verification (/admin; review_verification + checklist; statuses approved | rejected | needs_info)
      approve + used_code → roof claimed; claim_release_at = now(); listing visible
      approve, no code    → roof claimed; claim_notice letter; claim_release_at = sent_at + 14 days (null = held)
      reject              → listing stays held and is unlinked; roof → published
      no approval in 30 d → same auto-revert (cron)
 8. Release → one email to opted-in interested investors → they send inquiries themselves
```
- The owner sees the held listing in the dashboard and on its page with "ממתין לאימות", so the claim cannot deadlock.
- The publish wizard stores `drawn_on_provider` on every polygon edit.
- For the existing organic wizard, see D26 (owner-drawing fallback).

### E.4 Verification documents (product-legal §7.1, unchanged)
| Situation | Proves the right | Ties the claimant to it |
|---|---|---|
| Company owner or long lessee | Tabu extract ≤30 days old | Companies Registrar extract, signatory confirmation, email on the company domain |
| Individual owner | Tabu extract ≤30 days old | Name match, the last 4 digits of the ID, and proof of presence (letter code, arnona or electricity bill) |
| ILA or housing-company rights | ILA confirmation of rights | as above |
| Moshav נחלה | Moshav and/or ILA confirmation | Name match plus presence or a secretariat letter. ILA or moshav consent for PV is **UNVERIFIED** [LAWYER] |
| Kibbutz | Kibbutz authorisation | Letter from the authorised signatories |
| Tenant | Lease | Landlord's written consent |
| Condominium | Registration order or bylaws | Land Law s.59ט (two-thirds), or s.59י (proportional share, 45 days' notice); show the reduced area |
| Agent | Owner authorisation plus documents | Agent identity; broker licence if a fee is involved |

**Admin checklist:**
- document ≤30 days old;
- names match;
- block/parcel matches the location (checked manually on GovMap);
- signatory authority confirmed;
- condominium documents where needed;
- redaction.

Files are deleted 90 days after approval (the Node purge in B.11).

### E.5 Conflicts
- Several open claims on one roof are allowed. The first linked listing gets the link (advisory lock plus unique index); others become `conflict`.
- **Verified ownership wins.** On a substantiated dispute the admin hides the squatter listing (`admin_hidden`), runs `admin_unlink_listing`, which sets the roof back to `published`, and reopens the disputer's claim.
- An unresolved dispute after 30 days keeps the listing hidden. SolGag does not decide title.
- Every step is audited.

### E.6 Abuse prevention
| Abuse | Control |
|---|---|
| Impostor collecting deposits | Identity binding; hold; claim-notice letter plus 14 days; "סולגג לעולם אינה גובה כסף בשם בעלי גגות — אל תעבירו מקדמות" banner; report button |
| **Roof hiding through an organic listing** | Overlap with a published or notice_pending roof is an implicit claim: the listing is held and admins are notified |
| **Roof hiding through an unverified claim** | `claim_pending`, auto-revert at 30 days, revert on delete; `withdrawn` only after verification |
| Lead hoarding | 5 claims a day, 20 active; >3 in 30 days → manual scrutiny |
| Tenant without rights; co-owner or heir acting alone | Landlord consent; all Tabu owners or a power of attorney |
| Bot claims | Login, CAPTCHA, the existing listing-insert limits (5/h, 20/day, 100/account) |
| Users' spam that names SolGag (s.30א, up to ₪1,000 per message, broad reading of "מפרסם"; statute text **UNVERIFIED**) | **New Outreach Code clauses:** (a) no mention of or link to SolGag in any unsolicited electronic message; (b) the one-time business message may only ask for consent to receive advertising, with no offer; (c) SolGag provides no outreach templates; (d) a substantiated complaint leads to suspension. Clause 5 now reads "המידע מבוסס על מיפוי פתוח של מבנים (Microsoft) ובדיקה חזותית של סולגג, ולא נמסר על ידי הבעלים" |

### E.7 Removal, opt-out and correction
| Channel | Effect |
|---|---|
| Letter code "להסיר" | Hidden at once; `opted_out`; suppression written at once (permanent); hexagon purge |
| Public form `/potential/remove` (Turnstile, `ip_hash = HMAC(OPTOUT_HMAC_SECRET, ip)`, email or phone confirmation) | Hidden on confirmation. Suppression written when an admin upholds it, or after 7 quiet days with no abuse flag |
| Signed-in user | Hidden at once. >2 per day requires phone verification. Suppression as for the form |
| Phone line or privacy email | Admin enters it within 1 business day |
| Correction | Hidden until re-review |
| Roof already claim_pending or claimed | Becomes a dispute; no automatic action |

- **Limits:** 5 per IP hash and 5 per email per day; per-account and per-/24 limits; an alert above 5 per day per company domain or IP hash, and above 30 per day globally.
- **Abuse handling:** `restored_abuse` needs an audited note. A verified claim overrides a suppression.
- **Confirmation copy:** "הגג הוסתר מהמפה. כדי שלא יופיע שוב בעדכון הבא, נשמור את קו המתאר של המבנה ואת סוג הבקשה, בלי שם ובלי פרטי קשר. פרטי הקשר שמסרתם יימחקו בתוך 90 יום. לעיון או למחיקה: [privacy@…]."
- **Retention:** suppressions keep geometry plus a minimal enum (no free text); contact details for 90 days. **Location data is an identifier under s.3**, so for individual owners the suppression is personal data. Access requests under s.13 are handled in `/admin/removals`.

## Appendix F. Legal and privacy

### F.1 Gate 0 checklist (before any letter is sent)
| # | Item | Owner | Where |
|---|---|---|---|
| L1 | Lawyer engaged (privacy and real estate) on a **fixed-fee quote, 2–3 quotes compared at M0**; placeholder ₪20k–60k **UNVERIFIED** | 👤 owner | — |
| L2 | `/privacy` section: sources, purpose, Model O tiers, removal, retention (including that suppression geometry is kept), controller, s.13 access route. Providers listed: MapTiler, Esri, AWS (Israel), Cloudflare (Turnstile), Twilio, Sentry | dev + lawyer | `src/app/privacy/page.tsx` |
| L3 | `/terms`: Outreach Code with the new s.30א clauses (E.6); imagery flow-down (Esri ALP §3.1.c.5) | dev + lawyer | `src/app/terms/page.tsx` |
| L4 | Methodology and notice page, linked from every popup and letter | dev | `src/app/potential/about/page.tsx` |
| L5 | `/data-sources`: full CDLA-P-2.0 text; a licence link next to **every** surface that draws Microsoft polygons (map, `/roof`, listing pages created from a claim); `license` fields in RPC JSON; XPLAN notice; PVGIS | dev | `src/app/data-sources/page.tsx` |
| L6 | Operator details in `src/components/site/legalInfo.tsx` | 👤 owner | — |
| L7 | Database definitions document; privacy lead named; admins ≤10 | 👤 owner | internal |
| L8 | Retention schedule adopted (B.11), including the Node storage purge and its alert | owner + lawyer | cron |
| L9 | Removal flow tested end to end (hexagon purge; suppression honoured on re-ingest; delayed suppression path) | dev | e2e |
| L10 | **Done at M-1:** licensed tiles, production guard, geocoder fix | dev | §8.4 |
| L11 | Letter template approved (E.1 wording; no aerial unless Q19) | lawyer | E.1 |
| L12 | "Never pay deposits" banner | dev | listing page |
| L13 | PPA opinion primary text downloaded from gov.il and filed (the WebFetch got a 403); **counsel's written answer to Q1 before M3** | owner + lawyer | `docs/legal/` (not public) |
| L14 | Esri's written answers to 1(a) and 1(e), or fallbacks chosen; Airbus's answer on hosting recorded in the provider registry | owner | `src/lib/imagery.ts` notes |
| L15 | Contractor undertakings signed (Airbus Art. 1.1(f)) by non-employee reviewers | owner | — |
| L16 | `legal_signoff_ref` set through the audited RPC. The cron publishes nothing without it | owner | DB |

### F.2 Questions for counsel
**Privacy and lawful basis**
1. Against the **primary** PPA consent opinion (25 Feb 2026): is Model N (letter + 30 days → outlines for corporate or kibbutz roofs, shown to gated third parties for outreach) lawful? Secondary summaries say "שתיקה או היעדר מחאה אינם מספיקים", and that direct marketing for third parties needs opt-in. Letters to "המחזיקים" may reach tenants, not landlords. If Model N is not lawful, confirm that Model O (owner opt-in, or confirmed corporate holding) is.
2. May `individual_likely` candidates be stored in the pilot while only aggregates are shown, or only H3 ids and counts? (This gates any national load or review, D15.)
3. Data-broker status (s.8א(א)(1), more than 10,000 people), registration, DPO. This is the Gate 2 opinion.
4. Is the unnamed letter "direct mail" (ss.3, 17ו)? Which disclosures are mandatory?
5. Security level: are gated users "בעלי הרשאה"? Is the ≤10-admin basic-level route valid, including for `ownership-docs`?
6. Retention: 90 days for documents, 7 years for audit metadata, permanent suppression geometry.
7. Manual address lookup (GovMap viewer) and 30-day storage.
8. Is k≥5 over aggregate-only roofs, with bands and 5,000 m² rounding, enough to treat hexagon statistics as non-personal?
9. "Allow display": who may give it (owner, authorised representative; a tenant?), and is a letter code plus email confirmation enough?
10. Intermediaries: per-building data to a kibbutz secretariat (as owner) or to an industrial-park manager under a data-sharing agreement; confirm that nothing goes to the regional council or any other tax or enforcement body.

**Outreach and marketing**
11. The Outreach Code in `/terms`; SolGag's exposure as "מפרסם" under s.30א for users' messages; the new clauses.
12. Scope of the one-time business consent message; the do-not-call registry for calls to individual farmers.
13. Opt-in wording for release emails to investors; confirm that tenant-interest records are never shared.

**Brokerage and securities**
14. Free mediated interest is not "תיווך"; pre-clear any future fee. Physical-only metrics are not investment advice.

**Claims**
15. Document standards for נחלה, ILA and condominium (s.59ט/59י) cases; whether public bodies lease only by tender.

**Data and imagery licences**
16. CDLA-P-2.0 notice placement: UI, API JSON, letters, listing pages created from claims.
17. XPLAN CC BY notice; the data.gov.il privacy clause; the CBS identification clause.
18. Esri ALP §3.1.a.4: does an ODbL street basemap in the same layer switcher count as "combining"?
19. Airbus Standard EULA (Nov 2025):
    - are labels and admin-corrected outlines "DERIVATIVE WORKS" (no imagery data, irreversible) that may be distributed freely (1.1(c), (g))?
    - is EU cloud hosting or proxying a "transfer outside of the territory of its establishment" (1.2(a))?
    - contractor undertakings (1.1(f));
    - an EXTRACT in letters (1.1(h));
    - ML (1.1(e)).
20. **Owner-drawn polygons:** may owners draw or adjust polygons of their own property over Esri ALP World Imagery or MapTiler streets in our app, with SolGag storing and publishing them commercially? This covers the existing organic wizard too.
21. **Defence-industry and security sites:** does publishing outlines or capacity of such sites need Military Censor review, or breach other security rules? Is seeding exclusion zones from public lists acceptable?
22. **Geocoding:** current Google use under "results displayed on a map must be shown on a Google Map"; public Nominatim volume and attribution.

### F.3 Ongoing obligations
- Yearly minimisation review.
- Medium-level controls, including an audit every 24 months, if admins exceed 10.
- Outreach Code re-acceptance on every version change.
- Monitor PPA guidance; hard stop on any PPA inquiry.
- Re-assess registration and DPO before national publication.
- Review the daily invariant report and the audit hash chain.

## Appendix G. Imagery and maps: details

### G.1 Basemap cost tables
**C2 (recommended) and C8 (scale option), by tiles per map page view. USD per month, half the tiles street and half aerial.**

| Tiles per page view | C2, 10k | C2, 100k | C2, 1M | C8, 10k | C8, 100k | C8, 1M |
|---|---|---|---|---|---|---|
| 20 (one fill: phone, listing page) | $30 | $105 | $2,655 | $20 | $20 | $1,330 |
| **60 (planning case after M-1)** | **$30** | **$555** | **$8,655** | $20 | $230 | $4,525 |
| 150 (today's `flyToBounds` code, desktop) | $68 | $1,905 | $22,155 | $20 | $905 | ≈$11,950 |

- C2 = `$30 + max(0,S−500k)×$0.15/1k + max(0,A−2M)×$0.15/1k`.
- C8 = Stadia streets (Starter $20 for 1M credits, Standard $80 for 7.5M, Pro $250 for 25M; overage 3¢/2¢/1.5¢ per 1k) plus Esri aerial.
- **Aerial dominates at scale**, so the levers are: keep explore on streets; Esri 512 px static tiles *if* they bill as 1 (question 1(b), **UNVERIFIED**); self-hosted vector streets (Phase 2); negotiated terms.

**All combinations at 20 tiles per page view (v1 table, still valid as the lower bound):**

| Combination | 10k | 100k | 1M | Notes |
|---|---|---|---|---|
| ★ C2 MapTiler Flex + Esri ALP | $30 | $105 | $2,655 | recommended |
| C3 Esri ALP, both | $0 | $0 | $2,700 | streets need 512 px static tiles (code change); Hebrew labels **UNVERIFIED** |
| C8 Stadia streets + Esri | $20 | $20 | $1,330 | at scale, if Stadia streets are acceptable |
| C7 Stadia, both | $80 | $80 | $325 | **if** Alidade Satellite is good over Israel (unknown; 2 credits per tile assumed, **UNVERIFIED**) |
| C1 MapTiler, both | $30 | $255 | $2,955 | MapTiler satellite is about 1 m in the Middle East |
| C5 Mapbox | $0 | $313 | $3,113 | plus a possible commercial licence |
| C6 Azure Maps | $33 | $573 | $5,973 | — |
| C4 Google | $60 | $1,020 | $6,060 | Google for both layers |

Sources (seen 2026-10-19): [MapTiler](https://www.maptiler.com/cloud/pricing/), [ArcGIS Location Platform](https://location.arcgis.com/pricing/), [Stadia](https://stadiamaps.com/pricing/), [Mapbox](https://www.mapbox.com/pricing), [Azure](https://prices.azure.com/api/retail/prices?$filter=serviceName%20eq%20%27Azure%20Maps%27%20and%20armRegionName%20eq%20%27Global%27), [Google](https://developers.google.com/maps/billing-and-pricing/pricing).

### G.2 Assumptions
- **Tile counts:**
  - A viewport fill at 1920×1080 on `/explore` is about 34–40 tiles; about 18 at 1366 px; about 10 on a phone.
  - MapTiler's own figure is "10-16 requests for raster tiles with 256px size" per view, and a 512×512 raster counts as 4 requests (pricing page).
  - Requests aborted after reaching the provider are probably billed (**UNVERIFIED**).
- **Aerial share:** 50%. Explore defaults to streets; listing pages and the wizard default to aerial. Gated potential-roof sessions are deeper (ESTIMATE +20–50% tiles per such session).
- **Esri:** whether the 2M free tiles reset monthly is **UNVERIFIED**; the estimator says "monthly". Behaviour above the free tier is **UNVERIFIED** (question 1(f)).
- The potential layer itself uses our own data, so it adds no tile-API cost.

### G.3 Optimisations and guardrails
- M-1 items 1–7 (§8.4).
- Never proxy or cache tile-API tiles server-side (Esri §3.1.d.6, Stadia §8(5)).
- `detectRetina` stays off.
- Public `NEXT_PUBLIC_` keys can be replayed from non-browser clients (referrer checks are spoofable). Monitor daily and rotate keys on anomalies.
- At ≥200k page views per month, re-plan: Stadia streets, self-hosted vector tiles (MapLibre or protomaps-leaflet, Phase 2, 8–12 pd), or a negotiated MapTiler Custom or Esri commitment.

### G.4 Review imagery purchase
**Ordering rules** ([SkyWatch AOI help](https://intercom.help/skywatch-ab92e82e1a0a/en/articles/9917241), seen 2026-10-19):
- Pléiades Neo archive: minimum AOI 1 km², **minimum billable 5 km² per AOI**, maximum AOI 250 km².
- Airbus maximum AOI width 13 km (the help page does not say whether this covers Pléiades Neo).
- "Only 1 file can be uploaded at a time containing a single polygon."
- Tasking: 25 km² minimum billable.

**Prices:**
- VHR 30–49 cm: archive $19/km², tasking $29/km² ([SkyWatch data](https://skywatch.com/data), seen 2026-10-19).
- Land Info Pléiades Neo: $22.50/km² archive (**UNVERIFIED**).

**Pilot options:**

| Option | km² billed | Cost | Note |
|---|---|---|---|
| **★ Full pilot box, 2 AOIs (each ≈7.05 × 13.4 km, 94 km²)** | 188 | **$3,580–4,240** | The box is 14.1 km wide, more than one 13 km AOI. Simple and covers every candidate |
| Cells holding all ~2,294 MS ≥1,000 m² roofs (1 km cells) | ≈170–171 | $3,230–3,850 | A complex polygon; saves only about $350 |
| Tasking, full box | 188 | ≈ $5,460 | if no cloud-free 2025–2026 archive exists (**UNVERIFIED**) |
| ~~Tier A+B cells (≈87 km²)~~ | — | — | **Dropped:** XPLAN tiers do not exist until M1, and the per-AOI minimums make it ≈122 km² anyway |
| ~~Background Layer uplift~~ | — | — | Dropped from Phase 1; quote only if public Airbus display is approved |

**Re-check of the critic's area figures.** Planner's script in the session scratchpad: 1 km cells on a local metric grid, 8-connected components, minimum 5 km² per component.

| Set | Critic (cells / AOIs / billed) | Planner re-check | Cost at $19–22.50 |
|---|---|---|---|
| Pilot MS ≥1,000 m² | 159 / 4 / 171 km² | 170 cells / 1 component (must be split at 13 km) / ≈170 km² | $3.2k–3.8k |
| Pilot Tier A (OSM tiers) | 31 cells / billed 81 km² (×2.6) | 34 cells / 10 AOIs / billed 54 km² (×1.6) | — |
| Pilot Tier A+B | ≈122 km² billed | 82 cells / 7 AOIs / 93 km² billed | $1.8k–2.1k (not selectable before M1) |
| **National, all ≥1,000 m²** | 4,937 km² / 427 / 6,049 km² | 4,885 / 285 / 5,550 km² | $105k–136k |
| National, random 10.4% (dispersion upper bound for Tier A) | 2,397 / 564 / 4,112 km² | 2,402–2,458 / 361–394 / 3,411–3,499 km² | **$65k–93k** |
| **National Tier A, scaled from pilot clustering** | ≈975 km² of cells → 1,460–2,540 km² billed | 34/170 = 20% of cells × 4,885 ≈ 980 km² × 1.6–2.6 | **$28k–57k per refresh (ESTIMATE)** |

- The differences come from 4- versus 8-connectivity and grid alignment.
- Because one order is one polygon, diagonal-only joins need a bridge, so the truth lies between the two columns.
- **Ask resellers to quote merged AOIs:** paying for the gaps between clustered cells is often cheaper than many 5 km² minimums.

**Refresh:** every 12–24 months for published areas: pilot $3.6k–4.2k (≈ $150–350/mo amortised); national Tier A $28k–57k (≈ $1.2k–4.8k/mo).

**Ofek and other Israeli aerial vendors (10–25 cm):** RFQ, no public prices.

### G.5 Airbus Standard EULA (November 2025), read 2026-10-19
Source: [PDF](https://storage.googleapis.com/p-ssp-iep-prod-8ff-strapi-uploads/Standard_End_User_Licence_Agreement_November_2025_e87587e010/Standard_End_User_Licence_Agreement_November_2025_e87587e010.pdf), linked from [Airbus licences](https://space-solutions.airbus.com/legal/licences). It replaces v1's "404" note.

| Article | Effect for SolGag |
|---|---|
| 1.1(a) | Use, store and process "in any internal device including any third party secured cloud infrastructure" |
| 1.1(b), (c) | Value-added products (VAP) for internal purposes; derivative works (DW) allowed |
| 1.1(e) | "the right to access or use the PRODUCT for the purpose of developing or training machine learning algorithms" → Phase 2 ML needs no extra clause |
| 1.1(f) | CONTRACTORS (individuals contracted to provide services) may get access only after agreeing **in writing, in advance**, to the same limits and to return the material and keep no copy |
| 1.1(g) | The end user "owns and may freely distribute DERIVATIVE WORKS to third parties" |
| 1.1(h), (i) | An EXTRACT may be embedded in a DW such as a paper report or PDF for illustration. An EXTRACT is ≤2048×2048 px, non-extractable, at most the captured resolution, in a report format. Public-website display is for promotion |
| 1.2(a) | No transfer to third parties "nor transfer outside of the territory of its establishment, unless expressly authorised by AIRBUS DS" → **host in Israel, or get authorisation** |
| 1.2(c) | Do not remove credits. Art. 2.1: credits "conspicuously displayed" |
| Definition DW | "does not contain any imagery data from the PRODUCT and is irreversible and uncoupled from the PRODUCT" → labels and outlines qualify (Q19) |
| 4.2 | Termination for breach; delete everything and certify within 10 days |

### G.6 Esri and other confirmations to request (extends imagery-costs §9)
**Esri "Uses Permitted" (document dated 2024-01-22, read 2026-10-19).**
- It allows ArcGIS Pro, ArcMap, ArcGIS Online Map Viewer and Community Maps Editor to "digitize building footprints" for visual context.
- Users "can publicly share that vector data through a GIS data clearinghouse of their own or through another open data site", ArcGIS Open Data or OSM.
- "any and all other uses … remain subject to" the Master Agreement or Terms of Use.
- So a commercial, gated, non-open layer is **not** among the granted routes.

| To | Questions |
|---|---|
| **Esri** (ALP or the Israeli distributor) | (a) May a human reviewer classify our polygons on World Imagery in our ALP app, and may we use the class to choose what we publish commercially? (b) 512 px static imagery tiles: billed as 1? (c) ArcGIS Online Creator or Professional price in Israel, and does labelling there under the Uses Permitted cover a commercial, non-open layer? (d) Is §3.1.a.4 triggered by an ODbL street basemap in the same switcher? **(e) May Application Users draw or adjust polygons of their own property over World Imagery in our ALP app, with the result stored and displayed commercially?** **(f) What happens at 2M free tiles with pay-as-you-go off or on? Are there spending caps or alerts?** |
| **MapTiler** | (a) 512 px satellite tiles: answered, 4 requests each. (b) Is an owner drawing their own roof over MapTiler streets a "commercial derivative work" (§4.3)? (c) Quote Custom at 10–20M requests |
| **Airbus or reseller** | (a) Archive availability and cloud cover over the pilot box, 2025–2026. (b) Price per km² and minimum per polygon; a merged-AOI quote. (c) Product level (C.3). **(d) Written authorisation to host in the EU (R2 EU jurisdiction, Vercel fra1), or confirmation that Israeli hosting is required.** **(e) Confirm the reseller sells under the Airbus Standard EULA (Nov 2025).** (f) Background Layer uplift (later, only if needed) |
| **Ofek** (+1 other) | as imagery-costs §9.3, including ML and display rights and their energy-potential layer |

### G.7 Hosting options for Airbus review tiles
| Option | Territory | Cost | Use |
|---|---|---|---|
| **★ AWS S3 `il-central-1` + Lambda function URL (HMAC)** | Israel | S3 $0.025/GB-month; GET $0.0044 per 10k ([AWS price list](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/il-central-1/index.json), published 2026-10-15); egress about $0.11/GB and Lambda free tier **UNVERIFIED** → < $1/mo | Default |
| Cloudflare R2 + Worker | Location hints are only wnam, enam, weur, eeur, apac and oc; jurisdictions are eu, us and fedramp. **No Israel** ([R2 data location](https://developers.cloudflare.com/r2/reference/data-location/)) | free tier | Only with Airbus's written authorisation |
| Vercel route proxy (v1) | Frankfurt (fra1) | invocations | **Dropped**: transfer outside Israel, plus ~200–300 Supabase calls per grid page |
| Supabase Storage | eu-central-1 | Pro includes it | Same territory issue |

### G.8 Attribution and terms
- Street: "© MapTiler © OpenStreetMap contributors", on the basemap only.
- Aerial: "Esri, Vantor, Earthstar Geographics" (exact string **UNVERIFIED**).
- Review UI: "© Airbus DS <year>".
- Potential data: the CDLA-P-2.0 link (L5).
- `/terms` gets the ALP flow-down clause.

## Appendix H. Milestones, tests and monitoring

### H.1 Exit criteria
| Milestone | Exit criteria |
|---|---|
| M-1 | No `tile.openstreetmap.org` or `server.arcgisonline.com` URL reaches production; the build fails if one would. Playwright tile counter run at 1920, 1366 and 375 px, with results recorded in this plan (target: median ≤60 tiles per scripted explore session). MapTiler spending limit and Esri usage alert set. Google geocoding not shown on a non-Google map |
| M0 | Every §12 decision marked ★ is made. Accounts: Supabase Pro plus a staging project, Vercel Pro, Resend Pro with a verified domain, Twilio (alphanumeric registration filed, Geo Permissions +972, usage trigger). Lawyer engaged from 2–3 quotes; PPA text filed. Esri (a)–(f), MapTiler, Airbus (a)–(e) and Ofek RFQs sent and tracked. Reviewers named; contractor undertakings signed. XPLAN email sent. Pay-as-you-go decision recorded |
| M1 | A.9 pipeline tests. `test:rls` green in **every mode** (off, admins, invited, public): anon reads 0 rows from new tables; direct `/rest/v1/rpc/...` calls respect the mode; hexagons never include non-published, public or residential rows or any cell with n<5; the property test passes; bbox refuses without the gate and rejects inverted, NaN and oversized boxes. Held-listing matrix (B.7). State-machine test over every edge, including cron edges. Audit UPDATE and DELETE refused. Advisors: 0 unindexed FKs, 0 security warnings. CI runs `test:rls` against the staging project |
| M2 | Airbus tiles served from Israel. Unauthenticated, expired-token and replay requests return 401; `no-store`. Whole pilot set labelled; grid median ≥200/h over ≥500 decisions; QA agreement ≥85% (κ ≥0.7); Tier A+B ≥85% of publishable labels in ≤50% of candidates; each decision has `layers_shown`, zoom and an audit row. Counts reported: publishable roofs by owner class |
| Gate into M3 | Counsel's written Q1 answer (Model O or N); Esri's 1(e) answer, or the D26 fallback chosen |
| M3 | E2e: letter-code removal hides the roof from bbox at once and from hexagons within 60 s (on a Vercel preview); "allow display" makes the roof building-visible and bumps the version; claim → prefilled listing in <3 min; the claim listing is invisible to anon and strangers but visible to its owner; a second linked listing is refused in Hebrew; an organic overlap becomes a held implicit claim; `claim_pending` reverts after 30 days (time-travel test); a verified listing delete → `withdrawn`; Turnstile works under the CSP; the phone gate (test OTP) and the Send SMS hook refuse a non-+972 number; rate limits and view logs work; potential roofs never get a pin or listing style |
| M4 | Hexagon CDN hit ratio >90%, p95 miss <400 ms; bbox p95 <300 ms; `/security-review` has no open highs; F.1 complete; `legal_signoff_ref` set |

### H.2 Test inventory (component 12 and per component)
- `tests/rls.test.ts` (extended): mode matrix, held listings, inquiries, `listing_images`, private schema not routable, column grants.
- `tests/potential-state.test.ts` (new; vitest against local Supabase, reusing the `createUser` harness at `tests/rls.test.ts:203`): every transition and every cron function (publication, hold release, revert, `stale`, retention).
- `tests/potential-privacy.test.ts`: the k-anonymity property test, the bbox validation fuzz, and quotas.
- `scripts/potential/__tests__/`: IoU matching, split, merge, boundary, partial re-run.
- `e2e/potential.spec.ts`: the M3 list, with `[auth.sms.test_otp]` added to `supabase/config.toml`. The existing harness signs in through Mailpit (`e2e/helpers.ts:92-104`).
- `e2e/tiles.spec.ts`: the tile counter (M-1).
- Load test (k6 or autocannon) on hexagons and bbox; axe accessibility checks.

### H.3 Monitoring
- **Dead-man switch:** the daily cron writes `last_maintenance_at` and pings an external check (for example a healthchecks.io free check). A missed ping alerts the owner.
- **Error tracking:** Sentry or similar (free tier, **UNVERIFIED** limits) on route handlers and Server Actions.
- **Daily invariant SQL**, which alerts on any of:
  - an opted_out, suppressed, claim_pending, claimed or non-published roof in hexagon or bbox output;
  - any shown hexagon with n<5;
  - any `claim_hold` listing visible to anon;
  - a storage purge overdue;
  - `is_admin` count >10;
  - the hash chain broken.
- **Quotas:**
  - Esri ALP usage against 2M (alert at 70%);
  - MapTiler against the spending limit;
  - Twilio usage trigger;
  - API key expiry dates (30-day alert);
  - Supabase CPU and disk during an apply.
- **Daily digest email:** funnel events, removals, claims, sweep alerts and the audit hash.

### H.4 Effort detail: what changed from v1 (63–83 pd) to v2 (81–107 pd before contingency)
| # | Component | v2 full | Added work |
|---|---|---|---|
| 1 | Pipeline | 13–17 | +1–1.5 one-to-one matching, split and merge queue, quadkey-scoped supersede, timeouts, staging columns, fixtures; +0.5 mask, provenance, licence gate on all inputs |
| 2 | Schema, RLS, RPCs | 13–16.5 | +3–5 DB-enforced mode, hold in RLS, k-anonymity, implicit claims, `claim_pending`, visibility recompute, private schema, indexes, advisors |
| 3 | Review screen | 10–13.5 | +1–2 imagery processing (orthorectified, pansharpened 8-bit RGB; GDAL on Windows; co-registration check); +0.5 HMAC and Lambda instead of the Vercel proxy |
| 4 | Public layer | 10.5–13.5 | +1 SMS hardening (hook, CAPTCHA on login, Geo Permissions, test OTP); +1–1.5 quotas, canaries, business verification; +0.5–1 Leaflet fixes, server-side hexagons, version endpoint |
| 5 | Claim flow | 9–12 | +2–3 `verification_documents`, `needs_info`, folder cap, checklist UI |
| 6 | Removal and retention | 6–8 | +0.5 delayed suppression and limits; +0.5 Node storage purge with alert |
| 7 | Letters | 3.5–5.5 | +0.5 display opt-in on `/roof/<code>` |
| 8 | Audit | 2.5–3.5 | +0.5 session user, `application_name`, hash chain |
| 9 | Monitoring | 3–4 | +1 dead-man switch, Sentry, invariant SQL, quota and key-expiry alerts |
| 10 | Map hygiene | 2.5–3 | +1 production guard, `updateWhenZooming`, `fitBounds`, tile counter |
| 11 | Legal pages | 2–2.5 | +0.25–0.5 CDLA notices on every surface |
| 12 | Hardening and tests | 4.5–5.5 | +1.5 state machine, held-listing matrix, property test, phone-gate e2e |
| 13 | Environments | 1.5–2.5 | new: staging project, CI `test:rls`, account setup |

The technical review proposed 75–95 pd. v2 is higher because other accepted issues add work.

## Appendix I. Risks, KPIs and gates

### I.1 Risk register
| # | Risk | L / I | Mitigation |
|---|---|---|---|
| 1 | No lawful basis for building-level display (PPA) | Med / **High** | Model O default; Q1 answered before M3; mode and kill switch in the DB; gated, no identity |
| 2 | Re-identification through hexagon differencing, or version diffs | Med / High | k≥5 over aggregate-only roofs; bands; weekly batches; property test |
| 3 | Harvesting by gated users | Med / High | Invitation or business check; distinct-roof quotas; canaries; sweep alerts; Outreach Code |
| 4 | ODbL contamination (mask, lists, OSM) | Low / High | Microsoft partition mask; licence gate on every input; provenance |
| 5 | Imagery terms: review labelling | Med / High | Airbus only in ReviewMap; Esri and ArcGIS Online only with written OK; layers logged per decision |
| 6 | **Airbus territory clause or contractor rules** | Med / High | Israeli hosting; Israel-only access; undertakings; ask for authorisation |
| 7 | **Owner-drawn polygons derived from provider imagery** | Med / Med | Microsoft prefill; Esri 1(e) and MapTiler (b); D26 fallback; `drawn_on_provider` stored |
| 8 | **Tile bill**: tiles per view, no Esri cap, replayed keys | Med / Med–High | M-1 fixes and measurement; spending limit; 70% alert; pay-as-you-go decision; key rotation |
| 9 | **SMS pumping or lockout** (30/h project limit) | Med / Med | Send SMS hook (+972 only), CAPTCHA, Geo Permissions, usage trigger, raised limit |
| 10 | **Roof hiding** through organic listings, unverified claims or removals | Med / Med | Implicit claims held; `claim_pending` revert; delayed suppression; limits |
| 11 | Claim-hold bypass (`claim_release_at`) | Low after fix / High | Guard forces null on insert; RLS hold; tests |
| 12 | Silent cron failure | Med / High | Dead-man switch, invariants, Sentry |
| 13 | XPLAN coverage poor outside the pilot | High (national) / Med | Status stored; never shown as zoning; samples before national |
| 14 | Low precision (greenhouses, ~25% bad outlines, new PV) | High / Med | Recent 30 cm imagery; QA; precision study; corrections; freshness |
| 15 | Investors misread potentials as offers | Med / High | No pins, hatched slate, "לא מוצע", no ₪, off by default |
| 16 | Spam or trespass on owners; s.30א exposure | Med / High | Code clauses (E.6), phone, invitation or business check, suspension |
| 17 | Fraudulent claim | Low / High | Identity binding, hold, claim notice, banner |
| 18 | Unlicensed brokerage | Low / High | No fees |
| 19 | Data-broker duties at national scale | Med (national) / Med | No national load in Phase 1; Gate 2 opinion |
| 20 | Defence or sensitive sites published | Low / High | Civilian XPLAN codes only; key 8; seeded exclusion zones; Q21 |
| 21 | Too few reviewers | Med / Med | Name 3 at M0; publication blocked without QA |
| 22 | Free plans in production; no backups for Storage files | High if not upgraded | Pro at M0; D21 |
| 23 | Low opt-in under Model O | **High** / Med | Area interest feeds follow-up letters; claims do not depend on visibility; KPIs re-based; revisit at Gate 2 |
| 24 | Competition: GovMap rooftop tool, Ofek | Med / Med | Review quality, claims, matchmaking (D17) |
| 25 | Pipeline credentials leak | Low / High | Minimal role; password manager; audit with `application_name` |

### I.2 Pilot KPIs (ESTIMATE; about 120 letters; re-based for Model O)
| KPI | GO | Iterate | Stop |
|---|---|---|---|
| **Verified claims ÷ letters** | **≥6%** | 3–6% | <3% |
| Owner engagement (code visit, claim, allow display, correction, removal) ÷ letters | ≥15% | 8–15% | <8% |
| **Display opt-ins (owner opt-in + confirmed corporate) ÷ letters** | **≥15%** | 7–15% | <7% |
| Verified claims that become published listings | ≥60% | 40–60% | <40% |
| Building-level roofs with ≥1 investor interest | ≥40% | 20–40% | <20% |
| Area-interest registrations | ≥20 | 8–19 | <8 |
| Distinct interested investor or installer accounts | ≥15 | 8–14 | <8 |
| Inquiries per converted listing within 60 days | ≥2 | 1 | 0 |
| Precision (published roofs later found wrong) | ≤10% | 10–20% | >20% |
| Area error vs documented area (Tabu or permit) or an admin-corrected Airbus outline | ≤20% | 20–35% | >35% |
| Removals ÷ published roofs | ≤5% | 5–10% | >10% |
| Substantiated complaints per 100 roofs | ≤2 | 3–4 | ≥5, or any trespass or regulator complaint |
| Removal SLA met | 100% | – | <95% |
| Approved claims later found fraudulent | 0 | – | ≥1 (pause claims) |
| LOIs or negotiations reported (month 9) | ≥3 | 1–2 | 0 |
| Admin effort per verified claim | ≤2 h | 2–4 h | >4 h |
| Measured tiles per page view; tile cost per active investor | ≤60; within D14 budget | – | – |

With about 120 letters, 6% is about 7 claims (a Wilson 95% interval of roughly 3–12%). Gate 2 is directional, not statistical.

### I.3 Gates
- **Gate 0** (before S1): F.1 complete; removal flow tested; licensed tiles live; QA staffing; `legal_signoff_ref` set.
- **Gate 1** (end of S2): complaints and removals within limits; no trespass report; no harvesting alert left unresolved.
- **Gate 2** (S3 month 6): GO requires all of:
  - claims ≥6% of letters;
  - opt-ins ≥15%;
  - interest coverage ≥40%;
  - removals ≤5%;
  - complaints within limits;
  - precision ≥90%;
  - XPLAN samples in 3–4 regions;
  - the written national legal opinion;
  - a funded national imagery route (D19).

  **ITERATE** if claims are 3–6% and trust and safety are fine. **NO-GO** on any Stop.

### I.4 Hard stops (each sets `mode = 'off'` or disables building level through the audited RPC, which also purges)
- Any PPA inquiry or complaint, or a lawyer's letter from an owner.
- More than 10% removals in 30 days, or ≥2 substantiated trespass or harassment reports. Building level is suspended.
- A fraudulent approved claim. Claims are paused.
- A broken privacy invariant (H.3). The layer stays off until it is fixed.

## Appendix J. Sources

**Fetched or re-checked for v2 (2026-10-19)**
| Fact | Source |
|---|---|
| USD/ILS 3.11 (lastUpdate 2026-10-19T12:22Z) | https://www.boi.org.il/PublicApi/GetExchangeRates |
| VAT 18% from 2025-01-01 | https://www.chamber.org.il/serviceslobby/finance/1427/154872/ (via search) |
| Airbus Standard EULA Nov 2025: Art. 1.1(a)–(i), 1.2(a)–(c), 2.1, 4.2, definitions | https://storage.googleapis.com/p-ssp-iep-prod-8ff-strapi-uploads/Standard_End_User_Licence_Agreement_November_2025_e87587e010/Standard_End_User_Licence_Agreement_November_2025_e87587e010.pdf (text extracted locally); index https://space-solutions.airbus.com/legal/licences |
| Pléiades Neo AOI rules (5 km² billable, 250 km² max, 13 km width, one polygon, tasking 25 km²) | https://intercom.help/skywatch-ab92e82e1a0a/en/articles/9917241 |
| VHR 30–49 cm $19/km² archive, $29 tasking | https://skywatch.com/data |
| R2 location hints and jurisdictions (no Israel) | https://developers.cloudflare.com/r2/reference/data-location/ |
| S3 il-central-1 $0.025/GB-month, GET $0.0044 per 10k (publicationDate 2026-10-15) | https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/il-central-1/index.json |
| Supabase: Pro $25, $10 credit, PITR $100 per 7 days, branching $0.01344/h, phone MFA $75, extra project = full compute | https://supabase.com/pricing |
| PITR needs Small compute; Storage objects are not in backups; Pro keeps 7 daily backups | https://supabase.com/docs/guides/platform/backups |
| MapTiler: 10–16 raster requests per 256 px view; 512 px raster = 4 requests; Flex $30 / 500k / $0.15 per 1k; spending limit; Free is non-commercial | https://www.maptiler.com/cloud/pricing/ |
| MapTiler §4.3 "no commercial derivative works" | https://www.maptiler.com/terms/ |
| Esri ALP: 2M free then $0.15 per 1k; no spending-limit information | https://location.arcgis.com/pricing/ |
| Esri World Imagery "Uses Permitted" (document dated 2024-01-22) | https://www.arcgis.com/sharing/rest/content/items/8e90a00a0a6845a49262e0b756f57a10/data (text extracted locally) |
| CDLA-P-2.0 §2.1 and §3.1 | https://cdla.dev/permissive-2-0/ |
| geoBoundaries ISR ADM0: "OpenStreetMap, Wambacher", ODbL 1.0 | https://www.geoboundaries.org/api/current/gbOpen/ISR/ADM0/ |
| PPA final consent opinion (25 Feb 2026), summary posted 9 Mar 2026 | https://www.shibolet.com/?p=24351 · primary https://www.gov.il/he/pages/consent-2026 returned **403 (UNVERIFIED)** |
| Twilio Israel: $0.2575/segment, $15/mo clean mobile number, alphanumeric sender IDs free | https://www.twilio.com/en-us/sms/pricing/il |
| Twilio Israel sender rules (domestic alphanumeric pre-registration ~1 week; international not supported; no short codes) | https://www.twilio.com/en-us/guidelines/il/sms |
| Twilio Verify: $0.05 per successful verification plus channel fees | https://www.twilio.com/en-us/verify/pricing |
| Resend without a verified domain sends to your own address only | https://resend.com/docs/knowledge-base/403-error-resend-dev-domain |
| Israel Post regular letter ₪3.60 | https://www.ice.co.il/consumerism/news/article/997421 (via search; date per the cost review 2024-01-24; current rate **UNVERIFIED**) |

**Read in the repo for v2**
- `node_modules/leaflet/src/layer/tile/GridLayer.js:95-97`
- `node_modules/next/dist/server/web/spec-extension/revalidate.d.ts:13` (`revalidateTag(tag, profile)`)
- `src/app/globals.css:317`
- `src/components/explore/ExploreMap.tsx:74-75`
- `src/components/map/mapParts.tsx`
- `src/components/publish/DrawMap.tsx:86`
- `src/lib/config.ts:4-18`
- `src/proxy.ts:10`
- `src/lib/supabase/proxy.ts:6`
- `src/lib/data/queries.ts`
- `src/components/publish/ListingWizard.tsx:287`
- `supabase/migrations/20261019010000_review_fixes.sql:158-230, 304-330`
- `supabase/migrations/20261018000000_init.sql:28, 486-497`
- `supabase/config.toml:13, 203, 274, 427`
- `vercel.json` (no crons)
- AOI and cell re-check script output (session scratchpad, not committed)

**Cited by the reviewers and not re-fetched by the planner** (treat as seen by the reviewer on 2026-10-19):
- Vercel purge docs: https://vercel.com/docs/caching/cdn-cache/purge
- Next.js `revalidateTag` docs
- Supabase rate limits, Send SMS hook and Storage delete-objects pages
- react-leaflet docs; bundlephobia h3-js 4.5.0
- AYR/Legalink PPA summary (27 Apr 2026); law.co.il s.30א rulings
- apps.land.gov.il takanon of plan 409-0658419
- domainoffer.net .co.il prices; walla, 31.12.2024 (postage and VAT)

**Key primary sources carried over from v1** (§12 of v1; all seen 2026-10-19):
- Microsoft licence commit `ef94ee3` and the dated index
- XPLAN record and data.gov.il terms
- OSMF guidelines
- Esri ALP Agreement E204 (Nov 21 2025)
- Mapbox Product Terms (Jul 21 2026); Google Map Tiles policies
- Airbus licence summaries (2023)
- Kyl–Bingaman (85 FR 44059)
- Privacy Protection Law, Data Security Regulations, Real Estate Brokers Law and Land Law (Wikisource; verify against Nevo)
- Maariv, 2025-02-04 (GovMap tool)
- Vercel, Resend and Twilio pricing pages; Supabase compute sizes; R2 pricing
- The workstream notes' own source lists: imagery-costs §Sources, data-sources §9, israel-scale §9, technical-design §14, product-legal §12

**Internal:**
- `research/pilot-emek-hefer/data/stats.json` (992 candidates; A 238 / B 231 / C 523; photo review 33/36)
- `data/candidates.geojson`
- `audit/recompute-core.json` (2,294)
- `research/israel-scale/summary.json` (53,350), `raw/*.geojsonl.gz`

## Appendix K. Review notes (v1 → v2)

No issue was rejected outright. Where the plan departs from a reviewer's proposed fix, the reason is given.

**Costs review**
| # | Issue | Disposition | Where |
|---|---|---|---|
| C1 | 20 tiles is one viewport fill, not a page view; `flyToBounds` multiplies tiles | **Accepted.** Unit restated; 20/60/150 sensitivity; M-1 fixes and Playwright counter; spending limit. "Aborted requests are billed" kept as UNVERIFIED | §8.2–8.4, G.1–G.2, §9.2 |
| C2 | National Tier A imagery understated | **Accepted.** The planner re-ran the cell method (8-connected): all ≥1,000 m² billed 5,550 km² ($105k–125k); random 10.4% $65k–79k, against the critic's $78k–93k. The critic's $28k–57k central range is adopted, with the upper bound shown as $65k–93k. National review is out of Phase 1 (R7, D15, D19) | §8.3, G.4, §12 |
| C3 | Airbus Art. 1.2(a) territory vs R2/Vercel hosting | **Accepted.** The EULA was read and confirmed. Default hosting is AWS il-central-1; a written request to Airbus is sent in week 0 | C.3, G.5, G.7, D20 |
| C4 | D5 based on OSM candidate cells; Tier A+B not selectable; width >13 km; tasking; Background Layer | **Accepted.** Full box in 2 AOIs, $3.6k–4.2k, tasking ≈$5.5k; A+B and Background Layer dropped. The re-check confirms the bbox is 14.1 km wide | G.4, D5 |
| C5 | Supabase PITR, Small compute, staging, Storage not backed up | **Accepted** (D21, D22). Staging is a separate project at $10/mo | §9.2 |
| C6 | Imagery is recurring through the freshness rule | **Accepted.** Amortised row and "caused by potential roofs" row restated | §9.2 |
| C7 | Labour not costed; review hours inconsistent | **Accepted.** pd × rate and hours × rate; pilot 17–22 h; national Tier A 46–69 h | §9.4, C.7 |
| C8 | No FX rate, VAT ignored, legal unsourced, Gate 2 opinion missing | **Accepted.** BoI 3.11, a VAT column, a Gate 2 placeholder, and 2–3 fixed-fee quotes required | §0, §9.3, §9.5, L1 |
| C9 | Owners trace polygons over the public aerial | **Accepted** (merged with L2). Esri 1(e), [LAWYER] Q20, fallbacks costed (D26) | §8.1, E.3 |
| C10 | SMS sender, Verify fee, pumping, MFA | **Accepted with one correction:** Twilio's pricing page says alphanumeric sender IDs are free, so the sender costs $0–15, not $15. Geo Permissions, CAPTCHA, usage alert; MFA not triggered | §9.2, D.6 |
| C11 | Esri free tier has no guardrail | **Accepted.** Esri 1(f), pay-as-you-go decision D25, 70% alert, key rotation | §8.1, H.3 |
| C12 | Domain missing; letters print solgag.co.il | **Accepted** (D23; placeholder domain in letters) | §9.2, E.1 |
| C13 | Postage stale | **Accepted.** ≥₪3.60; Israel Post's current rate still UNVERIFIED | §9.3, E.1 |
| C14 | EULA settles ML, extracts, contractors | **Accepted** (D18, Q19, L15) | §1.3, G.5 |
| C15 | Optimised 1M figure lacks caveats | **Accepted.** v1's "$1.2k–2.2k optimised" removed. The planner adds that MapTiler bills a 512 px raster as 4 requests, so the 512 px saving is possible only on Esri (UNVERIFIED) | G.1, §8.4 |

**Legal review**
| # | Issue | Disposition | Where |
|---|---|---|---|
| L1 | Letter + silence is not consent under the PPA opinion | **Accepted.** Model O (opt-in or confirmed corporate) is the default; R8 is restated as an ethical notice; the PPA text is filed and Q1 answered before M3; returned letters never count; KPIs re-based. "Verified claim" as a positive signal is not listed separately, because a verified claim becomes a listing anyway | R8, B.5, F.1–F.2, I.2 |
| L2 | Owner drawing over Esri (Uses Permitted) and MapTiler §4.3 | **Accepted.** Microsoft-outline prefill, an M3 gate, `drawn_on_provider`, organic wizard included (Q20, D26). Both source texts were confirmed | §8.1, E.3 |
| L3 | Hexagon differencing re-identifies hidden roofs | **Accepted.** Aggregate-only statistics with **k≥5** (stricter than the technical review's k≥3), bands, 5,000 m² rounding, weekly batches, property test | §3, B.6, D.1 |
| L4 | geoBoundaries ISR is ODbL; kibbutz list source; licence gate | **Accepted.** ODbL confirmed through the API; Microsoft-partition mask; the gate covers all inputs | A.1 |
| L5 | Intermediaries receive building lists | **Accepted.** Flyers and counts only; kibbutz and park exceptions only with counsel and a data-sharing agreement; never tax or enforcement bodies | E.1 |
| L6 | Untrue statements in letters and copy | **Accepted:** (a)–(d), plus an s.13 access route | D.5, E.1, E.7 |
| L7 | National S0 contradicts D15 | **Accepted.** D15 binding; R7 changed | R7, D15 |
| L8 | S1 compression before sign-off | **Accepted.** Option removed; enforced by `legal_signoff_ref` | §7, B.11 |
| L9 | ArcGIS Online fallback is not clean | **Accepted.** Uses Permitted text confirmed; same written OK required; `esri-agol` decisions held back | §8.1, C.2 |
| L10 | Street toggle and inset in ReviewMap | **Accepted.** Airbus-only ReviewMap; registry covers every layer; build fails on keyless | C.2 |
| L11 | Bbox quota allows national harvesting; gate has no role check | **Accepted** (merged with T5): 100 calls, 150 distinct roofs a day, canaries, sweep alerts; S3 needs an invitation or business check | B.6, D.9 |
| L12 | Zone labels may leak parcel identifiers | **Accepted.** Whitelist and reject list | A.5 |
| L13 | CDLA §2.1 requires the text with shared Data | **Accepted.** §2.1 text confirmed; licence fields and links everywhere | A.1, L5 |
| L14 | Airbus misread (cautious side) | **Accepted.** The DW definition is confirmed in the full EULA. Admin outline correction on Airbus is a Phase 1.5 option (D11, +2 pd) pending Q19, not Phase 1, to keep scope. Background Layer availability is moot because BL is dropped | §1.3, G.5 |
| L15 | Release email consent; tenant-interest records | **Accepted** | D.7 |
| L16 | s.30א exposure through users' messages | **Accepted.** New Code clauses | E.6 |
| L17 | Hexagon copy promises details that never appear | **Accepted.** Copy varies by hexagon; area interest added | D.5 |
| L18 | Airbus tiles could be cached by the CDN | **Accepted.** `private, no-store` on the Israeli Lambda; 401 tests | C.3 |
| L19 | Keyless tiles and Google geocoding are a problem now | **Accepted** as M-1, independent of Phase 1 | §7, §8.4 |
| L20 | Defence-industry sites | **Accepted** (Q21, seeded exclusion zones from Microsoft footprints plus a buffer) | A.5 |

**Technical review**
| # | Issue | Disposition | Where |
|---|---|---|---|
| T1 | Rollout mode and kill switch only in an env var | **Accepted.** DB mode, invitation flag, audited RPC, tests in every mode | §3, B.3–B.4 |
| T2 | Hold in `listing_feed` leaks via the table, inquiries and images; deadlocks owners; breaks anon | **Accepted.** Hold in RLS, column grant, feed column, owner banner. All cited line numbers confirmed | B.7 |
| T3 | `claim_release_at` writable on insert | **Accepted** | B.7 |
| T4 | Organic listings and unverified claims hide roofs | **Accepted.** The implicit-claim option was chosen over "keep the roof unchanged", because it also blocks squatting on surfaced roofs; `claim_pending` with auto-revert | B.5, B.7, E.6 |
| T5 | Inverted bbox; quota does not limit extraction | **Accepted.** The planner also found that v1's "0.06° ≈ zoom 13" was wrong (≈350 px at z13): outlines now appear at z≥15, with a 0.08°×0.06° limit | B.6 |
| T6 | Hexagon k counts building-visible roofs; kWp ignores free share | **Accepted.** k raised to 5 per L3; kWp from the rounded Σ(area × free share) satisfies both reviewers | B.6, D.1 |
| T7 | Version spoofing, `revalidateTag` signature, version bumps, client version, untestable locally | **Accepted.** The signature was confirmed locally; exact purge semantics are verified by the preview smoke test | B.5, D.2 |
| T8 | Phone provider exposes SMS sending | **Accepted** | D.6 |
| T9 | `apply_batch` privileges, matching, supersede scope, timeouts, staging columns | **Accepted** | A.2, A.9 |
| T10 | Effort optimistic | **Accepted and extended:** 81–107 pd + 15% = 93–123 pd. This is above the reviewer's 75–95 because other accepted issues add work (quotas, monitoring, delayed suppression, letters opt-in, audit) | §9.1 |
| T11 | Tile proxy costs Supabase calls per tile | **Accepted in principle** (HMAC token, no Supabase per tile). The host moves from the proposed Cloudflare Worker and R2 to an **AWS il-central-1 Lambda** because of the Airbus territory clause (C3). The Worker is used only with Airbus authorisation | C.3, G.7 |
| T12 | Visibility not recomputed; intermediaries; no-address roofs; release clock; freshness | **Accepted, all five** | B.5, A.7, E.1 |
| T13 | SQL cannot delete Storage objects | **Accepted** | B.11 |
| T14 | Missing indexes, region column, advisors | **Accepted** | B.9, M1 |
| T15 | Test plan gaps | **Accepted** | H.2 |
| T16 | Monitoring is one digest | **Accepted** | H.3 |
| T17 | Removal abuse | **Accepted.** Delayed suppression (letter code stays instant), limits | E.7 |
| T18 | Leaflet integration and h3-js size | **Accepted.** Hexagons are computed on the server | D.2–D.3 |
| T19 | Link stored twice; race | **Accepted.** `potential_roofs.listing_id` dropped; one lock key | B.2, B.7 |
| T20 | Definer helpers exposed through PostgREST; unmetered code guesses | **Accepted.** `private` schema; lockout | B.1, B.6, E.3 |
| T21 | Audit actor and tamper evidence | **Accepted** | B.10 |
| T22 | Keyless fallbacks in production | **Accepted** (M-1 build guard) | §8.4 |
| T23 | Mediated interest cannot create inquiries | **Accepted.** Email with a link; the investor sends the inquiry | D.7 |

**Planner's own corrections in v2.**
- (P1) Bbox and zoom mismatch, see T5.
- (P2) MapTiler 512 px = 4 requests.
- (P3) Airbus ML and DW confirmed from the full EULA, replacing v1's UNVERIFIED.
- (P4) AWS S3 Israel price taken from the official price list.
- (P5) Published roofs due for re-review stay visible for 60 days instead of dropping to `candidate`; this answers T12 point 5.
- (P6) `potential_roofs.listing_id` removed: roofs already covered by a listing are skipped at apply and logged.

