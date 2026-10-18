import { ClipboardCheck, Hourglass, Info, MapPin } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { FICTIONAL_LABEL, waitingLabel } from '@/components/admin/labels';
import type { AdminVerificationItem } from '@/components/admin/types';
import { VerificationReview } from '@/components/admin/VerificationReview';
import { Tag } from '@/components/ui';
import { fmtDate, VERIFICATION, VERIFICATION_REQUEST_STATUS } from '@/lib/labels';
import { getRecentReviews, getVerificationQueue, requireAdmin } from '../_lib/data';

export const metadata: Metadata = { title: 'ניהול — אימות בעלות' };

function PendingRequest({ item }: { item: AdminVerificationItem }) {
  const badge = item.listingVerification ? VERIFICATION[item.listingVerification] : null;
  return (
    <li className="vr-card">
      <div className="vr-info">
        <div className="inq-top">
          <h3 className="vr-title">
            <Link href={`/listing/${item.listingId}`}>{item.listingTitle}</Link>
          </h3>
          <time dateTime={item.createdAt} title={`הוגשה ${fmtDate(item.createdAt)}`}>
            {waitingLabel(item.createdAt)}
          </time>
        </div>
        <p className="card-meta">
          <MapPin size={14} aria-hidden /> {item.locality}
          <span className="sep">·</span>
          שם המפרסם במודעה: {item.ownerDisplayName}
        </p>
        <dl className="vr-facts">
          <div>
            <dt>חשבון המגיש</dt>
            <dd>
              {item.accountName || '—'}
              {item.accountEmail && (
                <span className="vr-email" dir="ltr">
                  {item.accountEmail}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt>הוגשה</dt>
            <dd>{fmtDate(item.createdAt)}</dd>
          </div>
          <div>
            <dt>סימון נוכחי במודעה</dt>
            <dd>{badge ? <Tag tone={badge.tone}>{badge.label}</Tag> : '—'}</dd>
          </div>
        </dl>
        {item.listingIsFictional && <Tag tone="warn">{FICTIONAL_LABEL}</Tag>}
        {item.note ? (
          <blockquote className="owner-quote">
            {item.note}
            <footer>הערת המגיש</footer>
          </blockquote>
        ) : (
          <p className="muted small">המגיש לא צירף הערה.</p>
        )}
      </div>
      <VerificationReview requestId={item.id} listingTitle={item.listingTitle} />
    </li>
  );
}

function RecentReviews({ items }: { items: AdminVerificationItem[] }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <caption className="sr-only">בקשות אימות שטופלו לאחרונה</caption>
        <thead>
          <tr>
            <th scope="col">מודעה</th>
            <th scope="col">החלטה</th>
            <th scope="col">הערת בודק</th>
            <th scope="col">נבדק ע״י</th>
            <th scope="col">מועד ההחלטה</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => {
            const s = VERIFICATION_REQUEST_STATUS[r.status];
            return (
              <tr key={r.id}>
                <td className="al-title">
                  <Link href={`/listing/${r.listingId}`}>{r.listingTitle}</Link>
                  <span className="muted small">{r.locality}</span>
                </td>
                <td data-label="החלטה">
                  <Tag tone={s.tone}>{s.label}</Tag>
                </td>
                <td data-label="הערת בודק" className="al-note">
                  {r.reviewNote || <span className="muted">—</span>}
                </td>
                <td data-label="נבדק ע״י">{r.reviewerName || <span className="muted">—</span>}</td>
                <td data-label="מועד ההחלטה">
                  {r.reviewedAt ? <time dateTime={r.reviewedAt}>{fmtDate(r.reviewedAt)}</time> : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function AdminVerificationPage() {
  await requireAdmin();
  const [queue, recent] = await Promise.all([getVerificationQueue(), getRecentReviews()]);

  return (
    <>
      <div className="dash-head">
        <div>
          <h1>אימות בעלות</h1>
          <p className="muted">בקשות שהגישו מפרסמים, מהוותיקה לחדשה.</p>
        </div>
      </div>

      <p className="note admin-guidance">
        <Info size={15} aria-hidden />
        <span>
          אישור הוא הדרך היחידה שבה מודעה מקבלת את הסימון „{VERIFICATION.verified.label}”. בודקים שהמסמך (למשל נסח טאבו, חוזה
          חכירה/שכירות או ייפוי כוח) מתייחס לנכס שבמודעה, ושהבעלים או המורשה בו תואמים למפרסם. גם לאחר אישור, למשקיעים מוצג
          שאין בכך אישור משפטי או ערובה.
        </span>
      </p>

      <section className="dash-section" aria-labelledby="queue-title">
        <div className="section-head">
          <h2 id="queue-title">
            <Hourglass size={18} aria-hidden /> ממתינות לבדיקה ({queue.length})
          </h2>
        </div>
        {queue.length ? (
          <ul className="vr-list">
            {queue.map((item) => (
              <PendingRequest key={item.id} item={item} />
            ))}
          </ul>
        ) : (
          <div className="empty">
            <p>אין בקשות ממתינות לבדיקה.</p>
          </div>
        )}
      </section>

      <section className="dash-section" aria-labelledby="recent-title">
        <div className="section-head">
          <h2 id="recent-title">
            <ClipboardCheck size={18} aria-hidden /> טופלו לאחרונה
          </h2>
        </div>
        {recent.length ? (
          <RecentReviews items={recent} />
        ) : (
          <div className="empty">
            <p>עוד לא טופלו בקשות.</p>
          </div>
        )}
      </section>
    </>
  );
}
