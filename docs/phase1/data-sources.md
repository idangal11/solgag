# Phase 1: data sources without ODbL entanglement

Research notes for the "potential roofs" layer (Phase 1). Written 2026-10-19. All "seen" dates are 2026-10-19 unless stated otherwise.
Anything I could not confirm from a primary source is marked **UNVERIFIED**. This is research, not legal advice. The licence conclusions need a lawyer's sign-off before public launch (see also the privacy notes in the brief).

How I checked things:
- I used WebSearch/WebFetch for web pages and licence texts.
- I read the Microsoft index with HTTP range requests (scratchpad script) and downloaded no tiles.
- Israeli government GIS (ags.iplan.gov.il) resets connections from WebFetch's non-Israeli egress, so I read service metadata and ran a 60-point sample from the local machine (attributes only, no geometry). gov.il pages return HTTP 403 to automated clients from both WebFetch and the local machine (bot protection), so a few gov.il facts come only from search snippets. Those are marked.
- No application code, migrations or .env files were touched.

---

## 0. TL;DR: recommended Phase 1 data stack

| Element | Source | Licence (verified) | What we publish | Attribution needed |
|---|---|---|---|---|
| Roof geometry | **Microsoft Global ML Building Footprints**, release `2026-08-13` | **CDLA-Permissive-2.0** (changed from ODbL on 2026-03-11, commit `ef94ee3`) | Polygon (= "Data") plus area/kWp (= "Results") | The **full CDLA-P-2.0 text must accompany shared Data** (polygons). Results carry no obligation. |
| Zoning / land-use class (replaces OSM `landuse`) | **Planning Administration XPLAN**, layer 4 "יעודי קרקע" (`ags.iplan.gov.il/arcgisiplan/rest/services/PlanningPublic/Xplan/MapServer/4`) | **CC BY** per the data.gov.il record `xplan` (version unspecified). The gov.il service page says raw data may be used freely (snippet only). | Only a derived class per roof (e.g. "אזור תעסוקה/תעשייה", "קרקע חקלאית", "מבני ציבור"). We do **not** republish plan polygons. | "ייעודי קרקע: מינהל התכנון – XPLAN (CC BY), סווג מחדש ע"י סולגג" |
| Fallback zoning where XPLAN has no digital plan | District outline plans (תמ"מ, data.gov.il `tmm`), national plans (תמ"א, `tma`) | CC BY (data.gov.il records) | Derived class only | Same as XPLAN |
| Greenhouse screen (replaces OSM `greenhouse_horticulture`) | (1) XPLAN "קרקע חקלאית" without "מבני משק" → **review flag**, not auto-publish; (2) optional **Global-PCG-10** 10 m plastic-greenhouse map (2020); (3) optional own Sentinel-2 index | (2) **CC BY 4.0** (figshare record); (3) Copernicus free/full/open notice | Nothing directly: an internal exclusion or flag | (2) cite Niu et al. 2025; (3) "Contains modified Copernicus Sentinel data 2026" |
| Residential screen (fallback) | XPLAN residential codes; optional **GHSL GHS-BUILT-S 10 m `built_surface_nres`** (2018) | EC reuse: "Reuse is authorised, provided the source is acknowledged" | Internal flag only | "GHSL © European Union, JRC" |
| Existing PV on roof | **Our own reviewer labels** (human QA on licensed imagery) plus owner self-report in the claim flow | Our data | "PV present / partial / none (per review date)" | n/a |
| Context: local PV penetration (optional) | Electricity Authority BI CSV "מתקני ייצור מחוברים" (monthly); Ministry of Energy local-authority realisation index | data.gov.il not used. gov.il terms **UNVERIFIED** | Aggregates only (per regional council) | "מקור: רשות החשמל" (if used) |
| "Approximate address" | **No street address.** Label = jurisdiction / locality / zone name from **XPLAN layer 1** (plan boundaries: `jurstiction_area_name`, `plan_county_name`, `pl_name`) | CC BY (as above) | e.g. "מ.א. עמק חפר · אזה"ת עמק חפר" | XPLAN line covers it |
| Exact address | **Only first-party**: typed by the owner in the claim flow | Our data (privacy law applies) | Not public until the owner publishes a listing | n/a |
| Yield (kWh/kWp) | PVGIS API (already used in the pilot) | EC/JRC: free, "authorised if the source is acknowledged" (download page; API terms **UNVERIFIED**) | Results only | "PVGIS © European Union" |
| **Not used in the published layer** | OSM / Overpass / Geofabrik, Overture (buildings, base, divisions = ODbL), Google Open Buildings (no Israel coverage), GlobalBuildingAtlas (CC BY-NC / ODbL), Nominatim, Google Geocoding (storage + Google-map-only rule), GovMap / Survey of Israel (proprietary), Israel Land Authority and Ministry of Agriculture plot DB (ownership/cultivator = personal data) | — | — | — |

**Cost of the data stack: $0.** Every recommended source is free. The only optional paid item is a stored-results geocoder, and I recommend against it for Phase 1 (section 4). At 10,000 roofs that would cost about $40 (Esri stored, $4 per 1k) or $50 (Mapbox permanent, $5 per 1k).

**Main finding I did not expect:** in the pilot, XPLAN gives a specific land-use designation for 56/60 sampled candidates. But **40 of those 56 come from a single plan that is not yet approved**: 409-1041839, the comprehensive outline plan for Emek Hefer Regional Council, status "במילוי תנאים להפקדה". With approved plans only, just **10/60** points have a specific designation. So XPLAN works well as a classification signal of actual or intended use, but it must **not** be displayed as legal zoning. National coverage has to be measured region by region (section 2.1).

---

## 1. Why OSM has to go from the published pipeline (pilot facts)

From `research/pilot-emek-hefer/analyze.mjs` and `data/stats.json`:

