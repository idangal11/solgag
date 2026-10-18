import type { ReactNode } from 'react';
import { AVAILABILITY, type Tone } from '@/lib/labels';
import type { Availability, Listing } from '@/lib/types';
import { RoofArt } from './RoofArt';

export function StatusBadge({ status }: { status: Availability }) {
  const s = AVAILABILITY[status];
  return (
    <span className="badge status" style={{ ['--c' as string]: s.color }}>
      <span className="dot" />
      {s.label}
    </span>
  );
}

export function Tag({ children, tone = 'muted', icon }: { children: ReactNode; tone?: Tone; icon?: ReactNode }) {
  return (
    <span className={`tag tone-${tone}`}>
      {icon}
      {children}
    </span>
  );
}

/** First uploaded photo, or a clearly-illustrative drawing when there is none. */
export function ListingImage({ listing, className }: { listing: Pick<Listing, 'id' | 'title' | 'images' | 'buildingType'>; className?: string }) {
  if (listing.images.length) {
    return <img className={className} src={listing.images[0]} alt={`תמונה של ${listing.title}`} loading="lazy" decoding="async" />;
  }
  return <RoofArt className={className} type={listing.buildingType} seed={listing.id} />;
}

export function FictionalRibbon({ listing }: { listing: Pick<Listing, 'isFictional' | 'isMine' | 'status'> }) {
  if (listing.isFictional) return <span className="ribbon">מודעה לדוגמה — בדויה</span>;
  if (listing.isMine) return <span className="ribbon mine">{listing.status === 'hidden' ? 'המודעה שלך · מוסתרת' : 'המודעה שלך'}</span>;
  return null;
}
