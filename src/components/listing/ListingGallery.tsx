'use client';

import { useState } from 'react';
import { RoofArt } from '@/components/RoofArt';
import { FictionalRibbon } from '@/components/ui';
import type { Listing } from '@/lib/types';

type Props = { listing: Pick<Listing, 'id' | 'title' | 'images' | 'buildingType' | 'isFictional' | 'isMine' | 'status'> };

/** Hero photo with thumbnails, or a clearly-labelled illustration when no photo was uploaded. */
export function ListingGallery({ listing }: Props) {
  const [idx, setIdx] = useState(0);
  const { images } = listing;
  const current = images[idx] ?? images[0];

  return (
    <div className="hero-media">
      {current ? (
        <img
          src={current}
          alt={images.length > 1 ? `תמונה ${idx + 1} מתוך ${images.length} של ${listing.title}` : `תמונה של ${listing.title}`}
          className="hero-img"
          fetchPriority={idx === 0 ? 'high' : 'auto'}
          decoding="async"
        />
      ) : (
        <RoofArt className="hero-img" type={listing.buildingType} seed={listing.id} />
      )}
      <FictionalRibbon listing={listing} />
      {!current && <span className="img-note">איור להמחשה — אין תמונה של המבנה</span>}
      {images.length > 1 && (
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
