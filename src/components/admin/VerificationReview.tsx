'use client';

import { CircleCheck, CircleX, ExternalLink, FileText, LoaderCircle } from 'lucide-react';
import { useId, useState, useTransition } from 'react';
import { getVerificationDocumentUrl, reviewVerificationRequest } from '@/app/admin/actions';
import { useApp } from '@/components/AppProvider';
import { VERIFICATION } from '@/lib/labels';

/** Document viewer + approve/reject controls for one pending ownership request. */
export function VerificationReview({ requestId, listingTitle }: { requestId: string; listingTitle: string }) {
  const { toast } = useApp();
  const hintId = useId();
  const [note, setNote] = useState('');
  const [docLoading, setDocLoading] = useState(false);
  const [docViewed, setDocViewed] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function openDocument() {
    setError(null);
    setDocLoading(true);
    // Open the tab inside the click (popup blockers allow it), then point it at the signed URL.
    const win = window.open('', '_blank');
    const res = await getVerificationDocumentUrl(requestId).catch(() => ({ ok: false as const, error: 'החיבור לשרת נכשל. נסו שוב.' }));
    setDocLoading(false);
    if (!res.ok) {
      win?.close();
      setError(res.error);
      return;
    }
    setDocViewed(true);
    if (win) {
      win.opener = null;
      win.location.href = res.url;
    } else {
      setFallbackUrl(res.url);
    }
  }

  function decide(approve: boolean) {
    const question = approve
      ? `לאשר את הבעלות על "${listingTitle}"?\n\nהמודעה תוצג כ"${VERIFICATION.verified.label}". יש לאשר רק אחרי שבדקת שהמסמך מתייחס לנכס הזה ושהבעלים או המורשה בו תואמים למפרסם.`
      : `לדחות את הבקשה עבור "${listingTitle}"?\n\nהמודעה תסומן "${VERIFICATION.rejected.label}" והמפרסם יוכל להגיש מסמכים חדשים.`;
    if (!window.confirm(question)) return;
    setError(null);
    startTransition(async () => {
      const res = await reviewVerificationRequest({ requestId, approve, note }).catch(() => ({
        ok: false as const,
        error: 'החיבור לשרת נכשל. נסו שוב.',
      }));
      if (!res.ok) {
        setError(res.error);
        toast(res.error, 'error');
        return;
      }
      toast(approve ? 'הבעלות אושרה והסימון במודעה עודכן' : 'הבקשה נדחתה והסימון במודעה עודכן');
    });
  }

  return (
    <div className="vr-actions">
      <div className="vr-doc">
        <button type="button" className="btn ghost sm" onClick={openDocument} disabled={docLoading || pending}>
          {docLoading ? <LoaderCircle size={15} className="spin" aria-hidden /> : <FileText size={15} aria-hidden />}
          צפייה במסמך
        </button>
        {fallbackUrl && (
          <a className="btn link sm" href={fallbackUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} aria-hidden /> פתיחת המסמך בלשונית חדשה
          </a>
        )}
        <span className="hint">קישור זמני ומאובטח, בתוקף ל-10 דקות.</span>
      </div>

      <label className="field">
        <span>הערת בודק (לא חובה)</span>
        <textarea
          rows={2}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="למשל: נסח טאבו תואם לגוש/חלקה ולשם המפרסם"
          disabled={pending}
        />
        <span className="hint">ההערה נשמרת עם ההחלטה וגלויה למפרסם.</span>
      </label>

      <p className="hint">
        אישור יציג במודעה „{VERIFICATION.verified.label}”: {VERIFICATION.verified.desc}
      </p>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="vr-buttons">
        <button
          type="button"
          className="btn primary sm"
          onClick={() => decide(true)}
          disabled={!docViewed || pending}
          aria-describedby={docViewed ? undefined : hintId}
        >
          {pending ? <LoaderCircle size={15} className="spin" aria-hidden /> : <CircleCheck size={15} aria-hidden />}
          אישור בעלות
        </button>
        <button type="button" className="btn danger-ghost sm" onClick={() => decide(false)} disabled={pending}>
          <CircleX size={15} aria-hidden /> דחיית הבקשה
        </button>
        {!docViewed && (
          <span className="hint" id={hintId}>
            יש לצפות במסמך לפני אישור.
          </span>
        )}
      </div>
    </div>
  );
}
