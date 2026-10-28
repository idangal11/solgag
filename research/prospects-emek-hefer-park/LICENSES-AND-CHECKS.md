# Business-prospect pilot — Emek Hefer Industrial Park: data sources, licences, checks

Checked on 2026-10-20. This is an engineering summary, not legal advice.

## Rule of the pilot
Roof geometry and area come **only** from data whose licence permits extraction and
processing. Map tiles and aerial imagery are used **only to display** records to the
reviewer. Nothing is traced, measured or extracted from imagery. Viewing a map is not
treated as permission to derive data from it.

## Sources used

| Component | Source | Licence / terms | What we do with it | Allowed? |
|---|---|---|---|---|
| Roof outlines + area | Microsoft Global ML Building Footprints (tile `122112223`) | **CDLA-Permissive-2.0** ("This data is licensed by Microsoft under the CDLA Permissive 2.0", GitHub README). §1.1 use, modify and share; §2.1 include the licence text when sharing the data; §3.1 no restrictions on Results (outputs of analysis) | Select footprints in the park, compute area with Turf | ✅ Yes. Footprints were detected by Microsoft from Bing/Maxar/Airbus imagery. Microsoft holds the rights to that and publishes the result under CDLA-P-2.0. |
| Building corroboration, addresses, named businesses, streets, park boundary | OpenStreetMap via Overpass API | **ODbL 1.0** (© OpenStreetMap contributors). Overpass policy: modest volume | Overlap with footprints, `addr:*` tags, POIs, nearest street | ✅ Internal use is fine. If a database derived from OSM is ever **made public**, it must be offered under ODbL (share-alike) with attribution. |
| Reverse geocoding (roof → street) | OSM Nominatim public API | Usage policy: ≤1 request/s, identifying User-Agent, results must be cached, no systematic grid queries | 50 one-off reverse lookups of roof centroids at 1.1 s spacing, cached in `raw/nominatim-reverse.json` | ✅ Pilot volume only. A production pipeline must use its own Nominatim instance or a geocoder whose terms allow storing results. |
| Registered company addresses | Israeli Companies Registry, data.gov.il `ica_companies` | data.gov.il licence: commercial and non-commercial use allowed; must cite the source; **must not be used in a way that harms a person's privacy, including by cross-referencing with other sources** | Lists active companies registered in the park as *leads* | ✅ With attribution. The "c/o" (אצל) field is **dropped** because it can name private individuals. A registered address is not evidence of operating, renting or owning there. |
| Business name, website, phone, email | The business's **own official website** (or OSM tags) | Public pages published by the business to be contacted | Recorded with page URL + verbatim snippet; re-fetched to confirm | ✅ Business contact data only. Generic role e-mails (info@, office@…) and main business lines. Named individuals' mobiles/e-mails are **not** stored. |
| Discovery leads | Search engines, directories (B144, Dun's, Google Maps, Facebook…) | Their terms forbid copying/scraping their listings | Used only to learn that a business exists and find its official site; URL kept as a "lead" | ✅ As links only. **No values copied** from them. |
| Street basemap in the review screen | MapTiler (production) / OSM tiles (local dev) | Display under the provider's terms | Display only | ✅ Display only. |
| Aerial imagery in the review screen | Esri World Imagery via ArcGIS Location Platform (production) / Esri keyless (local dev) | Display only. No extraction, storage or derivation | Reviewer can look at a roof for context | ✅ Display only. Footprints are **not** edited from imagery in this pilot. |

Not used: Google Maps/Places (terms forbid storing results or using them off a Google map),
GovMap and council GIS viewers (viewer terms; linked out for manual checks only), paid land
registry extracts (נסח טאבו — would cost money; needs your approval).

## Accuracy rules implemented
- **Owner vs occupant.** Every business match carries `relation` = `occupant_unverified` by default.
  `owner` requires quoted evidence (e.g. a land-registry extract or the company saying it owns the
  building). The UI never labels a business as roof owner without it.
- **Two confidences.** `building_confidence` (is there one building of about this size here?) is
  separate from each business's `match_confidence` (does this business occupy this building?).
- **Ambiguity kept.** A roof can have several candidate businesses. Same-street-only matches are
  stored as `low` and never auto-approved.
- **No invented contacts.** Every phone/e-mail has a source URL and verbatim snippet, re-checked by
  re-fetching the page; anything not found is stored as `null` and shown as "לא זמין" (unavailable).
- **Real vs demo.** Every row has `is_demo`. The pilot import contains real records only; the
  review screen shows a "DEMO" badge on any demo row and can filter them out.
- **Suitability is preliminary.** `suitability = preliminary_unverified`; kWp estimates assume 65%
  usable area and 6.5 m²/kWp. Roof type, structure, shading, existing PV and grid capacity are not
  checked.
- **Admin-only.** The tables are readable and writable only by admins (RLS `is_admin()`); nothing is
  shown on the public map.

## Before any outreach (not done — no messages were sent)
- Israeli Communications Law §30A (anti-spam): marketing e-mail/SMS needs prior consent; a business
  may receive a single one-time approach asking for consent. Phone calls are not covered by §30A,
  but the do-not-call registry (אל תתקשר אליי) applies.
- Privacy Protection Law incl. Amendment 13: if contacts of identifiable people (e.g. sole
  proprietors) are kept for direct marketing, check registration and notice duties.