- **Geometry.** In the pilot, every OSM candidate (`source: both` = 378 and `osm_only` = 60) publishes the **OSM polygon**. Only `ms_only` (512) and `ms_merged` (42) publish Microsoft geometry. **All 238 Tier A roofs are `both`, so all of them currently use OSM outlines.** Phase 1 must rebuild every candidate on Microsoft geometry. Areas will shift. The audit (`audit/diagnostics.json`, D5) found 47 "both" roofs where the MS area is under 0.5× the OSM area and 29 where it is over 2×.
- **Selection and tiering.** OSM `landuse` drives every exclusion: residential 819, greenhouse area 606, military 16. The OSM `building` tag drives 17 + 32 more. Tier A is defined as "both sources agree" plus an industrial/commercial/farmyard OSM zone. Even when the published polygon comes from Microsoft, choosing which MS roofs to publish by OSM land use, or by agreement with OSM buildings, keeps an OSM dependency inside the published database.
- **OSMF guidance does not settle this.** The Collective Database guideline (endorsed 2016-06-17) says a reference between OSM and non-OSM data "can be by a database key or any other method", and none of its safe cases covers filtering third-party data with OSM. https://osmfoundation.org/wiki/Licence/Community_Guidelines/Collective_Database_Guideline_Guideline (seen 2026-10-19).
- **The insubstantial-extract safe harbour does not fit.** It covers fewer than 100 features, one-off and not repeated, or an area of about 1,000 inhabitants. A nationwide land-use filter is neither. https://osmfoundation.org/wiki/Licence/Community_Guidelines/Substantial_-_Guideline (seen 2026-10-19).
- **Mapped solar.** OSM had only 12 solar features in the pilot, so dropping OSM costs almost nothing here.
- **The basemap points the same way.** The imagery research notes that ArcGIS Location Platform terms forbid combining with ODbL layers. That is one more reason to keep the published layer 100% non-ODbL.

**Consequence for tiering.** "Both sources agree" can no longer be a published-layer signal. Phase 1 tiers have to come from: XPLAN class + MS geometry checks (area, elongation, overlap/duplicates; the pilot audit already computes these) + **human review, which stays mandatory**.

---

## 2. Building footprints

### 2.1 Microsoft Global ML Building Footprints (recommended)

