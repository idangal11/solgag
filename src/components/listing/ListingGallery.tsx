'use client';

import { useState } from 'react';
import { RoofArt } from '@/components/RoofArt';
import { FictionalRibbon } from '@/components/ui';
import type { Listing } from '@/lib/types';

type Props = {
  listing: Pick<Listing, 'id' | 'title' | 'images' | 'buildingType' | 'isFictional' | 'isMine' | 'status' | 'adminHidden'>;
};

/** Hero photo with thumbnails, or a clearly-labelled illustration when no photo was uploaded. */
export function ListingGallery({ listing }: Props) {
  const [idx, setIdx] = useState(0);
  const { images } = listing;
  const current = images[idx] ?? images[0];
  const hasThumbs = images.length > 1;
  // A listing hidden by staff is hidden whatever the owner's own setting says.
  const ribbon = {
    isFictional: listing.isFictional,
    isMine: listing.isMine,
    status: listing.adminHidden ? ('hidden' as const) : listing.status,
  };

  return (
    // has-thumbs: on phones the ribbon moves to the top so the thumbnail strip cannot cover it.
    <div className={`hero-media${hasThumbs ? ' has-thumbs' : ''}`}>
      {current ? (
        <img
          src={current}
          alt={hasThumbs ? `תמונה ${idx + 1} מתוך ${images.length} של ${listing.title}` : `תמונה של ${listing.title}`}
          className="hero-img"
          fetchPriority={idx === 0 ? 'high' : 'auto'}
          decoding="async"
        />
      ) : (
        <RoofArt className="hero-img" type={listing.buildingType} seed={listing.id} />
      )}
      <FictionalRibbon listing={ribbon} />
      {!current && <span className="img-note">איור להמחשה — אין תמונה של המבנה</span>}
      {hasThumbs && (
        <div className="thumbs" role="group" aria-label="תמונות המבנה">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              className={i === idx ? 'on' : ''}
              onClick={() => setIdx(i)}
              aria-label={`הצג תמונה ${i + 1} מתוך ${images.length}`}
              aria-pressed={i === idx}
            >
              <img src={src} alt="" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
