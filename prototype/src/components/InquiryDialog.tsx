import { CheckCircle2, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { href } from '../router';
import { useStore } from '../store';
import type { Inquiry, Listing } from '../types';

export function InquiryDialog({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const { addInquiry } = useStore();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [role, setRole] = useState<Inquiry['role']>('investor');
  const [message, setMessage] = useState(`שלום, אני מתעניין/ת בגג "${listing.title}" ב${listing.locality}. אשמח לקבל פרטים נוספים על התנאים והמבנה.`);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [onClose]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = 'נא להזין שם';
    const c = contact.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) && !/^[0-9+\-\s]{9,}$/.test(c)) errs.contact = 'נא להזין טלפון או דוא״ל תקינים';
    if (message.trim().length < 5) errs.message = 'נא לכתוב הודעה קצרה';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    addInquiry({ listingId: listing.id, listingTitle: listing.title, name: name.trim(), contact: c, role, message: message.trim(), direction: 'sent' });
    setDone(true);
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="inq-title">
        <button className="icon-btn close" onClick={onClose} aria-label="סגור">
          <X size={18} />
        </button>
        {done ? (
          <div className="inq-done">
            <CheckCircle2 size={48} className="ok" />
            <h2 id="inq-title">הפנייה נשמרה בדמו</h2>
            <p>
              <b>שימו לב:</b> זהו אב-טיפוס. הפנייה נשמרה רק בדפדפן שלך (localStorage) ו<b>לא נשלחה לאדם אמיתי</b>. בעלי הגג במודעה זו בדויים.
            </p>
            <div className="row-btns">
              <a className="btn primary" href={href.dashboard()} onClick={onClose}>
                לפניות שלי
              </a>
              <button className="btn ghost" onClick={onClose}>
                חזרה למודעה
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <h2 id="inq-title">מתעניין/ת בגג הזה</h2>
            <p className="muted">{listing.title} · {listing.locality}</p>
            <div className="demo-note">דמו: הפנייה תישמר מקומית בלבד ולא תישלח לאף אחד.</div>
            <label className="field">
              <span>שם מלא</span>
              <input ref={first} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-invalid={!!errors.name} />
              {errors.name && <small className="err">{errors.name}</small>}
            </label>
            <label className="field">
              <span>טלפון או דוא״ל</span>
              <input value={contact} onChange={(e) => setContact(e.target.value)} dir="ltr" placeholder="050-0000000 / name@example.com" aria-invalid={!!errors.contact} />
              {errors.contact && <small className="err">{errors.contact}</small>}
            </label>
            <label className="field">
              <span>אני פונה בתור</span>
              <select value={role} onChange={(e) => setRole(e.target.value as Inquiry['role'])}>
                <option value="investor">משקיע/ה</option>
                <option value="installer">חברת התקנה / יזם</option>
                <option value="other">אחר</option>
              </select>
            </label>
            <label className="field">
              <span>הודעה</span>
              <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} aria-invalid={!!errors.message} />
              {errors.message && <small className="err">{errors.message}</small>}
            </label>
            <button className="btn primary block" type="submit">
              <Send size={16} /> שמירת פנייה (דמו)
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
