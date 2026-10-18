import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  fromGeoJSONPolygon,
  isInSupportedArea,
  isSelfIntersecting,
  pointEWKT,
  polygonAreaSqm,
  polygonCentroid,
  polygonEWKT,
  SUPPORTED_BOUNDS,
  toGeoJSON,
} from './geo';
import type { LatLng } from './types';

const EARTH_RADIUS_M = 6_371_008.8;
const DEG = Math.PI / 180;

/** Axis-aligned rectangle of widthM (east–west) × heightM (north–south), SW corner first, counter-clockwise. */
function rectangle([lat, lng]: LatLng, widthM: number, heightM: number): LatLng[] {
  const dLat = heightM / (EARTH_RADIUS_M * DEG);
  const dLng = widthM / (EARTH_RADIUS_M * Math.cos(lat * DEG) * DEG);
  return [
    [lat, lng],
    [lat, lng + dLng],
    [lat + dLat, lng + dLng],
    [lat + dLat, lng],
  ];
}

// A warehouse-sized roof in an industrial zone near Petah Tikva.
const ORIGIN: LatLng = [32.1, 34.88];
const RECT = rectangle(ORIGIN, 100, 50);

/** Shape on a small grid (units of ~11 m) around ORIGIN. */
const grid = (pts: [number, number][]): LatLng[] => pts.map(([y, x]) => [ORIGIN[0] + y * 1e-4, ORIGIN[1] + x * 1e-4]);
const SQUARE = grid([
  [0, 0],
  [0, 2],
  [2, 2],
  [2, 0],
]);
const BOWTIE = grid([
  [0, 0],
  [2, 2],
  [0, 2],
  [2, 0],
]);
const L_SHAPE = grid([
  [0, 0],
  [0, 2],
  [1, 2],
  [1, 1],
  [2, 1],
  [2, 0],
]);

describe('polygonAreaSqm', () => {
  it('measures a ~100 m × 50 m rectangle as ≈ 5,000 m² (±1%)', () => {
    const a = polygonAreaSqm(RECT);
    expect(a).toBeGreaterThan(5000 * 0.99);
    expect(a).toBeLessThan(5000 * 1.01);
  });

  it('does not depend on vertex order', () => {
    expect(polygonAreaSqm([...RECT].reverse())).toBeCloseTo(polygonAreaSqm(RECT), 3);
  });

  it('is 0 for fewer than 3 points', () => {
    expect(polygonAreaSqm([])).toBe(0);
    expect(polygonAreaSqm(RECT.slice(0, 2))).toBe(0);
  });

  it('measures an L-shape as three quarters of its bounding square', () => {
    expect(polygonAreaSqm(L_SHAPE) / polygonAreaSqm(SQUARE)).toBeCloseTo(0.75, 3);
  });
});

describe('GeoJSON conversion', () => {
  it('swaps to [lng, lat] and closes the ring', () => {
    const f = toGeoJSON(RECT);
    expect(f.type).toBe('Feature');
    expect(f.geometry.type).toBe('Polygon');
    const ring = f.geometry.coordinates[0];
    expect(ring).toHaveLength(RECT.length + 1);
    expect(ring[0]).toEqual([RECT[0][1], RECT[0][0]]);
    expect(ring[ring.length - 1]).toEqual(ring[0]);
  });

  it('round-trips through fromGeoJSONPolygon without the closing point', () => {
    expect(fromGeoJSONPolygon(toGeoJSON(RECT).geometry)).toEqual(RECT);
    expect(fromGeoJSONPolygon(toGeoJSON(L_SHAPE).geometry)).toEqual(L_SHAPE);
  });

  it('keeps an unclosed ring as is', () => {
    const coordinates = [RECT.map(([lat, lng]) => [lng, lat])];
    expect(fromGeoJSONPolygon({ type: 'Polygon', coordinates })).toEqual(RECT);
  });

  it('returns an empty ring for missing or non-polygon geometry', () => {
    expect(fromGeoJSONPolygon(null)).toEqual([]);
    expect(fromGeoJSONPolygon(undefined)).toEqual([]);
    expect(fromGeoJSONPolygon({ type: 'MultiPolygon', coordinates: [] })).toEqual([]);
    expect(fromGeoJSONPolygon({ type: 'Polygon', coordinates: [] })).toEqual([]);
  });

  it('reads the PostGIS st_asgeojson output used by listing_feed', () => {
    // Taken from the shape of supabase/seed.sql footprints.
    const geom = {
      type: 'Polygon',
      coordinates: [
        [
          [35.2402651, 30.6501407],
          [35.2407349, 30.6501407],
          [35.2407349, 30.6508593],
          [35.2402651, 30.6508593],
          [35.2402651, 30.6501407],
        ],
      ],
    };
    const ring = fromGeoJSONPolygon(geom);
    expect(ring).toHaveLength(4);
    expect(ring[0]).toEqual([30.6501407, 35.2402651]);
  });
});

