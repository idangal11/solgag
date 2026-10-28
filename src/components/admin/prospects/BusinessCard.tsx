'use client';

import { Check, ExternalLink, Globe, LoaderCircle, Mail, Pencil, Phone, RotateCcw, X } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { reviewProspectBusiness } from '@/app/admin/prospects/actions';
import { Tag } from '@/components/ui';
import { fmtDate } from '@/lib/labels';
import { CONFIDENCE, RELATION, REVIEW, SOURCE_KIND_LABEL, UNAVAILABLE, type ProspectBusiness, type Relation } from '@/lib/prospects';
import { useAdminAction } from './useAdminAction';

function SourceLink({ href, title }: { href: string | null; title?: string | null }) {
  if (!href) return null;
  return (
    <a className="pr-src" href={href} target="_blank" rel="noopener noreferrer nofollow" title={title ?? href}>
      מקור <ExternalLink size={12} aria-hidden />
    </a>
  );
}

function Contact({ icon, label, value, href, source, snippet }: { icon: ReactNode; label: string; value: string | null; href?: string; source: string | null; snippet: string | null }) {
  return (
    <div className="pr-contact">
      <dt>
        {icon} {label}
      </dt>
      <dd>
        {value ? (
          <>
            <bdi className="pr-value" dir="ltr">
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                  {value}
                </a>
              ) : (
                value
              )}
            </bdi>
            <SourceLink href={source} title={snippet ? `מופיע במקור: „${snippet}”` : null} />
          </>
        ) : (
          <span className="pr-unavailable">{UNAVAILABLE}</span>
        )}
      </dd>
    </div>
  );
}

const RELATION_VALUES = Object.keys(RELATION) as Relation[];

