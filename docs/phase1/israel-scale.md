# Potential roofs, Phase 1: how many roofs Israel-wide, and how much review that takes

Author: scale agent, 2026-10-19. Data: `research/israel-scale/summary.json`, produced by `research/israel-scale/count.mjs`.
Raw tiles: `research/israel-scale/raw/` (git-ignored, 146.4 MB gzipped). They were kept because the brief only asks to delete them above 1 GB.

## TL;DR

| Quantity | Value |
|---|---|
| Microsoft ML footprints, Location "Israel" (release 2026-02-03) | **1,442,217** buildings, 391 km² of roof |
| Footprints ≥ 500 m² | 137,195 (9.5% of all), 196 km² |
| Footprints ≥ 1,000 m² | **53,350** (3.70% of all footprints; 38.9% of the ≥500 m² ones), **139.0 km²** (35.5% of all roof area) |
| What "Israel" covers | The **1949 armistice lines**, including the Mount Scopus enclave. It **excludes** East Jerusalem, the West Bank, the Golan Heights and Gaza, each of which is a separate Location in the index. |
| Roofs needing human review, Tier A only (scaled from the pilot) | **~5,500** (range 2,800–8,300) → **15 h at 10 s/roof** (8–31 h at 5–20 s) |
| Tier A + B | ~10,900 (5,500–16,400) → 30 h at 10 s |
| All filtered candidates (A+B+C) | ~23,100 (11,500–34,600) → 64 h at 10 s |
| Every roof ≥ 1,000 m², no land-use filter (upper bound) | ~57,700 → 160 h at 10 s |
| Expected publishable opportunities (bare + partial PV) | Tier A **~2,800** (700–6,200; ~2,300 bare only). A+B ~3,800. A+B+C ~4,450. |
| Their capacity, central estimate | Tier A ~745 MWp DC; A+B ~1.0 GWp; A+B+C ~1.2 GWp |
| Imagery tiles to review Tier A | 0.13–0.53 M tile loads. That fits inside ArcGIS Location Platform's 2 M free tiles; without the free tier it would be about $80. |

Bottom line: a national Tier A review is a small job, about **2–3 person-days for a single pass at 10 s/roof**, or about 9–13 person-days with double review and outline fixes. Imagery cost for the review is negligible. What limits Phase 1 is whether the imagery licence allows this kind of QA, plus the land-use filter for the agricultural south. Review time is not the limit.

---

## 1. Data source

- **Index:** `https://minedbuildings.z5.web.core.windows.net/global-buildings/dataset-links.csv`. It is 7.2 MB, `Last-Modified: Wed, 25 Feb 2026 23:01:46 GMT`, and every Israel URL points into `/global-buildings/2026-02-03/` with upload date 2026-02-23 (seen 2026-10-19). The index is now 7 MB, not "1 GB+" as the pilot script comment says, but the range-request binary search still works.
- **Israel rows:** **15** quadkey tiles at zoom 9. The size labels add up to 139.6 MiB, and the downloaded files total 146.4 MB (146,406,298 bytes), so the labels are MiB. The brief expected "~600 MB". That roughly matches the *uncompressed* size: the pilot tile is 40.3 MiB gzipped and 167.7 MB unzipped, about 4.15×, so the country is about 580 MB unzipped. Only gzipped files were stored. The script streams them through gunzip.
- **Separate index Locations next to Israel** (metadata only, not downloaded):

