'use client';

// Leaflet touches `window` at import time — load only through
// next/dynamic({ ssr: false }) (see ProspectsWorkspace).

import L from 'leaflet';
import { memo, useEffect, useRef } from 'react';
import { MapContainer, Polygon, Tooltip, useMap, ZoomControl } from 'react-leaflet';
import { prefersReducedMotion } from '@/components/explore/useMediaQuery';
import { BaseLayers, ISRAEL_BOUNDS } from '@/components/map/mapParts';
import { fmtNum } from '@/lib/labels';
import { REVIEW, type ProspectRoof } from '@/lib/prospects';

interface Props {
  roofs: ProspectRoof[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function Fit({ roofs, selectedId }: Pick<Props, 'roofs' | 'selectedId'>) {
  const map = useMap();
  const fitted = useRef(false);

  // Frame all roofs once, when they first arrive.
  useEffect(() => {
    if (fitted.current || !roofs.length) return;
    fitted.current = true;
    map.fitBounds(L.latLngBounds(roofs.flatMap((r) => r.polygon)), { padding: [30, 30], maxZoom: 17, animate: false });
  }, [roofs, map]);

  // Bring the selected roof into view without zooming out the reviewer's view.
  useEffect(() => {
    const r = roofs.find((x) => x.id === selectedId);
    if (!r || r.polygon.length < 3) return;
    const bounds = L.latLngBounds(r.polygon);
    if (map.getBounds().contains(bounds) && map.getZoom() >= 16) return;
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 18, animate: !prefersReducedMotion() });
  }, [selectedId, roofs, map]);

  return null;
}

const RoofShape = memo(function RoofShape({ roof, selected, onSelect }: { roof: ProspectRoof; selected: boolean; onSelect: (id: string) => void }) {
  const color = REVIEW[roof.reviewStatus].color;
  return (
    <Polygon
      positions={roof.polygon}
      pathOptions={{
        color: selected ? '#f5b81c' : color,
        weight: selected ? 4 : 2,
        fillColor: color,
        fillOpacity: selected ? 0.4 : 0.22,
        // Demo rows are dashed so they never pass for real records.
        dashArray: roof.isDemo ? '6 5' : undefined,
      }}
      eventHandlers={{ click: () => onSelect(roof.id) }}
    >
      <Tooltip direction="top" sticky className="rtl-tip">
        <strong>{roof.ref}</strong>
        {roof.isDemo && ' · נתוני הדגמה'}
        <br />
        {fmtNum(roof.areaM2)} מ״ר (משוער) · {REVIEW[roof.reviewStatus].label}
      </Tooltip>
    </Polygon>
  );
});

export default function ProspectsMap({ roofs, selectedId, onSelect }: Props) {
  return (
    <div className="map-ltr" dir="ltr">
      <MapContainer bounds={ISRAEL_BOUNDS} zoomControl={false} className="leaflet-host" minZoom={7} maxZoom={20} worldCopyJump={false}>
        <BaseLayers />
        <ZoomControl position="topright" zoomInTitle="התקרב" zoomOutTitle="התרחק" />
        <Fit roofs={roofs} selectedId={selectedId} />
        {roofs.map((r) => (
          <RoofShape key={r.id} roof={r} selected={r.id === selectedId} onSelect={onSelect} />
        ))}
      </MapContainer>
    </div>
  );
}
