// Public configuration. NEXT_PUBLIC_* values must be referenced literally so
// Next.js can inline them into the client bundle.

// ─── Map tiles ─────────────────────────────────────────────────────────
// Production must use licensed providers (see docs/DEPLOY.md §3). The keyless
// OpenStreetMap / Esri endpoints below are for local development only; the
// production build refuses them (next.config.ts).
//   • Street map: MapTiler Cloud (NEXT_PUBLIC_MAPTILER_KEY, origin-restricted key)
//   • Aerial:     Esri ArcGIS Location Platform World Imagery (NEXT_PUBLIC_ESRI_API_KEY,
//                 referrer-restricted API key with the "basemaps" privilege)
// Full URL overrides (NEXT_PUBLIC_MAP_TILE_URL / NEXT_PUBLIC_IMAGERY_TILE_URL) still win.

const DEV_STREET_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const DEV_STREET_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>';
const DEV_IMAGERY_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

const MAPTILER_ATTRIBUTION =
  '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">&copy; OpenStreetMap contributors</a>';
const ESRI_ATTRIBUTION = 'Powered by <a href="https://www.esri.com/" target="_blank" rel="noreferrer">Esri</a> | Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community';

const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? '';
const esriKey = process.env.NEXT_PUBLIC_ESRI_API_KEY ?? '';

const streetUrl =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ||
  (maptilerKey ? `https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${encodeURIComponent(maptilerKey)}` : DEV_STREET_TILES);
const imageryUrl =
  process.env.NEXT_PUBLIC_IMAGERY_TILE_URL ||
  (esriKey ? `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${encodeURIComponent(esriKey)}` : DEV_IMAGERY_TILES);

/** True when a URL points at a free, keyless endpoint that is not licensed for commercial traffic. */
export function isKeylessTileUrl(url: string): boolean {
  return /(^|\/\/)(\w+\.)?tile\.openstreetmap\.org\//.test(url) || /server\.arcgisonline\.com\//.test(url) || /services\.arcgisonline\.com\//.test(url);
}

export const publicConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  phoneAuthEnabled: process.env.NEXT_PUBLIC_AUTH_PHONE_ENABLED === 'true',
  map: {
    tileUrl: streetUrl,
    tileAttribution: process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION || (maptilerKey ? MAPTILER_ATTRIBUTION : DEV_STREET_ATTRIBUTION),
    imageryUrl,
    imageryAttribution: process.env.NEXT_PUBLIC_IMAGERY_TILE_ATTRIBUTION || ESRI_ATTRIBUTION,
    /** Esri World Imagery over Israel is mostly captured to zoom 18; deeper zooms upscale instead of fetching "no data" tiles. */
    imageryMaxNativeZoom: 18,
  },
} as const;

export const SITE_NAME = 'סולגג';
export const SITE_TAGLINE = 'גגות × משקיעים בסולארי';

export const STORAGE_BUCKETS = {
  listingImages: 'listing-images',
  ownershipDocs: 'ownership-docs',
} as const;

export function publicImageUrl(path: string): string {
  return `${publicConfig.supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKETS.listingImages}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}