**Licence.**
- The README says: "This data is licensed by Microsoft under the CDLA Permissive 2.0" and links to https://cdla.dev/permissive-2-0/. https://github.com/microsoft/GlobalMLBuildingFootprints (seen 2026-10-19).
- History of the `LICENSE` file, from the GitHub API (https://api.github.com/repos/microsoft/GlobalMLBuildingFootprints/commits?path=LICENSE, seen 2026-10-19):
  - `375d31c` (2022-04-22): "LICENSE committed". The file was the MIT licence (code). https://raw.githubusercontent.com/microsoft/GlobalMLBuildingFootprints/375d31c72f8d54031cd914011ccf048af7148969/LICENSE
  - Later the data line read "Data in this repository has been licensed by Microsoft under the Open Data Commons Open Database License (ODbL)". This is the line removed by the next commit.
  - **`ef94ee3dfb5da3bd2c9dd9c36815eff66fa0b66d` (2026-03-11 02:51 UTC)**: "Updating Readme and License file to relfect the change in license to CDLA Permissive 2.0 (#146)". The diff replaces every ODbL reference in `LICENSE` and `README.md`. https://api.github.com/repos/microsoft/GlobalMLBuildingFootprints/commits/ef94ee3dfb5da3bd2c9dd9c36815eff66fa0b66d
  - The current `LICENSE` is a single sentence and **misspells the licence as "CLDA Permissive 2.0"**. The README spells it correctly and links cdla.dev. Pinned copy: https://raw.githubusercontent.com/microsoft/GlobalMLBuildingFootprints/ef94ee3dfb5da3bd2c9dd9c36815eff66fa0b66d/LICENSE
- **Wayback Machine copies of `LICENSE`.** I looked these up with the archive.org availability API. I could not open web.archive.org itself from WebFetch, so I have not seen the snapshot contents.
  - After the change: http://web.archive.org/web/20260429192723/https://github.com/microsoft/GlobalMLBuildingFootprints/blob/main/LICENSE (2026-04-29)
  - Before the change (ODbL era): http://web.archive.org/web/20251130224610/https://github.com/microsoft/GlobalMLBuildingFootprints/blob/main/LICENSE (2025-11-30)
  - Recommendation: also save our own copies of the README, `LICENSE` and the cdla.dev text with the data manifest.
- **CDLA-Permissive-2.0 terms** (https://cdla.dev/permissive-2-0/, seen 2026-10-19):
  - §1.1: you may "use, modify, and share the Data".
  - §2.1: if you share Data, modified or not, you must make **the text of this agreement** available with the shared Data. This version has no URI-only alternative.
  - §3.1: **no restrictions or obligations on Results**, where Results are "any outcome obtained by computational analysis of Data" (§5.4).
  - §4: AS IS, no liability.
  - What this means for us: the polygons we serve, even simplified, are shared modified **Data**, so the licence text has to travel with them. Area, usable area, kWp and MWh are **Results** and are unrestricted.
- **Which licence covers which copy.** The pilot tile `raw/ms-122112223.geojsonl` was written 2026-10-19, after the change, but from the **old frozen host** (`minedbuildings.z5.web.core.windows.net`). For a clean provenance trail, Phase 1 should re-fetch from the post-change, versioned release (below) and record the licence commit SHA in the manifest.

**Release cadence.** Updates are irregular. From the README log (seen 2026-10-19):
- 2026: 01-09, 01-18, 01-23, 01-27, 02-03, then nothing until 07-24 (two entries, one of which moved hosting), then **08-13** ("Global dataset refreshed… 30,340 tiles across 225 regions; 1,945 tiles updated").
- 2025: 01-06, 02-03, 02-28.
- 2024: roughly monthly.

Most 2026 additions were US/EU Vexcel imagery. **No update mentions Israel.** Imagery for the dataset is Bing (Maxar/Airbus/Vexcel), dated 2014–2024 (the README contradicts itself, also saying 2014–2021). The per-tile imagery date for Israel is **UNVERIFIED**. Suggested policy: check the README monthly and rebuild only when Israel quadkeys change (compare per-tile sha256).

**Hosting and index (changed since the pilot).**
- Since **2026-07-24** the data lives at `bfppub.blob.core.windows.net`. The README says: "Older versions will not be moved but updates will be available at this new location going forward". `research/pilot-emek-hefer/fetch-ms.mjs` still points at the old, frozen `minedbuildings…/global-buildings/dataset-links.csv`.
- Current, **versioned** index: `https://bfppub.blob.core.windows.net/%24web/2026-08-13/dataset-links.csv`
  - HEAD on 2026-10-19: size **6,382,044 bytes** (the old index was over 1 GB), `Last-Modified: Thu, 13 Aug 2026 20:24:50 GMT`, `ETag: 0x8DEF978ED1693F9`.
  - Columns: `Location,QuadKey,Url,Size,UploadDate`. Partition: country × **Bing quadkey level 9**. Files are `.csv.gz` that actually contain GeoJSON lines (EPSG:4326).
- The tile URLs also carry the release date, e.g. `https://bfppub.z5.web.core.windows.net/2026-08-13/global-buildings.geojsonl/RegionName=Israel/quadkey=122112223/part-00050-….c000.csv.gz`. That makes a pinned release reproducible.

**Israel tiles in the 2026-08-13 release** (read 2026-10-19 with range requests; all rows show `UploadDate 2026-08-13`):

| quadkey (z9) | gz size | covers (approx.) |
|---|---|---|
| 122112212 | 1.3 MB | Upper Galilee / Kiryat Shmona |
| 122112221 | 13.2 MB | Haifa, Haifa Bay, Western Galilee |
| **122112223** | **40.5 MB** | Sharon, Tel Aviv, **Emek Hefer pilot** |
| 122112230 | 29.0 MB | Jezreel Valley, Lower Galilee, Golan (Katzrin) |
| 122112232 | 2.4 MB | Jordan Valley / Beit She'an area |
| 122130000 | 68.5 KB | southern coast edge |
| 122130001 | 27.8 MB | Shfela, Ashdod, Jerusalem area |
| 122130002 | 1.7 MB | western Negev coast |
| 122130003 | 17.3 MB | Be'er Sheva, Dimona |
| 122130010 | 2.4 MB | Dead Sea / eastern edge |
| 122130012 | 1.8 MB | central Negev |
| 122130021 | 475.2 KB | Arava |
| 122130023 | 1.4 MB | Eilat |
| 122130030 | 674.3 KB | Arava (east) |
| 122130201 | 56.7 KB | southern tip |
| **Total** | **≈ 140 MB gz** | |

- Footprint count: the old-release pilot tile 122112223 held **408,837 footprints** (167.7 MB uncompressed). Scaling by compressed size gives roughly **1.4 M footprints for the Israel partition** (estimate, UNVERIFIED).
- **Partition boundaries are Microsoft's, not ours.**
  - The same quadkeys also have `WestBank` rows: 122112223 (12.7 MB), 122112230, 122112232 (19.5 MB), 122130001 (17.8 MB), 122130003 and 122130010.
  - There are also `Syria` rows (122112230: 385 KB, which covers the Golan), `Lebanon` rows (122112212: 28.2 MB, 122112221, 122112230) and `GazaStrip` rows (122130000–002).
  - Which partition the Golan Heights and the seam-line areas fall into is **UNVERIFIED**.
  - Recipe: fetch every Location row for the 15 quadkeys above, then clip with **our own** service-area polygon. Build that polygon from a non-ODbL source such as Natural Earth (public domain) or geoBoundaries ADM0 (CC BY 4.0, not checked in detail). Do not rely on Microsoft's region names.
- **Attributes for Israel.** In the pilot tile, `height` = −1 for **0/408,837 with a real value**, so Israel has no heights. `confidence` is present on 408,818 footprints, but **99.75% are ≥ 0.8** (393,516 in the 0.9 bin), so confidence is useless as a greenhouse or false-positive filter. The README publishes Middle East metrics of 95.7% precision, 85.4% recall and 65.1% IoU (early 2022).

**Reproducible fetch recipe (no code changed, just the plan):**
1. `HEAD` the pinned index URL and record size, ETag and Last-Modified.
2. Binary-search the sorted index with `Range` requests, as `fetch-ms.mjs` already does. Now that the index is 6.4 MB, you can simply download it whole.
3. Select rows where `QuadKey ∈ {15 keys above}`. Keep Location ∈ {Israel, WestBank, Syria, Lebanon, GazaStrip} only if you will clip yourself.
4. Download each `Url`, record the **sha256** of the `.csv.gz`, and gunzip it to `.geojsonl`.
5. Write `manifest.json` with: release date `2026-08-13`, index URL, ETag, per-tile URL/size/sha256, licence commit `ef94ee3`, fetch timestamp, and a copy of the CDLA-P-2.0 text.
6. Clip to the service area, then filter by area ≥ 1,000 m², etc.

Data volume for all of Israel is about 140 MB gz, small enough to run on a laptop.

### 2.2 Alternatives checked (and why not)

- **Google Open Buildings v3 / 2.5D Temporal.** Covers Africa, South Asia, South-East Asia, Latin America and the Caribbean. **Israel and the Levant are not covered.** The FAQ says sensitive and conflict areas were omitted. Licence would be CC BY 4.0 or ODbL, user's choice. https://sites.research.google/gr/open-buildings/ and https://sites.research.google/gr/open-buildings/temporal/ (seen 2026-10-19). Not usable.
- **Overture Maps Buildings.** **ODbL**, with OSM, Esri Community Maps, Google and Microsoft as sources. Overture's attribution page (last updated 2026-05-15) still lists Global ML Building Footprints as ODbL, which is now stale. Overture Base (land use) and Divisions are also ODbL, and Overture Addresses has **no Israeli source**. https://docs.overturemaps.org/attribution/ (seen 2026-10-19). Not usable.
- **GlobalBuildingAtlas (TUM, ESSD 2025).** Its own derivations are **CC BY-NC 4.0** and it ships a separate ODbL polygon set. https://huggingface.co/datasets/vitrobot/GBA.LoD1/blob/main/README.md and https://essd.copernicus.org/articles/17/6647/2025/ (seen via search 2026-10-19). Not usable commercially.
- **OSM / Geofabrik.** ODbL. Fine for internal comparison or benchmarking that does not feed into publication. Keep it out of the publish path.
- **GovMap / Survey of Israel buildings.** Proprietary (see the brief). Not usable.

---

## 3. Land use / zoning (replacing OSM `landuse`)

### 3.1 Planning Administration XPLAN: the best non-ODbL zoning source (recommended, with caveats)

- **Licence.**
  - data.gov.il record `xplan` ("XPLAN - מה חל במקום שלי"), organisation מינהל התכנון: `license_id: cc-by` (Creative Commons Attribution, links opendefinition.org, **version not stated**). The resource is the link https://ags.iplan.gov.il/xplan/. Contact `it-tichnun@iplan.gov.il`. Record created 2018-12-09, metadata modified 2023-03-21. https://data.gov.il/api/3/action/package_show?id=xplan (seen 2026-10-19).
  - The data.gov.il general licence (below) says a dataset-specific licence prevails, so **CC BY** applies.
  - The gov.il XPLAN service page reportedly says the raw data may be used freely and GIS files can be downloaded. I only have this from a search snippet, because the page returns 403 to automated clients: https://www.gov.il/he/service/searching-plans-submitted-planning-institutes-in-xplan-site. **UNVERIFIED wording.**
  - Treat it as CC BY: attribute, indicate changes, no extra restrictions. Commercial use is OK.
  - I found **no explicit terms on automated querying**. Recommend emailing `it-tichnun@iplan.gov.il` before running nationwide.
- **Endpoint** (metadata read 2026-10-19): `https://ags.iplan.gov.il/arcgisiplan/rest/services/PlanningPublic/Xplan/MapServer`.
  - Capabilities: Map, Query, Data. Formats: JSON, **geoJSON**. `maxRecordCount` 1000, `supportsPagination` true, `supportsStatistics` true. Native SR **EPSG:2039 (ITM)**; `outSR=4326` is available through the standard ArcGIS query.
  - Layers: 0 point entities, **1 "קוים כחולים-תכניות מקוונות" (plan boundaries)**, 2 line entities, 3 polygon entities, **4 "יעודי קרקע" (land-use designations)**.
  - The `/arcgis/` path and the services directory listing are blocked. Only the `/arcgisiplan/` path answers.
  - **Geo-restriction:** the same URLs reset connections from WebFetch (non-Israeli egress) and answer 200 from the local machine. The pipeline step has to run from an Israeli IP: the user's machine, or an Israeli cloud region. US-hosted CI runners may fail (UNVERIFIED). Whether Vercel fra1 can reach it is **UNVERIFIED**, and it should not need to: this is an offline batch step.
- **Layer 4 fields:**
  - `mavat_code` and `mavat_name`: the MAVAT standard designation code. The renderer has 201 classes.
  - `pl_number` and `pl_name`, `station` / `station_desc` (plan status), `legal_area` (dunam), `shape_area`, `last_update_date`.
  - Codes relevant to us:
    - Residential, to exclude: 10–170 (e.g. 10 מגורים, 20 מגורים א, 160 מגורים בישוב כפרי).
    - Opportunity zones: 200 תעסוקה, 210 מסחר, 220 משרדים, **230 תעשיה**, **240 אחסנה**, 250 תעשיה עתירת ידע, 260 תעשיה קלה ומלאכה, 280 מתקנים הנדסיים; mixed 1050 / 1502 / 1630.
    - Dairy, chicken and farmyard roofs: **300 מבני משק**.
    - Public roofs, often municipal schools: 400–463 מבנים ומוסדות ציבור.
    - Greenhouse risk: **660 קרקע חקלאית**, 661.
    - Open space and other: 650–700+. Roads and rail: 800+.
    - "Not a real designation": 995 "per another approved plan", 996/997 building restrictions, 999 "plan does not apply".
  - Data is fresh: `last_update_date` max values in the pilot bbox are 2026-10-13 to 2026-10-18. The record says the site "is updated daily" and includes plans "from 2011 onward".
- **Pilot measurements** (2026-10-19; bbox 32.30–32.42N, 34.85–35.00E):
  - **12,032** layer-4 polygons intersect the bbox. By status: **approved (אישור) 5,599**, "decision on objections / approval" 907, fulfilling conditions for deposit 2,846, planning review 1,281, deposited 621, in approval process 670, other 108.
  - Polygon counts by code for opportunity zones (all statuses): 200 תעסוקה **76**, 230 תעשיה **92**, 300 מבני משק **58**, 400 public **452**, 660 agricultural **1,594**.
- **Stratified sample**: 20 candidates per tier, 60 total, point query at the roof centroid, attributes only. Scripts: `scratchpad/xplan-sample*.mjs`. Results are in the table below. The sample is small, so treat percentages as ±10–15 pp.

  | Plan statuses used | Tier A (20) | Tier B (20) | Tier C (20) | Points with a specific designation |
  |---|---|---|---|---|
  | **Any status** | 16 employment/industry, 2 public buildings, 1 agricultural, 1 residential | 13 agricultural, 4 employment, 1 residential, 2 none | 18 agricultural, 2 none | **56/60 (93%)** |
  | **Approved only** | 6 employment/industry (codes 200, 230, 1630), 2 public, 12 none | 1 employment (1050), 19 none | 1 agricultural, 19 none | **10/60 (17%)** |

  - **Agreement with the OSM land use the pilot used** (any status): **49/60 (82%)**. Of the 11 disagreements, 2 were OSM-"residential" Tier A roofs that XPLAN marks as **public buildings (400)**. Those are schools, a legitimate roof category, which OSM had hidden inside a residential polygon.
  - **Coverage depends on one draft plan.** 40 of the 60 "any status" hits come from plan **409-1041839** "תכנית מתאר כוללנית למועצה אזורית עמק חפר", status "במילוי תנאים להפקדה". The approved detailed plans for most Emek Hefer roofs are older and not digitised in XPLAN.
  - **Implications:**
    1. Use XPLAN as a **classification signal** (approved designation, else the latest in-process plan, else district plan) and store the status. Never show it as "legal zoning".
    2. National coverage is **UNVERIFIED** and will vary with whether each authority has a digitised comprehensive plan. Run the same 60-point sample in 3–4 other regions (Haifa Bay, Jezreel / Emek Yizre'el dairy area, Negev / Be'er Sheva, Galilee moshavim) before committing.
    3. Plan for gaps. Fallbacks: district outline plans (תמ"מ) → GHSL non-residential flag → human review.
- **What XPLAN cannot do.**
  - It cannot tell a greenhouse from a cowshed on "קרקע חקלאית". In the pilot, Microsoft-only farm roofs were 11/12 greenhouses.
  - It does not mark military areas (I found no military code).
  - Rule for Phase 1: publish a candidate only if its class is employment/industry/storage, farm buildings (300), public buildings (400s), or agricultural **after a reviewer confirms it is a real roof and not a greenhouse**. Leave roofs with no civilian designation unpublished. This also keeps unplanned and military sites out by construction.
- **How to query at scale.**
  - Use one point query per candidate centroid: `geometryType=esriGeometryPoint`, `inSR=4326`, `returnGeometry=false`, `outFields=mavat_code,mavat_name,pl_number,station_desc`. Then cache the results.
  - Polite rate is 2 requests/s: 20,000 candidates take about 2.8 h, and 60 points took about 40 s at 0.4 s spacing.
  - This avoids bulk-copying the plan polygons. We only publish a derived class, which is an adaptation under CC BY.
  - Store the query timestamp per roof.

### 3.2 Other Planning Administration datasets (fallback, coarse)

- `tmm` district outline plans (תכניות מתאר מחוזיות): **CC BY**. The description lists jpg/shp/dwg/gdb, delivered via a data.gov.il guide page. https://data.gov.il/api/3/action/organization_show?id=iplan&include_datasets=true (seen 2026-10-19). Scale is coarse (district plans are roughly 1:50,000; **UNVERIFIED**), but coverage should be national. Good for "inside an industrial/employment zone vs. agricultural/open" where XPLAN has nothing.
- `tma` national outline plans: **CC BY**.
- `valkachshap` ("גליונות ולקחש"פ", agricultural-land committee sheets): **CC BY**.
- `tatal` national infrastructure plans: **CC BY**.
- `ezoriyut_str`, `merchav_tichnun`: other-open.
- `iplan-itur-tochnit` (MAVAT viewer): no licence field. Not needed.

### 3.3 data.gov.il general licence (applies to every `other-open` dataset)

https://data.gov.il/terms-of-use: last updated **30/08/2025**, originally 01/01/2018 (seen 2026-10-19).
- **Grant:** "worldwide, royalty-free, non-exclusive licence to use the information"; "for commercial and non-commercial purposes"; you may copy, distribute and make derivative works.
- **Attribution:** "you must indicate the source". There is an **exemption** for derived data that does not preserve the original selection and arrangement.
- **Forbidden:**
  - misleading presentation, distortion, or harming the name of the rights holder;
  - breaking the law;
  - **infringing privacy, including by cross-referencing with other sources**;
  - implying access to identified personal information.
- **Excluded from the grant:** personal data (as defined in the Privacy Protection Law, 1981), state emblems and agency names, third-party rights, and non-copyright IP.
- **Precedence:** a dataset-specific licence prevails. Licence changes apply from posting, and your use is governed by the version in force when you retrieved the data.
- Governing law is Israeli, with Jerusalem courts.
- **Relevance:** the privacy cross-referencing clause is one more reason to keep the brief's privacy safeguards (no owner names, no Tabu joins, opt-out) even when the inputs are open data.

The portal's licence vocabulary (https://data.gov.il/api/3/action/license_list) includes `odc-odbl`. **Check `license_id` on every dataset before use.** An ODbL-tagged government dataset would bring the share-alike problem back.

### 3.4 Industrial zones

- **Ministry of Economy "רשימת אזורי תעשייה"** (`industrial-zones-info`): other-open, CSV, auto-updated "times in day" (resource last modified 2026-10-18).
  - It has only **31 records** (national-priority zones administered by the Industrial Zones Administration). Each has a `geom` field, available/occupied space and **named contact persons with phones and emails**.
  - **None is in the pilot area**: no Emek Hefer, Netanya or Kadima.
  - Use it only as a name lookup in the periphery. Do not republish the contact fields: they are personal data and excluded from the licence.
  - https://data.gov.il/api/3/action/package_show?id=industrial-zones-info and https://data.gov.il/api/3/action/datastore_search?resource_id=30af8da4-7586-4b00-ac88-c5ee75251632 (seen 2026-10-19).
- **Ministry of Environmental Protection "אזורי תעשייה הנדרשים בביצוע סקר קרקע"** (`industrialareas`): SHP polygons of former and active industrial areas, suspected contamination, tank farms, etc. (2019 resource). **No licence and `isopen: false`.** Do not use without permission. https://data.gov.il/api/3/action/package_show?id=industrialareas.
- **Better national source:** XPLAN codes 200–260 / 1050 / 1630. The plan names (`pl_name`) usually contain "אזה"ת …", which doubles as a zone name for the label (section 5).

### 3.5 CBS (הלמ"ס) statistical areas and localities

- **Layer:** "Statistical Areas 2011 with demographic data", editions 2017–2020 (catalogue 50502ז–50502י), ZIP / file geodatabase. I found no 2022 statistical areas and no localities polygon layer on this page. https://www.cbs.gov.il/he/Pages/geo-layers.aspx (seen 2026-10-19).
- **Licence:** CBS End-User License v2.1 (2016-01-03). https://www.cbs.gov.il/en/Pages/Enduser-license.aspx (seen 2026-10-19).
  - Commercial use and derivatives are **allowed**.
  - Attribution format: "The Central Bureau of Statistics (CBS)" + product name + access date + link, noting the data was copied and distributed as is. There is the same exemption for extracts that do not preserve the selection and arrangement.
  - It **prohibits combining data with other sources to identify individuals, businesses or organisations.**
- **Recommendation:** do **not** attach CBS data to individual roofs in Phase 1. We would gain little (a label), and the clause is close to what an owner-targeting layer does. Use CBS only for aggregate statistics pages, if at all.
- **Population Authority "רשימת ישובים בישראל"** (`citiesandsettelments`): other-open, CSV/XML, weekly. Names and codes, no geometry. Useful for normalising the locality names that come from XPLAN. https://data.gov.il/api/3/action/package_show?id=citiesandsettelments (seen 2026-10-19).
- **Municipal jurisdiction boundaries (גבולות שיפוט):** I found **no open dataset** on data.gov.il. The Ministry of Interior maintains them, and their absence from the portal is **UNVERIFIED**. XPLAN layer 1 carries `jurstiction_area_name` per plan, which is enough for a label.

### 3.6 Israel Land Authority (רמ"י) and Ministry of Agriculture

- **ILA:** I found no ILA datasets on data.gov.il (search returned 0; the organisation id may be wrong, **UNVERIFIED**). ILA data is about ownership and leases, which is exactly what the privacy analysis says not to join. **Exclude** it.
- **Ministry of Agriculture:** it holds a geographic plot database of about 4 M dunam with crop type **and cultivator identity**, refreshed only every few years. Two 2021 RFIs on remote-sensing updates describe it. https://mr.gov.il/ilgstorefront/he/p/attachment/005056BF65EB1EDC9090A33EE4E6C12F/מסמכי הליך (seen via search 2026-10-19). It is not public and contains personal data. **Exclude** it. I found no open greenhouse registry.

### 3.7 Satellite-derived, licence-clean screens (greenhouses / residential)

- **Global-PCG-10** (plastic-covered greenhouses, 10 m, reference year 2020, Sentinel-2).
  - **CC BY 4.0**, figshare DOI 10.6084/m9.figshare.27731148, v2 published 2024-11-14, 4 files, 326 MB. https://api.figshare.com/v2/articles/27731148 (seen 2026-10-19).
  - Paper: Niu et al., ESSD 17, 5065–5088, 2025. Reported PCG producer's accuracy 85.1%, user's accuracy 99.8%. https://essd.copernicus.org/articles/17/5065/2025/.
  - **Israel coverage UNVERIFIED.** The global grid covers 245 5°×5° cells; check its grid index.
  - Caveat: it maps *plastic-covered* houses. Net houses and glasshouses may be missed.
  - Use: if the share of footprint pixels classified PCG exceeds about 50%, set an "exclude / review" flag.
- **Own Sentinel-2 index.** Copernicus Sentinel data is free for reproduction, distribution and adaptation. The required notice for modified data is "Contains modified Copernicus Sentinel data [Year]". Legal basis: Reg. (EU) 377/2014 and Delegated Reg. 1159/2013. Mirror: https://ads.atmosphere.copernicus.eu/licences/ec-sentinel (seen via search 2026-10-19). Whatever we compute ourselves is ours.
- **GHSL GHS-BUILT-S R2023A 10 m.** Band `built_surface_nres` flags non-residential built-up cells (epoch 2018). The terms say "Reuse is authorised, provided the source is acknowledged" (EC reuse notice). Citation: Pesaresi & Politis 2023, doi:10.2905/9F06F36F-4B11-47EC-ABB0-4F8B7B1D72EA. https://developers.google.com/earth-engine/datasets/catalog/JRC_GHSL_P2023A_GHS_BUILT_S_10m (seen 2026-10-19). Its accuracy for Israeli moshav farm buildings is **UNVERIFIED**, so treat it as a secondary signal only.

---

## 4. Existing solar installations

**Bottom line: I found no open, per-building or per-coordinate PV registry for Israel.** Phase 1 has to rely on its own reviewer labels.

| Source | What it is | Granularity | Licence / access | Use in Phase 1 |
|---|---|---|---|---|
| **Electricity Authority BI** ("עולם האנרגיות המתחדשות – מערכת BI") https://www.gov.il/he/pages/bipua2024 | Dashboard of connected renewable facilities and distributor answers, filterable by technology, size, connection date, facility type and "geographic area". Monthly update (Davar, 2024-02-19: https://www.davar1.co.il/490769/). A search snippet lists downloadable "csv מתקני ייצור מחוברים (06.2026)". | Finest geographic level **UNVERIFIED** | gov.il blocks automated download (HTTP 403 from WebFetch and from the local machine), so this needs a **manual download**. gov.il content terms **UNVERIFIED**. | Optional context only: PV penetration per regional council. If the CSV has per-facility rows with small household systems, treat them as potentially personal data. |
| **Ministry of Energy local-authority solar realisation index** | Per local authority: rooftop potential and % realised (small dual-use systems ≤ 700 kW). National realisation 19% → 23%. Published 2024-12-17, data to end-2023. https://www.ice.co.il/local-news/news/article/1042815 | Local authority | Download / licence **UNVERIFIED** | Context ("in Emek Hefer X% of potential is realised"), aggregate only |
| **Ministry of Energy + Survey of Israel rooftop solar calculator on GovMap** | Launched **2025-02-04**. Per building: roof area, usable area, kW, sun hours, kWh/yr, ₪/yr. Planned: a high-resolution layer of roof obstructions and a local-authority dashboard. https://www.maariv.co.il/news/israel/article-1169853 | Per building | GovMap = proprietary, no download/API mentioned. **Do not copy.** | Not a data source. It shows the state already publishes per-building potential, so we can link owners to it. It is also a competitor. |
| **Noga** | Aggregate system data; a one-off 2021 study of potential generation sites vs substations. https://www.noga-iso.co.il/media/4tihlhq2/פוטנציאל-ייצור-מסמך-להפצה-28-11-2021.pdf | Not per building | — | No |
| **Global Renewables Watch** (Microsoft/Planet) | Detects *commercial PV farms* and wind turbines, 2017-Q4 to 2024-Q2 (86,410 PV installations globally) | Utility scale, not rooftop | Repo licence reported as MIT by a third party, **UNVERIFIED**. https://github.com/microsoft/global-renewables-watch | No (rooftops not covered) |
| **OSM `generator:source=solar`** | 12 features in the pilot | — | ODbL | No |

**Recommendation.**
1. Store a reviewer label per roof: `pv_status ∈ {none, partial, full, unclear}`, plus `reviewed_at` and `imagery_source` / date. It is our own data.
2. In the claim flow, ask the owner to confirm the PV status.
3. Show "existing PV per review dated …" on the card.
4. Revisit the Electricity Authority CSV after a manual look at its columns.

**Licence flag for the imagery work:** if reviewers **trace or redraw outlines** on Esri imagery, the result may count as "derivation" under ArcGIS terms (see `imagery-costs.md`). In Phase 1, reviewers should only accept, reject or flag Microsoft outlines, or split them using non-Esri imagery, until that is cleared.

---

## 5. Address / reverse geocoding

### 5.1 Options checked

- **Google Geocoding API.**
  - Policies page, "Last updated 2026-10-16 UTC" (https://developers.google.com/maps/documentation/geocoding/policies, seen 2026-10-19):
    - "Content pre-fetching, caching, or storage is generally restricted, with the exception of place IDs, which can be stored indefinitely".
    - "**Geocoding API results displayed on a map must be shown on a Google Map**", with attribution required when shown without a map.
  - The Service Specific Terms (https://cloud.google.com/maps-platform/terms/maps-service-terms) were too long to fetch. The 30-day lat/lng caching allowance I remember from earlier versions is **UNVERIFIED** for the current text.
  - Pricing: Geocoding Essentials SKU, 10,000 free events/month, then **$5.00 per 1,000** (https://developers.google.com/maps/billing-and-pricing/pricing, updated 2026-10-16).
  - **Verdict: incompatible.** We would store the address permanently in Supabase and show it on a Leaflet / non-Google basemap.
- **Nominatim (public OSMF instance).**
  - Usage policy: at most 1 request/s; bulk work discouraged (scripts running more than a day or at regular intervals: 4 requests/min); "Results must be cached on your side". **Systematic queries such as reverse-geocoding grids get you banned**, as does reselling. https://operations.osmfoundation.org/policies/nominatim/ (seen 2026-10-19).
  - The data is ODbL. The OSMF Geocoding Guideline says individual results don't trigger share-alike, and collections of names/addresses/lat-lng are not substantial **unless** they are "a systematic attempt to aggregate all or substantially all Primary Features" of a type in a city-sized or larger area. https://osmfoundation.org/wiki/Licence/Community_Guidelines/Geocoding_-_Guideline (seen 2026-10-19).
  - Reverse-geocoding every large roof in Israel is arguably exactly that. **Verdict: avoid** (ODbL attribution at minimum, share-alike risk at worst). Self-hosting Nominatim fixes the rate limit but not the licence.
- **Mapbox Permanent Geocoding.** $5.00 per 1,000 with no free tier; "Permanently store forward and reverse search results", but results are for own use and may not be distributed or sublicensed. Whether showing results publicly on a map counts as distribution is **UNVERIFIED**, as is Mapbox's Israeli address quality. https://www.mapbox.com/pricing (seen 2026-10-19).
- **Esri / ArcGIS Location Platform.** Geocoding not stored: 20k free, then $0.50 per 1k. **Stored: $4 per 1k.** https://location.arcgis.com/pricing/ (seen 2026-10-19). Whether stored geocodes may be shown outside ArcGIS apps, and Israeli address coverage, are **UNVERIFIED**. The ArcGIS display/derivation rules from the imagery research probably apply.
- **Israeli government.** I found **no open geocoded address-point dataset** on data.gov.il (absence **UNVERIFIED**). GovMap / Survey of Israel addresses are proprietary (see the brief). The Population Authority locality list is open but has no geometry (section 3.5).

### 5.2 Licence implications of *storing* addresses

Storing third-party geocoder output in our DB is where each licence bites:
- Google: generally forbidden except place IDs.
- Nominatim/OSM: an ODbL database question.
- Mapbox / Esri: a paid "stored" tier, with redistribution limits.

Storing an exact address against a single-owner building also makes the record more clearly "information about an identifiable person" under Amendment 13.

### 5.3 Recommendation for Phase 1

1. **Public layer: no street address.**
   - Show a **zone label** built from XPLAN layer 1 (CC BY) at the roof centroid:
     - `jurstiction_area_name` (e.g. "עמק חפר");
     - plus `plan_county_name` from the **smallest approved** plan, where it names a locality (e.g. "עין החורש");
     - plus a zone name parsed from `pl_name` (e.g. "אזה"ת עמק חפר").
   - Pilot test, 4 Tier A roofs on 2026-10-19: every point returned jurisdiction "עמק חפר"; one returned the locality "עין החורש"; two returned plans named "אזה"ת עמק חפר".
   - Caveat: a regional thematic plan reports one locality ("חופית") for the whole council. Prefer the smallest approved plan, and fall back to jurisdiction only.
   - Show coordinates rounded to about 100 m in the public API, if any are exposed at all.
2. **Exact address only from the owner** in the claim flow, stored as first-party data under our privacy notice. It stays non-public until the owner publishes a listing.
3. If ops ever needs an internal address for outreach, use an on-demand, non-stored lookup by a staff member. Do not run a bulk reverse-geocode. **Get legal review** first (privacy and database registration, per the brief).

---

## 6. Phase 1 pipeline: data steps and where the licences sit

1. **Fetch Microsoft** release 2026-08-13 for the 15 quadkeys, with a manifest (section 2.1). Clip to the service area using a Natural Earth or geoBoundaries outline.
2. **Geometry filters.** These are all Results from Microsoft Data, so there are no extra obligations:
   - area ≥ 1,000 m² (pilot `MIN_AREA`);
   - drop sliver or elongated shapes (pilot `elongation`);
   - de-duplicate overlaps (the pilot audit, `audit/diagnostics.json` D2, found 65 overlapping pairs ≥ 10 m² in the audited published set; MS-only footprints also overlap each other).
3. **XPLAN point query** per candidate, run from Israel at ≤ 2 req/s with cached results. Store: approved code, latest in-process code, plan number/status, query time.
4. **Optional screens**: Global-PCG-10 share and GHSL NRES share per footprint, as internal flags.
5. **Tiering** (no OSM):
   - **A:** approved or in-process code in {200–260, 1050/1502/1630, 300} and clean geometry.
   - **B:** code 400s, or 660 with no greenhouse flag.
   - **C:** everything else, which stays unpublished.
   - Every A/B roof still goes through **human review** before it appears (as the pilot concluded).
6. **Review labels:** keep / reject (greenhouse, residential, wrong outline, military / sensitive) and `pv_status`.
7. **Publish** polygon + Results + zone label + review date. Attach the licence notices (section 7).

All inputs are free (€0 / $0). The only infrastructure detail with a licence or geo angle is running step 3 from an Israeli IP.

---

## 7. Attribution and notice text (ready to paste)

On the map attribution control (short form):
> מבנים: Microsoft (CDLA‑Permissive‑2.0) · ייעודי קרקע: מינהל התכנון – XPLAN (CC BY) · PVGIS © האיחוד האירופי · [basemap attribution per imagery decision]

On a `/data-sources` page, and in any GeoJSON / API response (`"license"` field + link):
- **Building footprints:** "Microsoft Global ML Building Footprints, release 2026‑08‑13, licensed under the Community Data License Agreement – Permissive, Version 2.0." Include the **full licence text** on the page and in any downloadable export (CDLA‑P‑2.0 §2.1). Note that the polygons were filtered, de-duplicated and reviewed by SolGag. Area / capacity / yield figures are SolGag's own computations (Results, §3.1).
- **Land-use class and zone labels:** "מבוסס על נתוני XPLAN של מינהל התכנון, ברישיון Creative Commons ייחוס (CC BY). הסיווג הוא עיבוד של סולגג ואינו מהווה מידע תכנוני מחייב." Add a link to the licence. It is "indicate changes" plus a disclaimer, and doubles as protection against the data.gov.il "misleading presentation" clause.
- **If used:**
  - "Global‑PCG‑10 (Niu et al., 2025), CC BY 4.0"
  - "Contains modified Copernicus Sentinel data 2026"
  - "GHSL – Pesaresi & Politis 2023, © European Union / JRC"
  - "מקור: <משרד>, data.gov.il" (for any other-open dataset)
  - "מקור: רשות החשמל" (aggregates)
- **PVGIS:** "PVGIS © European Union, 2001–2026". Exact wording **UNVERIFIED**: the JRC download page asks for acknowledgement (https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/pvgis-data-download_en, seen via search 2026-10-19), and the API terms were not checked.
- **No ODbL attribution should be needed** once OSM is out of the publish path. That is the test: if "© OpenStreetMap contributors" is ever needed on the potential-roofs layer, something ODbL has leaked in. The basemap is a separate layer, separately attributed.

Compatibility: CDLA‑P‑2.0, CC BY, the EC reuse notice and the data.gov.il licence are all permissive, attribution-only and non-share-alike, so they can be combined. None of them conflicts with an ArcGIS "no ODbL" restriction.

---

## 8. Open questions / to verify before launch

1. **XPLAN national coverage.** Repeat the 60-point approved-vs-any-status sample in 3–4 regions. Decide whether in-process designations are acceptable for tiering.
2. **XPLAN licence version and bulk querying.** Is CC BY 4.0 intended? Is automated point-querying at about 2 req/s acceptable? Ask `it-tichnun@iplan.gov.il`.
3. **Where the pipeline runs.** XPLAN appears to be geo-restricted to Israeli IPs. Confirm, and decide between the local machine and an Israeli cloud region.
4. **Microsoft partitions** for the Golan Heights and seam-line areas: Israel vs Syria vs WestBank rows. Which service-area outline do we clip with?
5. **Global-PCG-10 Israel coverage and accuracy.** Check the grid index (needs a 326 MB download, so ask before downloading).
6. **Electricity Authority BI CSV.** Download manually and inspect columns (locality? coordinates? capacity?) and the terms. Decide whether locality-level PV penetration is worth showing.
7. **gov.il content terms**, for the Electricity Authority and Ministry of Energy pages, which could not be fetched.
8. **Google Maps Platform Service Specific Terms**, the current Geocoding caching clause (only relevant if Google is ever reconsidered).
9. **Mapbox / Esri stored-geocode terms** for public display outside their maps. Only relevant if internal addresses are ever needed.
10. **Legal review** (as the brief says) of: CDLA-P-2.0 notice placement; CC BY adaptation notice; the data.gov.il and CBS privacy cross-referencing clauses as applied to an owner-targeting layer.

---

## 9. Sources (all seen 2026-10-19 unless noted)

- Microsoft repo README: https://github.com/microsoft/GlobalMLBuildingFootprints · raw: https://raw.githubusercontent.com/microsoft/GlobalMLBuildingFootprints/main/README.md
- LICENSE history: https://api.github.com/repos/microsoft/GlobalMLBuildingFootprints/commits?path=LICENSE · change commit: https://api.github.com/repos/microsoft/GlobalMLBuildingFootprints/commits/ef94ee3dfb5da3bd2c9dd9c36815eff66fa0b66d
- Wayback availability: https://archive.org/wayback/available?url=github.com/microsoft/GlobalMLBuildingFootprints/blob/main/LICENSE&timestamp=20260601 (→ 20260429192723) and `…&timestamp=20260101` (→ 20251130224610)
- CDLA-Permissive-2.0: https://cdla.dev/permissive-2-0/
- MS index (HEAD + range reads): https://bfppub.blob.core.windows.net/%24web/2026-08-13/dataset-links.csv
- Google Open Buildings: https://sites.research.google/gr/open-buildings/ · https://sites.research.google/gr/open-buildings/temporal/
- Overture attribution: https://docs.overturemaps.org/attribution/
- GlobalBuildingAtlas: https://huggingface.co/datasets/vitrobot/GBA.LoD1/blob/main/README.md (via search)
- OSMF guidelines: https://osmfoundation.org/wiki/Licence/Community_Guidelines/Collective_Database_Guideline_Guideline · https://osmfoundation.org/wiki/Licence/Community_Guidelines/Substantial_-_Guideline · https://osmfoundation.org/wiki/Licence/Community_Guidelines/Geocoding_-_Guideline
- Nominatim policy: https://operations.osmfoundation.org/policies/nominatim/
- data.gov.il terms: https://data.gov.il/terms-of-use · about: https://data.gov.il/about · licences: https://data.gov.il/api/3/action/license_list
- XPLAN record: https://data.gov.il/api/3/action/package_show?id=xplan · iplan datasets: https://data.gov.il/api/3/action/organization_show?id=iplan&include_datasets=true
- XPLAN service (local machine): https://ags.iplan.gov.il/arcgisiplan/rest/services/PlanningPublic/Xplan/MapServer?f=pjson, `/4?f=pjson`, `/1?f=pjson`, `/4/query` (count / statistics / point queries)
- gov.il XPLAN service page (403; via search snippet): https://www.gov.il/he/service/searching-plans-submitted-planning-institutes-in-xplan-site
- Industrial zones (MoE): https://data.gov.il/api/3/action/package_show?id=industrial-zones-info · MoEP industrial areas: https://data.gov.il/api/3/action/package_show?id=industrialareas
- Localities list: https://data.gov.il/api/3/action/package_show?id=citiesandsettelments
- CBS geo layers: https://www.cbs.gov.il/he/Pages/geo-layers.aspx · CBS licence: https://www.cbs.gov.il/en/Pages/Enduser-license.aspx
- Ministry of Agriculture RFI (plot DB): https://mr.gov.il/ilgstorefront/he/p/attachment/005056BF65EB1EDC9090A33EE4E6C12F/מסמכי הליך (via search)
- Global-PCG-10: https://essd.copernicus.org/articles/17/5065/2025/ · https://api.figshare.com/v2/articles/27731148
- GHSL 10 m: https://developers.google.com/earth-engine/datasets/catalog/JRC_GHSL_P2023A_GHS_BUILT_S_10m
- Copernicus Sentinel licence (mirror): https://ads.atmosphere.copernicus.eu/licences/ec-sentinel (via search)
- Electricity Authority BI: https://www.gov.il/he/pages/bipua2024 (403; via search snippet) · Davar 2024-02-19: https://www.davar1.co.il/490769/
- MoE local-authority index (2024-12-17): https://www.ice.co.il/local-news/news/article/1042815
- MoE/MAPI GovMap calculator (2025-02-04): https://www.maariv.co.il/news/israel/article-1169853
- Noga 2021 study: https://www.noga-iso.co.il/media/4tihlhq2/פוטנציאל-ייצור-מסמך-להפצה-28-11-2021.pdf (via search)
- Global Renewables Watch: https://arxiv.org/abs/2503.14860 · https://github.com/microsoft/global-renewables-watch (licence via third party)
- Google Geocoding policies: https://developers.google.com/maps/documentation/geocoding/policies · pricing: https://developers.google.com/maps/billing-and-pricing/pricing · service terms (not fetched): https://cloud.google.com/maps-platform/terms/maps-service-terms
- Mapbox pricing: https://www.mapbox.com/pricing · Esri pricing: https://location.arcgis.com/pricing/
- PVGIS data reuse: https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/pvgis-data-download_en (via search)
