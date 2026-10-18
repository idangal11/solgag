import { AlertTriangle, CalendarDays, Plug, ShieldQuestion, SunDim, Warehouse } from 'lucide-react';
import { Tag } from '@/components/ui';
import { NOT_ASSESSED, TECH_ASSESSMENT, VERIFICATION } from '@/lib/labels';
import type { Listing } from '@/lib/types';

type Props = { listing: Pick<Listing, 'ownerVerification' | 'techAssessment' | 'tech'> };

/** Ownership verification and technical suitability — exactly as recorded, never more. */
export function ListingTrust({ listing }: Props) {
  const verification = VERIFICATION[listing.ownerVerification];
  const tech = TECH_ASSESSMENT[listing.techAssessment];
  const age = listing.tech.roofAgeYears;

  const rows = [
    { icon: <Warehouse size={16} aria-hidden="true" />, k: 'סוג גג', v: listing.tech.roofType },
    { icon: <SunDim size={16} aria-hidden="true" />, k: 'הצללה', v: listing.tech.shading },
    { icon: <Plug size={16} aria-hidden="true" />, k: 'חיבור חשמל', v: listing.tech.grid },
    { icon: <CalendarDays size={16} aria-hidden="true" />, k: 'גיל הגג', v: age != null ? `${age} שנים (לפי הבעלים)` : null },
  ];

  return (
    <section className="card-surface" aria-labelledby="trust-title">
      <h2 id="trust-title">
        <ShieldQuestion size={19} aria-hidden="true" /> אימות והתאמה טכנית
      </h2>
      <div className="verify-grid">
        <div className={`verify tone-${verification.tone}`}>
          <span className="k">אימות בעלות</span>
          <span className="v">{verification.label}</span>
          <span className="d">{verification.desc}</span>
        </div>
        <div className={`verify tone-${tech.tone}`}>
          <span className="k">הערכת התאמה טכנית</span>
          <span className="v">{tech.label}</span>
        </div>
      </div>
      <p className="note">
        <AlertTriangle size={15} aria-hidden="true" />
        {listing.techAssessment === 'assessed'
          ? 'הסטטוס עודכן על ידי צוות הפלטפורמה. אין בכך אישור הנדסי — יש לבצע בדיקה עצמאית לפני כל התקשרות.'
          : `לא בוצעה בדיקה הנדסית של הגג. הנתונים הטכניים מוצגים כפי שדווחו על ידי המפרסם, או כ״${NOT_ASSESSED}״.`}
      </p>
      <ul className="tech-list">
        {rows.map((r) => (
          <li key={r.k}>
            <span className="k">
              {r.icon} {r.k}
            </span>
            {r.v ? <span className="v">{r.v}</span> : <Tag tone="muted">{NOT_ASSESSED}</Tag>}
          </li>
        ))}
      </ul>
    </section>
  );
}
