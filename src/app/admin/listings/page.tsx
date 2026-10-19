import { Search, ShieldAlert, Wrench } from 'lucide-react';
import type { Metadata } from 'next';
import Form from 'next/form';
import Link from 'next/link';
import { VISIBILITY_LABEL } from '@/components/admin/labels';
import { ListingAdminRow } from '@/components/admin/ListingAdminRow';
import type { ListingVisibility } from '@/components/admin/types';
import { Tag } from '@/components/ui';
import { fmtNum, TECH_ASSESSMENT } from '@/lib/labels';
import type { TechAssessment } from '@/lib/types';
import { ADMIN_LISTINGS_LIMIT, getAdminListings, requireAdmin, type ListingFilters } from '../_lib/data';

export const metadata: Metadata = { title: 'ניהול — מודעות' };

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

const VISIBILITY_VALUES = Object.keys(VISIBILITY_LABEL) as ListingVisibility[];
/** Links from before the staff/owner split (?status=published|hidden). */
const LEGACY_STATUS: Record<string, ListingVisibility> = { published: 'public', hidden: 'owner_hidden' };

function parseFilters(sp: Awaited<SearchParams>): ListingFilters {
  const visibility = first(sp.visibility) || first(sp.status);
  const kind = first(sp.kind);
  return {
    q: first(sp.q).trim().slice(0, 80),
    visibility: (VISIBILITY_VALUES as string[]).includes(visibility)
      ? (visibility as ListingVisibility)
      : (LEGACY_STATUS[visibility] ?? 'all'),
    kind: kind === 'real' || kind === 'fictional' ? kind : 'all',
  };
}

const TECH_HELP: Record<TechAssessment, string> = {
  not_assessed: 'ברירת המחדל: אין מידע טכני שנבדק.',
  owner_reported: 'הנתונים הטכניים במודעה נמסרו על ידי הבעלים ולא נבדקו.',
  survey_planned: 'נקבע סקר הנדסי, אך הוא טרם בוצע.',
  assessed: 'רק אחרי שבוצע בפועל סקר טכני/הנדסי בגג על ידי גורם מקצועי, וממצאיו מתועדים. הסימון מוצג למשקיעים.',
};

export default async function AdminListingsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const filters = parseFilters(await searchParams);
  const { rows, total } = await getAdminListings(filters);
  const filtered = filters.q !== '' || filters.visibility !== 'all' || filters.kind !== 'all';

  return (
    <>
      <div className="dash-head">
        <div>
          <h1>ניהול מודעות</h1>
          <p className="muted">כל המודעות במערכת, כולל מוסתרות ומודעות לדוגמה. החדשות ביותר מופיעות ראשונות.</p>
        </div>
      </div>

      <p className="note admin-guidance">
        <ShieldAlert size={15} aria-hidden />
        <span>
          „הסתרה” כאן היא הסתרה של צוות האתר: המודעה לא מוצגת לציבור ולא מקבלת פניות חדשות, והמפרסם לא יכול לבטל אותה. היא
          נפרדת מהסטטוס שהמפרסם בוחר בעצמו (מפורסמת/מוסתרת), שאינו משתנה כאן — ביטול ההסתרה מחזיר את המודעה למצב שהמפרסם בחר.
        </span>
      </p>

      <Form action="/admin/listings" className="admin-filters" role="search" aria-label="סינון מודעות">
        <label className="field grow">
          <span>חיפוש</span>
          <input type="search" name="q" defaultValue={filters.q} placeholder="כותרת, יישוב או שם מפרסם" maxLength={80} />
        </label>
        <label className="field">
          <span>נראות</span>
          <select name="visibility" defaultValue={filters.visibility}>
            <option value="all">הכול</option>
            {VISIBILITY_VALUES.map((v) => (
              <option key={v} value={v}>
                {VISIBILITY_LABEL[v]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>סוג</span>
          <select name="kind" defaultValue={filters.kind}>
            <option value="all">הכול</option>
            <option value="real">אמיתיות</option>
            <option value="fictional">לדוגמה (בדויות)</option>
          </select>
        </label>
        <div className="admin-filter-btns">
          <button type="submit" className="btn primary sm">
            <Search size={15} aria-hidden /> סינון
          </button>
          {filtered && (
            <Link className="btn link sm" href="/admin/listings">
              ניקוי
            </Link>
          )}
        </div>
      </Form>

      <details className="admin-help">
        <summary>
          <Wrench size={16} aria-hidden /> מתי לבחור כל סטטוס של התאמה טכנית?
        </summary>
        <ul>
          {(Object.keys(TECH_HELP) as TechAssessment[]).map((v) => (
            <li key={v}>
              <Tag tone={TECH_ASSESSMENT[v].tone}>{TECH_ASSESSMENT[v].label}</Tag>
              <span>{TECH_HELP[v]}</span>
            </li>
          ))}
        </ul>
      </details>

      <p className="muted small admin-result-count" role="status">
        {total > rows.length
          ? `מוצגות ${fmtNum(rows.length)} האחרונות מתוך ${fmtNum(total)}. אפשר לצמצם בעזרת החיפוש והסינון.`
          : `${fmtNum(total)} מודעות${filtered ? ' תואמות לסינון' : ''}.`}
      </p>

      {rows.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table admin-listings">
            <caption className="sr-only">
              מודעות במערכת (עד {ADMIN_LISTINGS_LIMIT} האחרונות)
            </caption>
            <thead>
              <tr>
                <th scope="col">מודעה</th>
                <th scope="col">סטטוס המפרסם</th>
                <th scope="col">הסתרת צוות</th>
                <th scope="col">סוג</th>
                <th scope="col">אימות בעלות</th>
                <th scope="col">התאמה טכנית</th>
                <th scope="col">נוצרה</th>
                <th scope="col">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <ListingAdminRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          <p>{filtered ? 'לא נמצאו מודעות שתואמות לסינון.' : 'אין עדיין מודעות במערכת.'}</p>
        </div>
      )}
    </>
  );
}
