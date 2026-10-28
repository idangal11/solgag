'use client';

import { Building2, Check, ExternalLink, LoaderCircle, MapPin, Plus, RotateCcw, Store, Sun, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { addProspectBusiness, reviewProspectRoof } from '@/app/admin/prospects/actions';
import { Tag } from '@/components/ui';
import { fmtNum } from '@/lib/labels';
import { CONFIDENCE, REVIEW, SUITABILITY_LABEL, UNAVAILABLE, type ProspectRoof } from '@/lib/prospects';
import { BusinessCard } from './BusinessCard';
import { useAdminAction } from './useAdminAction';

const formatAddress = (a: { street: string; houseNumber: string | null; locality: string | null }) =>
  `${a.street}${a.houseNumber ? ` ${a.houseNumber}` : ''}${a.locality ? `, ${a.locality}` : ''}`;

function RoofReview({ roof }: { roof: ProspectRoof }) {
  const { pending, run } = useAdminAction();
  const [note, setNote] = useState(roof.reviewNote ?? '');
  const [suitability, setSuitability] = useState(roof.suitability);
  const [fixing, setFixing] = useState(false);

  function decide(status: 'approved' | 'rejected' | 'pending') {
    run(
      () => reviewProspectRoof({ roofId: roof.id, status, note, suitability }),
      status === 'approved' ? `${roof.ref} אושר` : status === 'rejected' ? `${roof.ref} נדחה` : `${roof.ref} הוחזר לבדיקה`,
    );
  }

  function saveAddress(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? '');
    run(
      () =>
        reviewProspectRoof({
          roofId: roof.id,
          status: 'corrected',
          note,
          suitability,
          address: {
            street: s('street'),
            houseNumber: s('houseNumber'),
            locality: s('locality'),
            confidence: s('confidence') as 'high' | 'medium' | 'low',
            sourceNote: s('sourceNote'),
            sourceUrl: s('sourceUrl'),
          },
        }),
      'הכתובת תוקנה',
      () => setFixing(false),
    );
  }

  return (
    <section className="pr-section" aria-labelledby={`review-${roof.id}`}>
      <h3 id={`review-${roof.id}`}>בדיקת הגג</h3>
      <div className="pr-form-row">
        <label className="field">
          <span>התאמה לסולארי</span>
          <select value={suitability} onChange={(e) => setSuitability(e.target.value as ProspectRoof['suitability'])} disabled={pending}>
            {(Object.keys(SUITABILITY_LABEL) as ProspectRoof['suitability'][]).map((v) => (
              <option key={v} value={v}>
                {SUITABILITY_LABEL[v]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>הערת בודק/ת</span>
        <textarea rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} disabled={pending} />
      </label>
      <div className="pr-buttons">
        <button type="button" className="btn primary sm" onClick={() => decide('approved')} disabled={pending}>
          <Check size={15} aria-hidden /> אישור הגג
        </button>
        <button type="button" className="btn ghost sm" onClick={() => setFixing((v) => !v)} disabled={pending} aria-expanded={fixing}>
          <MapPin size={15} aria-hidden /> תיקון כתובת
        </button>
        <button type="button" className="btn danger-ghost sm" onClick={() => decide('rejected')} disabled={pending}>
          <X size={15} aria-hidden /> דחייה
        </button>
        {roof.reviewStatus !== 'pending' && (
          <button type="button" className="btn link sm" onClick={() => decide('pending')} disabled={pending}>
            <RotateCcw size={15} aria-hidden /> החזרה לבדיקה
          </button>
        )}
        {pending && <LoaderCircle size={16} className="spin" aria-hidden />}
      </div>
      {fixing && (
        <form className="pr-form" onSubmit={saveAddress}>
          <div className="pr-form-row">
            <label className="field">
              <span>רחוב</span>
              <input name="street" required maxLength={120} defaultValue={roof.address?.street ?? ''} />
            </label>
            <label className="field">
              <span>מספר</span>
              <input name="houseNumber" maxLength={20} defaultValue={roof.address?.houseNumber ?? ''} />
            </label>
          </div>
          <div className="pr-form-row">
            <label className="field">
              <span>יישוב / אזור</span>
              <input name="locality" maxLength={120} defaultValue={roof.address?.locality ?? 'פארק תעשיות עמק חפר'} />
            </label>
            <label className="field">
              <span>ביטחון בכתובת</span>
              <select name="confidence" defaultValue="medium">
                <option value="high">{CONFIDENCE.high.label}</option>
                <option value="medium">{CONFIDENCE.medium.label}</option>
                <option value="low">{CONFIDENCE.low.label}</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span>מאיפה הכתובת? (חובה)</span>
            <input name="sourceNote" required minLength={3} maxLength={500} placeholder="למשל: שלט על המבנה בביקור ב-21.10" />
          </label>
          <label className="field">
            <span>קישור למקור (אם יש)</span>
            <input name="sourceUrl" type="url" dir="ltr" placeholder="https://" />
          </label>
          <div className="pr-buttons">
            <button type="submit" className="btn primary sm" disabled={pending}>
              שמירת כתובת
            </button>
            <button type="button" className="btn link sm" onClick={() => setFixing(false)}>
              ביטול
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function AddBusiness({ roofId }: { roofId: string }) {
  const { pending, run } = useAdminAction();
  const [open, setOpen] = useState(false);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? '');
    run(
      () =>
        addProspectBusiness({
          roofId,
          name: s('name'),
          matchConfidence: s('matchConfidence') as 'high' | 'medium' | 'low',
          matchBasis: s('matchBasis'),
          sourceUrl: s('sourceUrl'),
          website: s('website'),
          websiteSourceUrl: s('websiteSourceUrl') || s('sourceUrl'),
          phone: s('phone'),
          phoneSourceUrl: s('phoneSourceUrl'),
          email: s('email'),
          emailSourceUrl: s('emailSourceUrl'),
        }),
      'העסק נוסף כמועמד',
      () => setOpen(false),
    );
  }

  if (!open) {
    return (
      <button type="button" className="btn ghost sm" onClick={() => setOpen(true)}>
        <Plus size={15} aria-hidden /> הוספת עסק מועמד
      </button>
    );
  }
  return (
    <form className="pr-form" onSubmit={submit}>
      <p className="note small">העסק יישמר כ„עסק בכתובת — לא ידוע אם בעלים”. חובה לצרף מקור; פרטי קשר רק עם קישור לעמוד שבו הופיעו.</p>
      <label className="field">
        <span>שם העסק</span>
        <input name="name" required maxLength={200} />
      </label>
      <div className="pr-form-row">
        <label className="field">
          <span>ביטחון בהתאמה</span>
          <select name="matchConfidence" defaultValue="low">
            <option value="high">{CONFIDENCE.high.label}</option>
            <option value="medium">{CONFIDENCE.medium.label}</option>
            <option value="low">{CONFIDENCE.low.label}</option>
          </select>
        </label>
        <label className="field">
          <span>קישור למקור (חובה)</span>
          <input name="sourceUrl" type="url" dir="ltr" required placeholder="https://" />
        </label>
      </div>
      <label className="field">
        <span>על סמך מה העסק משויך לגג?</span>
        <input name="matchBasis" required minLength={5} maxLength={1000} />
      </label>
      {(
        [
          ['website', 'אתר רשמי', 'url'],
          ['phone', 'טלפון עסקי', 'tel'],
          ['email', 'דוא״ל עסקי', 'email'],
        ] as const
      ).map(([key, label, type]) => (
        <div className="pr-form-row" key={key}>
          <label className="field">
            <span>{label} (אופציונלי)</span>
            <input name={key} type={type} dir="ltr" />
          </label>
          <label className="field">
            <span>מקור של {label}</span>
            <input name={`${key}SourceUrl`} type="url" dir="ltr" placeholder="https://" />
          </label>
        </div>
      ))}
      <div className="pr-buttons">
        <button type="submit" className="btn primary sm" disabled={pending}>
          הוספה
        </button>
        <button type="button" className="btn link sm" onClick={() => setOpen(false)}>
          ביטול
        </button>
        {pending && <LoaderCircle size={16} className="spin" aria-hidden />}
      </div>
    </form>
  );
}

export function RoofDetail({ roof }: { roof: ProspectRoof }) {
  const [lat, lng] = roof.center;
  const d = roof.suitabilityDetail;
  const review = REVIEW[roof.reviewStatus];
  const live = roof.businesses.filter((b) => b.reviewStatus !== 'rejected');

  return (
    <article className="pr-detail" aria-labelledby={`roof-${roof.id}`}>
      <header className="pr-detail-head">
        <h2 id={`roof-${roof.id}`}>
          <Building2 size={18} aria-hidden /> {roof.ref}
        </h2>
        <div className="pr-tags">
          {roof.isDemo ? <Tag tone="warn">נתוני הדגמה — לא אמיתי</Tag> : <Tag tone="info">רשומה אמיתית</Tag>}
          <Tag tone={review.tone}>{review.label}</Tag>
        </div>
      </header>

      <dl className="vr-facts">
        <div>
          <dt>שטח גג משוער</dt>
          <dd>{fmtNum(roof.areaM2)} מ״ר</dd>
        </div>
        <div>
          <dt>ביטחון במבנה</dt>
          <dd>
            <Tag tone={CONFIDENCE[roof.building.confidence].tone}>{CONFIDENCE[roof.building.confidence].label}</Tag>
          </dd>
        </div>
        <div>
          <dt>הספק משוער (DC, ראשוני)</dt>
          <dd>{d.estKwpDc != null ? <bdi dir="ltr">~{fmtNum(d.estKwpDc)} kWp</bdi> : UNAVAILABLE}</dd>
        </div>
      </dl>

      <section className="pr-section">
        <h3>
          <Building2 size={16} aria-hidden /> המבנה
        </h3>
        <ul className="pr-list">
          {roof.building.basis.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <p className="muted small">
          מקור הגבול:{' '}
          {roof.building.sourceUrl ? (
            <a href={roof.building.sourceUrl} target="_blank" rel="noopener noreferrer">
              {roof.building.source}
            </a>
          ) : (
            roof.building.source
          )}{' '}
          · רישיון {roof.building.license}. השטח מחושב מטביעת הרגל של המבנה ואינו מדידה.
        </p>
      </section>

      <section className="pr-section">
        <h3>
          <Sun size={16} aria-hidden /> התאמה לסולארי
        </h3>
        <p>
          <Tag tone={roof.suitability === 'unsuitable' ? 'bad' : roof.suitability === 'plausible_after_review' ? 'info' : 'warn'}>
            {SUITABILITY_LABEL[roof.suitability]}
          </Tag>
        </p>
        <p className="muted small">
          {d.usableAreaM2 != null && `שטח שמיש משוער ${fmtNum(d.usableAreaM2)} מ״ר. `}
          {d.assumptions}
        </p>
        {d.existingPvMappedInOsm?.length ? <p className="note small">ב-OpenStreetMap מסומנים פאנלים קיימים על הגג הזה.</p> : null}
      </section>

      <section className="pr-section">
        <h3>
          <MapPin size={16} aria-hidden /> כתובת
        </h3>
        {roof.address ? (
          <p>
            <b>{formatAddress(roof.address)}</b>{' '}
            {roof.address.confidence && <Tag tone={CONFIDENCE[roof.address.confidence].tone}>ביטחון בכתובת: {CONFIDENCE[roof.address.confidence].label}</Tag>}
            <span className="muted small pr-block">
              {roof.address.source}
              {roof.address.method ? ` — ${roof.address.method}` : ''}
              {roof.address.sourceUrl && (
                <>
                  {' '}
                  <a className="pr-src" href={roof.address.sourceUrl} target="_blank" rel="noopener noreferrer">
                    מקור <ExternalLink size={12} aria-hidden />
                  </a>
                </>
              )}
            </span>
          </p>
        ) : (
          <p className="pr-unavailable">{UNAVAILABLE}</p>
        )}
        {roof.addressCandidates.length > 1 && (
          <details className="pr-sources">
            <summary>כל הכתובות האפשריות ({roof.addressCandidates.length})</summary>
            <ul>
              {roof.addressCandidates.map((a) => (
                <li key={`${a.street}|${a.houseNumber}|${a.source}`}>
                  <Tag tone={CONFIDENCE[a.confidence].tone}>{CONFIDENCE[a.confidence].label}</Tag> {formatAddress(a)}
                  <span className="muted small pr-block">
                    {a.method} ·{' '}
                    {a.sourceUrl ? (
                      <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer">
                        {a.source}
                      </a>
                    ) : (
                      a.source
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
        <p className="muted small">
          בדיקה ידנית (פתיחה בלבד, בלי להעתיק נתונים):{' '}
          <a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=19/${lat}/${lng}`} target="_blank" rel="noopener noreferrer">
            OpenStreetMap
          </a>{' '}
          ·{' '}
          <a href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`} target="_blank" rel="noopener noreferrer">
            Google Maps
          </a>
        </p>
      </section>

      <section className="pr-section">
        <h3>
          <Store size={16} aria-hidden /> עסקים אפשריים ({live.length})
        </h3>
        <p className="note small">
          עסק שפועל בכתובת עשוי להיות שוכר. „התאמת עסק לגג” נפרדת מ„ביטחון במבנה”. כשהכתובת לא חד-משמעית מוצגים כמה מועמדים.
        </p>
        {roof.businesses.length ? (
          <ul className="pr-biz-list">
            {roof.businesses.map((b) => (
              <BusinessCard key={b.id} business={b} />
            ))}
          </ul>
        ) : (
          <p className="pr-unavailable">לא נמצא עסק במקורות הציבוריים שנבדקו.</p>
        )}
        <AddBusiness roofId={roof.id} />
      </section>

      <RoofReview key={`${roof.id}-${roof.reviewStatus}`} roof={roof} />
    </article>
  );
}
