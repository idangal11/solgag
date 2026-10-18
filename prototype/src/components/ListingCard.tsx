import { Building2, Heart, MapPin, Maximize2, Sun } from 'lucide-react';
import { forwardRef } from 'react';
import { AGREEMENT_LABEL, BUILDING_LABEL, fmtSqm } from '../labels';
import { href } from '../router';
import { useStore } from '../store';
import type { Listing } from '../types';
import { FictionalRibbon, ListingImage, StatusBadge } from './ui';

interface Props {
  listing: Listing;
  selected?: boolean;
  onFocus?: (id: string) => void;
  compact?: boolean;
}

export const ListingCard = forwardRef<HTMLElement, Props>(function ListingCard({ listing, selected, onFocus, compact }, ref) {
  const { favorites, toggleFavorite } = useStore();
  const fav = favorites.includes(listing.id);
  return (
    <article
      ref={ref}
      className={`listing-card${selected ? ' is-selected' : ''}${compact ? ' compact' : ''}`}
      onClick={() => onFocus?.(listing.id)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) onFocus?.(listing.id);
      }}
      aria-label={`${listing.title}, ${listing.locality}`}
    >
      <div className="card-media">
        <ListingImage listing={listing} className="card-img" />
        <FictionalRibbon listing={listing} />
        <button
          className={`icon-btn fav${fav ? ' on' : ''}`}
          aria-pressed={fav}
          aria-label={fav ? 'הסר ממועדפים' : 'שמור למועדפים'}
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(listing.id);
          }}
        >
          <Heart size={18} fill={fav ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="card-body">
        <div className="card-top">
          <StatusBadge status={listing.availability} />
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
          <button
            className="btn ghost sm"
            onClick={(e) => {
              e.stopPropagation();
              onFocus?.(listing.id);
            }}
          >
            <MapPin size={15} /> הצג במפה
          </button>
          <a className="btn primary sm" href={href.listing(listing.id)} onClick={(e) => e.stopPropagation()}>
            לפרטים ולחישוב
          </a>
        </div>
      </div>
    </article>
  );
});
