'use client';

import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';
import { NOT_ASSESSED, TECH_ASSESSMENT } from '@/lib/labels';
import type { TechAssessment } from '@/lib/types';
import type { Draft } from './draft';
import { FieldError, errProps } from './FieldError';

interface Props {
  d: Draft;
  set: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
  errors: Record<string, string>;
  /** The photo uploader, rendered at the end of the step. */
  images: ReactNode;
  /** Edit mode: a technical survey status that changing the roof data would downgrade. */
  surveyAtRisk?: Extract<TechAssessment, 'assessed' | 'survey_planned'> | null;
}

export function DetailsStep({ d, set, errors, images, surveyAtRisk = null }: Props) {
  return (
    <div className="form-grid">
      {surveyAtRisk && (
        <p className="note span2">
          <AlertTriangle size={15} aria-hidden />
          {`שינוי נתוני הגג, השטח או המיקום יחליף את התווית „${TECH_ASSESSMENT[surveyAtRisk].label}״ בתווית „${TECH_ASSESSMENT.owner_reported.label}״.`}
        </p>
      )}
      <p className="hint span2">
        אפשר להשאיר ריק — במודעה יוצג „{NOT_ASSESSED}״. נתונים שתמלאו יוצגו כ„{TECH_ASSESSMENT.owner_reported.label}״, ולא כבדיקה הנדסית.
      </p>
      <label className="field">
        <span>סוג גג</span>
        <input
          list="roof-types"
          value={d.roofType}
          onChange={(e) => set('roofType', e.target.value)}
          placeholder={NOT_ASSESSED}
          maxLength={120}
          {...errProps('roofType', errors)}
        />
        <datalist id="roof-types">
          <option value="פאנל סנדוויץ׳" />
          <option value="איסכורית" />
          <option value="בטון" />
          <option value="פלדה" />
        </datalist>
        <FieldError id="err-roofType" msg={errors.roofType} />
      </label>
      <label className="field">
        <span>גיל הגג (שנים)</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={150}
          step={1}
          value={d.roofAge}
          onChange={(e) => set('roofAge', e.target.value)}
          placeholder="לא ידוע"
          {...errProps('roofAgeYears', errors)}
        />
        <FieldError id="err-roofAgeYears" msg={errors.roofAgeYears} />
      </label>
      <label className="field">
        <span>הצללה</span>
        <input
          value={d.shading}
          onChange={(e) => set('shading', e.target.value)}
          placeholder={NOT_ASSESSED}
          maxLength={200}
          {...errProps('shading', errors)}
        />
        <FieldError id="err-shading" msg={errors.shading} />
      </label>
      <label className="field">
        <span>חיבור חשמל</span>
        <input
          value={d.grid}
          onChange={(e) => set('grid', e.target.value)}
          placeholder="לא נבדק"
          maxLength={200}
          {...errProps('grid', errors)}
        />
        <FieldError id="err-grid" msg={errors.grid} />
      </label>
      {images}
    </div>
  );
}
