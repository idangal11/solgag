import { FileSignature } from 'lucide-react';
import { AGREEMENT_HINT, AGREEMENT_LABEL, fmtILS } from '@/lib/labels';
import type { Listing } from '@/lib/types';

const fmtRate = (n: number) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
const fmtPct = (n: number) => new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 }).format(n);

type Props = { listing: Pick<Listing, 'agreement' | 'terms' | 'usableAreaSqm' | 'description' | 'ownerDisplayName'> };

/** Agreement model, the owner's requested terms and their own description. */
export function ListingTerms({ listing }: Props) {
  const t = listing.terms;
  return (
    <section className="card-surface" aria-labelledby="terms-title">
      <h2 id="terms-title">
        <FileSignature size={19} aria-hidden="true" /> תנאי ההתקשרות המבוקשים
      </h2>
      <p className="muted">{AGREEMENT_HINT[listing.agreement]}</p>
      <dl className="terms">
        <div>
          <dt>מודל</dt>
          <dd>{AGREEMENT_LABEL[listing.agreement]}</dd>
        </div>
        {t.rentPerSqmYear != null && (
          <div>
            <dt>שכירות מבוקשת</dt>
            <dd>
              {fmtRate(t.rentPerSqmYear)} למ״ר שמיש לשנה
              <small> (≈ {fmtILS(t.rentPerSqmYear * listing.usableAreaSqm)} בשנה לפי השטח השמיש המוערך)</small>
            </dd>
          </div>
        )}
        {t.sharePct != null && (
          <div>
            <dt>חלק מבוקש לבעלים</dt>
            <dd>{fmtPct(t.sharePct)}% מהתזרים לחלוקה</dd>
          </div>
        )}
        {t.years != null && (
          <div>
            <dt>תקופה מבוקשת</dt>
            <dd>{t.years} שנים</dd>
          </div>
        )}
        {t.notes && (
          <div className="full">
            <dt>תנאים נוספים</dt>
            <dd className="pre-line">{t.notes}</dd>
          </div>
        )}
      </dl>
      <h3 className="sub">מהבעלים</h3>
      <blockquote className="owner-quote">
        {listing.description ? <p className="pre-line">{listing.description}</p> : <p className="muted">המפרסם לא הוסיף תיאור.</p>}
        <footer>— {listing.ownerDisplayName}</footer>
      </blockquote>
    </section>
  );
}