describe('polygonCentroid', () => {
  it('is the middle of a rectangle', () => {
    const [lat, lng] = polygonCentroid(RECT);
    expect(lat).toBeCloseTo((RECT[0][0] + RECT[2][0]) / 2, 7);
    expect(lng).toBeCloseTo((RECT[0][1] + RECT[2][1]) / 2, 7);
  });
});

describe('EWKT', () => {
  it('writes a point as SRID=4326;POINT(lng lat)', () => {
    expect(pointEWKT([32.09025, 34.8803])).toBe('SRID=4326;POINT(34.8803 32.09025)');
  });

  it('writes a closed polygon ring in lng/lat order', () => {
    const ring: LatLng[] = [
      [32.09, 34.88],
      [32.09, 34.8806],
      [32.0905, 34.8806],
    ];
    expect(polygonEWKT(ring)).toBe('SRID=4326;POLYGON((34.88 32.09,34.8806 32.09,34.8806 32.0905,34.88 32.09))');
  });
});

describe('isSelfIntersecting', () => {
  it('accepts a square', () => {
    expect(isSelfIntersecting(SQUARE)).toBe(false);
  });

  it('detects a bow-tie', () => {
    expect(isSelfIntersecting(BOWTIE)).toBe(true);
  });

  it('accepts a concave L-shape', () => {
    expect(isSelfIntersecting(L_SHAPE)).toBe(false);
    expect(isSelfIntersecting([...L_SHAPE].reverse())).toBe(false);
  });

  it('detects a crossing introduced by moving one vertex of an L-shape', () => {
    // Pull the inner corner [1,1] beyond the far edge — the outline now crosses itself.
    const broken = L_SHAPE.slice();
    broken[3] = grid([[1, -1]])[0];
    expect(isSelfIntersecting(broken)).toBe(true);
  });

  it('never flags triangles or incomplete outlines', () => {
    expect(isSelfIntersecting([])).toBe(false);
    expect(isSelfIntersecting(SQUARE.slice(0, 3))).toBe(false);
  });
});

describe('isInSupportedArea', () => {
  it('accepts locations in Israel, from the Galilee to Eilat', () => {
    expect(isInSupportedArea([32.08, 34.78])).toBe(true); // Tel Aviv
    expect(isInSupportedArea([32.92, 35.32])).toBe(true); // Karmiel
    expect(isInSupportedArea([29.56, 34.95])).toBe(true); // Eilat
    expect(isInSupportedArea(ORIGIN)).toBe(true);
  });

  it('includes the edges of the box', () => {
    const b = SUPPORTED_BOUNDS;
    expect(isInSupportedArea([b.minLat, b.minLng])).toBe(true);
    expect(isInSupportedArea([b.maxLat, b.maxLng])).toBe(true);
  });

  it('rejects locations outside the box, and swapped lat/lng', () => {
    expect(isInSupportedArea([40.71, -74.0])).toBe(false); // New York
    expect(isInSupportedArea([33.41, 35.5])).toBe(false); // just north of the box
    expect(isInSupportedArea([31.5, 34.19])).toBe(false); // just west of the box
    expect(isInSupportedArea([34.78, 32.08])).toBe(false); // [lng, lat] by mistake
  });

  it('mirrors the bounding box enforced by the database trigger', () => {
    const sql = readFileSync(new URL('../../supabase/migrations/20261018000000_init.sql', import.meta.url), 'utf8');
    const m = sql.match(/st_makeenvelope\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*4326\)/);
    expect(m, 'listings_guard envelope not found in the migration').not.toBeNull();
    const [minLng, minLat, maxLng, maxLat] = m!.slice(1).map(Number);
    expect({ minLng, minLat, maxLng, maxLat }).toEqual({ ...SUPPORTED_BOUNDS });
  });
});
