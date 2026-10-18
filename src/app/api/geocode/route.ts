import { unstable_cache } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { publicConfig } from '@/lib/config';
import { isInSupportedArea } from '@/lib/geo';
import { getCurrentUser } from '@/lib/supabase/server';

// Address search for the publish wizard. Google Geocoding when a server key is
// configured, otherwise OpenStreetMap Nominatim (low volume only — see
// https://operations.osmfoundation.org/policies/nominatim/). The key never
// leaves the server.

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

async function google(q: string, key: string): Promise<GeocodeResult[]> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.search = new URLSearchParams({ address: q, language: 'iw', region: 'il', components: 'country:IL', key }).toString();
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`google ${res.status}`);
  const data = (await res.json()) as {
    status: string;
    results?: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[];
  };
  if (data.status === 'ZERO_RESULTS') return [];
  // REQUEST_DENIED / OVER_QUERY_LIMIT etc. arrive with HTTP 200 — throw so they are not cached.
  if (data.status !== 'OK') throw new Error(`google ${data.status}`);
  return clean(
    (data.results ?? []).map((r) => ({ label: r.formatted_address, lat: r.geometry.location.lat, lng: r.geometry.location.lng })),
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
  async (provider: 'google' | 'osm', q: string) => {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    return provider === 'google' && key ? google(q, key) : nominatim(q);
  },
  ['geocode-v1'],
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
  const provider = process.env.GOOGLE_MAPS_API_KEY ? 'google' : 'osm';

  try {
    const results = await cachedGeocode(provider, q.toLocaleLowerCase('he'));
    return NextResponse.json(results, {
      headers: { 'Cache-Control': 'private, max-age=3600' },
    });
  } catch {
    return NextResponse.json({ error: 'geocoding unavailable' }, { status: 502 });
  }
}
