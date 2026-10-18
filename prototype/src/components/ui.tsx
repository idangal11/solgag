import type { ReactNode } from 'react';
import { AVAILABILITY } from '../labels';
import type { Availability, Listing } from '../types';
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

export function Tag({ children, tone = 'muted', icon }: { children: ReactNode; tone?: 'muted' | 'warn' | 'info' | 'green' | 'yellow'; icon?: ReactNode }) {
  return (
    <span className={`tag tone-${tone}`}>
      {icon}
      {children}
    </span>
  );
}

export function ListingImage({ listing, className }: { listing: Listing; className?: string }) {
  if (listing.images.length) {
    return <img className={className} src={listing.images[0]} alt={`תמונה של ${listing.title}`} loading="lazy" />;
  }
  return <RoofArt className={className} type={listing.buildingType} seed={listing.id} />;
}

export function FictionalRibbon({ listing }: { listing: Listing }) {
  if (listing.isFictional) return <span className="ribbon">מודעה בדויה לדמו</span>;
  if (listing.isMine) return <span className="ribbon mine">פורסם על ידך (דמו)</span>;
  return null;
}
