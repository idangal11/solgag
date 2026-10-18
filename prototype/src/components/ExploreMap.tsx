import { useEffect } from 'react';
import { MapContainer, Marker, Polygon, Tooltip, useMap, ZoomControl } from 'react-leaflet';
import { AVAILABILITY } from '../labels';
import type { Listing } from '../types';
import { BaseLayers, ISRAEL_BOUNDS, listingBounds, pinIcon } from './mapParts';

interface Props {
  listings: Listing[];
  selectedId: string | null;
  flyKey: number;
  onSelect: (id: string) => void;
  visible: boolean;
}

function Controller({ listings, selectedId, flyKey, visible }: Pick<Props, 'listings' | 'selectedId' | 'flyKey' | 'visible'>) {
  const map = useMap();
  // Leaflet needs a size recalculation when the container was hidden (mobile list view).
  useEffect(() => {
    if (visible) setTimeout(() => map.invalidateSize(), 60);
  }, [visible, map]);

  useEffect(() => {
    if (!flyKey || !selectedId) return;
    const l = listings.find((x) => x.id === selectedId);
    if (!l) return;
    const t = setTimeout(() => {
      map.invalidateSize();
      // Leave room for the preview card (top on desktop, bottom sheet on mobile).
      const mobile = map.getSize().x < 700;
      map.flyToBounds(listingBounds(l), {
        maxZoom: 17,
        paddingTopLeft: [50, mobile ? 70 : 230],
        paddingBottomRight: [50, mobile ? 380 : 40],
        duration: 1.1,
      });
    }, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyKey]);
  return null;
}

export function ExploreMap({ listings, selectedId, flyKey, onSelect, visible }: Props) {
  return (
    <div className="map-ltr" dir="ltr">
      <MapContainer bounds={ISRAEL_BOUNDS} zoomControl={false} className="leaflet-host" minZoom={7} maxZoom={19} worldCopyJump={false}>
        <BaseLayers />
        <ZoomControl position="topright" zoomInTitle="התקרב" zoomOutTitle="התרחק" />
        <Controller listings={listings} selectedId={selectedId} flyKey={flyKey} visible={visible} />
        {listings.filter((l) => l.polygon.length >= 3).map((l) => {
          const color = AVAILABILITY[l.availability].color;
          const sel = l.id === selectedId;
          return (
            <Polygon
              key={`poly-${l.id}`}
              positions={l.polygon}
              pathOptions={{
                color: sel ? '#f5b81c' : color,
                weight: sel ? 4 : 2.5,
                fillColor: color,
                fillOpacity: sel ? 0.35 : 0.22,
                dashArray: l.polygonIllustrative ? '7 6' : undefined,
              }}
              eventHandlers={{ click: () => onSelect(l.id) }}
            >
              <Tooltip direction="top" sticky className="rtl-tip">
                <strong>{l.title}</strong>
                <br />
                {l.polygonIllustrative ? 'גבול להמחשה בלבד — אינו מדידה' : 'גבול ששורטט ע״י המפרסם — לא נמדד'}
              </Tooltip>
            </Polygon>
          );
        })}
        {listings.map((l) => (
          <Marker
            key={`m-${l.id}`}
            position={l.center}
            icon={pinIcon(l.availability, l.id === selectedId)}
            zIndexOffset={l.id === selectedId ? 1000 : 0}
            eventHandlers={{ click: () => onSelect(l.id) }}
            title={l.title}
            alt={l.title}
          />
        ))}
      </MapContainer>
    </div>
  );
}