| Location | Tiles | gz size | Estimated footprints (gz size × Israel's footprints per byte) |
|---|---|---|---|
| WestBank | 6 | 65.0 MiB | ~670,000 |
| GazaStrip | 3 | 22.4 MiB | ~230,000 |
| GolanHeights | 3 | 0.8 MiB | ~8,000 |
| GolanHeightsSubdistrict | 3 | 1.7 MiB | ~18,000 |

  The meaning of "GolanHeights" vs "GolanHeightsSubdistrict" is not documented (UNVERIFIED). That East Jerusalem sits inside "WestBank" is an inference: it is absent from "Israel", but I did not download the WestBank tiles to check.
- **Newer release exists.** The README update log says hosting moved to `bfppub.blob.core.windows.net` on 2026-07-24, and the global dataset was refreshed on 2026-08-13 ("Refreshed the global dataset from the current source of truth"; 1,945 of 30,340 tiles updated).
  - Its index `https://bfppub.blob.core.windows.net/%24web/2026-08-13/dataset-links.csv` (Last-Modified 2026-08-13, seen 2026-10-19) has the **same 15 Israel quadkeys**, with a size-label total only **+0.36%** larger (three tiles grew by 0.1–0.2 MiB).
  - I kept the old release because it is identical to what the pilot used: tile 122112223 has exactly 408,837 footprints, matching `audit/recompute-core.json`. That keeps the calibration exact. National counts would move by well under 1%.
  - **The production pipeline should read the new host.** Per the README, the old host will not receive updates.
- **Licence:** "This data is licensed by Microsoft under the CDLA Permissive 2.0" (README, seen 2026-10-19). The brief's statement that the repo LICENSE changed on 2026-03-11 was not re-checked here.
- **Feature properties:** `height` and `confidence`, with −1 as the placeholder (README).
  - Among the ≥1,000 m² footprints, 46,979 carry a confidence value (mean 0.966; only 311 below 0.8) and 6,371 have −1.
  - Confidence is therefore not a useful filter.
  - README accuracy table for the "Middle East" (evaluation of 7,000 buildings, early 2022): precision 95.7%, recall 85.4%, IoU 65.1%. These are building-level metrics. They say nothing about whether a roof is a usable *bare roof*.

## 2. Method (`research/israel-scale/count.mjs`)

1. Binary-search the sorted index with HTTP `Range` requests (same approach as `research/pilot-emek-hefer/fetch-ms.mjs`) and collect every row whose Location is exactly `Israel`. Then stream-download the 15 tiles, three in parallel, and check each file's byte length against `Content-Length`.
2. Stream each tile through `zlib.createGunzip()` and `readline`, then `JSON.parse` each line. For each footprint:
   - **area:** `@turf/area`, the same function as the pilot;
   - **centroid:** the pilot's area-weighted centroid;
   - **size class:** <500, 500–1,000, 1,000–2,500, 2,500–5,000, 5,000–10,000, 10,000+ m²;
   - **tallies:** overall, per quadkey, per latitude band (north >32.5°N, centre 31.7–32.5°N, south <31.7°N) and per 0.5° of latitude.
3. **Quality checks:**
   - geometry types: all 1,442,217 are `Polygon`; 0 parse errors;
   - deduplication of every footprint ≥500 m² on (centroid to 1e-6°, rounded area): **0 duplicates**;
   - 5,751 centroids fall just outside their file's quadkey. This is ordinary edge assignment, and nothing was double-counted.
4. **Green Line check:**
   - 28 probe boxes of ±0.008° (about ±0.9 km): 6 controls inside Israel, 1 on the Mount Scopus enclave, and 21 beyond the line (East Jerusalem, West Bank settlements and their industrial zones, Palestinian cities, Golan, Gaza);
   - plus coarse hand-drawn outlines of the West Bank, Golan and Gaza (see §4).
5. **Pilot calibration:** count the same Microsoft data inside the pilot box (centroid in 32.30–32.42°N, 34.85–35.00°E) and read the pilot's 992 candidates (`research/pilot-emek-hefer/data/candidates.geojson`) to get tier counts per size class.
6. **National scaling.** For two scenarios, also compute imagery tile loads and a storage estimate. Section 5 has the formulas.

Re-run with `node research/israel-scale/count.mjs` from the repo root. It takes about 16 s once the tiles are on disk, or about 3 minutes including the download.

## 3. Results: national size distribution

### 3.1 Overall (Location "Israel")

| Size class | Footprints | Roof area (km²) | Mean area (m²) |
|---|---|---|---|
| < 500 m² | 1,305,022 | 194.69 | 149 |
| 500–1,000 | 83,845 | 57.45 | 685 |
| 1,000–2,500 | 38,512 | 57.40 | 1,490 |
| 2,500–5,000 | 9,415 | 32.27 | 3,427 |
| 5,000–10,000 | 4,062 | 28.53 | 7,024 |
| 10,000+ | 1,361 | 20.76 | 15,255 |
| **≥ 500** | **137,195** | 196.41 | 1,432 |
| **≥ 1,000** | **53,350** | **138.96** | 2,605 |
| All | 1,442,217 | 391.10 | 271 |

- Share of footprints that are ≥1,000 m²: **3.70%**. Among footprints ≥500 m², the share is 38.9%. By area, ≥1,000 m² roofs hold **35.5%** of all mapped roof area.
- Taken at face value, ≥1,000 m² × 0.65 usable ÷ 6.5 m²/kWp gives 13.9 GWp DC. That is a meaningless upper bound: it includes greenhouses, PV-covered roofs, merged outlines and residential blocks.
- Dropping the Phase 1 threshold to 500 m² would mean **2.57× as many** roofs (137,195 vs 53,350). The pilot did not calibrate below 1,000 m², so the scenarios below do not model that case.

### 3.2 Per quadkey (zoom 9)

| Quadkey | Tile bounds | All | 500–1k | 1–2.5k | 2.5–5k | 5–10k | 10k+ | ≥1k | ≥1k km² | ≥1k share |
|---|---|---|---|---|---|---|---|---|---|---|
| 122112212 | 33.14–33.72N, 35.16–35.86E | 13,550 | 493 | 266 | 65 | 20 | 7 | 358 | 0.85 | 2.6% |
| 122112221 | 32.55–33.14N, 34.45–35.16E | 135,052 | 8,902 | 3,509 | 749 | 254 | 87 | 4,599 | 10.70 | 3.4% |
| 122112223 (pilot tile) | 31.95–32.55N, 34.45–35.16E | 408,837 | 30,473 | 13,959 | 2,794 | 856 | 193 | 17,802 | 38.71 | 4.4% |
| 122112230 | 32.55–33.14N, 35.16–35.86E | 306,480 | 11,811 | 4,593 | 1,104 | 380 | 80 | 6,157 | 14.34 | 2.0% |
| 122112232 | 31.95–32.55N, 35.16–35.86E | 24,403 | 1,170 | 687 | 190 | 55 | 15 | 947 | 2.26 | 3.9% |
| 122130000 | 31.35–31.95N, 33.75–34.45E | 849 | 19 | 18 | 2 | 1 | 0 | 21 | 0.04 | 2.5% |
| 122130001 | 31.35–31.95N, 34.45–35.16E | 279,468 | 17,301 | 9,176 | 2,404 | 984 | 327 | 12,891 | 33.59 | 4.6% |
| 122130002 | 30.75–31.35N, 33.75–34.45E | 15,715 | 821 | 967 | 689 | 444 | 210 | 2,310 | 10.57 | **14.7%** |
| 122130003 | 30.75–31.35N, 34.45–35.16E | 192,059 | 7,032 | 2,887 | 620 | 213 | 71 | 3,791 | 9.00 | 2.0% |
| 122130010 | 31.35–31.95N, 35.16–35.86E | 21,210 | 2,700 | 1,052 | 201 | 49 | 8 | 1,310 | 2.64 | 6.2% |
| 122130012 | 30.75–31.35N, 35.16–35.86E | 19,231 | 1,248 | 476 | 276 | 331 | 101 | 1,184 | 5.84 | 6.2% |
| 122130021 | 30.15–30.75N, 34.45–35.16E | 4,999 | 227 | 92 | 41 | 52 | 36 | 221 | 1.32 | 4.4% |
| 122130023 | 29.54–30.15N, 34.45–35.16E | 13,540 | 1,138 | 551 | 103 | 39 | 22 | 715 | 1.71 | 5.3% |
| 122130030 | 30.15–30.75N, 35.16–35.86E | 6,260 | 474 | 261 | 169 | 375 | 203 | 1,008 | 7.26 | **16.1%** |
| 122130201 | 28.92–29.54N, 34.45–35.16E | 564 | 36 | 18 | 8 | 9 | 1 | 36 | 0.12 | 6.4% |

Two southern tiles stand out:
- **122130002**, the western Negev / Eshkol / Halutza sands west of 34.45°E;
- **122130030**, the central Arava.

In both, 15–16% of all footprints are ≥1,000 m², against 2–5% elsewhere, and they hold 413 of the 1,361 roofs over 10,000 m². Of the ten largest footprints in the country:
- eight are in the western Negev at 34.39–34.47°E (seven in tile 122130002, one in 122130003);
- one is in the Arava (30.37°N 35.13°E);
- one is at 31.71°N 34.83°E.

The largest is 105,778 m² at 31.2455°N 34.4433°E. These are almost certainly **greenhouse / net-house complexes**. That is an inference from the location and shape statistics; I did not check imagery. It matches the pilot finding that Microsoft-only roofs in farm areas were 11/12 greenhouses.

### 3.3 Geographic split (≥1,000 m²)

| Band | All footprints | ≥1k | ≥1k km² | 10k+ | ≥1k share of all | ≥1k share of ≥500 |
|---|---|---|---|---|---|---|
| North (>32.5°N) | 501,907 | 12,078 (23%) | 27.95 | 187 | 2.4% | 34.5% |
| Centre (31.7–32.5°N) | 571,530 | 26,659 (50%) | 59.71 | 343 | 4.7% | 37.9% |
| South (<31.7°N) | 368,780 | 14,613 (27%) | 51.31 | **831** | 4.0% | 45.8% |

Per 0.5° of latitude (≥1,000 m²):

| Band | Footprints |
|---|---|
| 33.0–33.5°N | 1,385 |
| 32.5–33.0 | 10,693 |
| 32.0–32.5 | 16,324 |
| 31.5–32.0 | 13,924 |
| 31.0–31.5 | 7,558 |
| 30.5–31.0 | 2,308 |
| 30.0–30.5 | 492 |
| 29.5–30.0 | 665 |

For comparison, the pilot box alone holds 2,294 of the 53,350 (4.3%) on about 0.9% of Israel's area. Assuming about 20,770 km² within the 1949 lines (a commonly cited figure, UNVERIFIED here), that is 12.2 large roofs per km² in the pilot against about 2.6 per km² nationally. The pilot is roughly 5× denser than the national average.

## 4. Green Line / coverage check

- **Bounding box of all "Israel" centroids:** 29.491–33.286°N, 34.268–35.682°E. The eastern edge, 35.682°E, is the Hula valley / Dan area. Katzrin (35.69°E, 32.99°N) is not included.
- **Probe boxes** (`greenLineCheck.probes`):
  - **All 6 controls are populated:** Tel Aviv 2,288 footprints, Haifa Bay 643, Be'er Sheva 2,276, Eilat 1,986, Kiryat Shmona 1,858, West Jerusalem 1,344.
  - **20 of the 21 probes beyond the line contain 0 footprints:**
    - East Jerusalem: Beit Hanina, Pisgat Ze'ev, the Atarot industrial zone, Gilo, Silwan;
    - West Bank settlements: Ariel, the Barkan industrial zone, Ma'ale Adumim, the Mishor Adumim industrial zone, Modi'in Illit, Beitar Illit, Kiryat Arba;
    - Palestinian cities: Ramallah, Nablus, Hebron, Jenin;
    - Golan: Katzrin, Majdal Shams;
    - Gaza: Gaza City, Khan Yunis.
  - The 21st probe, the Old City / Sheikh Jarrah box (35.227–35.243°E), has only 19 footprints, against roughly a thousand in a populated box. They sit on its two edges: West Jerusalem right at the line (about 35.227°E) and the Mount Scopus enclave at its north-eastern corner (up to 35.243°E). None are in the Old City itself.
  - A probe on **Mount Scopus**, the pre-1967 Israeli enclave, holds 565 footprints.
  - A direct listing of central Jerusalem found West Jerusalem footprints ending at about 35.227–35.229°E, which is the line along the Old City wall. A separate cluster sits at 35.239–35.251°E, 31.784–31.801°N: the Hebrew University / Hadassah Mount Scopus enclave.
- **Coarse outlines:** these put 46,013 "Israel" footprints inside my West Bank outline, 1,881 inside the Golan one and 2,373 inside the Gaza one. Gridding them (`outlineHitsTopCells`) shows they are Israeli towns along the line that the ±1–2 km outline catches: Rosh HaAyin / Kafr Qasim, Umm al-Fahm / Wadi Ara, Taibe / Tira, Modi'in, Gilboa, the Jerusalem corridor, Hula / Dan, Nahal Oz. They are not evidence of beyond-the-line data.

**Conclusion.** In this dataset, Location "Israel" is Israel within the 1949 armistice lines, including the Mount Scopus enclave. It excludes East Jerusalem (including the Atarot industrial zone), every West Bank settlement and its industrial zones, the Golan Heights and Gaza. Including any of those in Phase 1 would mean adding the separate WestBank / Golan Locations, which have different land-registration regimes. That is a product and legal decision, not a data question.

**Coverage completeness was not verified.** The README says Microsoft drops imagery tiles that are older than 2014 or have low detection probability, which "results in squares of missing data". I did not download the coverage GeoJSON. The pilot box itself was well covered: 43,124 Microsoft footprints vs 18,123 OSM buildings.

## 5. National Phase 1 workload

### 5.1 Calibration (pilot box, the same Microsoft data)

| | Pilot | Ratio per Microsoft footprint ≥1,000 m² |
|---|---|---|
| Microsoft footprints ≥1,000 m², centroid in the pilot box | **2,294** measured now (audit: 2,293 ellipsoid / 2,294 sphere) | 1 |
| OSM ∪ MS roofs ≥1,000 m² ("raw large roofs") | 2,482 | 1.082 |
| After residential / greenhouse / military exclusion (A+B+C) | 992 | 0.432 |
| Tier A | 238 | **0.1037** |
| Tier B | 231 | 0.1007 |
| Tier C | 523 | 0.2280 |

Tier rates by size class (pilot tier count ÷ pilot Microsoft count):

| Size class | Pilot MS | A | B | C |
|---|---|---|---|---|
| 1,000–2,500 | 1,428 | 10.6% | 11.6% | 18.6% |
| 2,500–5,000 | 505 | 11.7% | 10.3% | 29.1% |
| 5,000–10,000 | 288 | 7.3% | 2.4% | 26.7% |
| 10,000+ | 73 | 8.2% | 8.2% | 46.6% |

The candidates' tier assignment uses the OSM outline when both sources agree, so the size classes match only approximately.

The precision of 42% bare roofs + 8% partial PV comes from a sample of only 12 Tier A roofs. Wilson 95% intervals: **bare 19–68%**, **bare + partial 25–75%**. Tier B and C precision was **not measured**. I assumed:
- Tier B: 20% (10–30%);
- Tier C: 5% (2–10%), since Microsoft-only roofs in farm areas were 11/12 greenhouses;
- the land-use-excluded set: 2% (0–5%).

### 5.2 Scaling formula

- National count for tier *t* = 53,350 × (pilot count for *t* / 2,294). This is the "flat" estimate, used as the central value.
- Cross-check: Σ over size classes of (national count in class × pilot tier rate in that class). This "size-stratified" estimate differs by only 1–5%.
- Range: ×0.5 to ×1.5. This is a **judgement**, not a statistical interval. The pilot is a single 188 km² area in the Sharon. The national land-use mix and OSM land-use coverage differ, especially in the agricultural south (§3.2).
- Review hours = roofs × seconds ÷ 3600, for a single pass. Person-days use 6 productive hours per day.
- Publishable = Σ roofs in tier × tier precision. The low end uses the low count with low precision; the high end uses the high count with high precision.
- MWp = publishable × mean pilot candidate area for the tier (A 2,693, B 2,393, C 3,818 m²) × 0.65 ÷ 6.5. Partial-PV roofs are counted in full, so this is optimistic.

### 5.3 Scenarios

| Scenario | Roofs to review, central (stratified; range) | 5 s/roof | 10 s/roof | 20 s/roof | Double review at 10 s | Outline fixes (25% × 60–120 s) | Publishable, central (range) | Publishable per review-hour at 10 s | MWp DC, central |
|---|---|---|---|---|---|---|---|---|---|
| **A: Tier A only** | **5,535** (5,607; 2,768–8,303) | 7.7 h | **15.4 h** (2.6 person-days) | 30.8 h | 30.8 h | 23–46 h | **2,768** (703–6,194); bare only 2,306 | **180** | ~745 |
| **AB: Tier A + B** | 10,907 (11,264; 5,454–16,361) | 15.1 h | 30.3 h (5.0 person-days) | 60.6 h | 60.6 h | 45–91 h | 3,842 (972–8,611) | 127 | ~1,000 |
| **ABC: all filtered candidates** | 23,070 (22,872; 11,535–34,605) | 32.0 h | 64.1 h (10.7 person-days) | 128.2 h | 128.2 h | 96–192 h | 4,450 (1,093–10,436) | 69 | ~1,235 |
| Unfiltered: every ≥1,000 m² roof | 57,722 (includes about 4,400 (8%) OSM-only roofs at the pilot rate) | 80.2 h | 160.3 h (26.7 person-days) | 320.7 h | 320.7 h | 240–481 h | 5,143 (1,093–13,035) | 32 | ~1,500 |

Marginal yield at 10 s/roof:
- Tier A: about **180 publishable roofs per review-hour**;
- adding Tier B: +1,074 publishable for 14.9 extra hours, about **72/h**;
- adding Tier C: +608 for 33.8 extra hours, about **18/h**;
- reviewing the land-use-excluded remainder: about **7/h** (+693 for 96 h).

A Tier A–first Phase 1 is the clear choice. Tier B can be a second wave. Tier C and the unfiltered set are not worth reviewing manually without a better automatic filter.

As a cross-check against the pilot, 238 × 0.42–0.50 gives 100–119 opportunities, which matches the "~100–120" found there.

### 5.4 Where the Tier A work falls (flat ratio per band)

| Band | MS ≥1k | Tier A | A+B | A+B+C |
|---|---|---|---|---|
| North | 12,078 | 1,253 | 2,469 | 5,223 |
| Centre | 26,659 | 2,766 | 5,450 | 11,528 |
| South | 14,613 | 1,516 | 2,988 | 6,319 |

The southern figure is the least reliable. Its many very large agricultural footprints (§3.2) are likely to fail Tier A, because they lack a strong industrial/commercial/farmyard zone, or to need greenhouse exclusion. The true southern Tier A share is probably lower and Tier C plus excluded higher (UNVERIFIED). A good Phase 1 sequence is to run the pipeline on the **centre** first, where it most resembles the pilot, then the north, then the south, re-measuring precision at each step.

### 5.5 Imagery tile loads and cost (review only, one-off)

**Assumptions:**
- 256-px raster tiles;
- one full-screen view (~1280×720 px) is about 24 tile loads; a close-up plus a context zoom is about 48;
- a 4×3 grid UI like `qa.html` uses about 6–9 tiles per roof, so these figures are conservative.

**Pricing:** ArcGIS Location Platform says "2M free then $0.15 per 1,000 tiles" for basemap tiles. Billing "is determined by the number of tile requests to" `basemaps-api`, `ibasemaps-api` and `static-map-tiles-api` (https://location.arcgis.com/pricing/, seen 2026-10-19).
- The page does not say whether the 2 M free allowance resets monthly. Its cost estimator is labelled "Estimated monthly cost" (UNVERIFIED that it is monthly).
- It does not name imagery explicitly. `ibasemaps-api` is the imagery-basemap host (UNVERIFIED that imagery is billed at the same rate).

| Scenario | 1 view, 1 pass | 2 views, 1 pass | 2 views, 2 reviewers | USD at $0.15/1k with 2 M free (no free tier) |
|---|---|---|---|---|
| A | 132,840 | 265,680 | 531,360 | $0 ($80) |
| AB | 261,768 | 523,536 | 1,047,072 | $0 ($157) |
| ABC | 553,680 | 1,107,360 | 2,214,720 | $32 ($332) |
| Unfiltered | 1,385,328 | 2,770,656 | 5,541,312 | $531 ($831) |

So the review imagery costs **tens of dollars at most**. What matters is the licence:
- the brief notes that whether human visual QA in your own app counts as permitted ArcGIS "visualization" is UNCERTAIN;
- the pilot's keyless Esri World Imagery is not licensed for commercial use.

The public layer's own tile cost depends on visitor traffic and is outside this note. The imagery-licensing note covers it.

### 5.6 Storage sizing (Supabase)

- **Geometry size:** footprints ≥1,000 m² average 15.5 vertices, or 763 bytes per GeoJSON line.
- **Full ≥1,000 m² set:** all 53,350 is about 41 MB as GeoJSON text. As PostGIS geometry it is roughly 15–20 MB plus indexes (estimate).
- **Filtered sets:** Tier A–C (~23k) is about 7–10 MB, and Tier A alone about 2–3 MB.
- **Plan headroom:** both fit easily in the Free plan's "500 MB database size per project", and the Pro plan includes "8 GB disk size per project" from $25/month (https://supabase.com/pricing, seen 2026-10-19). Storing all ≥1,000 m² candidates plus review state needs no plan change by itself.

## 6. Caveats

1. **Pilot transfer is the dominant uncertainty.** All tier and precision ratios come from one 188 km² Sharon/Emek Hefer box, with only 12 roofs sampled for Tier A precision. Nationally, the mix differs:
   - Haifa Bay, Ashdod, Ashkelon, Kiryat Gat, Be'er Sheva and Dimona/Rotem are heavier industry;
   - the Negev and Arava have greenhouse/net-house complexes;
   - the Galilee and Jezreel have many poultry houses and cowsheds.

   OSM land-use completeness, which drives the A/B/C split, also varies by region. The ×0.5–×1.5 band is a judgement.
2. **The tiers can only be computed with OSM data.** Tier A requires both OSM and Microsoft footprints plus OSM land use. Running the real national pipeline needs a Geofabrik Israel extract, not public Overpass. It also carries the ODbL questions in the brief: using OSM land use to select published Microsoft roofs is a grey zone. A Microsoft-only pipeline, with no OSM, cannot reproduce Tier A. It would need its own classifier and its own precision measurement.
3. **The 12-roof Tier A sample is small.** Bare + partial could be anywhere from 25% to 75%. The first national review batch should double as a larger precision study: for example, 200 roofs stratified by region and size class, with two reviewers. That narrows the interval to about ±7 points.
4. **Tier B and C precision are assumptions** (20% and 5%), not measurements.
5. **Existing PV and imagery age.** Microsoft footprints come from imagery dated 2014–2024 (README). Rooftop PV has grown fast in Israel. The Heschel Center / KKL-JNF Jezreel Valley study reports that only "about a quarter" of the agricultural and industrial roof potential is used, and more than a third of that only partly (https://heschel.org.il/en/news/the-potential-of-energy-periphery/, seen 2026-10-19; publication date not stated). The precision of a roof being *bare* therefore depends on reviewing **current** imagery. The vintage of the licensed imagery chosen matters more than the footprint vintage.
6. **Merged and wrong outlines.** About 1 in 4 Tier A outlines were wrong in the pilot. The 10,000+ m² class is especially prone to merged blocks and greenhouse ranges. If wrong outlines are *fixed* rather than rejected, add 23–46 h for Tier A (60–120 s per fix, an assumption). Tracing outlines over licensed imagery may itself count as "derivation" under the imagery terms. See the imagery note.
7. **The review times exclude overhead:** login, UI latency, disagreements and spot checks. 5 s/roof is realistic only with a pre-loaded grid and keyboard shortcuts. 20 s/roof is realistic when partial PV and outline correctness must both be judged.
8. **Area and capacity.** Footprint area is the planimetric outline, with no tilt, setbacks or shading. The usable ratio of 0.65 and 6.5 m²/kWp are the app's assumptions. MWp numbers are indicative only.
9. **Scope.** The figures exclude East Jerusalem, the West Bank, the Golan and Gaza (§4). Israel's "potential roofs" outside the 1949 lines, such as the Katzrin, Barkan, Mishor Adumim and Atarot industrial zones, are not in these counts.
10. **Dataset version.** These counts use the 2026-02-03 release. The 2026-08-13 release has about 0.4% more data for Israel.

## 7. Recommendations for Phase 1 (scale-related)

- **Scope Phase 1 to Tier A, nationally, in about 5,500 roofs.** Batch by region in this order: centre → north → south. A single reviewer pass at about 10 s/roof takes roughly 15 h of screen time. Budget about 2 person-weeks including double review of accepted roofs, outline fixes and a 200-roof precision study.
- **Expect about 2,300–2,800 publishable roofs nationally, and plan for 700–6,000.** The public layer, claim flow and outreach should be sized for a few thousand records, not tens of thousands.
- **Add an automatic greenhouse filter before Tier C or the south enter the queue.** Candidates: MS-only in farmland → exclude; elongation or area caps for 10,000+ m² in agricultural tiles; OSM `landuse=greenhouse_horticulture` and `building=greenhouse`; an optional spectral or brightness check on licensed imagery if the licence allows it. Tier C at about 18 publishable roofs per review-hour is not worth manual review as it stands.
- **Switch the pipeline to the new Microsoft host** (`bfppub.blob.core.windows.net`, release 2026-08-13 or later) and keep the binary-search approach. The index is 6–7 MB now and could simply be downloaded whole.
- **Review cost is not a reason to choose one licensed imagery provider over another.** At under 0.6 M tiles for Tier A, the deciding factors are the licence terms for QA/derivation, imagery recency, and resolution good enough to see PV.
- **Store all 53k ≥1,000 m² footprints with review status** (unreviewed / bare / partial / full-PV / wrong / greenhouse / residential) in Postgres, even if only Tier A is reviewed. It is about 20 MB, and it lets later waves and opt-out requests key on stable IDs.

## 8. Open questions

- Will Phase 1 cover only Israel within the 1949 lines (the current data), or also the Golan or East Jerusalem industrial zones? Those come from different Locations, under different legal regimes.
- Is double review of every Tier A roof required, or only of accepted roofs? Reviewing only accepted roofs adds about 50% instead of 100%.
- Will wrong outlines be fixed, which needs drawing over imagery and raises a licence issue, or rejected? Rejecting costs about 25% of Tier A yield.
- Which licensed imagery will be used for QA, and when was it captured? This decides both whether QA is allowed and how accurately existing PV is detected.
- Does OSM land-use coverage in the Negev and Arava mark greenhouses well enough for the pilot's exclusion rule to work there? UNVERIFIED; answering it needs the Geofabrik extract.
- The Ministry of Energy and the Israel Mapping Center launched a public rooftop-solar potential calculator on GovMap that covers commercial, industrial and agricultural buildings (pv-magazine, 2025-02-06, https://www.pv-magazine.com/?p=39910, seen 2026-10-19). Whether it shows per-building results publicly is UNVERIFIED. It is a likely reference point, and possibly a competitor, for owners claiming their roofs.

## 9. Sources (all seen 2026-10-19)

- Microsoft Global ML Building Footprints index, release 2026-02-03: https://minedbuildings.z5.web.core.windows.net/global-buildings/dataset-links.csv (Last-Modified 2026-02-25)
- The same dataset, release 2026-08-13 (index metadata only): https://bfppub.blob.core.windows.net/%24web/2026-08-13/dataset-links.csv (Last-Modified 2026-08-13)
- README: licence (CDLA Permissive 2.0), update log (hosting move 2026-07-24; refresh 2026-08-13), properties, accuracy, coverage gaps: https://github.com/microsoft/GlobalMLBuildingFootprints and https://raw.githubusercontent.com/microsoft/GlobalMLBuildingFootprints/main/README.md
- ArcGIS Location Platform pricing: https://location.arcgis.com/pricing/
- Supabase pricing: https://supabase.com/pricing
- Heschel Center, Jezreel Valley rooftop study: https://heschel.org.il/en/news/the-potential-of-energy-periphery/
- pv-magazine, Israel rooftop solar tool (2025-02-06): https://www.pv-magazine.com/?p=39910
- Pilot inputs: `research/pilot-emek-hefer/data/stats.json`, `data/candidates.geojson`, `audit/recompute-core.json`, `index.html` (Tier A review text)
