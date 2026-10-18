'use client';

// Leaflet touches `window` at import time — this module is only loaded through
// next/dynamic({ ssr: false }) from ExploreClient.

import L from 'leaflet';
import { memo, useEffect, type RefObject } from 'react';
import { MapContainer, Marker, Polygon, Tooltip, useMap, ZoomControl } from 'react-leaflet';
import { BaseLayers, ISRAEL_BOUNDS, listingBounds, pinIcon } from '@/components/map/mapParts';
import { SAMPLE_STATUS } from '@/components/ui';
import { AVAILABILITY } from '@/lib/labels';
import type { Listing } from '@/lib/types';
import { prefersReducedMotion } from './useMediaQuery';

/** A fresh object per request, so asking for the same rooftop again flies again. */
export interface FlyRequest {
  target: Pick<Listing, 'center' | 'polygon'>;
}

interface Props {
  listings: Listing[];
  selectedId: string | null;
  flyTo: FlyRequest | null;
  onSelect: (id: string) => void;
  /** False while the map is hidden behind the list (mobile). */
  visible: boolean;
  /** The preview card floating over the map; flights keep the rooftop clear of it. */
  overlayRef: RefObject<HTMLElement | null>;
}

const MIN_VISIBLE_PX = 140;

/**
 * Fit padding that leaves room for the preview card: a top card on desktop,
 * a bottom sheet on mobile. Measured from the DOM so it follows the real layout.
 */
function overlayPadding(map: L.Map, overlay: HTMLElement | null) {
  const box = map.getContainer().getBoundingClientRect();
  const side = 40;
  let top = 60; // layer switcher / zoom / mobile legend
  let bottom = 70; // attribution / mobile list-map toggle
  const o = overlay?.getBoundingClientRect();
  if (o && o.height > 0) {
    const atTop = o.top + o.height / 2 < box.top + box.height / 2;
    if (atTop) top = Math.max(top, o.bottom - box.top + 16);
    else bottom = Math.max(bottom, box.bottom - o.top + 16);
    // On short screens let the card overlap a little rather than zooming out to nothing.
    const excess = top + bottom + MIN_VISIBLE_PX - box.height;
    if (excess > 0) {
      if (atTop) top = Math.max(10, top - excess);
      else bottom = Math.max(10, bottom - excess);
    }
  }
  return { paddingTopLeft: L.point(side, top), paddingBottomRight: L.point(side, bottom) };
}

function Controller({ flyTo, visible, overlayRef }: Pick<Props, 'flyTo' | 'visible' | 'overlayRef'>) {
  const map = useMap();

  // Leaflet needs a size recalculation after its container was hidden.
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => map.invalidateSize(), 60);
    return () => clearTimeout(t);
  }, [visible, map]);

  useEffect(() => {
    if (!flyTo) return;
    // Wait a beat so the preview card (and a just-revealed map) are laid out.
    const t = setTimeout(() => {
      map.invalidateSize();
      const bounds = listingBounds(flyTo.target);
      const opts = { maxZoom: 17, ...overlayPadding(map, overlayRef.current) };
      if (prefersReducedMotion()) map.fitBounds(bounds, opts);
      else map.flyToBounds(bounds, { ...opts, duration: 1.1 });
    }, 80);
    return () => clearTimeout(t);
  }, [flyTo, map, overlayRef]);

  return null;
}

const RoofLayer = memo(function RoofLayer({ listing: l, selected, onSelect }: { listing: Listing; selected: boolean; onSelect: (id: string) => void }) {
  // Sample listings get a neutral color: they cannot receive inquiries, so they must not look "open".
  const status = l.isFictional ? SAMPLE_STATUS : AVAILABILITY[l.availability];
  const handlers = { click: () => onSelect(l.id) };
  const sample = l.isFictional ? 'מודעה לדוגמה — בדויה, לא פתוחה לפניות' : null;
  return (
    <>
      {l.polygon.length >= 3 && (
        <Polygon
          positions={l.polygon}
          pathOptions={{
            color: selected ? '#f5b81c' : status.color,
            weight: selected ? 4 : 2.5,
            fillColor: status.color,
            fillOpacity: selected ? 0.35 : 0.22,
            dashArray: l.polygonIllustrative ? '7 6' : undefined,
          }}
          eventHandlers={handlers}
        >
          <Tooltip direction="top" sticky className="rtl-tip">
            <strong>{l.title}</strong>
            <br />
            {l.polygonIllustrative ? 'גבול להמחשה בלבד — אינו מדידה' : 'גבול ששורטט ע״י המפרסם — לא נמדד'}
            {sample && (
              <>
                <br />
                {sample}
              </>
            )}
          </Tooltip>
        </Polygon>
      )}
      <Marker
        position={l.center}
        icon={pinIcon(l.isFictional ? 'sample' : l.availability, selected)}
        zIndexOffset={selected ? 1000 : 0}
        eventHandlers={handlers}
        title={[l.title, status.label, sample].filter(Boolean).join(' · ')}
        alt={l.title}
      />
    </>
  );
});

export default function ExploreMap({ listings, selectedId, flyTo, onSelect, visible, overlayRef }: Props) {
  return (
    <div className="map-ltr" dir="ltr">
      <MapContainer bounds={ISRAEL_BOUNDS} zoomControl={false} className="leaflet-host" minZoom={7} maxZoom={19} worldCopyJump={false}>
        <BaseLayers />
        <ZoomControl position="topright" zoomInTitle="התקרב" zoomOutTitle="התרחק" />
        <Controller flyTo={flyTo} visible={visible} overlayRef={overlayRef} />
        {listings.map((l) => (
          <RoofLayer key={l.id} listing={l} selected={l.id === selectedId} onSelect={onSelect} />
        ))}
      </MapContainer>
    </div>
  );
}
