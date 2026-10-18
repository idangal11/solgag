'use client';

import { AlertTriangle, Info } from 'lucide-react';
import { AGREEMENT_HINT, AGREEMENT_LABEL, AVAILABILITY, BUILDING_LABEL, fmtSqm, VERIFICATION } from '@/lib/labels';
import type { AgreementModel, Availability } from '@/lib/types';
import { totalArea, usableArea, type Draft } from './draft';
import { FieldError, errProps } from './FieldError';

interface Props {
  d: Draft;
  set: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
  errors: Record<string, string>;
  isEdit: boolean;
  /** Edit mode: saving will reset a verified/pending ownership status. */
  resetsVerification: boolean;
}

const DECLARATION_TEXT =
  'אני מצהיר/ה כי אני הבעלים של המבנה או מורשה כדין להציע את הגג להתקשרות, וכי הפרטים שמסרתי נכונים למיטב ידיעתי. ידוע לי שהפלטפורמה לא אימתה את הבעלות ולא ביצעה בדיקה הנדסית.';

export function AgreementStep({ d, set, errors, isEdit, resetsVerification }: Props) {
  const total = totalArea(d);
  const usable = usableArea(d);

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

      {resetsVerification ? (
        <p className="note span2">
          <AlertTriangle size={15} />
          שיניתם את המיקום או את גבולות הגג. לאחר השמירה סטטוס הבעלות יחזור ל„{VERIFICATION.not_verified.label}״.
        </p>
      ) : (
        !isEdit && (
          <p className="note info-note span2">
            <Info size={15} />
            המודעה תוצג עם התווית „{VERIFICATION.not_verified.label}״ עד שיוגשו מסמכי בעלות וייבדקו על ידי צוות הפלטפורמה.
          </p>
        )
      )}

      <label className={`declare span2${errors.declared ? ' invalid' : ''}`}>
        <input
          type="checkbox"
          checked={d.declared}
          onChange={(e) => set('declared', e.target.checked)}
          {...errProps('declared', errors)}
        />
        <span>{DECLARATION_TEXT}</span>
      </label>
      <FieldError id="err-declared" msg={errors.declared} className="span2" />
      <FieldError id="err-_" msg={errors._} className="span2" />
    </div>
  );
}
