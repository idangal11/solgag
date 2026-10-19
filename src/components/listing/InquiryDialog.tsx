'use client';

import { CheckCircle2, Loader2, Send, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from 'react';
import { submitInquiry } from '@/app/listing/[id]/actions';
import { useApp } from '@/components/AppProvider';
import { INQUIRY_ROLE_LABEL } from '@/lib/labels';
import type { InquiryRole, Listing } from '@/lib/types';
import { fieldErrors, inquirySchema } from '@/lib/validation';

const ROLES = Object.keys(INQUIRY_ROLE_LABEL) as InquiryRole[];
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface InquiryDialogProps {
  listing: Pick<Listing, 'id' | 'title' | 'locality'>;
  prefill: { name: string; contact: string };
  onClose: () => void;
}

// The typed message survives closing the dialog, a failed send and the sign-in round
// trip (same tab only). Contact details are not stored: they come from the profile.
type Draft = { role: InquiryRole; message: string };
// Keyed by user too, so a draft (which may contain a phone number) never surfaces for
// another account signed in later on the same browser tab.
const draftKey = (userId: string, listingId: string) => `solgag:inquiry-draft:${userId}:${listingId}`;

function readDraft(key: string): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Draft>;
    if (typeof d.message !== 'string' || !d.message.trim()) return null;
    return { role: d.role && ROLES.includes(d.role) ? d.role : 'investor', message: d.message.slice(0, 2000) };
  } catch {
    return null;
  }
}

