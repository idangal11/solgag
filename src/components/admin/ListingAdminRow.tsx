'use client';

import { Eye, EyeOff, LoaderCircle, Trash } from 'lucide-react';
import Link from 'next/link';
import { useOptimistic, useTransition } from 'react';
import { deleteListing, setListingStatus, setListingTechAssessment } from '@/app/admin/actions';
import { useApp } from '@/components/AppProvider';
import { Tag } from '@/components/ui';
import { fmtDate, TECH_ASSESSMENT, VERIFICATION } from '@/lib/labels';
import type { ListingStatus, TechAssessment } from '@/lib/types';
import { FICTIONAL_LABEL, LISTING_STATUS_LABEL } from './labels';
import type { ActionResult, AdminListingRow } from './types';

const TECH_VALUES = Object.keys(TECH_ASSESSMENT) as TechAssessment[];
const NETWORK_ERROR: ActionResult = { ok: false, error: 'החיבור לשרת נכשל. נסו שוב.' };

/** One row of the moderation table: visibility, technical-assessment status and deletion. */
export function ListingAdminRow({ row }: { row: AdminListingRow }) {
  const { toast } = useApp();
  const [pending, startTransition] = useTransition();
  const [status, setOptimisticStatus] = useOptimistic(row.status);
  const [tech, setOptimisticTech] = useOptimistic(row.techAssessment);
  const verification = VERIFICATION[row.ownerVerification];

  function run(action: () => Promise<ActionResult>, success: string, optimistic?: () => void) {
    startTransition(async () => {
      optimistic?.();
      const res = await action().catch(() => NETWORK_ERROR);
      if (res.ok) toast(success);
      else toast(res.error, 'error');
    });
  }

  function toggleStatus() {
    const next: ListingStatus = status === 'published' ? 'hidden' : 'published';
    if (
      next === 'published' &&
      !window.confirm(`לפרסם מחדש את "${row.title}"?\n\nאם בעל המודעה הסתיר אותה בעצמו, כדאי לתאם איתו לפני פרסום.`)
    ) {
      return;
    }
    run(
      () => setListingStatus(row.id, next),
      next === 'hidden' ? 'המודעה הוסתרה מהציבור' : 'המודעה פורסמה',
      () => setOptimisticStatus(next),
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
    run(() => setListingTechAssessment(row.id, next), 'סטטוס ההתאמה הטכנית עודכן', () => setOptimisticTech(next));
  }

  function remove() {
    if (
      !window.confirm(
        `למחוק לצמיתות את "${row.title}"?\n\nיימחקו גם התמונות, הפניות וההודעות ובקשות אימות הבעלות של המודעה. לא ניתן לבטל — אפשר להסתיר במקום.`,
      )
    ) {
      return;
    }
    run(() => deleteListing(row.id), 'המודעה נמחקה');
  }

  return (
    <tr className={status === 'hidden' ? 'is-hidden' : undefined} aria-busy={pending || undefined}>
      <td className="al-title">
        <Link href={`/listing/${row.id}`}>{row.title}</Link>
        <span className="muted small">
          {row.locality} · {row.ownerDisplayName}
        </span>
      </td>
      <td data-label="סטטוס">
        <Tag tone={status === 'published' ? 'ok' : 'muted'}>{LISTING_STATUS_LABEL[status]}</Tag>
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
          <button type="button" className="btn ghost xs" onClick={toggleStatus} disabled={pending}>
            {status === 'published' ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
            {status === 'published' ? 'הסתרה' : 'פרסום'}
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
