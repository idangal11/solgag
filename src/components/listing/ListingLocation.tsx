import { AlertTriangle, MapPin } from 'lucide-react';
import Link from 'next/link';
import type { Listing } from '@/lib/types';
import { ListingMap } from './ListingMap';

type Props = {
  listing: Pick<
    Listing,
    'id' | 'title' | 'center' | 'polygon' | 'polygonIllustrative' | 'isFictional' | 'availability' | 'status' | 'adminHidden'
  >;
};

function boundaryNote(l: Props['listing'], illustrative: boolean): string {
  const hasPolygon = l.polygon.length >= 3;
  if (hasPolygon && illustrative) return 'מיקום ופוליגון להמחשה בלבד. הם אינם מייצגים את גבולות מבנה אמיתי כלשהו.';
  if (l.isFictional) return 'מיקום להמחשה בלבד — המודעה בדויה ואינה מייצגת מבנה אמיתי.';
  if (hasPolygon) return 'גבולות הגג שורטטו על ידי המפרסם על גבי המפה, ולא נמדדו או אומתו בשטח.';
  return 'לא שורטטו גבולות לגג — מוצגת רק הנקודה שסימן המפרסם.';
}

/** Mini map with an honest note about where the shape on it comes from. */
export function ListingLocation({ listing }: Props) {
  // Fictional listings never show a real boundary, whatever the flag says.
  const illustrative = listing.polygonIllustrative || listing.isFictional;
  return (
    <section className="card-surface" aria-labelledby="location-title">
      <h2 id="location-title">
        <MapPin size={19} aria-hidden="true" /> מיקום וגבולות הגג
      </h2>
      <ListingMap
        label={`מפת המיקום של ${listing.title}`}
        center={listing.center}
        polygon={listing.polygon}
        illustrative={illustrative}
        availability={listing.availability}
        fictional={listing.isFictional}
      />
      <p className="note">
        <AlertTriangle size={15} aria-hidden="true" />
        {boundaryNote(listing, illustrative)}
      </p>
      {/* Only listings that are actually on the public map. */}
      {listing.status === 'published' && !listing.adminHidden && (
        <Link className="btn ghost sm listing-map-link" href={`/?focus=${listing.id}`}>
          <MapPin size={15} aria-hidden="true" /> הצג במפה הראשית
        </Link>
      )}
    </section>
  );
}
