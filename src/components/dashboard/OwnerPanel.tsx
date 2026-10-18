import { CirclePlus, House, Inbox } from 'lucide-react';
import Link from 'next/link';
import { fmtNum } from '@/lib/labels';
import type { Inquiry, Listing, VerificationRequest } from '@/lib/types';
import { InquiryListItem } from './InquiryListItem';
import { MyListingItem } from './MyListingItem';

interface Props {
  listings: Listing[];
  received: Inquiry[];
  requests: VerificationRequest[];
  documentUrls: Record<string, string>;
}

/** "בעלי גג" tab: KPIs, my listings with management, and inquiries received on them. */
export function OwnerPanel({ listings, received, requests, documentUrls }: Props) {
  const published = listings.filter((l) => l.status === 'published').length;
  const fresh = received.filter((i) => i.status === 'new').length;
  const usable = listings.reduce((s, l) => s + l.usableAreaSqm, 0);

  return (
    <>
      <div className="kpi-strip">
        <div className="kpi">
          <span className="k">המודעות שלי</span>
          <span className="v">{listings.length}</span>
          <small>מפורסמות: {published}</small>
        </div>
        <div className="kpi">
          <span className="k">פניות שהתקבלו</span>
          <span className="v">{received.length}</span>
          <small>חדשות: {fresh}</small>
        </div>
        <div className="kpi">
          <span className="k">סה״כ שטח שמיש</span>
          <span className="v">{fmtNum(usable)} מ״ר</span>
          <small>לפי דיווח המפרסם</small>
        </div>
      </div>

      <section className="dash-section" aria-labelledby="my-listings-heading">
        <div className="section-head">
          <h2 id="my-listings-heading" tabIndex={-1}>
            <House size={18} aria-hidden /> המודעות שלי
          </h2>
          <Link className="btn primary sm" href="/publish">
            <CirclePlus size={15} aria-hidden /> פרסום גג חדש
          </Link>
        </div>
        {listings.length ? (
          <div className="grid-cards dash-my-grid">
            {listings.map((l) => (
              <MyListingItem key={l.id} listing={l} requests={requests.filter((r) => r.listingId === l.id)} documentUrls={documentUrls} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <p>עוד לא פרסמת גג. זה לוקח כ-2 דקות.</p>
            <Link className="btn primary sm" href="/publish">
              פרסום גג
            </Link>
          </div>
        )}
      </section>

      <section className="dash-section" aria-labelledby="received-heading">
        <div className="section-head">
          <h2 id="received-heading">
            <Inbox size={18} aria-hidden /> פניות שהתקבלו
          </h2>
        </div>
        {received.length ? (
          <ul className="inq-list">
            {received.map((i) => (
              <InquiryListItem key={i.id} inquiry={i} />
            ))}
          </ul>
        ) : (
          <div className="empty">
            <p>{listings.length ? 'עדיין לא התקבלו פניות על המודעות שלך. פניות חדשות יופיעו כאן.' : 'פניות על המודעות שלך יופיעו כאן.'}</p>
          </div>
        )}
      </section>
    </>
  );
}
