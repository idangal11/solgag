// Public configuration. NEXT_PUBLIC_* values must be referenced literally so
// Next.js can inline them into the client bundle.

const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>';
const ESRI_IMAGERY = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_ATTRIBUTION = 'Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community';

export const publicConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  phoneAuthEnabled: process.env.NEXT_PUBLIC_AUTH_PHONE_ENABLED === 'true',
  map: {
    tileUrl: process.env.NEXT_PUBLIC_MAP_TILE_URL || OSM_TILES,
    tileAttribution: process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION || OSM_ATTRIBUTION,
    imageryUrl: process.env.NEXT_PUBLIC_IMAGERY_TILE_URL || ESRI_IMAGERY,
    imageryAttribution: process.env.NEXT_PUBLIC_IMAGERY_TILE_ATTRIBUTION || ESRI_ATTRIBUTION,
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
