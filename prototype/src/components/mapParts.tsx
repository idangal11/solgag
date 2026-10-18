import L from 'leaflet';
import { LayersControl, TileLayer } from 'react-leaflet';
import { AVAILABILITY } from '../labels';
import type { Availability } from '../types';

export const ISRAEL_BOUNDS: L.LatLngBoundsExpression = [
  [29.45, 34.2],
  [33.35, 35.9],
];

/** Free tile sources, no API key. Attribution is shown in the map corner. */
export function BaseLayers({ defaultAerial = false }: { defaultAerial?: boolean }) {
  return (
    <LayersControl position="topleft">
      <LayersControl.BaseLayer checked={!defaultAerial} name="מפה">
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'
          className="osm-tiles"
          maxNativeZoom={19}
          maxZoom={20}
        />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer checked={defaultAerial} name="תצלום אוויר">
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community"
          maxZoom={19}
        />
      </LayersControl.BaseLayer>
    </LayersControl>
  );
}

/** Bounds of a listing's footprint, or a small box around its point if none was drawn. */
export function listingBounds(l: { polygon: [number, number][]; center: [number, number] }): L.LatLngBounds {
  if (l.polygon.length >= 3) return L.latLngBounds(l.polygon);
  return L.latLng(l.center).toBounds(160);
}

const iconCache = new Map<string, L.DivIcon>();

export function pinIcon(status: Availability | 'draft', selected = false): L.DivIcon {
  const key = `${status}-${selected}`;
  const cached = iconCache.get(key);
  if (cached) return cached;
  const color = status === 'draft' ? '#0f3d2e' : AVAILABILITY[status].color;
  const icon = L.divIcon({
    className: 'roof-pin-wrap',
    html: `<div class="roof-pin${selected ? ' is-selected' : ''}" style="--pin:${color}">
      <svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="4.2" fill="#f5b81c"/><g stroke="#f5b81c" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7"/></g></svg>
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
