import area from '@turf/area';
import centroid from '@turf/centroid';
import type { Feature, Polygon } from 'geojson';
import type { LatLng } from './types';

/** Supported area (Israel bounding box) — mirrors the DB guard trigger. */
export const SUPPORTED_BOUNDS = { minLng: 34.2, minLat: 29.4, maxLng: 35.95, maxLat: 33.4 } as const;

export function isInSupportedArea([lat, lng]: LatLng): boolean {
  const b = SUPPORTED_BOUNDS;
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}

/** Leaflet-style [lat,lng] ring → closed GeoJSON polygon ([lng,lat]). */
export function toGeoJSON(ring: LatLng[]): Feature<Polygon> {
  const coords = ring.map(([lat, lng]) => [lng, lat]);
  if (coords.length) coords.push(coords[0]);
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } };
}

/** GeoJSON polygon geometry → Leaflet ring without the closing point. */
export function fromGeoJSONPolygon(geom: { type: string; coordinates: number[][][] } | null | undefined): LatLng[] {
  if (!geom || geom.type !== 'Polygon' || !geom.coordinates?.[0]) return [];
  const ring = geom.coordinates[0].map(([lng, lat]) => [lat, lng] as LatLng);
  if (ring.length > 1) {
    const [a, b] = [ring[0], ring[ring.length - 1]];
    if (a[0] === b[0] && a[1] === b[1]) ring.pop();
  }
  return ring;
}

/** Geodesic area in m² (Turf.js). The server recomputes it with PostGIS. */
export function polygonAreaSqm(ring: LatLng[]): number {
  if (ring.length < 3) return 0;
  return area(toGeoJSON(ring));
}

export function polygonCentroid(ring: LatLng[]): LatLng {
  const c = centroid(toGeoJSON(ring)).geometry.coordinates;
  return [c[1], c[0]];
}

/** EWKT for PostGIS geography columns (PostgREST accepts it as text input). */
export function pointEWKT([lat, lng]: LatLng): string {
  return `SRID=4326;POINT(${lng} ${lat})`;
}

export function polygonEWKT(ring: LatLng[]): string {
  const pts = [...ring, ring[0]].map(([lat, lng]) => `${lng} ${lat}`).join(',');
  return `SRID=4326;POLYGON((${pts}))`;
}

/** True if any two non-adjacent edges of the ring cross (self-intersection). */
export function isSelfIntersecting(ring: LatLng[]): boolean {
  const n = ring.length;
  if (n < 4) return false;
  const seg = (i: number) => [ring[i], ring[(i + 1) % n]] as const;
  const orient = (p: LatLng, q: LatLng, r: LatLng) => Math.sign((q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      const [a, b] = seg(i);
      const [c, d] = seg(j);
      if (orient(a, b, c) !== orient(a, b, d) && orient(c, d, a) !== orient(c, d, b)) return true;
    }
  }
  return false;
}
