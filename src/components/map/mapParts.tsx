'use client';

// Leaflet touches `window` at import time — only import this module from
// components loaded with next/dynamic({ ssr: false }).

import L from 'leaflet';
import { useEffect } from 'react';
import { LayersControl, TileLayer, useMap } from 'react-leaflet';
import { publicConfig } from '@/lib/config';
import { AVAILABILITY } from '@/lib/labels';
import type { Availability, LatLng } from '@/lib/types';

export const ISRAEL_BOUNDS: L.LatLngBoundsExpression = [
  [29.45, 34.2],
  [33.35, 35.9],
];

/** Street map + aerial imagery. Providers come from env (see .env.example). */
export function BaseLayers({ defaultAerial = false }: { defaultAerial?: boolean }) {
  const m = publicConfig.map;
  const map = useMap();
  // Leaflet hard-codes an English "Layers" title on the layer switcher toggle.
  useEffect(() => {
    const toggle = map.getContainer().querySelector<HTMLElement>('.leaflet-control-layers-toggle');
    if (!toggle) return;
    toggle.title = 'שכבות מפה';
    toggle.setAttribute('aria-label', 'בחירת שכבת מפה: מפה או תצלום אוויר');
  }, [map]);
  return (
    <LayersControl position="topleft">
      {/* updateWhenZooming=false: load tiles once a zoom ends, not for every intermediate
          level — every tile is a billable request with the licensed providers. */}
      <LayersControl.BaseLayer checked={!defaultAerial} name="מפה">
        <TileLayer url={m.tileUrl} attribution={m.tileAttribution} className="osm-tiles" maxNativeZoom={19} maxZoom={20} updateWhenZooming={false} />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer checked={defaultAerial} name="תצלום אוויר">
        <TileLayer url={m.imageryUrl} attribution={m.imageryAttribution} maxNativeZoom={m.imageryMaxNativeZoom} maxZoom={20} updateWhenZooming={false} />
      </LayersControl.BaseLayer>
    </LayersControl>
  );
}

/** Bounds of a listing's footprint, or a small box around its point if none was drawn. */
export function listingBounds(l: { polygon: LatLng[]; center: LatLng }): L.LatLngBounds {
  if (l.polygon.length >= 3) return L.latLngBounds(l.polygon);
  return L.latLng(l.center).toBounds(160);
}

const iconCache = new Map<string, L.DivIcon>();

/** 'sample' = fictional demo listing (neutral pin; it cannot receive inquiries). */
export function pinIcon(status: Availability | 'draft' | 'sample', selected = false): L.DivIcon {
  const key = `${status}-${selected}`;
  const cached = iconCache.get(key);
  if (cached) return cached;
  const color = status === 'draft' ? '#0f3d2e' : status === 'sample' ? '#6b7a73' : AVAILABILITY[status].color;
  const icon = L.divIcon({
    className: 'roof-pin-wrap',
    html: `<div class="roof-pin${selected ? ' is-selected' : ''}" style="--pin:${color}">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="#f5b81c"/><g stroke="#f5b81c" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7"/></g></svg>
    </div>`,
    iconSize: selected ? [40, 48] : [32, 40],
    iconAnchor: selected ? [20, 46] : [16, 38],
  });
  iconCache.set(key, icon);
  return icon;
}

export const vertexIcon = L.divIcon({
  className: 'vertex-wrap',
  html: '<div class="vertex-handle"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});
