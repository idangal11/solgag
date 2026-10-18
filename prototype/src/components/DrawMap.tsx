import { useEffect } from 'react';
import { MapContainer, Marker, Polygon, Polyline, useMap, useMapEvents, ZoomControl } from 'react-leaflet';
import type { LatLng } from '../types';
import { BaseLayers, ISRAEL_BOUNDS, pinIcon, vertexIcon } from './mapParts';

export type DrawMode = 'locate' | 'draw';

interface Props {
  mode: DrawMode;
  location: LatLng | null;
  polygon: LatLng[];
  flyTo: { at: LatLng; key: number } | null;
  onLocation: (p: LatLng) => void;
  onPolygon: (p: LatLng[]) => void;
}

function Events({ mode, polygon, onLocation, onPolygon }: Pick<Props, 'mode' | 'polygon' | 'onLocation' | 'onPolygon'>) {
  useMapEvents({
    click(e) {
      const p: LatLng = [e.latlng.lat, e.latlng.lng];
      if (mode === 'locate') onLocation(p);
      else onPolygon([...polygon, p]);
    },
  });
  return null;
}

function Fly({ flyTo }: { flyTo: Props['flyTo'] }) {
  const map = useMap();
  useEffect(() => {
    if (flyTo) map.flyTo(flyTo.at, 18, { duration: 1 });
  }, [flyTo, map]);
  return null;
}

export function DrawMap({ mode, location, polygon, flyTo, onLocation, onPolygon }: Props) {
  return (
    <div className={`map-ltr draw-map mode-${mode}`} dir="ltr">
      <MapContainer bounds={ISRAEL_BOUNDS} zoomControl={false} className="leaflet-host" maxZoom={19} doubleClickZoom={false}>
        <BaseLayers defaultAerial />
        <ZoomControl position="topright" />
        <Events mode={mode} polygon={polygon} onLocation={onLocation} onPolygon={onPolygon} />
        <Fly flyTo={flyTo} />
        {location && (
          <Marker
            position={location}
            icon={pinIcon('draft')}
            draggable={mode === 'locate'}
            eventHandlers={{
              dragend: (e) => {
                const ll = e.target.getLatLng();
                onLocation([ll.lat, ll.lng]);
              },
            }}
          />
        )}
        {polygon.length >= 3 && <Polygon positions={polygon} pathOptions={{ color: '#f5b81c', weight: 3, fillColor: '#f5b81c', fillOpacity: 0.25 }} interactive={false} />}
        {polygon.length === 2 && <Polyline positions={polygon} pathOptions={{ color: '#f5b81c', weight: 3 }} interactive={false} />}
        {mode === 'draw' &&
          polygon.map((p, i) => (
            <Marker
              key={i}
              position={p}
              icon={vertexIcon}
              draggable
              eventHandlers={{
                drag: (e) => {
                  const ll = e.target.getLatLng();
                  const next = polygon.slice();
                  next[i] = [ll.lat, ll.lng];
                  onPolygon(next);
                },
                contextmenu: () => onPolygon(polygon.filter((_, j) => j !== i)),
              }}
            />
          ))}
      </MapContainer>
    </div>
  );
}
