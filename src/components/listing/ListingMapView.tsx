'use client';

// Leaflet module — load only through ListingMap (next/dynamic, ssr: false).

import L from 'leaflet';
import { MapContainer, Marker, Polygon, ZoomControl } from 'react-leaflet';
import { BaseLayers, listingBounds, pinIcon } from '@/components/map/mapParts';
import type { Availability, LatLng } from '@/lib/types';

export interface ListingMapViewProps {
  center: LatLng;
  polygon: LatLng[];
  /** Dashed outline: the shape is an illustration, not a real boundary. */
  illustrative: boolean;
  availability: Availability;
}

export default function ListingMapView({ center, polygon, illustrative, availability }: ListingMapViewProps) {
  return (
    <MapContainer
      bounds={listingBounds({ polygon, center })}
      boundsOptions={{ padding: [40, 40], maxZoom: 18 }}
      zoomControl={false}
      scrollWheelZoom={false}
      // One-finger drag would trap page scrolling on phones; pinch and the zoom buttons still work.
      dragging={!L.Browser.mobile}
      className="leaflet-host"
    >
      <BaseLayers defaultAerial />
      <ZoomControl position="topright" />
      {polygon.length >= 3 ? (
        <Polygon
          positions={polygon}
          interactive={false}
          pathOptions={{ color: '#f5b81c', weight: 3, fillOpacity: 0.2, dashArray: illustrative ? '7 6' : undefined }}
        />
      ) : (
        <Marker position={center} icon={pinIcon(availability)} interactive={false} keyboard={false} />
      )}
    </MapContainer>
  );
}
