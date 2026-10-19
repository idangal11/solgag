# Phase 1: imagery licensing and costs

*Potential-roofs feature. Research date 2026-10-19. Every price, licence term and legal claim below has a source URL, and all sources were seen on 2026-10-19 unless another date is given. Anything I could not confirm from a primary source is marked **UNVERIFIED**. All prices are USD and exclude VAT unless stated. This is not legal advice: the licence readings below are an engineer's reading of the texts, for counsel to confirm.*

---

## 0. Summary

**Recommendation in one table**

| Use | Recommended now | Monthly / one-off cost | Why |
|---|---|---|---|
| **U1 public basemap** (street + aerial on the explore map, listing pages, publish wizard, new potential-roof pages) | **MapTiler Flex** for the street map + **Esri ArcGIS Location Platform (ALP) World Imagery** for the aerial layer | 10k views/mo: **~$30**. 100k: **~$105** ($68–143). 1M: **~$2,655** ($1.9k–3.4k), *before* the optimisations in §5.4 | Esri gives the best imagery available over Israel through a tile API (0.46–0.5 m Vantor Vivid, 2023–2025 captures), already the look the site has today, with 2M free tiles/month. MapTiler streets are already planned in `docs/DEPLOY.md` and work with the current 256 px Leaflet config. |
| **U2 internal human review** (bare / greenhouse / PV / wrong outline / residential) | **Buy recent Airbus Pléiades Neo 30 cm archive imagery** under the *Standard + Background Layer* licence, limited to candidate areas, self-hosted as XYZ tiles in the admin review screen. Send an RFQ to Ofek (Israeli aerial) in parallel. | Pilot Tier A+B (~87 km²): **~$1.7k–2.0k one-off**. All pilot candidates (~138 km²): **~$2.6k–3.1k**. National: **~$2.6k–4.2k per 1,000 candidates**, plus a periodic refresh | It is the only route I found that is both clearly licensed and gives recent imagery. The licence is perpetual, internal processing is allowed, derivative works such as our labels may be distributed, and the imagery may be shown to site visitors as a background layer. Every tile API forbids or does not clearly allow turning imagery into data. |
| U2 no-cost interim | Review inside **ArcGIS Online** (Map Viewer / Field Maps) on World Imagery. Esri's *Uses Permitted* document explicitly allows data collection and editing in ArcGIS apps. | 1–2 Creator/Professional user licences, **~$0.7k–1.4k per user per year (UNVERIFIED)** | Legally the cleanest free-imagery path. The imagery is 2023–2025, so recent PV will be missed. |
| **U3 ML (Phase 2)** | Only imagery we **own a licence to** (Airbus, Planet, or Ofek with an ML clause). **Never** tile-API imagery. | Same purchased imagery as U2. ML rights must be confirmed in the full EULA. | MapTiler, Mapbox, Google, Esri ALP, Stadia and Azure all forbid machine processing or derivation, or allow visualization only. |

**Facts that drive the decision**

