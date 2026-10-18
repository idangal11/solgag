import { ArrowLeft, Hourglass, MapPin } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { waitingLabel } from '@/components/admin/labels';
import { fmtDate, fmtNum } from '@/lib/labels';
import { getAdminCounts, getVerificationQueue, requireAdmin } from './_lib/data';

export const metadata: Metadata = { title: 'ניהול — סקירה' };

function Kpi({ label, value, sub, href, attention }: { label: string; value: number; sub?: string; href?: string; attention?: boolean }) {
  const body = (
    <>
      <span className="k">{label}</span>
      <span className="v">{fmtNum(value)}</span>
      {sub && <small>{sub}</small>}
    </>
  );
  const className = `kpi admin-kpi${attention ? ' attention' : ''}`;
  return href ? (
    <Link className={className} href={href}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export default async function AdminOverviewPage() {
  await requireAdmin();
  const [counts, oldest] = await Promise.all([getAdminCounts(), getVerificationQueue(3)]);

  return (
    <>
      <div className="dash-head">
        <div>
          <h1>סקירה כללית</h1>
          <p className="muted">מצב הפלטפורמה כרגע, לפי הנתונים במסד.</p>
        </div>
      </div>

      <div className="admin-kpis">
        <Kpi
          label="מודעות מפורסמות"
          value={counts.published}
          sub={counts.publishedFictional ? `מתוכן ${fmtNum(counts.publishedFictional)} לדוגמה (בדויות)` : undefined}
          href="/admin/listings?status=published"
        />
        <Kpi label="מודעות מוסתרות" value={counts.hidden} href="/admin/listings?status=hidden" />
        <Kpi
          label="בקשות אימות ממתינות"
          value={counts.pendingVerifications}
          href="/admin/verification"
          attention={counts.pendingVerifications > 0}
        />
        <Kpi label="פניות ב-7 הימים האחרונים" value={counts.inquiriesLastWeek} />
      </div>

      <section className="dash-section" aria-labelledby="oldest-title">
        <div className="section-head">
          <h2 id="oldest-title">
            <Hourglass size={18} aria-hidden /> ממתינות לבדיקה הכי הרבה זמן
          </h2>
          <Link className="btn ghost sm" href="/admin/verification">
            לתור האימות <ArrowLeft size={15} aria-hidden />
          </Link>
        </div>
        {oldest.length ? (
          <ul className="inq-list">
            {oldest.map((r) => (
              <li key={r.id} className="inq-row">
                <div className="inq-top">
                  <b>{r.listingTitle}</b>
                  <time dateTime={r.createdAt} title={fmtDate(r.createdAt)}>
                    {waitingLabel(r.createdAt)}
                  </time>
                </div>
                <p className="card-meta">
                  <MapPin size={14} aria-hidden /> {r.locality}
                  <span className="sep">·</span>
                  {r.ownerDisplayName}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty">
            <p>אין בקשות אימות ממתינות.</p>
          </div>
        )}
      </section>
    </>
  );
}
