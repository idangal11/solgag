'use client';

// Leaflet map for the publish wizard. Load only via next/dynamic({ ssr: false }).

import L from 'leaflet';
import { useEffect, useState } from 'react';
import { MapContainer, Marker, Polygon, Polyline, useMap, useMapEvents, ZoomControl } from 'react-leaflet';
import { BaseLayers, ISRAEL_BOUNDS, listingBounds, pinIcon, vertexIcon } from '@/components/map/mapParts';
import type { LatLng } from '@/lib/types';
import { MAX_VERTICES, type DrawMode } from './draft';

export interface DrawMapProps {
  mode: DrawMode;
  location: LatLng | null;
  polygon: LatLng[];
  /** Highlights the outline in red (e.g. self-intersecting). */
  invalid?: boolean;
  flyTo: { at: LatLng; key: number } | null;
  onLocation: (p: LatLng) => void;
  onPolygon: (p: LatLng[]) => void;
  onReady?: (api: MapApi) => void;
}

export interface MapApi {
  center: () => LatLng;
}

const SUN = '#f5b81c';
const DANGER = '#c0392b';

function Events({ mode, polygon, onLocation, onPolygon }: Pick<DrawMapProps, 'mode' | 'polygon' | 'onLocation' | 'onPolygon'>) {
  useMapEvents({
    click(e) {
      const p: LatLng = [e.latlng.lat, e.latlng.lng];
      if (mode === 'locate') {
        onLocation(p);
        return;
      }
      const last = polygon[polygon.length - 1];
      // A double click would add two points on the same spot, which reads as a self-crossing edge.
      if (last && e.latlng.distanceTo(L.latLng(last)) < 0.5) return;
      if (polygon.length >= MAX_VERTICES) return;
      onPolygon([...polygon, p]);
    },
  });
  return null;
}

function Fly({ flyTo }: { flyTo: DrawMapProps['flyTo'] }) {
  const map = useMap();
  useEffect(() => {
    // setView (not flyTo): no tiles fetched for the intermediate zoom levels.
    if (flyTo) map.setView(flyTo.at, 18);
  }, [flyTo, map]);
  return null;
}

/** Hands the parent a way to read the map center (keyboard path: pan with arrows, then "mark center"). */
function ReadyBridge({ onReady }: { onReady: DrawMapProps['onReady'] }) {
  const map = useMap();
  useEffect(() => {
    onReady?.({
      center: () => {
        const c = map.getCenter();
        return [c.lat, c.lng];
      },
    });
  }, [map, onReady]);
  return null;
}

export function DrawMap({ mode, location, polygon, invalid, flyTo, onLocation, onPolygon, onReady }: DrawMapProps) {
  // Initial view only — later moves come from the user or from flyTo.
  const [initialBounds] = useState<L.LatLngBoundsExpression>(() =>
    polygon.length >= 3 || location ? listingBounds({ polygon, center: location ?? polygon[0] }).pad(0.3) : ISRAEL_BOUNDS,
  );
  const color = invalid ? DANGER : SUN;

  return (
    <div
      className={`map-ltr draw-map mode-${mode}`}
      dir="ltr"
      role="region"
      aria-label={mode === 'locate' ? 'מפה לסימון מיקום המבנה' : 'מפה לשרטוט גבולות הגג'}
    >
      <MapContainer bounds={initialBounds} zoomControl={false} className="leaflet-host" maxZoom={19} doubleClickZoom={false}>
        <BaseLayers defaultAerial />
        <ZoomControl position="topright" zoomInTitle="התקרב" zoomOutTitle="התרחק" />
        <Events mode={mode} polygon={polygon} onLocation={onLocation} onPolygon={onPolygon} />
        <Fly flyTo={flyTo} />
        <ReadyBridge onReady={onReady} />
        {location && (
          <Marker
            position={location}
            icon={pinIcon('draft')}
            draggable={mode === 'locate'}
            keyboard={false}
            title="מיקום המבנה"
            alt="מיקום המבנה"
            eventHandlers={{
              dragend: (e) => {
                const ll = (e.target as L.Marker).getLatLng();
                onLocation([ll.lat, ll.lng]);
              },
            }}
          />
        )}
        {polygon.length >= 3 && (
          <Polygon positions={polygon} pathOptions={{ color, weight: 3, fillColor: color, fillOpacity: 0.25 }} interactive={false} />
        )}
        {polygon.length === 2 && <Polyline positions={polygon} pathOptions={{ color, weight: 3 }} interactive={false} />}
        {mode === 'draw' &&
          polygon.map((p, i) => (
            <Marker
              key={i}
              position={p}
              icon={vertexIcon}
              draggable
              keyboard={false}
              title={`נקודה ${i + 1} — גררו להזזה, לחיצה ימנית או לחיצה ארוכה למחיקה`}
              eventHandlers={{
                drag: (e) => {
                  const ll = (e.target as L.Marker).getLatLng();
                  const next = polygon.slice();
                  next[i] = [ll.lat, ll.lng];
                  onPolygon(next);
                },
                // Right click on desktop; Leaflet also fires it on long-press for touch.
                contextmenu: (e) => {
                  L.DomEvent.preventDefault(e.originalEvent);
                  onPolygon(polygon.filter((_, j) => j !== i));
                },
              }}
            />
          ))}
      </MapContainer>
      {/* Where „סימון במרכז המפה" will put the pin (keyboard users pan the map under it). */}
      {mode === 'locate' && (
        <svg className="map-crosshair" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" focusable="false">
          <path d="M16 3v8M16 21v8M3 16h8M21 16h8" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
          <path d="M16 3v8M16 21v8M3 16h8M21 16h8" fill="none" stroke="#0f3d2e" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="16" cy="16" r="2.2" fill="#0f3d2e" stroke="#fff" strokeWidth="1.5" />
        </svg>
      )}
    </div>
  );
}
