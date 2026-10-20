import { unstable_cache } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { publicConfig } from '@/lib/config';
import { isInSupportedArea } from '@/lib/geo';
import { getCurrentUser } from '@/lib/supabase/server';

// Address search for the publish wizard. MapTiler Geocoding when a server key is
// configured (MAPTILER_GEOCODING_KEY — a separate key without an origin
// restriction, never sent to the browser), otherwise OpenStreetMap Nominatim
// (low volume only — https://operations.osmfoundation.org/policies/nominatim/).
// Google Geocoding is deliberately not used: its terms require showing results
// on a Google map, and this app uses Leaflet.

interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

const querySchema = z.string().trim().min(2).max(200);
const TIMEOUT_MS = 7000;
const ONE_DAY = 86400;

function clean(results: GeocodeResult[]): GeocodeResult[] {
  return results.filter((r) => r.label && Number.isFinite(r.lat) && Number.isFinite(r.lng) && isInSupportedArea([r.lat, r.lng])).slice(0, 5);
}

async function maptiler(q: string, key: string): Promise<GeocodeResult[]> {
  const url = new URL(`https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json`);
  url.search = new URLSearchParams({ key, language: 'he', country: 'il', limit: '5' }).toString();
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`maptiler ${res.status}`);
  const data = (await res.json()) as { features?: { place_name?: string; center?: [number, number] }[] };
  if (!Array.isArray(data.features)) throw new Error('maptiler: unexpected body');
  return clean(
    data.features.filter((f) => Array.isArray(f.center)).map((f) => ({ label: f.place_name ?? '', lat: f.center![1], lng: f.center![0] })),
  );
}

// Nominatim allows at most 1 request per second; space calls out per instance.
let nominatimQueue: Promise<unknown> = Promise.resolve();
let nominatimLast = 0;

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = nominatimQueue.then(async () => {
    const wait = nominatimLast + 1000 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    nominatimLast = Date.now();
    return fn();
  });
  nominatimQueue = run.catch(() => undefined);
  return run;
}

async function nominatim(q: string): Promise<GeocodeResult[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.search = new URLSearchParams({ format: 'jsonv2', countrycodes: 'il', 'accept-language': 'he', limit: '5', q }).toString();
  const res = await throttled(() =>
    fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'application/json', 'User-Agent': `SolGag/0.2 (+${publicConfig.siteUrl})` },
    }),
  );
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  if (!Array.isArray(data)) throw new Error('nominatim: unexpected body');
  return clean(data.map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) })));
}

// Only successful lookups are cached — a thrown error is never stored.
const cachedGeocode = unstable_cache(
  async (provider: 'maptiler' | 'osm', q: string) => {
    const key = process.env.MAPTILER_GEOCODING_KEY;
    return provider === 'maptiler' && key ? maptiler(q, key) : nominatim(q);
  },
  ['geocode-v2'],
  { revalidate: ONE_DAY },
);

export async function GET(req: NextRequest) {
  // Only the (signed-in) publish wizard uses address search. Requiring a session
  // keeps anonymous scrapers from burning the geocoding quota / Nominatim policy.
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: 'sign-in required' }, { status: 401 });
  }
  const parsed = querySchema.safeParse(req.nextUrl.searchParams.get('q') ?? '');
  if (!parsed.success) {
    return NextResponse.json({ error: 'q must be 2-200 characters' }, { status: 400 });
  }
  const q = parsed.data.replace(/\s+/g, ' ');
  const provider = process.env.MAPTILER_GEOCODING_KEY ? 'maptiler' : 'osm';

  try {
    const results = await cachedGeocode(provider, q.toLocaleLowerCase('he'));
    return NextResponse.json(results, {
      headers: { 'Cache-Control': 'private, max-age=3600' },
    });
  } catch {
    return NextResponse.json({ error: 'geocoding unavailable' }, { status: 502 });
  }
}
