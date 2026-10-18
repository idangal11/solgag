# סולגג — אב-טיפוס

Prototype of a marketplace connecting owners of large rooftops with solar investors in Israel. Hebrew, RTL, responsive.

## Run

Requires Node 18+ (a portable Node 22 is in `.tools/` for this machine).

```
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build to dist/
```

## Stack

React 18 + TypeScript + Vite · Leaflet / react-leaflet (OpenStreetMap tiles, Esri World Imagery for aerial) · Turf.js for geodesic polygon area · lucide-react icons. No API keys, no backend.

## Structure

- `src/types.ts` — domain model (Listing, Inquiry…)
- `src/data/seed.ts` — 12 fictional listings with illustrative footprints
- `src/data/repository.ts` — the only module that touches localStorage; swap for API calls later
- `src/store.tsx` — React context over the repository
- `src/finance.ts` — the calculator model (pure functions)
- `src/geo.ts` — Turf area / centroid helpers
- `src/pages/*` — Explore (map + list), Listing detail, Publish wizard, Dashboard
- `src/components/*` — map parts, cards, calculator, inquiry dialog, polygon draw map

## What is simulated

All seed listings, owners and boundaries are fictional. No ownership verification or engineering assessment is performed. Inquiries are stored in the browser only and never sent. Address search uses the public OSM Nominatim service and falls back to manual map selection.
