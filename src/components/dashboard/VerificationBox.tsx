'use client';

import { FileText, FileUp, LoaderCircle, Paperclip, ShieldCheck } from 'lucide-react';
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from 'react';
import { submitVerificationRequest } from '@/app/dashboard/actions';
import { useApp } from '@/components/AppProvider';
import { Tag } from '@/components/ui';
import { STORAGE_BUCKETS } from '@/lib/config';
import { fmtDate, fmtNum, VERIFICATION, VERIFICATION_REQUEST_STATUS } from '@/lib/labels';
import { createClient } from '@/lib/supabase/client';
import type { OwnerVerification, VerificationRequest } from '@/lib/types';

const MAX_BYTES = 10 * 1024 * 1024;
const EXT_BY_TYPE: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const TYPE_BY_EXT: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/** Some browsers leave File.type empty; fall back to the extension. */
function docType(file: File): string | null {
  if (EXT_BY_TYPE[file.type]) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return TYPE_BY_EXT[ext] ?? null;
}

interface Props {
  listingId: string;
  listingTitle: string;
  status: OwnerVerification;
  requests: VerificationRequest[];
  documentUrls: Record<string, string>;
}

/** Ownership verification status, explanation, document upload and request history for one listing. */
export function VerificationBox({ listingId, listingTitle, status, requests, documentUrls }: Props) {
  const { user, toast, requireAuth } = useApp();
  const id = useId();
  const v = VERIFICATION[status];
  const hasPending = requests.some((r) => r.status === 'pending');
  const canSubmit = (status === 'not_verified' || status === 'rejected') && !hasPending;

  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) fileInput.current?.focus();
  }, [open]);

  const reset = () => {
    setOpen(false);
    setFile(null);
    setNote('');
    setError(null);
  };

  const pick = (f: File | null) => {
    setError(null);
    setFile(null);
    if (!f) return;
    if (!docType(f)) {
      setError('ניתן לצרף קובץ PDF או תמונה (JPG, PNG, WEBP) בלבד.');
    } else if (f.size > MAX_BYTES) {
      setError('הקובץ גדול מ-10MB. נא לצרף קובץ קטן יותר.');
    } else if (f.size === 0) {
      setError('הקובץ ריק.');
    } else {
      setFile(f);
      return;
    }
    if (fileInput.current) fileInput.current.value = '';
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!requireAuth('יש להתחבר כדי להגיש מסמכים') || !user) return;
    const type = file && docType(file);
    if (!file || !type) {
      setError('נא לבחור קובץ להעלאה.');
      fileInput.current?.focus();
      return;
    }
    if (note.trim().length > 1000) {
      setError('ההערה ארוכה מדי (עד 1000 תווים).');
      return;
    }
    setError(null);
    startTransition(async () => {
      const docs = createClient().storage.from(STORAGE_BUCKETS.ownershipDocs);
      const path = `${user.id}/${listingId}/${crypto.randomUUID()}.${EXT_BY_TYPE[type]}`;
      const { error: uploadError } = await docs.upload(path, file, { contentType: type, upsert: false });
      if (uploadError) {
        console.error('ownership doc upload', uploadError);
        const msg = 'העלאת המסמך נכשלה. בדקו את החיבור ונסו שוב.';
        setError(msg);
        toast(msg, 'error');
        return;
      }
      const res = await submitVerificationRequest({ listingId, documentPath: path, note: note.trim() });
      if (!res.ok) {
        // Best effort: drop the now-unreferenced upload (a no-op unless storage allows it).
        void docs.remove([path]).catch(() => undefined);
        setError(res.error);
        toast(res.error, 'error');
        return;
      }
      reset();
      toast('המסמך נשלח לבדיקת צוות הפלטפורמה');
    });
  };

  return (
    <section className="dash-verif" aria-labelledby={`${id}-h`}>
      <div className="dash-verif-head">
        <h4 id={`${id}-h`}>
          <ShieldCheck size={16} aria-hidden /> אימות בעלות
        </h4>
        <Tag tone={v.tone}>{v.label}</Tag>
      </div>
      <p className="small muted dash-verif-desc">{v.desc}</p>
      {status === 'not_verified' && hasPending && (
        <p className="small muted">בקשת אימות קודמת עדיין ממתינה לבדיקה.</p>
      )}

      <details className="dash-explain">
        <summary>מה בודקים באימות בעלות?</summary>
        <p>
          צוות סולגג בודק ידנית שהמסמך שהגשת — למשל נסח טאבו, חוזה חכירה או הרשאה בכתב מבעלי הנכס — תואם למבנה ולמפרסם.
          זו בדיקת מסמכים בלבד: היא אינה חוות דעת משפטית, אינה בדיקה הנדסית ואינה ערובה לזכויות בנכס.
        </p>
        <p>המסמך נשמר באחסון פרטי ונגיש רק לך ולצוות הבדיקה. שינוי המיקום או גבולות המבנה בעריכת המודעה מבטל אימות קיים.</p>
      </details>

      {canSubmit && !open && (
        <button type="button" className="btn ghost sm dash-verif-open" onClick={() => setOpen(true)}>
          <FileUp size={15} aria-hidden /> הגשת מסמך בעלות
        </button>
      )}

      {canSubmit && open && (
        <form className="dash-verif-form" onSubmit={submit} noValidate aria-busy={pending} aria-label={`הגשת מסמך בעלות — ${listingTitle}`}>
          <label className="field">
            <span>מסמך בעלות או הרשאה (PDF, JPG, PNG או WEBP, עד 10MB)</span>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
              disabled={pending}
              aria-invalid={!!error && !file}
              aria-describedby={error ? `${id}-err` : undefined}
            />
          </label>
          {file && (
            <span className="small muted dash-file">
              <Paperclip size={14} aria-hidden /> {file.name} · {fmtNum(file.size / (1024 * 1024), 1)}MB
            </span>
          )}
          <label className="field">
            <span>הערה לצוות הבדיקה (לא חובה)</span>
            <textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} readOnly={pending} />
          </label>
          {error && (
            <p id={`${id}-err`} className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="dash-btns">
            <button type="submit" className="btn primary sm" disabled={pending}>
              {pending ? <LoaderCircle size={15} className="spin" aria-hidden /> : <FileUp size={15} aria-hidden />}
              {pending ? 'שולח…' : 'שליחה לבדיקה'}
            </button>
            <button type="button" className="btn ghost sm" onClick={reset} disabled={pending}>
              ביטול
            </button>
          </div>
        </form>
      )}

      {requests.length > 0 && (
        <div className="dash-verif-history">
          <h5>בקשות שהוגשו</h5>
          <ul>
            {requests.map((r) => {
              const rs = VERIFICATION_REQUEST_STATUS[r.status];
              const url = documentUrls[r.documentPath];
              return (
                <li key={r.id}>
                  <div className="dash-verif-row">
                    <Tag tone={rs.tone}>{rs.label}</Tag>
                    <time dateTime={r.createdAt} suppressHydrationWarning>
                      הוגשה {fmtDate(r.createdAt)}
                    </time>
                    {url && (
                      <a className="btn link xs" href={url} target="_blank" rel="noopener noreferrer">
                        <FileText size={14} aria-hidden /> צפייה במסמך
                      </a>
                    )}
                  </div>
                  {r.note && <p className="small">ההערה שלך: {r.note}</p>}
                  {r.reviewNote && <p className="small dash-review-note">הערת הצוות: {r.reviewNote}</p>}
                  {r.reviewedAt && (
                    <span className="tiny muted" suppressHydrationWarning>
                      נבדקה {fmtDate(r.reviewedAt)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