export function BusinessCard({ business: b }: { business: ProspectBusiness }) {
  const { pending, run } = useAdminAction();
  const [note, setNote] = useState(b.reviewNote ?? '');
  const [editing, setEditing] = useState(false);
  const review = REVIEW[b.reviewStatus];

  function decide(status: 'approved' | 'rejected' | 'pending') {
    run(() => reviewProspectBusiness({ businessId: b.id, status, note }), status === 'approved' ? 'ההתאמה אושרה' : status === 'rejected' ? 'ההתאמה נדחתה' : 'הוחזר לבדיקה');
  }

  function saveCorrection(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? '');
    run(
      () =>
        reviewProspectBusiness({
          businessId: b.id,
          status: 'corrected',
          note,
          correction: {
            name: s('name'),
            relation: s('relation') as Relation,
            relationEvidence: s('relationEvidence'),
            matchConfidence: s('matchConfidence') as 'high' | 'medium' | 'low',
            website: s('website'),
            websiteSourceUrl: s('websiteSourceUrl'),
            phone: s('phone'),
            phoneSourceUrl: s('phoneSourceUrl'),
            email: s('email'),
            emailSourceUrl: s('emailSourceUrl'),
          },
        }),
      'התיקון נשמר',
      () => setEditing(false),
    );
  }

  return (
    <li className={`pr-biz${b.reviewStatus === 'rejected' ? ' is-rejected' : ''}`} aria-busy={pending || undefined}>
      <div className="pr-biz-head">
        <div>
          <b className="pr-biz-name">{b.name}</b>
          {b.nameEn && b.nameEn !== b.name && (
            <bdi className="muted small" dir="ltr">
              {' '}
              {b.nameEn}
            </bdi>
          )}
          {b.category && <span className="muted small"> · {b.category}</span>}
        </div>
        <div className="pr-tags">
          {b.isDemo && <Tag tone="warn">נתוני הדגמה</Tag>}
          <Tag tone={review.tone}>{review.label}</Tag>
        </div>
      </div>

      <div className="pr-tags">
        <Tag tone={CONFIDENCE[b.matchConfidence].tone}>התאמת עסק לגג: {CONFIDENCE[b.matchConfidence].label}</Tag>
        <Tag tone={RELATION[b.relation].tone}>{RELATION[b.relation].label}</Tag>
      </div>
      <p className="pr-basis">
        <span className="muted">בסיס ההתאמה: </span>
        {b.matchBasis}
      </p>
      {b.relation === 'owner_evidence' && b.relationEvidence && (
        <p className="pr-basis">
          <span className="muted">ראיה לבעלות: </span>
          {b.relationEvidence}
        </p>
      )}

      <dl className="pr-contacts">
        <div className="pr-contact">
          <dt>כתובת העסק</dt>
          <dd>
            {b.businessAddress ? (
              <>
                {b.businessAddress} <SourceLink href={b.businessAddressSourceUrl} />
              </>
            ) : (
              <span className="pr-unavailable">{UNAVAILABLE}</span>
            )}
          </dd>
        </div>
        <Contact icon={<Globe size={13} aria-hidden />} label="אתר רשמי" value={b.website} href={b.website ?? undefined} source={b.websiteSourceUrl} snippet={null} />
        <Contact icon={<Phone size={13} aria-hidden />} label="טלפון עסקי" value={b.phone} source={b.phoneSourceUrl} snippet={b.phoneSnippet} />
        <Contact icon={<Mail size={13} aria-hidden />} label="דוא״ל עסקי" value={b.email} source={b.emailSourceUrl} snippet={b.emailSnippet} />
        {b.companyNumber && (
          <div className="pr-contact">
            <dt>ח.פ.</dt>
            <dd>
              <bdi dir="ltr">{b.companyNumber}</bdi>
            </dd>
          </div>
        )}
      </dl>
      {b.contactsCheckedAt && <p className="muted small">פרטי הקשר נבדקו מול המקור: {fmtDate(b.contactsCheckedAt)}</p>}

      {b.sources.length > 0 && (
        <details className="pr-sources">
          <summary>מקורות ({b.sources.length})</summary>
          <ul>
            {b.sources.map((s) => (
              <li key={s.url + s.kind}>
                <Tag tone={s.kind === 'lead' ? 'muted' : 'info'}>{SOURCE_KIND_LABEL[s.kind]}</Tag>{' '}
                <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="pr-review">
        <label className="field">
          <span>הערת בודק/ת</span>
          <textarea rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} disabled={pending} />
        </label>
        <div className="pr-buttons">
          <button type="button" className="btn primary xs" onClick={() => decide('approved')} disabled={pending}>
            <Check size={14} aria-hidden /> אישור התאמה<span className="sr-only"> — {b.name}</span>
          </button>
          <button type="button" className="btn ghost xs" onClick={() => setEditing((v) => !v)} disabled={pending} aria-expanded={editing}>
            <Pencil size={14} aria-hidden /> תיקון<span className="sr-only"> — {b.name}</span>
          </button>
          <button type="button" className="btn danger-ghost xs" onClick={() => decide('rejected')} disabled={pending}>
            <X size={14} aria-hidden /> דחייה<span className="sr-only"> — {b.name}</span>
          </button>
          {b.reviewStatus !== 'pending' && (
            <button type="button" className="btn link xs" onClick={() => decide('pending')} disabled={pending}>
              <RotateCcw size={14} aria-hidden /> החזרה לבדיקה
            </button>
          )}
          {pending && <LoaderCircle size={15} className="spin" aria-hidden />}
        </div>
      </div>

      {editing && (
        <form className="pr-form" onSubmit={saveCorrection}>
          <p className="note small">
            כל פרט קשר חייב קישור לעמוד שבו הוא מופיע. שדה ריק נשמר כ„{UNAVAILABLE}”. אין לסמן „יש ראיה לבעלות” בלי ראיה כתובה.
          </p>
          <label className="field">
            <span>שם העסק</span>
            <input name="name" defaultValue={b.name} required maxLength={200} />
          </label>
          <div className="pr-form-row">
            <label className="field">
              <span>קשר לגג</span>
              <select name="relation" defaultValue={b.relation}>
                {RELATION_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {RELATION[v].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>ביטחון בהתאמה</span>
              <select name="matchConfidence" defaultValue={b.matchConfidence}>
                <option value="high">{CONFIDENCE.high.label}</option>
                <option value="medium">{CONFIDENCE.medium.label}</option>
                <option value="low">{CONFIDENCE.low.label}</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span>ראיה לבעלות (חובה אם מסומן „יש ראיה לבעלות”)</span>
            <input name="relationEvidence" defaultValue={b.relationEvidence ?? ''} maxLength={1000} />
          </label>
          {(
            [
              ['website', 'אתר רשמי', b.website, b.websiteSourceUrl, 'url'],
              ['phone', 'טלפון עסקי', b.phone, b.phoneSourceUrl, 'tel'],
              ['email', 'דוא״ל עסקי', b.email, b.emailSourceUrl, 'email'],
            ] as const
          ).map(([key, label, value, source, type]) => (
            <div className="pr-form-row" key={key}>
              <label className="field">
                <span>{label}</span>
                <input name={key} type={type} dir="ltr" defaultValue={value ?? ''} />
              </label>
              <label className="field">
                <span>קישור למקור של {label}</span>
                <input name={`${key}SourceUrl`} type="url" dir="ltr" defaultValue={source ?? ''} placeholder="https://" />
              </label>
            </div>
          ))}
          <div className="pr-buttons">
            <button type="submit" className="btn primary sm" disabled={pending}>
              שמירת תיקון
            </button>
            <button type="button" className="btn link sm" onClick={() => setEditing(false)}>
              ביטול
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