/** Returns false when storage is unavailable (private mode, blocked): the draft is then not kept. */
function writeDraft(key: string, draft: Draft | null): boolean {
  try {
    if (draft) window.sessionStorage.setItem(key, JSON.stringify(draft));
    else window.sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function InquiryDialog({ listing, prefill, onClose }: InquiryDialogProps) {
  const uid = useId();
  const { user } = useApp();
  const storageKey = draftKey(user?.id ?? 'anon', listing.id);
  // Rendered only on the client (after a click), so reading storage here cannot mismatch hydration.
  const [draft] = useState(() => readDraft(storageKey));
  const [name, setName] = useState(prefill.name);
  const [contact, setContact] = useState(prefill.contact);
  const [role, setRole] = useState<InquiryRole>(draft?.role ?? 'investor');
  const [message, setMessage] = useState(
    draft?.message ?? `שלום, אני מתעניין/ת בגג "${listing.title}" ב${listing.locality}. אשמח לקבל פרטים נוספים על התנאים והמבנה.`,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const modalRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  // Initial focus goes to the first field still to fill in.
  const [firstEmpty] = useState(() => (!prefill.name ? 'name' : !prefill.contact ? 'contact' : 'message'));

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [onClose]);

  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  // Keep Tab / Shift+Tab inside the dialog.
  const trapFocus = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !modalRef.current) return;
    const items = Array.from(modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === modalRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setFormError(null);
    const input = { listingId: listing.id, senderName: name, senderContact: contact, senderRole: role, message };
    const parsed = inquirySchema.safeParse(input);
    if (!parsed.success) {
      showFieldErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setNeedsLogin(false);
    startTransition(async () => {
      // A rejected call (network error, new deployment) must not reach error.tsx: the
      // dialog stays open with everything the user typed, and shows a Hebrew error.
      try {
        const res = await submitInquiry(parsed.data);
        if (res.ok) {
          writeDraft(storageKey, null);
          setDone(true);
          return;
        }
        // The session expired since the page loaded: offer to sign in again.
        setNeedsLogin(!!res.needsAuth);
        if (res.fieldErrors) showFieldErrors(res.fieldErrors);
        const generic = !res.fieldErrors || !!res.fieldErrors.listingId;
        setFormError(res.error ?? (generic ? 'שליחת הפנייה נכשלה. נסו שוב.' : null));
      } catch {
        // Keep the message in sessionStorage too, so even a page refresh (needed after a
        // new deployment) brings it back.
        const kept = writeDraft(storageKey, { role: parsed.data.senderRole, message: parsed.data.message });
        setFormError(
          kept
            ? 'שליחת הפנייה נכשלה — ייתכן שהחיבור לאינטרנט נקטע. ההודעה שכתבת נשמרה; נסו שוב, ואם זה חוזר — רעננו את הדף.'
            : 'שליחת הפנייה נכשלה — ייתכן שהחיבור לאינטרנט נקטע. הפרטים שמילאת נשארו בטופס; נסו לשלוח שוב בעוד רגע.',
        );
      }
    });
  };

  const updateMessage = (value: string) => {
    setMessage(value);
    writeDraft(storageKey, { role, message: value });
  };
  const updateRole = (value: InquiryRole) => {
    setRole(value);
    writeDraft(storageKey, { role: value, message });
  };

  const showFieldErrors = (errs: Record<string, string>) => {
    setErrors(errs);
    requestAnimationFrame(() => modalRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  };

  const fieldProps = (key: string) => ({
    'aria-invalid': !!errors[key],
    'aria-describedby': errors[key] ? `${uid}-${key}-err` : undefined,
  });
  const fieldError = (key: string) =>
    errors[key] ? (
      <small className="err" id={`${uid}-${key}-err`}>
        {errors[key]}
      </small>
    ) : null;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`} ref={modalRef} onKeyDown={trapFocus}>
        <button type="button" className="icon-btn close" onClick={onClose} aria-label="סגירת החלון">
          <X size={18} />
        </button>
        {done ? (
          <div className="inq-done" role="status">
            <CheckCircle2 size={48} className="ok" aria-hidden="true" />
            <h2 id={`${uid}-title`} ref={doneRef} tabIndex={-1}>
              הפנייה נשלחה לבעלי הגג
            </h2>
            <p>
              בעלי הגג יראו את ההודעה ואת פרטי הקשר שמסרת. תשובות שיגיעו דרך האתר יופיעו ב<Link href="/dashboard">אזור האישי</Link> שלך, תחת
              הפניות שנשלחו.
            </p>
            <div className="row-btns">
              <Link className="btn primary" href="/dashboard" onClick={onClose}>
                לאזור האישי
              </Link>
              <button type="button" className="btn ghost" onClick={onClose}>
                חזרה למודעה
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate aria-busy={pending}>
            <h2 id={`${uid}-title`}>מתעניין/ת בגג הזה</h2>
            <p className="muted">
              {listing.title} · {listing.locality}
            </p>
            {formError && (
              <div className="form-error" role="alert">
                {formError}
                {needsLogin && (
                  <>
                    {' '}
                    <Link href={`/login?next=${encodeURIComponent(`/listing/${listing.id}`)}`}>להתחברות</Link>
                  </>
                )}
              </div>
            )}
            <label className="field">
              <span>שם מלא</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                autoFocus={firstEmpty === 'name'}
                maxLength={100}
                required
                {...fieldProps('senderName')}
              />
              {fieldError('senderName')}
            </label>
            <label className="field">
              <span>טלפון או דוא״ל לחזרה</span>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                dir="ltr"
                placeholder="050-0000000 / name@example.com"
                autoFocus={firstEmpty === 'contact'}
                maxLength={254}
                required
                {...fieldProps('senderContact')}
              />
              {fieldError('senderContact')}
            </label>
            <label className="field">
              <span>אני פונה בתור</span>
              <select value={role} onChange={(e) => updateRole(e.target.value as InquiryRole)} {...fieldProps('senderRole')}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {INQUIRY_ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
              {fieldError('senderRole')}
            </label>
            <label className="field">
              <span>הודעה</span>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => updateMessage(e.target.value)}
                autoFocus={firstEmpty === 'message'}
                maxLength={2000}
                required
                {...fieldProps('message')}
              />
              {fieldError('message')}
            </label>
            <p className="hint inq-privacy">
              השם, פרטי הקשר וההודעה יוצגו לבעלי הגג באזור האישי שלהם. שליחת פנייה אינה מחייבת אף צד. <Link href="/privacy">מדיניות פרטיות</Link>
            </p>
            <button className="btn primary block" type="submit" disabled={pending}>
              {pending ? <Loader2 size={16} className="spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
              {pending ? 'שולח…' : 'שליחת הפנייה'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
