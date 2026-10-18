import { NextResponse, type NextRequest } from 'next/server';
import { isInSupportedArea } from '@/lib/geo';

// Proxies the EU JRC PVGIS "PVcalc" API (free, no key, no browser CORS) and
// returns the annual yield of 1 kWp at the given location.
// https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis_en

export const revalidate = 2592000; // 30 days

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get('lat'));
  const lng = Number(req.nextUrl.searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isInSupportedArea([lat, lng])) {
    return NextResponse.json({ error: 'invalid location' }, { status: 400 });
  }

  // Round to ~1 km so nearby rooftops share the cache entry.
  const url = new URL('https://re.jrc.ec.europa.eu/api/v5_3/PVcalc');
  url.search = new URLSearchParams({
    lat: lat.toFixed(2),
    lon: lng.toFixed(2),
    peakpower: '1',
    loss: '14',
    optimalangles: '1',
    outputformat: 'json',
  }).toString();

  try {
    const res = await fetch(url, { next: { revalidate }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`PVGIS ${res.status}`);
    const data = (await res.json()) as { outputs?: { totals?: { fixed?: { E_y?: number } } } };
    const ey = data.outputs?.totals?.fixed?.E_y;
    if (typeof ey !== 'number' || ey <= 0) throw new Error('PVGIS: no E_y');
    return NextResponse.json(
      { yieldKwhPerKw: ey, source: 'PVGIS v5.3 (EU JRC)' },
      { headers: { 'Cache-Control': 'public, s-maxage=2592000, stale-while-revalidate=86400' } },
    );
  } catch {
    return NextResponse.json({ error: 'pvgis unavailable' }, { status: 502 });
  }
}
