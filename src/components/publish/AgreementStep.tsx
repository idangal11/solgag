'use client';

import { AlertTriangle, Info } from 'lucide-react';
import { AGREEMENT_HINT, AGREEMENT_LABEL, AVAILABILITY, BUILDING_LABEL, fmtSqm, TECH_ASSESSMENT, VERIFICATION } from '@/lib/labels';
import type { AgreementModel, Availability, OwnerVerification, TechAssessment } from '@/lib/types';
import { declarationText, totalArea, usableArea, type Draft } from './draft';
import { FieldError, errProps } from './FieldError';

/** Edit mode: the listing's trust statuses now, and as the DB guard will leave them after this save. */
export interface TrustStatus {
  ownerBefore: OwnerVerification;
  ownerAfter: OwnerVerification;
  techBefore: TechAssessment;
  techAfter: TechAssessment;
}

interface Props {
  d: Draft;
  set: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
  errors: Record<string, string>;
  /** null when creating a listing (it always starts unverified and unassessed). */
  status: TrustStatus | null;
}

export function AgreementStep({ d, set, errors, status }: Props) {
  const total = totalArea(d);
  const usable = usableArea(d);
  const resetsOwnership = !!status && status.ownerAfter !== status.ownerBefore;
  const resetsSurvey = !!status && status.techAfter !== status.techBefore;

  return (
    <div className="form-grid">
      <fieldset className="field span2 agree-fieldset">
        <legend>מודל התקשרות מוצע</legend>
        <div className="agree-opts">
          {(Object.keys(AGREEMENT_LABEL) as AgreementModel[]).map((a) => (
            <label key={a} className={`agree-opt${d.agreement === a ? ' on' : ''}`}>
              <input type="radio" name="agreement" value={a} checked={d.agreement === a} onChange={() => set('agreement', a)} />
              <b>{AGREEMENT_LABEL[a]}</b>
              <small>{AGREEMENT_HINT[a]}</small>
            </label>
          ))}
        </div>
      </fieldset>
      {d.agreement === 'fixed_rent' && (
        <label className="field">
          <span>שכירות מבוקשת (₪ למ״ר שמיש לשנה)</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={1000}
            step="any"
            value={d.rent}
            onChange={(e) => set('rent', e.target.value)}
            {...errProps('rentPerSqmYear', errors)}
          />
          <FieldError id="err-rentPerSqmYear" msg={errors.rentPerSqmYear} />
        </label>
      )}
      {d.agreement === 'revenue_share' && (
        <label className="field">
          <span>חלק מבוקש לבעלים (% מהתזרים לחלוקה)</span>
          <input
            type="number"
            inputMode="decimal"
            min={1}
            max={99}
            step="any"
            value={d.share}
            onChange={(e) => set('share', e.target.value)}
            {...errProps('sharePct', errors)}
          />
          <FieldError id="err-sharePct" msg={errors.sharePct} />
        </label>
      )}
      <label className="field">
        <span>תקופת התקשרות מבוקשת (שנים)</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={50}
          step={1}
          value={d.years}
          onChange={(e) => set('years', e.target.value)}
          placeholder="לא צוין"
          {...errProps('termYears', errors)}
        />
        <FieldError id="err-termYears" msg={errors.termYears} />
      </label>
      <label className="field">
        <span>סטטוס זמינות</span>
        <select value={d.availability} onChange={(e) => set('availability', e.target.value as Availability)} aria-describedby="availability-desc">
          {(Object.keys(AVAILABILITY) as Availability[]).map((a) => (
            <option key={a} value={a}>
              {AVAILABILITY[a].label}
            </option>
          ))}
        </select>
        <small className="hint" id="availability-desc">
          {AVAILABILITY[d.availability].desc}
        </small>
      </label>
      <label className="field span2">
        <span>תנאים נוספים</span>
        <textarea
          rows={2}
          value={d.termsNotes}
          onChange={(e) => set('termsNotes', e.target.value)}
          placeholder="לדוגמה: הצמדה למדד, חלונות זמן להתקנה"
          maxLength={1000}
          {...errProps('termsNotes', errors)}
        />
        <FieldError id="err-termsNotes" msg={errors.termsNotes} />
      </label>

      <div className="summary span2">
        <b>סיכום:</b> {d.title.trim() || 'ללא כותרת'} · {d.locality.trim() || '—'} · {BUILDING_LABEL[d.buildingType]} · גג{' '}
        {total > 0 ? fmtSqm(total) : '—'} · שמיש ≈ {usable > 0 ? fmtSqm(usable) : '—'}
        {d.areaMode === 'polygon' && <span className="muted"> (השטח הסופי יחושב בשרת מתוך השרטוט)</span>}
      </div>

      {!status && (
        <p className="note info-note span2">
          <Info size={15} aria-hidden />
          המודעה תוצג עם התווית „{VERIFICATION.not_verified.label}״ עד שיוגשו מסמכי בעלות וייבדקו על ידי צוות הפלטפורמה.
        </p>
      )}
      {status && resetsOwnership && (
        <p className="note span2">
          <AlertTriangle size={15} aria-hidden />
          {`שיניתם פרטים שנבדקו באימות הבעלות (מיקום, גבולות הגג, יישוב או שם בעלי הגג). לאחר השמירה סטטוס הבעלות יחזור ל„${VERIFICATION[status.ownerAfter].label}״${
            status.ownerBefore === 'pending' ? ', ובקשת האימות הממתינה תבוטל' : ''
          }.`}
        </p>
      )}
      {status && resetsSurvey && (
        <p className="note span2">
          <AlertTriangle size={15} aria-hidden />
          {`שיניתם נתוני גג, שטח או מיקום. לאחר השמירה התווית „${TECH_ASSESSMENT[status.techBefore].label}״ תוחלף ב„${TECH_ASSESSMENT[status.techAfter].label}״.`}
        </p>
      )}

      <label className={`declare span2${errors.declared ? ' invalid' : ''}`}>
        <input
          type="checkbox"
          checked={d.declared}
          onChange={(e) => set('declared', e.target.checked)}
          {...errProps('declared', errors)}
        />
        <span>{declarationText(status?.ownerAfter ?? 'not_verified', status?.techAfter ?? 'not_assessed')}</span>
      </label>
      <FieldError id="err-declared" msg={errors.declared} className="span2" />
      <FieldError id="err-_" msg={errors._} className="span2" />
    </div>
  );
}
