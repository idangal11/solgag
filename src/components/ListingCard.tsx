'use client';

import { Building2, Heart, MapPin, Maximize2, Sun } from 'lucide-react';
import Link from 'next/link';
import { forwardRef } from 'react';
import { AGREEMENT_LABEL, BUILDING_LABEL, fmtSqm } from '@/lib/labels';
import type { Listing } from '@/lib/types';
import { useApp } from './AppProvider';
import { FictionalRibbon, ListingImage, StatusBadge } from './ui';

interface Props {
  listing: Listing;
  selected?: boolean;
  /** Focus the rooftop on the map. Without it the card links to the listing page. */
  onFocus?: (id: string) => void;
  compact?: boolean;
}

export const ListingCard = forwardRef<HTMLElement, Props>(function ListingCard({ listing, selected, onFocus, compact }, ref) {
  const { favorites, toggleFavorite } = useApp();
  const fav = favorites.has(listing.id);
  const detailHref = `/listing/${listing.id}`;
  return (
    <article
      ref={ref}
      className={`listing-card${selected ? ' is-selected' : ''}${compact ? ' compact' : ''}`}
      // Mouse convenience only; keyboard and screen-reader users get the explicit
      // "הצג במפה" button below, so the article itself is not a fake control.
      onClick={() => onFocus?.(listing.id)}
      aria-label={`${listing.title}, ${listing.locality}`}
      data-listing-id={listing.id}
    >
      <div className="card-media">
        <ListingImage listing={listing} className="card-img" />
        <FictionalRibbon listing={listing} />
        <button
          type="button"
          className={`icon-btn fav${fav ? ' on' : ''}`}
          aria-pressed={fav}
          aria-label={fav ? 'הסר ממועדפים' : 'שמור למועדפים'}
          onClick={(e) => {
            e.stopPropagation();
            void toggleFavorite(listing.id);
          }}
        >
          <Heart size={18} fill={fav ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="card-body">
        <div className="card-top">
          <StatusBadge status={listing.availability} fictional={listing.isFictional} />
          <span className="agreement-chip">{AGREEMENT_LABEL[listing.agreement]}</span>
        </div>
        <h3 className="card-title">{listing.title}</h3>
        <p className="card-meta">
          <MapPin size={14} /> {listing.locality}
          <span className="sep">·</span>
          <Building2 size={14} /> {BUILDING_LABEL[listing.buildingType]}
        </p>
        <div className="card-areas">
          <div>
            <span className="k">
              <Maximize2 size={13} /> שטח גג כולל
            </span>
            <span className="v">{fmtSqm(listing.totalAreaSqm)}</span>
          </div>
          <div>
            <span className="k">
              <Sun size={13} /> שטח שמיש מוערך
            </span>
            <span className="v accent">{fmtSqm(listing.usableAreaSqm)}</span>
          </div>
        </div>
        <div className="card-actions">
          {onFocus && (
            <button
              type="button"
              className="btn ghost sm"
              onClick={(e) => {
                e.stopPropagation();
                onFocus(listing.id);
              }}
            >
              <MapPin size={15} /> הצג במפה
            </button>
          )}
          <Link className="btn primary sm" href={detailHref} onClick={(e) => e.stopPropagation()}>
            לפרטים ולחישוב
          </Link>
        </div>
      </div>
    </article>
  );
});
