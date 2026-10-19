'use client';

import { LoaderCircle, RefreshCw, Send } from 'lucide-react';
import { useId, useRef, useState, useSyncExternalStore, useTransition, type FormEvent } from 'react';
import { callAction } from '@/app/dashboard/_lib/callAction';
import { sendInquiryReply } from '@/app/inquiries/actions';
import { useApp } from '@/components/AppProvider';
import { fieldErrors, messageSchema } from '@/lib/validation';

const MAX = 2000;

// The unsent reply is also kept in this tab's sessionStorage, so it survives a
// reload (e.g. after a deploy made the page stale). A per-viewer convenience
// only: every access is guarded and the form works without it.
const draftKey = (inquiryId: string) => `solgag:reply-draft:${inquiryId}`;

function readDraft(key: string): string {
  try {
    return window.sessionStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function writeDraft(key: string, value: string) {
  try {
    if (value) window.sessionStorage.setItem(key, value);
    else window.sessionStorage.removeItem(key);
  } catch {
    /* storage unavailable (private mode, blocked site data) */
  }
}

const noSubscribe = () => () => {};

export function ReplyForm({ inquiryId }: { inquiryId: string }) {
  const { toast } = useApp();
  const id = useId();
  const key = draftKey(inquiryId);
  // Server render and hydration see '' — the saved draft appears right after hydration.
  const savedDraft = useSyncExternalStore(
    noSubscribe,
    () => readDraft(key),
    () => '',
  );
  const [edited, setEdited] = useState<string | null>(null);
  const body = edited ?? savedDraft;
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLTextAreaElement>(null);

  const setBody = (value: string) => {
    setEdited(value);
    writeDraft(key, value);
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (pending) return;
    const parsed = messageSchema.safeParse({ inquiryId, body });
    if (!parsed.success) {
      setError(fieldErrors(parsed.error).body ?? 'ההודעה אינה תקינה');
      input.current?.focus();
      return;
    }
    setError(null);
    setStale(false);
    startTransition(async () => {
      const res = await callAction(() => sendInquiryReply(parsed.data));
      if (!res.ok) {
        // The text stays in the box (and in the saved draft) on every failure.
        const msg =
          res.reason === 'network'
            ? 'החיבור לשרת נכשל וייתכן שההודעה לא נשלחה. הטקסט נשמר כאן — לפני שליחה חוזרת לחצו „רענון״ ובדקו אם ההודעה כבר הופיעה בשיחה.'
            : res.error;
        setStale(res.reason === 'stale');
        setError(msg);
        toast(msg, 'error');
        return;
      }
      setBody('');
      toast('ההודעה נשלחה');
      input.current?.focus();
    });
  };

  return (
    <form className="card-surface dash-reply" onSubmit={submit} noValidate aria-busy={pending}>
      <label className="field">
        <span>כתיבת תשובה</span>
        <textarea
          ref={input}
          rows={4}
          maxLength={MAX}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit();
          }}
          aria-invalid={!!error}
          aria-describedby={`${id}-hint${error ? ` ${id}-err` : ''}`}
          readOnly={pending}
          placeholder="ההודעה תופיע בשיחה אצל הצד השני"
        />
      </label>
      <div className="dash-reply-foot">
        <small id={`${id}-hint`} className="hint">
          {body.length}/{MAX} · Ctrl+Enter לשליחה
        </small>
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? <LoaderCircle size={16} className="spin" aria-hidden /> : <Send size={16} aria-hidden />}
          {pending ? 'שולח…' : 'שליחה'}
        </button>
      </div>
      {error && (
        <div className="dash-reply-error">
          <p id={`${id}-err`} className="form-error" role="alert">
            {error}
          </p>
          {stale && (
            <button type="button" className="btn ghost sm" onClick={() => window.location.reload()}>
              <RefreshCw size={15} aria-hidden />
              {/* Only promise the draft survives when the browser actually stored it. */}
              {readDraft(key) === body ? 'רענון העמוד (הטיוטה תישמר)' : 'רענון העמוד (העתיקו קודם את הטיוטה)'}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
