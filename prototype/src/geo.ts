import area from '@turf/area';
import centroid from '@turf/centroid';
import type { Feature, Polygon } from 'geojson';
import type { LatLng } from './types';

/** Leaflet-style [lat,lng] ring → closed GeoJSON polygon ([lng,lat]). */
export function toGeoJSON(ring: LatLng[]): Feature<Polygon> {
  const coords = ring.map(([lat, lng]) => [lng, lat]);
  if (coords.length) coords.push(coords[0]);
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } };
}

/** Geodesic area in m² (Turf.js), not pixel based. */
export function polygonAreaSqm(ring: LatLng[]): number {
  if (ring.length < 3) return 0;
  return area(toGeoJSON(ring));
}

export function polygonCentroid(ring: LatLng[]): LatLng {
  const c = centroid(toGeoJSON(ring)).geometry.coordinates;
  return [c[1], c[0]];
}

/**
 * Builds an illustrative footprint around a centre: a rotated rectangle,
 * optionally with a notch to make an L shape. Used only for fictional demo data.
 */
export function illustrativeFootprint(
  center: LatLng,
  widthM: number,
  lengthM: number,
  rotationDeg: number,
  notch?: { w: number; l: number },
): LatLng[] {
  const [lat0, lng0] = center;
  const mPerLat = 111_320;
  const mPerLng = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const hw = widthM / 2;
  const hl = lengthM / 2;
  let pts: [number, number][] = notch
    ? [
        [-hw, -hl],
        [hw, -hl],
        [hw, hl - notch.l],
        [hw - notch.w, hl - notch.l],
        [hw - notch.w, hl],
        [-hw, hl],
      ]
    : [
        [-hw, -hl],
        [hw, -hl],
        [hw, hl],
        [-hw, hl],
      ];
  const r = (rotationDeg * Math.PI) / 180;
  pts = pts.map(([x, y]) => [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)]);
  return pts.map(([x, y]) => [lat0 + y / mPerLat, lng0 + x / mPerLng]);
}
