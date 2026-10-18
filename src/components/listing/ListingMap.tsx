'use client';

import dynamic from 'next/dynamic';
import type { ListingMapViewProps } from './ListingMapView';

const ListingMapView = dynamic(() => import('./ListingMapView'), {
  ssr: false,
  loading: () => <div className="mini-map-loading">טוען מפה…</div>,
});

/** Mini map of the rooftop (aerial imagery by default). */
export function ListingMap(props: ListingMapViewProps & { label: string }) {
  const { label, ...view } = props;
  return (
    <div className="mini-map" dir="ltr" role="region" aria-label={label}>
      <ListingMapView {...view} />
    </div>
  );
}
