import { Heart, Search, Send } from 'lucide-react';
import Link from 'next/link';
import { fmtNum } from '@/lib/labels';
import type { Inquiry, Listing } from '@/lib/types';
import { FavoritesGrid } from './FavoritesGrid';
import { InquiryListItem } from './InquiryListItem';

interface Props {
  favorites: Listing[];
  sent: Inquiry[];
  /** Listings of my sent inquiries that I can no longer see (hidden by their owner or by staff). */
  hiddenListingIds: string[];
}

/** "משקיע/ה" tab: KPIs, saved rooftops and inquiries I sent. */
export function InvestorPanel({ favorites, sent, hiddenListingIds }: Props) {
  const hidden = new Set(hiddenListingIds);
  const usable = favorites.reduce((s, l) => s + l.usableAreaSqm, 0);
  const open = sent.filter((i) => i.status !== 'closed').length;

  return (
    <>
      <div className="kpi-strip">
        <div className="kpi">
          <span className="k">גגות במועדפים</span>
          <span className="v">{favorites.length}</span>
        </div>
        <div className="kpi">
          <span className="k">פניות ששלחתי</span>
          <span className="v">{sent.length}</span>
          <small>פתוחות: {open}</small>
        </div>
        <div className="kpi">
          <span className="k">שטח שמיש במועדפים</span>
          <span className="v">{fmtNum(usable)} מ״ר</span>
          <small>לפי דיווח המפרסמים</small>
        </div>
      </div>

      <section className="dash-section" aria-labelledby="favorites-heading">
        <div className="section-head">
          <h2 id="favorites-heading">
            <Heart size={18} aria-hidden /> מועדפים
          </h2>
        </div>
        {favorites.length ? (
          <>
            <p className="hint dash-hint">שמירה במועדפים אינה שריון ואינה התחייבות. זמינות הגג לעסקה מופיעה בתווית שבכרטיס.</p>
            <FavoritesGrid listings={favorites} />
          </>
        ) : (
          <div className="empty">
            <p>לחצו על ♡ בכרטיס גג כדי לשמור אותו כאן.</p>
            <Link className="btn primary sm" href="/">
              <Search size={15} aria-hidden /> לחיפוש גגות
            </Link>
          </div>
        )}
      </section>

      <section className="dash-section" aria-labelledby="sent-heading">
        <div className="section-head">
          <h2 id="sent-heading">
            <Send size={18} aria-hidden /> פניות ששלחתי
          </h2>
        </div>
        {sent.length ? (
          <ul className="inq-list">
            {sent.map((i) => (
              <InquiryListItem key={i.id} inquiry={i} listingVisible={!hidden.has(i.listingId)} />
            ))}
          </ul>
        ) : (
          <div className="empty">
            <p>עוד לא שלחת פנייה. פתחו מודעה ולחצו „אני מתעניין/ת״.</p>
            <Link className="btn primary sm" href="/">
              לחיפוש גגות
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
