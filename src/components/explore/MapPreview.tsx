'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import type { Ref } from 'react';
import { ListingCard } from '@/components/ListingCard';
import type { Listing } from '@/lib/types';

function boundaryNote(l: Listing): string {
  if (l.polygon.length < 3) return 'לא שורטט גבול לגג — הסימון במפה מציין מיקום בלבד.';
  if (l.polygonIllustrative) return 'הגבול המסומן להמחשה בלבד ואינו גבול מדוד של המבנה.';
  return 'הגבול שורטט על ידי המפרסם ולא נמדד.';
}

interface Props {
  listing: Listing;
  onClose: () => void;
  /** Fly to the rooftop again. */
  onRefocus: () => void;
  ref?: Ref<HTMLElement>;
}

/** Preview of the selected rooftop: a card at the top of the map on desktop, a bottom sheet on mobile. */
export function MapPreview({ listing, onClose, onRefocus, ref }: Props) {
  return (
    <section
      ref={ref}
      className="map-preview"
      aria-label={`תצוגה מקדימה: ${listing.title}`}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <button type="button" className="icon-btn close" aria-label="סגירת התצוגה המקדימה" onClick={onClose}>
        <X size={16} aria-hidden />
      </button>
      <ListingCard listing={listing} compact onFocus={onRefocus} />
      <p className="preview-note">{boundaryNote(listing)}</p>
      <Link className="btn primary block" href={`/listing/${listing.id}`}>
        פתח מודעה מלאה
      </Link>
    </section>
  );
}
