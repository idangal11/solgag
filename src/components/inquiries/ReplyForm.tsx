'use client';

import { LoaderCircle, Send } from 'lucide-react';
import { useId, useRef, useState, useTransition, type FormEvent } from 'react';
import { sendInquiryReply } from '@/app/inquiries/actions';
import { useApp } from '@/components/AppProvider';
import { fieldErrors, messageSchema } from '@/lib/validation';

const MAX = 2000;

export function ReplyForm({ inquiryId }: { inquiryId: string }) {
  const { toast } = useApp();
  const id = useId();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLTextAreaElement>(null);

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
    startTransition(async () => {
      const res = await sendInquiryReply(parsed.data);
      if (!res.ok) {
        setError(res.error);
        toast(res.error, 'error');
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
        <p id={`${id}-err`} className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
