import { ArrowRight, Building2, ClipboardCheck, EyeOff, Info, MapPin, Maximize2, Sun } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Calculator } from '@/components/Calculator';
import { ListingActions } from '@/components/listing/ListingActions';
import { ListingGallery } from '@/components/listing/ListingGallery';
import { ListingLocation } from '@/components/listing/ListingLocation';
import { ListingTerms } from '@/components/listing/ListingTerms';
import { ListingTrust } from '@/components/listing/ListingTrust';
import { StatusBadge } from '@/components/ui';
import { getListing, getMyProfile } from '@/lib/data/queries';
import { AGREEMENT_LABEL, AREA_SOURCE_LABEL, AVAILABILITY, BUILDING_LABEL, fmtSqm, REGION_LABEL } from '@/lib/labels';
import type { Listing } from '@/lib/types';
import '@/styles/listing.css';

type Params = { params: Promise<{ id: string }> };

function metaDescription(l: Listing): string {
  const base =
    l.description.trim() || `${BUILDING_LABEL[l.buildingType]} ב${l.locality} · ${fmtSqm(l.usableAreaSqm)} שטח שמיש מוערך · ${AGREEMENT_LABEL[l.agreement]}`;
  const text = (l.isFictional ? `מודעה לדוגמה (בדויה). ${base}` : base).replace(/\s+/g, ' ').trim();
  return text.length > 150 ? `${text.slice(0, 149).trimEnd()}…` : text;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) return { title: 'המודעה לא נמצאה', robots: { index: false } };
  const description = metaDescription(listing);
  return {
    title: listing.title,
    description,
    alternates: { canonical: `/listing/${listing.id}` },
    openGraph: {
      type: 'article',
      title: listing.title,
      description,
      url: `/listing/${listing.id}`,
      images: listing.images[0] ? [{ url: listing.images[0], alt: `תמונה של ${listing.title}` }] : undefined,
    },
    robots: listing.isFictional || listing.status !== 'published' ? { index: false, follow: true } : undefined,
  };
}

export default async function ListingPage({ params }: Params) {
  const { id } = await params;
  const [listing, profile] = await Promise.all([getListing(id), getMyProfile()]);
  if (!listing) notFound();

  const prefill = {
    name: profile?.fullName ?? '',
    contact: profile?.contactEmail || profile?.phone || '',
  };

  return (
    <div className="page listing-page">
      <Link className="back-link" href="/">
        <ArrowRight size={16} aria-hidden="true" /> חזרה לחיפוש
      </Link>

      {listing.status !== 'published' && (
        <p className="note listing-banner">
          <EyeOff size={15} aria-hidden="true" /> המודעה מוסתרת ואינה מוצגת לציבור או בחיפוש.
        </p>
      )}

      <div className="detail-grid">
        <div className="detail-main">
          <ListingGallery
            listing={{
              id: listing.id,
              title: listing.title,
              images: listing.images,
              buildingType: listing.buildingType,
              isFictional: listing.isFictional,
              isMine: listing.isMine,
              status: listing.status,
            }}
          />

          <header className="detail-head">
            <div className="badges">
              <StatusBadge status={listing.availability} />
              <span className="agreement-chip">{AGREEMENT_LABEL[listing.agreement]}</span>
            </div>
            <h1>{listing.title}</h1>
            <p className="card-meta lg">
              <MapPin size={16} aria-hidden="true" /> {listing.locality}, {REGION_LABEL[listing.region]}
              <span className="sep" aria-hidden="true">
                ·
              </span>
              <Building2 size={16} aria-hidden="true" /> {BUILDING_LABEL[listing.buildingType]}
            </p>
            <p className="status-desc">{AVAILABILITY[listing.availability].desc}</p>
          </header>

          {listing.isFictional && (
            <p className="note">
              <Info size={15} aria-hidden="true" /> מודעה לדוגמה — בדויה. אין מאחוריה מבנה או בעלים אמיתיים, והיא אינה פתוחה לפניות.
            </p>
          )}

          <div className="stat-grid">
            <div className="stat">
              <Maximize2 size={18} aria-hidden="true" />
              <span className="k">שטח גג כולל</span>
              <span className="v">{fmtSqm(listing.totalAreaSqm)}</span>
            </div>
            <div className="stat accent">
              <Sun size={18} aria-hidden="true" />
              <span className="k">שטח שמיש מוערך להתקנה</span>
              <span className="v">{fmtSqm(listing.usableAreaSqm)}</span>
            </div>
            <div className="stat">
              <ClipboardCheck size={18} aria-hidden="true" />
              <span className="k">מקור המדידה</span>
              <span className="v sm">{AREA_SOURCE_LABEL[listing.areaSource]}</span>
            </div>
          </div>

          <ListingTerms listing={listing} />
          <ListingTrust listing={listing} />
          <ListingLocation listing={listing} />

          <Calculator key={listing.id} usableAreaSqm={listing.usableAreaSqm} ownerSharePct={listing.terms.sharePct} location={listing.center} />
        </div>

        <ListingActions
          listing={{
            id: listing.id,
            title: listing.title,
            locality: listing.locality,
            usableAreaSqm: listing.usableAreaSqm,
            totalAreaSqm: listing.totalAreaSqm,
            isFictional: listing.isFictional,
            isMine: listing.isMine,
            status: listing.status,
            availability: listing.availability,
          }}
          prefill={prefill}
        />
      </div>
    </div>
  );
}
