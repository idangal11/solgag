'use client';

import { Eye, EyeOff, LoaderCircle, ShieldAlert, Trash } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useOptimistic, useTransition } from 'react';
import { deleteListing, setListingAdminHidden, setListingTechAssessment } from '@/app/admin/actions';
import { useApp } from '@/components/AppProvider';
import { Tag } from '@/components/ui';
import { fmtDate, TECH_ASSESSMENT, VERIFICATION } from '@/lib/labels';
import type { TechAssessment } from '@/lib/types';
import { callAction } from './callAction';
import { ADMIN_HIDDEN_LABEL, FICTIONAL_LABEL, LISTING_STATUS_LABEL } from './labels';
import type { ActionResult, AdminListingRow } from './types';

const TECH_VALUES = Object.keys(TECH_ASSESSMENT) as TechAssessment[];

/**
 * One row of the moderation table: the owner's status and the staff hide
 * (two separate things), technical-assessment status and deletion.
 */
export function ListingAdminRow({ row }: { row: AdminListingRow }) {
  const { toast } = useApp();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adminHidden, setOptimisticAdminHidden] = useOptimistic(row.adminHidden);
  const [tech, setOptimisticTech] = useOptimistic(row.techAssessment);
  const verification = VERIFICATION[row.ownerVerification];
  const isPublic = row.status === 'published' && !adminHidden;

  function run<T extends object>(
    action: () => Promise<ActionResult<T>>,
    onSuccess: (res: { ok: true } & T) => void,
    optimistic?: () => void,
  ) {
    startTransition(async () => {
      optimistic?.();
      const res = await callAction(action);
      if (res.ok) {
        onSuccess(res);
        return;
      }
      toast(res.error, 'error');
      // The row changed or disappeared since the page was rendered.
      if (res.stale) router.refresh();
    });
  }

  function toggleAdminHidden() {
    const hide = !adminHidden;
    const question = hide
      ? `להסתיר את "${row.title}" מהציבור?\n\nהמודעה לא תוצג באתר ולא תקבל פניות חדשות, והמפרסם לא יוכל לבטל את ההסתרה. אפשר לבטל אותה כאן בכל עת.`
      : `לבטל את ההסתרה של הצוות עבור "${row.title}"?\n\n${
          row.status === 'published'
            ? 'המודעה תחזור להיות גלויה לציבור ותוכל לקבל פניות.'
            : 'המפרסם הסתיר את המודעה בעצמו, ולכן היא תישאר מוסתרת עד שיפרסם אותה מחדש.'
        }`;
    if (!window.confirm(question)) return;
    run(
      () => setListingAdminHidden(row.id, hide),
      (res) =>
        toast(
          hide
            ? 'המודעה הוסתרה מהציבור. המפרסם לא יוכל לפרסם אותה מחדש.'
            : res.ownerStatus === 'published'
              ? 'ההסתרה בוטלה — המודעה גלויה שוב לציבור'
              : 'ההסתרה בוטלה. המודעה עדיין מוסתרת על ידי המפרסם.',
        ),
      () => setOptimisticAdminHidden(hide),
    );
  }

  function changeTech(next: TechAssessment) {
    if (next === tech) return;
    if (
      next === 'assessed' &&
      !window.confirm(
        `לסמן את "${row.title}" כ"${TECH_ASSESSMENT.assessed.label}"?\n\nיש לבחור בכך רק אחרי שבוצע בפועל סקר טכני/הנדסי בגג על ידי גורם מקצועי וממצאיו מתועדים. הסימון מוצג למשקיעים.`,
      )
    ) {
      return;
    }
    run(
      () => setListingTechAssessment(row.id, next),
      () => toast('סטטוס ההתאמה הטכנית עודכן'),
      () => setOptimisticTech(next),
    );
  }

  function remove() {
    if (
      !window.confirm(
        `למחוק לצמיתות את "${row.title}"?\n\nיימחקו גם התמונות, מסמכי הבעלות, הפניות וההודעות ובקשות אימות הבעלות של המודעה. לא ניתן לבטל — אפשר להסתיר במקום.`,
      )
    ) {
      return;
    }
    run(
      () => deleteListing(row.id),
      (res) => {
        if (!res.warning) {
          toast('המודעה נמחקה');
          return;
        }
        // The row disappears and a toast fades in seconds, but the admin has to act
        // on this (remove the files by hand), so it stays on screen until dismissed.
        toast('המודעה נמחקה, אך ניקוי הקבצים מהאחסון לא הושלם', 'error');
        window.alert(res.warning);
      },
    );
  }

  return (
    <tr className={isPublic ? undefined : 'is-hidden'} aria-busy={pending || undefined}>
      <td className="al-title">
        <Link href={`/listing/${row.id}`}>{row.title}</Link>
        <span className="muted small">
          {row.locality} · {row.ownerDisplayName}
        </span>
      </td>
      <td data-label="סטטוס המפרסם">
        <Tag tone={row.status === 'published' ? 'ok' : 'muted'}>{LISTING_STATUS_LABEL[row.status]}</Tag>
      </td>
      <td data-label="הסתרת צוות">
        {adminHidden ? (
          <Tag tone="bad" icon={<ShieldAlert size={13} aria-hidden />}>
            {ADMIN_HIDDEN_LABEL}
          </Tag>
        ) : (
          <span className="muted small">לא הוסתרה</span>
        )}
      </td>
      <td data-label="סוג">
        {row.isFictional ? <Tag tone="warn">{FICTIONAL_LABEL}</Tag> : <span className="muted small">אמיתית</span>}
      </td>
      <td data-label="אימות בעלות">
        <Tag tone={verification.tone}>{verification.label}</Tag>
      </td>
      <td data-label="התאמה טכנית">
        <select
          className="admin-select"
          aria-label={`התאמה טכנית — ${row.title}`}
          value={tech}
          onChange={(e) => changeTech(e.target.value as TechAssessment)}
          disabled={pending}
        >
          {TECH_VALUES.map((v) => (
            // A fictional listing has no real roof that could have been surveyed.
            <option key={v} value={v} disabled={v === 'assessed' && row.isFictional && tech !== 'assessed'}>
              {TECH_ASSESSMENT[v].label}
            </option>
          ))}
        </select>
      </td>
      <td data-label="נוצרה">
        <time dateTime={row.createdAt}>{fmtDate(row.createdAt)}</time>
      </td>
      <td data-label="פעולות">
        <div className="al-actions">
          <button type="button" className="btn ghost xs" onClick={toggleAdminHidden} disabled={pending}>
            {adminHidden ? <Eye size={14} aria-hidden /> : <EyeOff size={14} aria-hidden />}
            {adminHidden ? 'ביטול הסתרה' : 'הסתרה'}
            <span className="sr-only"> — {row.title}</span>
          </button>
          <button type="button" className="btn danger-ghost xs" onClick={remove} disabled={pending}>
            <Trash size={14} aria-hidden /> מחיקה<span className="sr-only"> — {row.title}</span>
          </button>
          {pending && <LoaderCircle size={15} className="spin" aria-hidden />}
        </div>
      </td>
    </tr>
  );
}
