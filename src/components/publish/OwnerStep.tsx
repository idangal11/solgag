'use client';

import { AlertTriangle } from 'lucide-react';
import { BUILDING_LABEL, REGION_LABEL, VERIFICATION } from '@/lib/labels';
import type { BuildingType, Region } from '@/lib/types';
import type { Draft } from './draft';
import { FieldError, errProps } from './FieldError';

interface Props {
  d: Draft;
  set: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
  errors: Record<string, string>;
  /** Edit mode: the listing's ownership is verified or under review. */
  verificationAtRisk?: boolean;
}

export function OwnerStep({ d, set, errors, verificationAtRisk = false }: Props) {
  return (
    <div className="form-grid">
      {verificationAtRisk && (
        <p className="note span2">
          <AlertTriangle size={15} aria-hidden />
          שינוי שם בעלי הגג או היישוב יחזיר את סטטוס הבעלות ל„{VERIFICATION.not_verified.label}״, ויהיה צורך להגיש מסמכים לבדיקה מחדש.
        </p>
      )}
      <label className="field">
        <span>שם בעלי הגג / מורשה (יוצג במודעה)</span>
        <input
          value={d.ownerDisplayName}
          onChange={(e) => set('ownerDisplayName', e.target.value)}
          maxLength={100}
          autoComplete="organization"
          {...errProps('ownerDisplayName', errors)}
        />
        <FieldError id="err-ownerDisplayName" msg={errors.ownerDisplayName} />
      </label>
      <div className="field">
        <span>יצירת קשר</span>
        <p className="hint contact-hint">פניות ממשקיעים יתקבלו באזור האישי שלך. פרטי הקשר שלך אינם מוצגים במודעה.</p>
      </div>
      <label className="field span2">
        <span>כותרת המודעה</span>
        <input
          value={d.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="לדוגמה: גג מחסן 4,000 מ״ר באזור תעשייה"
          maxLength={120}
          {...errProps('title', errors)}
        />
        <FieldError id="err-title" msg={errors.title} />
      </label>
      <label className="field">
        <span>סוג מבנה</span>
        <select value={d.buildingType} onChange={(e) => set('buildingType', e.target.value as BuildingType)}>
          {(Object.keys(BUILDING_LABEL) as BuildingType[]).map((t) => (
            <option key={t} value={t}>
              {BUILDING_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>אזור</span>
        <select value={d.region} onChange={(e) => set('region', e.target.value as Region)}>
          {(Object.keys(REGION_LABEL) as Region[]).map((r) => (
            <option key={r} value={r}>
              {REGION_LABEL[r]}
            </option>
          ))}
        </select>
      </label>
      <label className="field span2">
        <span>יישוב</span>
        <input
          value={d.locality}
          onChange={(e) => set('locality', e.target.value)}
          maxLength={80}
          autoComplete="address-level2"
          {...errProps('locality', errors)}
        />
        <FieldError id="err-locality" msg={errors.locality} />
      </label>
      <label className="field span2">
        <span>תיאור קצר מהבעלים</span>
        <textarea
          rows={3}
          value={d.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="מה חשוב שמשקיע ידע על הגג והמבנה?"
          maxLength={3000}
          {...errProps('description', errors)}
        />
        <FieldError id="err-description" msg={errors.description} />
      </label>
    </div>
  );
}
