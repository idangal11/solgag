'use client';

import { LoaderCircle, Upload } from 'lucide-react';
import { useRef, type FormEvent } from 'react';
import { importProspects } from '@/app/admin/prospects/actions';
import { useAdminAction } from './useAdminAction';

/** Loads a research batch (prospects-import.json) under the admin's own session — no service key needed. */
export function ImportForm() {
  const { pending, run } = useAdminAction();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    run(
      () => importProspects(data),
      (res) => `יובאו ${res.roofs} גגות ו-${res.businesses} התאמות עסקים (אצווה ${res.batch}). החלטות בדיקה קיימות נשמרו.`,
      () => formRef.current?.reset(),
    );
  }

  return (
    <details className="admin-help pr-import">
      <summary>
        <Upload size={16} aria-hidden /> ייבוא אצווה ממחקר
      </summary>
      <form ref={formRef} onSubmit={submit} className="pr-import-form">
        <p className="muted small">
          קובץ JSON שנוצר בסקריפט המחקר (research/prospects-…/data/prospects-import.json). ייבוא חוזר מעדכן ראיות, אבל לא דורס החלטות
          בדיקה, כתובות שתוקנו או עסקים שכבר נבדקו.
        </p>
        <input type="file" name="file" accept="application/json,.json" required aria-label="קובץ ייבוא" />
        <button type="submit" className="btn primary sm" disabled={pending}>
          {pending ? <LoaderCircle size={15} className="spin" aria-hidden /> : <Upload size={15} aria-hidden />} ייבוא
        </button>
      </form>
    </details>
  );
}
