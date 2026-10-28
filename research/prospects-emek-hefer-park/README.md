# Business-prospect pilot — Emek Hefer Industrial Park

Internal, admin-only pilot: find large commercial roofs in one industrial area, match each
roof to an address, find the businesses publicly listed there (with official contact
details), and review everything in `/admin/prospects` before anyone uses it.

Licences and the checks behind each source: [LICENSES-AND-CHECKS.md](LICENSES-AND-CHECKS.md).

## Pipeline (run from the project root, after `scripts/dev-shell.ps1`)

| Step | Script | Output |
|---|---|---|
| 1. OSM data for the park (buildings, addresses, POIs, streets) | `node research/prospects-emek-hefer-park/fetch-osm.mjs` | `raw/osm-park-v2.json` (gitignored) |
| 2. Candidate roofs (Microsoft footprints ≥ 1,000 m² in the park, top 50) + building and address evidence; Nominatim reverse at ≤1 req/s, cached | `node research/prospects-emek-hefer-park/candidates.mjs [--min-area=1000] [--max=50]` | `data/roofs.json` |
| 3. Companies registered in the park (leads only) | `node research/prospects-emek-hefer-park/registry-extract.mjs` | `data/registry-park-active.json` |
| 4. Desk research of businesses (official websites only for contacts) | done by research agents following the rules in LICENSES-AND-CHECKS.md | `discovery/group-*.json` |
| 5. Independent contact check: re-fetch every source page, keep only values found on it | `node research/prospects-emek-hefer-park/verify-contacts.mjs` | `data/contact-checks.json` |
| 6. Match businesses to roofs, build the import file | `node research/prospects-emek-hefer-park/build-import.mjs` | `data/prospects-import.json`, `data/matching-report.json` |
| 7. Load into the app | `/admin/prospects` → "ייבוא אצווה ממחקר" → upload `data/prospects-import.json` | DB tables `prospect_roofs`, `prospect_businesses` |

Step 2 needs the Microsoft tile `research/pilot-emek-hefer/raw/ms-122112223.geojsonl`
(`node research/pilot-emek-hefer/fetch-ms.mjs`).

Re-importing is safe: evidence is updated, but reviewed roofs keep their address and reviewed
businesses are left untouched.

## Confidence definitions

**Building confidence** (is there one building of about this size here?)
- high: an independent OSM building overlaps the Microsoft footprint closely (IoU ≥ 0.6)
- medium: OSM buildings cover ≥ 50% of the footprint but outlines differ (several buildings / extension)
- low: no independent corroboration

**Address confidence**
- high: `addr:*` with a house number on the OSM building overlapping the footprint, or an OSM address point inside it
- medium: OSM address without a number on the building, or an address point within 15 m / a Nominatim object lying on the roof
- low: nearest named street only — the house number is unknown and never guessed

**Business match confidence** (does this business occupy this building?)
- high: coordinates published on the business's own website fall inside the footprint
- medium: OSM business POI inside the footprint / named OSM building overlapping it; street + number equal to the OSM address on this building; website coordinates within 25 m
- low: same street only (several candidates kept, up to 6 per roof), or an OSM POI within 60 m

Relation is always "occupant, tenure unknown" unless written evidence of ownership is recorded.