1. **Tile APIs allow display, not data-making.** MapTiler §4.3, Mapbox §1.5–1.6, Google's Map Tiles policy, Esri ALP §3.1.d.3/6, Stadia §30.1 and Azure/Bing all forbid deriving data from their imagery or restrict it to visualization (§4). Whether a human typing a label while looking at imagery in our own admin app counts as "visualization" remains **UNCERTAIN** for Esri ALP, and is effectively **not allowed** for Google ("object detection or identification") and Mapbox ("derive … information").
2. **Kyl–Bingaman cap.** US-licensed satellite operators (Vantor/Maxar, Planet) may not disseminate imagery of Israel finer than **0.4 m GSD**. This covers new and archived data ([Federal Register 85 FR 44059, 21 Jul 2020](https://www.govinfo.gov/content/pkg/FR-2020-07-21/pdf/2020-15770.pdf)). Vantor "15 cm / 30 cm" products are therefore not available over Israel at those resolutions. Sub-0.4 m imagery means **Airbus Pléiades Neo (30 cm, French)** or **Israeli aerial photography**.
3. **Resolution is enough; recency is not.** The pilot's blind photo review (33/36 agreement) used Esri World Imagery at `maxNativeZoom: 18` (`research/pilot-emek-hefer/qa.html`, `index.html`), so ~0.5 m was sufficient to classify roofs. The problem is age. At the pilot centre the Esri capture is **2023-10-21**, and "existing PV very common" means PV installed after 2023 would be labelled "bare". This is the main reason to buy recent imagery for U2.
4. **The site must move off keyless tiles before launch.** `src/lib/config.ts` falls back to `tile.openstreetmap.org` and `server.arcgisonline.com/…/World_Imagery` when the env vars are unset.

---

## 1. Use cases and current state of the app

| | What it needs | Volume driver |
|---|---|---|
| **U1** Public basemap | XYZ raster tiles for Leaflet (`src/components/map/mapParts.tsx`: 256 px `TileLayer`, `maxNativeZoom 19`, `maxZoom 20`). Street map by default on `/explore` (`ExploreMap.tsx`: `<BaseLayers />`). **Aerial by default** on listing pages (`ListingMapView.tsx`) and in the publish wizard (`DrawMap.tsx`: `defaultAerial`). New potential-roof detail pages will probably also default to aerial. Commercial use, Hebrew labels. | Map views per month × tiles per view |
| **U2** Internal review | ≤0.5 m imagery, **recent** (PV changes yearly), shown under each candidate outline in an admin screen. The licence must allow (a) a human creating labels, (b) storing those labels, and (c) using them to decide what we publish commercially. | km² of candidate areas, about 0.14–0.19 km² per candidate (§6.1) |
| **U3** ML (Phase 2) | Pixel access (chips/COGs), batch processing, model training and inference, and storage of outputs. | km² × refresh frequency |

**How I counted map views.** The brief says to assume 15–25 tile requests (256 px) per map view, and I used **20** as the midpoint with 15 and 25 as the range. MapTiler's own docs say a 256 px raster view generates "10-16 requests" ([MapTiler pricing](https://www.maptiler.com/cloud/pricing/)), so 20 is conservative. I assumed **50% of tiles are aerial**: explore defaults to street, while listing, publish and potential-roof pages default to aerial. Stadia's satellite credit cost per 256 px tile is my assumption (§4.6).

---

## 2. Comparison table

U1 = public display in our commercial site. U2 = human review that produces stored labels used commercially. U3 = ML training or inference. ✅ allowed · ⚠️ grey zone or needs a written exception · ❌ not allowed.

| Provider / product | Israel coverage, resolution, recency | U1 | U2 | U3 | Price (official, 2026-10-19) | Leaflet XYZ |
|---|---|---|---|---|---|---|
| **MapTiler Cloud**: `streets-v2`, `satellite` (`satellite-v2`) | Satellite: "Middle East" listed at **~1 m/px**. Satellite imagery is 2021–2022, aerial up to 2026 in selected countries ([docs](https://docs.maptiler.com/schema-raster/satellite/)). Israel-specific: **UNVERIFIED**. | ✅ (Flex or Custom; Free is non-commercial) | ⚠️/❌ §4.3: "may not produce commercial derivative works", except via a custom licence | ❌ §4.3 explicitly covers "training of machine learning algorithms for feature extraction" | Free $0 (non-commercial, 100k req). **Flex $30/mo**: 500k requests, then **$0.15/1k**; 25k sessions, then $2.50/1k. **Custom** = prepaid quote. A 256 px raster tile = 1 request; 512 px = 4 ([pricing](https://www.maptiler.com/cloud/pricing/), [plans](https://www.maptiler.com/cloud/plans)) | ✅ `api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=` |
| **Esri ALP**: World Imagery (+ street styles) | **Vantor Vivid, WorldView-2, 0.46–0.5 m.** Pilot centre 34.92/32.36: Vivid Standard 0.5 m, **2023-10-21**, to z18. Tel Aviv: 0.5 m, 2023-11-06. Haifa Bay: Vivid Advanced 0.46 m, **2025-02-28**, to z19 ([identify query](https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/identify?geometry=34.92,32.36&geometryType=esriGeometryPoint&sr=4326&layers=all&tolerance=2&mapExtent=34.85,32.30,35.0,32.42&imageDisplay=1200,1000,96&returnGeometry=false&f=json)) | ✅ revenue-generating apps allowed with authentication (E300 fn 89; ALP Agreement §3.1.c.1) | ⚠️ in a custom app: §3.1.d.3 "only … for visualization purposes". ✅ inside ArcGIS apps (Uses Permitted document) | ❌ §3.1.d.6 no scrape, download or extract; E300 fn 10 bars programmatic tile export; fn 96 bars batch classification and deep learning on Image services | **2M basemap tiles/month free, then $0.15/1k tiles.** Or sessions: 1k free, then $4/1k. Support $2,500/yr optional ([pricing](https://location.arcgis.com/pricing/)) | ✅ `ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=` (256 px). Static basemap tiles are 512 px. |
| **ArcGIS Online** (Creator / Professional user type) | Same World Imagery | n/a (internal) | ✅ "may be used in various ArcGIS applications to support data collection and editing" | ❌ (fn 96) | Per user per year. **Price not shown on the official page.** ~$845/yr (Equator Studios) or ~US$1,400 (Esri Colombia quote, Oct 2025): **UNVERIFIED** | n/a |
| **Mapbox**: Raster Tiles API (`mapbox.satellite`) | **UNVERIFIED** for Israel. Vantor-sourced imagery is capped at 0.4 m. | ⚠️ Product Terms §1.2.3: production use for **real estate** or BI/analytics apps needs a separately purchased **commercial licence** | ❌ §1.6 "shall not trace or otherwise derive or extract … information". Tracing satellite is allowed only for non-commercial use or OSM. | ❌ §1.5(ii) no ML or AI training or operation | Raster tiles: 750k free, then $0.25/1k (to 2M), $0.20 (to 4M), $0.15 (to 20M) ([pricing](https://www.mapbox.com/pricing)) | ✅ |
| **Google Map Tiles API**: 2D satellite | **UNVERIFIED** | ✅ but must not be used "with or near a non-Google map", so both layers must be Google | ❌ "You may not use Map Tiles API for any non-visualization use cases, such as … Object detection or identification" | ❌ "Image analysis", "Machine interpretation" | 2D tiles: 100k free, then $0.60/1k (to 1M), $0.48 (1–5M), $0.36 (5–10M), $0.18 (10–50M) ([pricing](https://developers.google.com/maps/billing-and-pricing/pricing)) | ✅ (session token + key) |
| **Azure Maps**: `microsoft.imagery` | **UNVERIFIED** | ✅ | ❌ (Bing terms: no derivatives; Microsoft moderator: "prohibits … tracing the rooftop equipment"). Current Azure Product Terms text: **UNVERIFIED** | ❌ (same) | 1 transaction = **15 tiles**. Imagery: 1k transactions free, base map: 5k free, then **$4.50 per 1k transactions** (= $0.30 per 1k tiles) ([Azure retail price API](https://prices.azure.com/api/retail/prices?$filter=serviceName%20eq%20%27Azure%20Maps%27%20and%20armRegionName%20eq%20%27Global%27)) | ✅ |
| **Stadia Maps**: street styles + Alidade Satellite | Airbus/CNES/PlanetObserver imagery: "1.5m or better" everywhere, 30 cm on 37M km², 50 cm on 7M km². **Israel not listed: UNVERIFIED.** Imagery-only layer max **z18** | ✅ (paid plans; satellite on Standard and above) | ❌ §30.1 imagery for "visualization" only, no processing | ❌ | Starter $20 (1M credits), **Standard $80 (7.5M)**, Professional $250 (25M). Overage $0.03 / $0.02 / $0.015 per 1k credits. Raster tile = 1 credit; satellite imagery = 4 credits per 512 px tile ([pricing](https://stadiamaps.com/pricing/)) | ✅ `tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.jpg` |
| **Thunderforest** (street only) | OSM-based | ✅ paid plans (Hobby commercial status **UNVERIFIED**) | n/a | n/a | Solo $125/mo (1.5M tiles), Small Business $255 (15M), Large $525 (150M). Overage not listed ([pricing](https://www.thunderforest.com/pricing/)) | ✅ |
| **Jawg** (street only) | OSM-based | ✅ paid plans | n/a | n/a | Professional **€250/mo** (100k map views; 1 view = 15 raster tiles), Enterprise €500 (500k views), above that a quote ([pricing](https://www.jawg.io/en/pricing/)) | ✅ |
| **Vantor (ex-Maxar)**: archive, Vivid Mosaic | WorldView 15/30/50 cm, but **≤0.4 m over Israel** (Kyl–Bingaman). Esri's Israel imagery is this product. | via a licence | ⚠️ Internal Use licence, derivative terms **UNVERIFIED** (vantor.com licence page did not render) | ⚠️ some Maxar licences forbid ML ("train machine learning algorithms for feature extraction or any other purpose") | Reseller indicative prices, June 2026: 50 cm archive **$14/km²**, 30 cm $19, Vivid Mosaic 30 cm **$12/km²**, min 1 km² ([SkyWatch Vantor](https://skywatch.com/geospatial-data-providers/vantor/)). No official price list. | self-host |
| **Airbus**: Pléiades Neo 30 cm, Pléiades 50 cm, OneAtlas Basemap | Pléiades Neo **30 cm native**, not subject to the US cap. Archive and tasking. Israel archive availability **UNVERIFIED** (check in a catalogue). | ✅ with **Background Layer** licence: may be shown "into your interactive online map" to customers | ✅ Standard licence: internal processing, "Create value added product … and derivative work", "Distribute any derivative work" | ✅ probably (internal processing). An explicit ML clause is **UNVERIFIED**. | Reseller "Very High-Res 30–49 cm" from **$19/km² archive**, $29 tasking, 1 km² min ([SkyWatch](https://skywatch.com/data)). Land Info lists Pléiades Neo at **$22.50/km² archive** (search snippet only, **UNVERIFIED**). OneAtlas Basemap price: quote only ([Airbus](https://space-solutions.airbus.com/imagery/reference-layers/basemap)). | self-host |
| **Planet**: SkySat 50 cm, PlanetScope 3 m, Basemaps | SkySat 50 cm (US-licensed, so ≤0.4 m cap, not binding at 50 cm). PlanetScope 3 m is too coarse for roofs. | ❌ for commercial sites without an upgrade ("display … for noncommercial purposes") | ✅ "create a Derivative Product without restriction" | ✅ not prohibited in the EULA (2016 revision) | SkySat archive **$10/km²**, tasking $12, 25 km² min (reseller, [SkyWatch](https://skywatch.com/data)). Planet's own pricing is not published. | self-host (internal) |
| **Nearmap** | **Does not cover Israel** (US, Australia, NZ only) ([coverage](https://www.nearmap.com/coverage)) | – | – | – | – | – |
| **Ofek Aerial Photography (אופק צילומי אוויר)** | Sells "national orthophotos", oblique, DSM/DTM, satellite, and **national energy-potential, shade and 3D-building layers** ([ofek-air.com](https://www.ofek-air.com/)). Resolution and year **UNVERIFIED**. | ? (RFQ) | ? (RFQ) | ? (RFQ) | **No public prices.** The shop sells area-based one-off downloads, "payment is a one-time fee with no subscription", delivered within 2 business days ([shop](https://shop.ofekonline.com/)) | self-host or WMS |
| **Kav Medida (קו מדידה)** | Orthophotos "up to 5 mm per pixel" (drone/aerial, project-based), delivered as GeoTIFF/ECW or **WMS/WMTS** ([page](https://www.kav-medida.co.il/accurate-orthophoto-maps-en)) | ? | ? | ? | No public prices | WMTS |
| **Survey of Israel / GovMap** | From the orchestrator brief, not re-researched: proprietary, commercial agreement plus royalties, Israeli servers only, nothing finer than 0.5 m orthophoto online. Impractical for Phase 1. | – | – | – | – | – |

---

## 3. Cross-cutting rules

1. **Kyl–Bingaman (US law).** "This license condition now prohibits the dissemination of satellite imagery over Israel at a resolution finer than 0.4 m GSD; this condition does not distinguish between new and archived data" ([85 FR 44059, 21 Jul 2020](https://www.govinfo.gov/content/pkg/FR-2020-07-21/pdf/2020-15770.pdf)). I found no later notice changing the 0.4 m figure. This applies to Vantor and Planet, and indirectly to every basemap that resells Vantor imagery (Esri, MapTiler, Mapbox, Google, Azure). It does not apply to Airbus (non-US) or to aerial photography.
2. **Combining with open-data (ODbL) layers.** Esri ALP Agreement §3.1.a.4 forbids combining ALP output "in a manner that would subject" it to "open-database use or license terms" ([E204, Nov 21 2025](https://www.esri.com/content/dam/esrisites/en-us/media/legal/platform/platform-legal.pdf)). Mapbox §1.13 has the same rule. Showing an OSM-based street layer or our own layer next to or over Esri imagery does not, on my reading, put the imagery under ODbL, because ODbL share-alike covers databases and not the produced image underneath. Creating an ODbL database **from** Esri imagery would be a problem. **Counsel to confirm.**
3. **Caching.** Esri allows "pre-caching … as permitted by the caching headers" only (§3.1.d.6.A). Mapbox allows on-device caching for 30 days (§2.8.1). Google allows nothing beyond `Cache-Control`. Stadia allows no server-side caching (§8(5)). **Do not proxy or cache tile-API imagery in a CDN, Supabase or R2.** Purchased Airbus/Planet imagery may be stored and tiled ourselves.
4. **Flow-down terms.** ALP requires our own end-user terms to make users comply (§3.1.c.5), and Esri may review them (§12.6). Mapbox and Airbus also require attribution and cascading of terms. → Add an imagery clause to `/terms` and list providers on `/privacy`. `src/app/privacy/page.tsx` already maps `*.arcgis.com` hosts to "Esri".

---

## 4. Provider notes

### 4.1 MapTiler Cloud
- **Plans (official page).** Free, **Flex $30/mo**, Custom. Pro and Business tiers no longer appear on the official page. A third-party listing dated June 2026 still shows "Flex $25" and an "Unlimited $295" tier ([frontdeskreview](https://frontdeskreview.com/software/maps-api/maptiler/)), so the official page has changed and the official figures are used here. Flex includes 25k sessions, 500k API requests and 10 GB storage. Overage is $2.50/1k sessions and **$0.15/1k requests**, billed at period end, and a spending limit can be set. Only Custom allows reselling; Custom has soft limits and a 99.9% SLA ([pricing](https://www.maptiler.com/cloud/pricing/), [plans](https://www.maptiler.com/cloud/plans)).
- **Free tier** is "Suitable for testing, PoC, prototyping, personal, or non-commercial use", so SolGag needs Flex from launch.
- **Counting.** A 256 px rendered raster tile is 1 request; a 512 px tile is 4; a "single tile served from .mbtiles" is 1 ([docs](https://docs.maptiler.com/guides/maps-apis/maps-platform/tile-requests-and-map-sessions-compared)). Sessions are only available with the MapTiler SDK, so Leaflet raster uses request billing.
- **Terms** ([maptiler.com/terms](https://www.maptiler.com/terms/), undated):
  - §4.3: "you may not produce commercial derivative works from MapTiler Services. This includes … the training of machine learning algorithms for feature extraction … The production of derivative vector datasets for non-commercial purposes or for OpenStreetMap is permitted."
  - §4.4 forbids modifying "vectors, pixels or underlying metadata".
  - §4.9 allows a custom licence exception.
  - §13.4: satellite content requires an export-control representation.
  - → **U1 only.** U2 labels that feed a commercial layer are a "commercial derivative work" on a plain reading.
- **Imagery.** satellite-v2 runs z0–22. It is 2 m globally, 5–50 cm in Western Europe and the USA, and **1 m in "densely populated regions (e.g. … the Middle East …)"**. Satellite imagery dates from 2021–2022 ([docs](https://docs.maptiler.com/schema-raster/satellite/)). Visual QA over Israel is needed. It is likely coarser than Esri's 0.5 m (**UNVERIFIED**).

### 4.2 Esri: ArcGIS Location Platform (ALP) and ArcGIS Online
- **Pricing** ([location.arcgis.com/pricing](https://location.arcgis.com/pricing/)):
  - Basemap tiles (vector, map, static): **2M free per month, then $0.15 per 1,000 tiles**.
  - Basemap sessions: 1k free, then $4 per 1,000.
  - Geocodes (not stored): 20k free, then $0.50/1k.
  - Technical support: $2,500/yr.
  - The session model was added in Oct 2025 ([Esri blog](https://www.esri.com/arcgis-blog/products/platform/announcements/basemap-sessions)).
- **Leaflet integration.** The World Imagery image-tile service is at `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=` (256 px, same `{z}/{y}/{x}` order as today), per the [Esri MapLibre sample](https://developers.arcgis.com/maplibre-gl-js/maps/display-multiple-basemap-layers) and [Cesium docs](https://cesium.com/learn/cesiumjs/ref-doc/ArcGisMapServerImageryProvider.html). Switching is an **env-var change only** (`NEXT_PUBLIC_IMAGERY_TILE_URL`) plus attribution. Static Basemap Tiles are **512 px**, styles include `arcgis/imagery-labels`, and they need the `premium:user:staticbasemaptiles` privilege ([docs](https://developers.arcgis.com/documentation/mapping-and-location-services/mapping/basemaps/introduction-static-basemap-tiles-service/)). Whether a plain `arcgis/imagery` static style without labels exists, and whether a 512 px tile bills as 1 tile, are both **UNVERIFIED**. If both hold, aerial billable tiles drop by about 4×.
- **ALP Agreement E204 (revised Nov 21, 2025)** ([PDF](https://www.esri.com/content/dam/esrisites/en-us/media/legal/platform/platform-legal.pdf)):
  - §3.1.c.1 allows "revenue-generating Customer Applications". The "Customer Application(s)" definition requires "substantial and independent functionality", which SolGag meets.
  - §3.1.d.2: "Resultant Output from a single request to serve a single Application User" (no shared caching).
  - **§3.1.d.3: "only use Resultant Output for visualization purposes and only within Customer Applications."**
  - **§3.1.d.6: may not "scrape, download, or extract Resultant Output, nor cache or store"** except as the caching headers allow.
  - §3.1.a.4: no combining in a way that subjects output to open-database terms.
  - §3.1.d.4: attribution required.
- **Product-Specific Terms E300 (Nov 13, 2025)** ([PDF](https://www.esri.com/content/dam/esrisites/en-us/media/legal/product-specific-terms-of-use/e300.pdf)). ALP footnotes are 5, 10, 16, 66, 78, 82, 89, 90, 97, 103 and 109.
  - fn 10: "Programmatic use of session tokens (e.g., exporting volumes of basemap tiles) is not permitted."
  - fn 89: revenue-generating apps "are required to use Authentication".
  - fn 90: only one production subscription per organization.
  - fn 96 (ArcGIS Online): "Programmatic use of the ArcGIS Image services (e.g., batch classification, deep learning …) [is] not permitted."
- **World Imagery "Data Collection and Editing Uses Permitted"** ([PDF, item 8e90a00a…](https://www.arcgis.com/sharing/rest/content/items/8e90a00a0a6845a49262e0b756f57a10/data), metadata dated 2024-01-22):
  - It permits use "in various ArcGIS applications to support data collection and editing". It names ArcGIS Pro, ArcMap, **ArcGIS Online Map Viewer** and Field Maps, with examples such as "digitize building footprints".
  - It grants "the non-exclusive right to use the World Imagery map to trace features and validate edits in the creation of vector data", with sharing via open-data sites or OSM.
  - "Except for the additional limited rights granted above, any and all other uses … remain subject to" the Master Agreement or Terms of Use.
  - The World Imagery item's `licenseInfo` says it may be used "for data collection and editing in ArcGIS apps" ([item JSON](https://www.arcgis.com/sharing/rest/content/items/10df2279f9684e4a9f6a7f08febac2a9?f=json), modified 2026-10-07).
  - **Reading for U2.** Inside ArcGIS apps, a reviewer setting a class attribute on our footprint layer is clearly within the permitted "data collection and editing". In our own Leaflet admin app under ALP, only "visualization" is granted. A human looking at imagery is visualization, but storing the resulting judgement and using it to drive a commercial layer is not addressed. **Get written confirmation** from Esri or the Israeli distributor before relying on it.
- **ArcGIS Online user types.** Creator, Professional and Professional Plus each include 500 credits ([pricing page](https://www.esri.com/en-us/arcgis/products/arcgis-online/pricing)). **No prices are shown on the official pages today**, which tell buyers to contact sales. Secondary figures: "$845 per year 'Creator'" ([Equator Studios](https://equatorstudios.com/what-will-arcgis-cost-personal-vs-team-pricing/), undated) and an Esri Colombia Oct-2025 quote of COP 5,755,945 per Creator per year, about **US$1,400** by my conversion ([Colombia Compra order 148930](https://operaciones.colombiacompra.gov.co/tienda-virtual-del-estado-colombiano/ordenes-compra/148930)). **UNVERIFIED for Israel.** Buy through the local distributor; the distributor's name and price are **UNVERIFIED**.

### 4.3 Mapbox
- **Pricing** ([mapbox.com/pricing](https://www.mapbox.com/pricing)): Raster Tiles API (includes satellite) is free to 750k per month, then $0.25/1k (to 2M), $0.20 (to 4M) and $0.15 (to 20M). Above 20M, contact sales. GL JS map loads are 50k free, then $5→$2.50 per 1k.
- **Product Terms (Last Updated July 21, 2026)** ([PDF](https://cdn.prod.website-files.com/609ed46055e27a02ffc0749b/6a60463142f6478d57642594_Mapbox%20Product%20Terms%20(July%2021%2C%202026).pdf)):
  - **§1.2.3**: production use of a Licensed Application "related to business intelligence or analytics … or real estate" must "in all cases purchase a commercial license". A rooftop-leasing marketplace with owner targeting is plausibly "real estate" and "analytics". **Hidden enterprise-contract risk.**
  - §1.5(ii): no use "to train, operate or improve machine-learning or artificial intelligence".
  - **§1.6**: "shall not trace or otherwise derive or extract content, data and/or information from the Service Offerings", except tracing satellite "(i) for non-commercial purposes or (ii) for OpenStreetMap".
  - §1.9(v): no export, cache or storage of results.
  - §1.13: no merging with share-alike data.
  - §2.8.1: 30-day on-device caching only.
  - §2.8.2: no using satellite imagery to "enhance any imagery".
- **Verdict:** usable for U1 only after a sales conversation about §1.2.3. ❌ for U2 and U3. **Not recommended.**

### 4.4 Google Maps Platform: Map Tiles API (2D)
- **Pricing** ([billing & pricing](https://developers.google.com/maps/billing-and-pricing/pricing)): 2D Map Tiles (Essentials) is free to 100k per month, then $0.60/1k (to 1M), $0.48 (1–5M), $0.36 (5–10M), $0.18 (10–50M) and $0.045 (50M+).
- **Policies** ([Map Tiles API policies](https://developers.google.com/maps/documentation/tile/policies), last updated 2026-10-16): "You may not use Map Tiles API for any non-visualization use cases, such as: Image analysis; Machine interpretation; Object detection or identification; Geodata extraction or resale; Offline uses". No pre-fetching, indexing, storing or caching except as the terms allow.
- **Terms** (Google Maps Platform ToS, quoted from a reseller copy; Google's own page did not render text): "You will not create content based on Google Maps Content", for example "trace or digitize … building outlines … from the Google Map Tiles API Satellite base map type". Also "You will not use the Google Maps Content with or near a non-Google map in a Your Application" ([Cesium copy of the terms](https://cesium.com/legal/terms-for-google/), Aug 20 2025). An update to the "creating content" clause was logged on 2026-06-24 ([Conduct Atlas](https://conductatlas.com/platform/google-maps/google-maps-platform-terms-of-service/provision/CA-P-041128/prohibition-on-creating-content-from-google-maps-content/)). **UNVERIFIED** against Google's live text.
- **Verdict:** U1 only, and then both layers must be Google. It is the most expensive option at every volume (§5). ❌ for U2 and U3.

### 4.5 Azure Maps
- **Prices** come from the official [Azure Retail Prices API](https://prices.azure.com/api/retail/prices?$filter=serviceName%20eq%20%27Azure%20Maps%27%20and%20armRegionName%20eq%20%27Global%27) ("Maps" SKU, effective 2023-06/07). The marketing page shows "Contact Us" instead of prices ([pricing page](https://azure.microsoft.com/en-us/pricing/details/azure-maps/)). It says 1 transaction = "increments of 15 tile requests", with volume discounts from 100k transactions per month.
  - Maps Imagery Tiles: 1k transactions free, then $4.50/1k.
  - Maps Base Map Tiles: 5k free, then $4.50/1k.
- **Terms.** The current Azure Maps Product Terms could not be retrieved (the page requires choosing a licensing programme): **UNVERIFIED**. Older Azure Maps preview terms bar a "derived database" and cap caching at 6 months ([preview terms](https://azure-int.microsoft.com/en-us/support/legal/preview-supplemental-terms)). A Microsoft moderator answered (2021-06-07) that Bing imagery terms "prohibit the generation of derivatives from the maps, such as tracing the rooftop equipment", a restriction passed down from imagery suppliers ([Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/421467/use-of-bing-maps-to-generate-a-roof-plan-and-3d-mo)).
- **Verdict:** U1 only, and about 2× Esri/MapTiler at scale. Not recommended.

### 4.6 Street-only and budget basemaps
- **Stadia Maps** ([pricing](https://stadiamaps.com/pricing/)):
  - Plans: Free $0 (200k credits, non-commercial), Starter $20 (1M), Standard $80 (7.5M, satellite included), Professional $250 (25M). Overage is 3¢, 2¢ or 1.5¢ per 1k credits.
  - A raster tile costs 1 credit. Satellite imagery costs 4 credits per 512 px tile, and a satellite basemap needs both imagery and vector tiles. **The credit cost of the raster `alidade_satellite` 256 px tile is not stated; I assumed 2 credits (UNVERIFIED).**
  - Imagery: Airbus-based, "1.5m or better" everywhere, 30 cm on 37M km², updated 2026-08-05. Israel is not named ([blog](https://stadiamaps.com/news/2026-satellite-imagery-update/)). The imagery-only layer goes to z18 ([docs](https://docs.stadiamaps.com/map-styles/alidade-satellite/)).
  - ToS (effective Mar 18 2026; a new version takes effect Nov 9 2026): §30.1 imagery is for visualization only, with no processing or bulk download; §8(5) no server-side caching ([ToS](https://stadiamaps.com/terms-of-service/)).
  - **Cheapest by far at 1M views (~$250–440/mo)**, *if* the Israel imagery passes visual QA.
- **Thunderforest** ([pricing](https://www.thunderforest.com/pricing/)): $125, $255 or $525 per month for 1.5M, 15M or 150M tiles. Street only.
- **Jawg** ([pricing](https://www.jawg.io/en/pricing/)): €250/mo for 100k views (1 view = 15 raster tiles), €500 for 500k, above that a quote. The free tier is non-commercial. Street only, and expensive at low volume.
- **Self-hosted OSM vector tiles** (Protomaps PMTiles or OpenMapTiles on Cloudflare R2): R2 costs $0.015/GB-month, has **no egress fees**, and gives 10M free Class B reads per month, then $0.36 per million ([R2 pricing](https://developers.cloudflare.com/r2/pricing/)). This needs MapLibre or protomaps-leaflet, which is a code change. Phase 2 option for streets at ≥1M views.

### 4.7 Vantor (ex-Maxar)
- Vantor sells archive and tasking (15, 30 and 50 cm) and **Vivid Mosaic** basemaps (15 or 30 cm, via Vantor Hub) ([Vantor Vivid](https://vantor.com/product/vivid/mosaic/)). There is **no official price list**.
- Reseller indicative prices, June 2026: Vantor-50cm archive $14/km², tasking $25; Vantor-30cm $19 / $29; Vivid-Mosaic-30cm $12/km²; Vivid-Mosaic-15cm $15/km²; 1 km² minimum ([SkyWatch](https://skywatch.com/geospatial-data-providers/vantor/)).
- **Over Israel**, deliveries are capped at 0.4 m (§3.1). A 2021 reseller post says Maxar products over Israel are delivered "at up to 40 cm" ([Apollo Mapping blog](https://apollomapping.com/blog/all-maxar-imagery-products-over-israel-now-delivered-at-up-to-40-cm-resolution), page returned 403, title from search). So the 15 and 30 cm prices buy at best 40 cm. The Esri imagery in Israel is native 0.46–0.5 m (§4.2).
- **Licence.** The default is an "Internal Use License" for a single end user (described in [EUSI ATOM docs](https://atom-docs.euspaceimaging.com/?p=156)). The licence page itself (vantor.com/resources/internal-use-license) did not render, so derivative and ML terms are **UNVERIFIED**. Older Maxar licences bar using products "to train machine learning algorithms for feature extraction or any other purpose" (search snippet of maxar.com/legal/vricon-internal-use-license; the site's TLS certificate had expired). **Not first choice** for U2 or U3 until the licence is read.

### 4.8 Airbus (Pléiades Neo / Pléiades / SPOT / OneAtlas)
- **Licences** ([Airbus licences page](https://www.space-solutions.airbus.com/legal/licences/)). The main licences "do not require prior validation from Airbus" and are Standard, Background Layer, and Standard + Background Layer. The full Standard EULA (Nov 2025) link returned 404 today, so the points below come from Airbus's official summaries:
  - **Standard licence summary** (version March 2023, [PDF](https://storage.googleapis.com/p-ssp-iep-prod-8ff-strapi-uploads/standard_licence_summary_12032023_2d8b0c02c3/standard_licence_summary_12032023_2d8b0c02c3.pdf)):
    - Internal use: "Use, store, access, copy, share, process the product into any internal device or your secured cloud infrastructure. Create value added product (e.g. mosaic) and derivative work (e.g. map, report)."
    - External use: "Distribute any derivative work". You may "display an extract of the product on a website in a non-extractable and non-downloadable format".
    - You may not distribute the product or a VAP.
    - **Perpetual**, under French law. Covers SPOT, Pléiades and Pléiades Neo.
  - **Standard + Background Layer summary** (January 2023, [PDF](https://storage.googleapis.com/p-ssp-iep-prod-8ff-strapi-uploads/standard_background_layer_licence_summary_12032023_04a76f6961/standard_background_layer_licence_summary_12032023_04a76f6961.pdf)):
    - "You can make available the background layer to your customer(s) for visualization purposes (e.g. by integrating the background layer into your interactive online map …)". Customers may not download it.
    - It also covers Living Library and Basemap.
  - → **U1 (in purchased areas), U2 and U3 are all covered by one purchase.** An explicit ML clause is **UNVERIFIED** until the full EULA is read. The derivative-work definition in Airbus-family EULAs is "does not contain any imagery data and is irreversible and uncoupled from the Product" (Planet-distributed Airbus EULA, [Geomatics EULA 2023.1](https://assets.planet.com/docs/Geomatics_EULA_SPOT_PLEIADES_2023.1.pdf), via search snippet). Roof-class labels and outlines fit that definition. The same Geomatics EULA (search snippet) grants "the right to access or use the Product for the purpose of developing or training machine learning algorithms": **UNVERIFIED** for Airbus-direct orders.
- **Prices.** There is no official Airbus per-km² list; OneAtlas Basemap is quote only ([Airbus Basemap](https://space-solutions.airbus.com/imagery/reference-layers/basemap)). Reseller starting rates: VHR 30–49 cm **$19/km² archive**, $29 tasking, 1 km² min; HR 50–99 cm $10 / $12 ([SkyWatch data](https://skywatch.com/data)). Land Info lists Pléiades Neo 30 cm at $22.50 archive and $32.50 new, with a 25 km² contiguous archive minimum (search snippet; the site returned 403): **UNVERIFIED**. SkyWatch bills small VHR archive orders at a 5 km² minimum ([SkyWatch AOI help](https://intercom.help/skywatch-ab92e82e1a0a/en/articles/9917241-aoi-size-and-cost-requirements-hub)). The Background Layer uplift is **UNVERIFIED** and needs a quote.

### 4.9 Planet
- The Planet Labs EULA (revision Jan 1, 2016, still published at [assets.planet.com](https://assets.planet.com/docs/upload-EULA-us.pdf)):
  - "use the Content to create a Derivative Product without restriction"; "You are free to redistribute Derivative Products without restriction".
  - Internet display only "for noncommercial purposes in a nondownloadable, noninteractive fashion".
  - Licence tiers: Single-User (1), Multi (5), Enterprise (10), Expanded (11+).
  - No ML prohibition in this text. Planet's Geomatics ToS 2023.1 forbids training models "designed to replicate the Licensed Materials" (search snippet), which does not affect our use.
- SkySat 50 cm archive $10/km², tasking $12, 25 km² minimum (reseller, [SkyWatch](https://skywatch.com/data)). Planet's own pricing page shows no prices ([planet.com/pricing](https://www.planet.com/pricing/)).
- → Good for **U2/U3 internal use**, not for U1 public display. It is cheaper than Pléiades Neo but 50 cm, and SkySat archive density over Israel is **UNVERIFIED**.

### 4.10 Israeli vendors
- **Ofek (אופק צילומי אוויר)**: Israel's largest aerial-mapping company, founded 1987.
  - It offers national orthophotos, oblique imagery, DSM/DTM, LiDAR, a historical archive, and **national "energy potential", shade and 3D-building layers** ([ofek-air.com](https://www.ofek-air.com/)). The energy-potential layer is a potential data source *and* a competitor to this feature.
  - The shop sells area-selected one-off downloads with "no subscription" ([shop.ofekonline.com](https://shop.ofekonline.com/)). **No prices or licence text are published.**
  - It has held Survey of Israel aerial-photography contracts (Globes, 2000-12-24: about ₪2.5M/yr, four aircraft) ([Globes](https://www.globes.co.il/news/article.aspx?did=458942), old).
  - **Send an RFQ** (see §9).
- **Kav Medida (קו מדידה)**: project orthophotos "up to 5 mm per pixel", streamable via WMS/WMTS. No prices ([page](https://www.kav-medida.co.il/accurate-orthophoto-maps-en)). Relevant only for small-area or drone work.
- **Government context.** The Israel Land Authority ran tender 105-2024 for orthophotos ([tender booklet](https://mr.gov.il/ilgstorefront/he/p/attachment/005056BFAF4C1FE082C857779F9452E9/חוברת%20המכרז)), and a 2021 enforcement tender required ≥10,000 km² at 12.5 cm/pixel experience. This shows the Israeli aerial market routinely produces **12.5 cm national-scale orthophotos**, but government imagery is not licensable to us.
- **Important context outside imagery.** The Ministry of Energy and Survey of Israel launched (Feb 2025) a GovMap tool estimating **per-building rooftop solar potential (kWp, kWh, ₪/yr)** for residential, commercial, industrial, public and agricultural roofs ([Maariv, 2025-02-04](https://www.maariv.co.il/news/israel/article-1169853)). See Open Questions.

### 4.11 Self-hosting purchased imagery (U2, and U1 in purchased areas)
- Pipeline: GeoTIFF/JP2 → COG → XYZ JPEG tiles (z12–19) → object storage → Leaflet `TileLayer` in the admin review screen (and optionally on potential-roof pages under the Background Layer licence).
- My size estimate (**UNVERIFIED**): at 32°N a z19 tile covers about 64 m, so ~240 tiles/km² at z19 × 15–25 KB, plus about ⅓ for lower zooms, gives **~5–8 MB per km²**. The pilot (138 km²) is about 0.7–1.1 GB; 2,000 km² is about 10–16 GB.
- Storage cost:
  - **Cloudflare R2**: $0.015/GB-mo, 10 GB free, egress free ([R2 pricing](https://developers.cloudflare.com/r2/pricing/)), so cents per month.
  - **Supabase Free**: 1 GB storage and 5 GB egress, too small. **Supabase Pro**: 100 GB storage and 250 GB egress included, then $0.0213/GB and $0.09/GB ([Supabase pricing](https://supabase.com/pricing)).
  - → R2 or Supabase Pro both work.
- The review screen must stay behind admin auth (Standard licence = internal use). Public display is only allowed under the Background Layer licence.

---

## 5. U1 monthly cost model

### 5.1 Assumptions
- A map view loads **20 tiles** (range 15–25) of 256 px. Each tile request is billed as one unit.
- **50% of tiles are aerial**. Explore defaults to street; listing, publish and potential-roof pages default to aerial.
- Prices are the official list prices in §2 and §4, with no negotiated discounts, VAT, retries or bot traffic.
- Stadia raster satellite is assumed at 2 credits per 256 px tile (**UNVERIFIED**).
- The model script is in my scratchpad (not committed). The formulas are simple enough to re-run by hand.

### 5.2 Results (USD per month; midpoint 20 tiles/view, range in brackets for 15–25)

| Combination | 10k views (200k tiles) | 100k views (2M tiles) | 1M views (20M tiles) | Notes |
|---|---|---|---|---|
| **C2 ★ MapTiler Flex streets + Esri ALP imagery** | **$30** [30–30] | **$105** [68–143] | **$2,655** [1,905–3,405] | Recommended. Esri aerial is free up to 2M aerial tiles/mo (≈200k views at 50% aerial). |
| C1 MapTiler Flex, both layers | $30 [30–30] | $255 [180–330] | $2,955 [2,205–3,705] | Simplest, but satellite is likely ~1 m in Israel |
| C3 Esri ALP, both layers | $0 [0–0] | $0 [0–75] | $2,700 [1,950–3,450] | Cheapest ≤100k views. Streets need 512 px static tiles (code change), and Hebrew label quality is **UNVERIFIED**. |
| C8 Stadia Starter/Standard streets + Esri imagery | $20 [20–20] | $20 [20–28] | $1,330 [905–1,755] | Best at scale if Stadia streets are acceptable |
| C7 Stadia (Standard/Pro), both layers | $80 [80–80] | $80 [80–80] | $325 [250–438] | Cheapest at scale, **if** Alidade Satellite is good over Israel (unknown) |
| C5 Mapbox, both | $0 [0–0] | $313 [188–413] | $3,113 [2,363–3,863] | Plus a possible **commercial licence** (§1.2.3), price unknown |
| C6 Azure Maps, both | $33 [18–48] | $573 [423–723] | $5,973 [4,473–7,473] | Before volume discounts |
| C4 Google Map Tiles, both | $60 [30–90] | $1,020 [780–1,260] | $6,060 [5,160–6,960] | Must be Google for both layers |
| *Street only, for reference:* Thunderforest | $125 | $125 | $255 | |
| *Street only:* Jawg | €250 | €250 | quote (>500k Jawg views) | |

### 5.3 Sensitivity
- **Aerial share.** If potential-roof pages push aerial to 80%, C2 at 1M views becomes MapTiler (4M street tiles) ≈ **$555** plus Esri (16M aerial tiles) ≈ **$2,100**, still about **$2,655** in total. The total does not change because both providers charge $0.15/1k at the margin and their free allowances are fixed. The split only matters below the free allowances.
- **Formula for any volume.** C2 ≈ `$30 + max(0, S − 500k) × $0.15/1k + max(0, A − 2M) × $0.15/1k`, where S = street tiles and A = aerial tiles per month.

### 5.4 Optimisations before paying the 1M-view bill
1. Use 512 px tiles where billing is per request: Esri static basemap tiles, and MapTiler `/tiles/satellite-v2` if a 512 px tileset tile counts as 1 (**UNVERIFIED**). This cuts aerial requests by up to about 4×.
2. Keep explore on the street map by default (already the case). Load maps lazily on listing pages, and do not mount a second map or minimap.
3. Respect HTTP caching. Never proxy or cache tile-API tiles server-side (§3).
4. At ≥500k views, move streets to Stadia (C8) or self-hosted vector tiles, and negotiate MapTiler Custom or an Esri commitment.

---

## 6. U2 review imagery: one-off and annual costs

### 6.1 How many km² must be bought (pilot data)
I computed this from `research/pilot-emek-hefer/data/candidates.geojson` (992 candidates, bbox 188.4 km²) by counting grid cells that contain at least one candidate centroid:

| Grid cell (≈ order polygon granularity) | All 992 candidates | Tier A+B (469) | Tier A (238) |
|---|---|---|---|
| 250 m | 26.2 km² | 12.3 km² | 5.6 km² |
| 500 m | 63.3 km² | 32.3 km² | 14.3 km² |
| **1 km** (matches 1 km² minimums) | **138 km²** | **87 km²** | **38 km²** |

**Rule of thumb: ~0.14 km² per candidate (all tiers), or ~0.19 km² per Tier A+B candidate**, at 1 km cells. The 250–500 m figures apply only if the vendor accepts many small polygons without per-polygon minimums. SkyWatch's minimum billed area for small VHR archive orders is 5 km² ([AOI help](https://intercom.help/skywatch-ab92e82e1a0a/en/articles/9917241-aoi-size-and-cost-requirements-hub)).

### 6.2 Options and costs

| Option | Pilot cost (Tier A+B, 87 km²) | Pilot cost (all candidates, 138 km²) | Per 1,000 candidates nationally | Recurring | Rights for U2/U3 |
|---|---|---|---|---|---|
| **B ★ Airbus Pléiades Neo 30 cm archive** at $19–22.50/km², Standard + Background Layer | **$1,650–1,960** | **$2,620–3,110** | **$2,600–4,200** (139–185 km²) | Re-buy each 12–24 months to catch new PV, same order of cost | ✅ U2 and derivative works; U1 background layer in purchased areas; U3 probably (confirm) |
| B′ 50 cm archive (Pléiades 1, SkySat or Vantor 50 cm) at $10–14/km² | $870–1,220 | $1,380–1,930 | $1,400–2,600 | same | SkySat: U2/U3 ✅, U1 ❌. Vantor: **UNVERIFIED** |
| C Ofek / Israeli aerial orthophoto (10–25 cm) | **RFQ** | **RFQ** | **RFQ** | National programme is likely annual (**UNVERIFIED**) | Licence must be negotiated (§9) |
| A Esri World Imagery inside **ArcGIS Online** | $0 imagery + **~$0.7k–1.4k per reviewer per year (UNVERIFIED)** | same | same | annual licence | ✅ "data collection and editing" in ArcGIS apps. U3 ❌. Imagery 2023–2025 |
| D Esri World Imagery in **our admin app** via ALP | $0 (inside 2M free tiles) | $0 | $0 | – | ⚠️ "visualization only". Needs Esri's written OK |
| Google / Mapbox / MapTiler / Stadia / Azure | – | – | – | – | ❌ forbidden or no derivation right |

Plus storage of about $0–2/month (§4.11), and engineering time for the tiling pipeline (one-off).

### 6.3 Recommended U2 path
1. **This week, no cost.** Email the Esri Israel distributor asking whether option D (human labelling in a custom ALP app, labels used to select published roofs) is permitted. If yes, use it for triage straight away.
2. **Pilot.** Order Pléiades Neo 30 cm archive for the **Tier A+B 1 km cells (~87 km²), about $2k**, from the most recent cloud-free captures (2025–2026). Use the *Standard + Background Layer* licence and get the uplift quoted. Tile it to R2 or Supabase. Review screen: outline over Airbus tiles, with Esri as a second "older" layer for comparison.
3. **In parallel**, send RFQs to Ofek (and one more Israeli aerial vendor) for the same AOI. Compare price per km², recency and resolution. Aerial at 10–25 cm would make PV and greenhouse calls trivial.
4. **National rollout.** Budget about **$2.6k–4.2k per 1,000 candidates** for 30 cm satellite (or the Ofek quote), plus a refresh cycle. Buy only the cells that hold Tier A/B candidates after automated filtering.

---

## 7. U3 (Phase 2): ML on imagery
- **Not allowed** on any tile API researched: MapTiler §4.3, Mapbox §1.5(ii)/§1.6, Google policy, Esri ALP §3.1.d.6 and E300 fn 10/96, Stadia §30.1, Azure/Bing.
- **Allowed or likely allowed** only on purchased imagery:
  - Airbus Standard: internal processing ✅. An explicit ML clause is **UNVERIFIED**, so ask for it in writing; the Planet-distributed Airbus EULA grants ML.
  - Planet: derivative products "without restriction" ✅.
  - Vantor: **UNVERIFIED**, and possibly prohibited.
  - Ofek: negotiate an ML clause.
- The U2 labels we create, attached to our purchased imagery, become the training set. Make sure the purchase licence covers *storing image chips* for training (internal VAP: Airbus ✅, Planet ✅).
- Cost driver: km² × refresh. Example: re-buying 2,000 km² at 30 cm costs about $38k–45k per refresh at reseller list prices. A volume or annual "basemap" deal (Airbus OneAtlas Basemap or Living Library, or a Vantor Vivid subscription) should be quoted once the national AOI is known.

---

## 8. Recommended combination (final)

| Phase | U1 public basemap | U2 review | U3 ML |
|---|---|---|---|
| **Before public launch (now)** | MapTiler **Flex** ($30/mo) for streets (existing `DEPLOY.md` env vars) + **Esri ALP** World Imagery with an API key restricted by referrer (env-var change to `ibasemaps-api…?token=`, update the attribution to Esri/Vantor/Earthstar). Account owner 👤 creates both accounts. Add the ALP flow-down clause to `/terms`. | Ask Esri about option D. Order the Pléiades Neo pilot AOI (~$2k). RFQ Ofek. | – |
| **≤100k views/mo** | ≈ **$30–145/mo** | ≈ $2–3k one-off (pilot) | – |
| **~1M views/mo** | ≈ $1.9k–3.4k/mo as is. Apply §5.4 to reach about **$0.9k–1.8k** (Stadia streets + Esri imagery), or test Stadia for both (~$0.25–0.45k) | ~$2.6k–4.2k per 1,000 candidates plus refresh | Purchased Airbus/Planet/Ofek imagery with an explicit ML clause |

---

## 9. RFQ and confirmation checklist (to send)

1. **Esri (ALP or the Israeli distributor):**
   - (a) May a human reviewer, in our own web app using World Imagery via ALP, classify our own building polygons and store the class, then use it to choose which polygons we publish commercially?
   - (b) Is `arcgis/imagery` available as 512 px static tiles, and is a 512 px tile billed as 1 tile?
   - (c) ArcGIS Online Creator or Professional price in Israel.
   - (d) Confirm that §3.1.a.4 is not triggered by showing OSM (ODbL) street tiles as an alternative base layer.
2. **Airbus or reseller (SkyWatch, UP42, Land Info):**
   - (a) Pléiades Neo archive availability and cloud cover over the Emek Hefer cells, 2025–2026.
   - (b) Price per km² and minimum per polygon.
   - (c) Uplift for Standard + Background Layer.
   - (d) The full Standard EULA text (the Nov 2025 link is 404), with an explicit ML-training permission.
3. **Ofek (and one other Israeli aerial vendor):**
   - (a) Latest national orthophoto year and GSD for the pilot area.
   - (b) Price for about 90–140 km² (one-off) and for a national subscription.
   - (c) Licence: internal review, storing derived labels, publishing derived attributes (area, capacity, class), showing imagery on public pages, ML training.
   - (d) Delivery format and WMTS.
   - (e) Price and licence of their "national energy-potential layer".
4. **MapTiler:** confirm how `/tiles/satellite-v2` 512 px tiles are counted, and quote Custom at 10–20M requests per month.

---

## 10. Open questions and UNVERIFIED items
- Actual imagery quality and date over Israel for MapTiler satellite, Mapbox, Google, Azure and Stadia Alidade Satellite. This needs a visual check in a browser, which I did not do because the brief prohibits using the browser pane.
- ArcGIS Online user-type prices (not on the official page today).
- Airbus full Standard EULA text (404) and an explicit ML clause. Pléiades Neo archive coverage over the pilot.
- Vantor Internal Use licence terms (page did not render).
- Land Info prices (site 403; figures from search snippets only).
- Stadia raster satellite credit cost per 256 px tile.
- Whether Mapbox §1.2.3 "real estate" would apply to SolGag. This only matters if Mapbox is chosen.
- **Strategic question for the orchestrator.** The Ministry of Energy and Survey of Israel GovMap rooftop solar-potential tool (Feb 2025) and Ofek's "national energy-potential layer" already estimate per-building potential. Check (a) whether they cover our industrial and agricultural targets, (b) whether they can be licensed as an input instead of our own pipeline, and (c) how SolGag's layer differentiates from them. Source: [Maariv 2025-02-04](https://www.maariv.co.il/news/israel/article-1169853), [ofek-air.com](https://www.ofek-air.com/).

---

## Sources (all seen 2026-10-19 unless noted)
- MapTiler: [pricing](https://www.maptiler.com/cloud/pricing/) · [plans](https://www.maptiler.com/cloud/plans) · [terms](https://www.maptiler.com/terms/) · [satellite dataset docs](https://docs.maptiler.com/schema-raster/satellite/) · [request counting](https://docs.maptiler.com/guides/maps-apis/maps-platform/tile-requests-and-map-sessions-compared) · [frontdeskreview (third party, June 2026)](https://frontdeskreview.com/software/maps-api/maptiler/)
- Esri: [ALP pricing](https://location.arcgis.com/pricing/) · [basemap sessions blog](https://www.esri.com/arcgis-blog/products/platform/announcements/basemap-sessions) · [ALP Agreement E204, Nov 21 2025](https://www.esri.com/content/dam/esrisites/en-us/media/legal/platform/platform-legal.pdf) · [Product-Specific Terms E300, Nov 13 2025](https://www.esri.com/content/dam/esrisites/en-us/media/legal/product-specific-terms-of-use/e300.pdf) · [World Imagery Uses Permitted PDF](https://www.arcgis.com/sharing/rest/content/items/8e90a00a0a6845a49262e0b756f57a10/data) · [World Imagery item JSON](https://www.arcgis.com/sharing/rest/content/items/10df2279f9684e4a9f6a7f08febac2a9?f=json) · World Imagery identify queries for [pilot centre](https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/identify?geometry=34.92,32.36&geometryType=esriGeometryPoint&sr=4326&layers=all&tolerance=2&mapExtent=34.85,32.30,35.0,32.42&imageDisplay=1200,1000,96&returnGeometry=false&f=json), [Haifa Bay](https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/identify?geometry=35.05,32.80&geometryType=esriGeometryPoint&sr=4326&layers=all&tolerance=2&mapExtent=35.0,32.75,35.1,32.85&imageDisplay=1200,1000,96&returnGeometry=false&f=json) and [Tel Aviv](https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/identify?geometry=34.78,32.07&geometryType=esriGeometryPoint&sr=4326&layers=all&tolerance=2&mapExtent=34.73,32.02,34.83,32.12&imageDisplay=1200,1000,96&returnGeometry=false&f=json) · [Static basemap tiles docs](https://developers.arcgis.com/documentation/mapping-and-location-services/mapping/basemaps/introduction-static-basemap-tiles-service/) · [MapLibre ibasemaps sample](https://developers.arcgis.com/maplibre-gl-js/maps/display-multiple-basemap-layers) · [ArcGIS Online user types](https://www.esri.com/en-us/arcgis/products/arcgis-online/pricing) · [Equator Studios (third party)](https://equatorstudios.com/what-will-arcgis-cost-personal-vs-team-pricing/) · [Colombia Compra order 148930](https://operaciones.colombiacompra.gov.co/tienda-virtual-del-estado-colombiano/ordenes-compra/148930)
- Mapbox: [pricing](https://www.mapbox.com/pricing) · [Product Terms, Jul 21 2026](https://cdn.prod.website-files.com/609ed46055e27a02ffc0749b/6a60463142f6478d57642594_Mapbox%20Product%20Terms%20(July%2021%2C%202026).pdf) · [ToS, Mar 31 2024](https://www.mapbox.com/legal/tos)
- Google: [pricing](https://developers.google.com/maps/billing-and-pricing/pricing) · [Map Tiles API policies (updated 2026-10-16)](https://developers.google.com/maps/documentation/tile/policies) · [Cesium copy of Google terms (Aug 20 2025)](https://cesium.com/legal/terms-for-google/) · [Conduct Atlas tracker](https://conductatlas.com/platform/google-maps/google-maps-platform-terms-of-service/provision/CA-P-041128/prohibition-on-creating-content-from-google-maps-content/)
- Azure: [retail prices API](https://prices.azure.com/api/retail/prices?$filter=serviceName%20eq%20%27Azure%20Maps%27%20and%20armRegionName%20eq%20%27Global%27) · [pricing page](https://azure.microsoft.com/en-us/pricing/details/azure-maps/) · [preview supplemental terms](https://azure-int.microsoft.com/en-us/support/legal/preview-supplemental-terms) · [Microsoft Q&A 2021-06-07](https://learn.microsoft.com/en-us/answers/questions/421467/use-of-bing-maps-to-generate-a-roof-plan-and-3d-mo)
- Stadia / Thunderforest / Jawg: [Stadia pricing](https://stadiamaps.com/pricing/) · [Stadia ToS](https://stadiamaps.com/terms-of-service/) · [Alidade Satellite docs](https://docs.stadiamaps.com/map-styles/alidade-satellite/) · [Stadia 2026 imagery update](https://stadiamaps.com/news/2026-satellite-imagery-update/) · [Thunderforest pricing](https://www.thunderforest.com/pricing/) · [Jawg pricing](https://www.jawg.io/en/pricing/)
- Vantor / Airbus / Planet / resellers: [SkyWatch data pricing](https://skywatch.com/data) · [SkyWatch Vantor](https://skywatch.com/geospatial-data-providers/vantor/) · [SkyWatch AOI rules](https://intercom.help/skywatch-ab92e82e1a0a/en/articles/9917241-aoi-size-and-cost-requirements-hub) · [Vantor Vivid Mosaic](https://vantor.com/product/vivid/mosaic/) · [EUSI ATOM docs](https://atom-docs.euspaceimaging.com/?p=156) · [Airbus licences](https://www.space-solutions.airbus.com/legal/licences/) · [Airbus Standard summary](https://storage.googleapis.com/p-ssp-iep-prod-8ff-strapi-uploads/standard_licence_summary_12032023_2d8b0c02c3/standard_licence_summary_12032023_2d8b0c02c3.pdf) · [Airbus Standard + Background Layer summary](https://storage.googleapis.com/p-ssp-iep-prod-8ff-strapi-uploads/standard_background_layer_licence_summary_12032023_04a76f6961/standard_background_layer_licence_summary_12032023_04a76f6961.pdf) · [Airbus Basemap](https://space-solutions.airbus.com/imagery/reference-layers/basemap) · [Planet EULA (rev. 2016)](https://assets.planet.com/docs/upload-EULA-us.pdf) · [Planet Geomatics EULA 2023.1](https://assets.planet.com/docs/Geomatics_EULA_SPOT_PLEIADES_2023.1.pdf) · [Land Info pricing (403; snippet only)](https://landinfo.com/satellite-imagery-pricing/) · [Nearmap coverage](https://www.nearmap.com/coverage)
- Israel: [85 FR 44059 (Kyl–Bingaman 0.4 m)](https://www.govinfo.gov/content/pkg/FR-2020-07-21/pdf/2020-15770.pdf) · [Ofek](https://www.ofek-air.com/) · [Ofek shop](https://shop.ofekonline.com/) · [Globes 2000 on Ofek](https://www.globes.co.il/news/article.aspx?did=458942) · [Kav Medida](https://www.kav-medida.co.il/accurate-orthophoto-maps-en) · [ILA tender 105-2024](https://mr.gov.il/ilgstorefront/he/p/attachment/005056BFAF4C1FE082C857779F9452E9/חוברת%20המכרז) · [Maariv 2025-02-04, GovMap solar tool](https://www.maariv.co.il/news/israel/article-1169853)
- Infrastructure: [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/) · [Supabase pricing](https://supabase.com/pricing)
