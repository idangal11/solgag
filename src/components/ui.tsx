import type { ReactNode } from 'react';
import { AVAILABILITY, type Tone } from '@/lib/labels';
import type { Availability, Listing } from '@/lib/types';
import { RoofArt } from './RoofArt';

/** Sample (fictional) listings get their own neutral status: they cannot take inquiries. */
export const SAMPLE_STATUS = { label: 'מודעה לדוגמה', color: '#6b7a73' } as const;

export function StatusBadge({ status, fictional = false }: { status: Availability; fictional?: boolean }) {
  const s = fictional ? SAMPLE_STATUS : AVAILABILITY[status];
  return (
    <span className="badge status" style={{ ['--c' as string]: s.color }}>
      <span className="dot" aria-hidden="true" />
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
  return (
    <>
      <RoofArt className={className} type={listing.buildingType} seed={listing.id} />
      <span className="art-label">איור — אין תמונה</span>
    </>
  );
}

export function FictionalRibbon({ listing }: { listing: Pick<Listing, 'isFictional' | 'isMine' | 'status'> }) {
  if (listing.isFictional) return <span className="ribbon">מודעה לדוגמה — בדויה</span>;
  if (listing.isMine) return <span className="ribbon mine">{listing.status === 'hidden' ? 'המודעה שלך · מוסתרת' : 'המודעה שלך'}</span>;
  return null;
}
