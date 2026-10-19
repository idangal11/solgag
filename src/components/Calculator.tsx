'use client';

import { Calculator as CalcIcon, Info, Loader2, RotateCcw, SunMedium } from 'lucide-react';
import { useMemo, useState } from 'react';
import { calculate, defaultInputsFor, type FinanceInputs, type SplitMode } from '@/lib/finance';
import { fmtILS, fmtNum } from '@/lib/labels';
import type { LatLng } from '@/lib/types';

type NumericKey = Exclude<keyof FinanceInputs, 'splitMode'>;

interface FieldDef {
  key: NumericKey;
  label: string;
  unit: string;
  step: number;
  min: number;
  max: number;
  hint?: string;
}

const FIELDS: FieldDef[] = [
  { key: 'capacityKw', label: 'הספק מותקן משוער', unit: 'kW', step: 5, min: 0, max: 20000, hint: 'ברירת מחדל: שטח שמיש ÷ 6.5 מ״ר לכל kW' },
  { key: 'yieldKwhPerKw', label: 'תפוקה שנתית לכל kW', unit: 'kWh', step: 10, min: 0, max: 2500 },
  { key: 'tariffIlsPerKwh', label: 'מחיר מכירת חשמל', unit: '₪ ל-kWh', step: 0.01, min: 0, max: 2, hint: 'הנחה מסחרית להמחשה — לא תעריף ביתי. יש לבדוק את המסלול הרלוונטי מול רשות החשמל.' },
  { key: 'installCostIls', label: 'עלות התקנה כוללת', unit: '₪', step: 1000, min: 0, max: 100_000_000 },
  { key: 'opexIlsYear', label: 'הוצאות תפעול שנתיות', unit: '₪ לשנה', step: 500, min: 0, max: 10_000_000 },
  { key: 'reserveIlsYear', label: 'רזרבה לציוד (ממירים וכו׳)', unit: '₪ לשנה', step: 500, min: 0, max: 10_000_000 },
];

const SHARE_FIELD: FieldDef = { key: 'ownerSharePct', label: 'חלק בעלי הגג מהתזרים', unit: '%', step: 1, min: 0, max: 99 };
const RENT_FIELD: FieldDef = {
  key: 'ownerFixedRentIls',
  label: 'דמי שכירות שנתיים לבעלי הגג',
  unit: '₪ לשנה',
  step: 1000,
  min: 0,
  max: 10_000_000,
  hint: 'משולמים לבעלים גם כשהתזרים נמוך; המשקיע מקבל את היתרה.',
};

const MODES: { value: SplitMode; label: string }[] = [
  { value: 'share', label: 'חלוקת הכנסות (%)' },
  { value: 'fixed_rent', label: 'שכירות קבועה (₪)' },
];

interface PvgisResult {
  yieldKwhPerKw: number;
}

export function Calculator({
  usableAreaSqm,
  ownerSharePct,
  rentPerSqmYear,
  location,
}: {
  usableAreaSqm: number;
  ownerSharePct?: number | null;
  /** Requested fixed rent, ₪ per usable m² per year → starts in the fixed-rent model. */
  rentPerSqmYear?: number | null;
  /** When given, offers to fetch a location-specific yield from PVGIS. */
  location?: LatLng;
}) {
  const defaults = useMemo(
    () => defaultInputsFor(usableAreaSqm, ownerSharePct, undefined, rentPerSqmYear ? rentPerSqmYear * usableAreaSqm : null),
    [usableAreaSqm, ownerSharePct, rentPerSqmYear],
  );
  const [inputs, setInputs] = useState<FinanceInputs>(defaults);
  const [pvgis, setPvgis] = useState<{ state: 'idle' | 'loading' | 'done' | 'error'; value?: number }>({ state: 'idle' });
  // When the roof size changes (e.g. the /calculator area field), refresh only the
  // size-dependent assumptions and keep everything else the user edited.
  const [syncedArea, setSyncedArea] = useState(usableAreaSqm);
  if (usableAreaSqm !== syncedArea) {
    setSyncedArea(usableAreaSqm);
    setInputs((p) => ({
      ...p,
      capacityKw: defaults.capacityKw,
      installCostIls: defaults.installCostIls,
      opexIlsYear: defaults.opexIlsYear,
      reserveIlsYear: defaults.reserveIlsYear,
    }));
  }
  const r = calculate(inputs);
  const mode: SplitMode = inputs.splitMode ?? 'share';

  const set = (k: NumericKey, v: string) => {
    const n = Number(v);
    setInputs((p) => ({ ...p, [k]: Number.isFinite(n) ? n : 0 }));
  };

  const fetchYield = async () => {
    if (!location) return;
    setPvgis({ state: 'loading' });
    try {
      const res = await fetch(`/api/pvgis?lat=${location[0].toFixed(4)}&lng=${location[1].toFixed(4)}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as PvgisResult;
      const value = Math.round(data.yieldKwhPerKw);
      setInputs((p) => ({ ...p, yieldKwhPerKw: value }));
      setPvgis({ state: 'done', value });
    } catch {
      setPvgis({ state: 'error' });
    }
  };

  // Allocation chart: where each shekel of gross revenue goes.
  const segments =
    r.gross > 0
      ? [
          { label: 'תפעול', value: Math.min(inputs.opexIlsYear, r.gross), color: '#9aa8a1' },
          { label: 'רזרבה', value: Math.max(0, Math.min(inputs.reserveIlsYear, r.gross - inputs.opexIlsYear)), color: '#c6cfca' },
          { label: 'בעלי הגג', value: Math.max(0, Math.min(r.owner, r.gross)), color: '#f5b81c' },
          { label: 'משקיע', value: Math.max(0, r.investor), color: '#1f7a55' },
        ]
      : [];
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const noCash = r.distributable <= 0;

  // Percentages describe the actual split of the distributable cash flow; with
  // nothing to distribute there is no meaningful percentage to show.
  const ownerPct = r.ownerPctOfDistributable;
  const investorPct = ownerPct === null ? null : 100 - ownerPct;
  const pctLabel = (p: number | null) => (p === null ? '' : ` (${fmtNum(p, p > 0 && p < 1 ? 1 : 0)}%)`);

  const renderField = (f: FieldDef) => (
    <label key={f.key} className="calc-field">
      <span className="lbl">{f.label}</span>
      <div className="input-unit">
        <input
          type="number"
          inputMode="decimal"
          min={f.min}
          max={f.max}
          step={f.step}
          value={inputs[f.key] ?? 0}
          onChange={(e) => set(f.key, e.target.value)}
          aria-label={f.label}
        />
        <span className="unit">{f.unit}</span>
      </div>
      {f.key === 'ownerSharePct' && (
        <input type="range" min={0} max={99} step={1} value={inputs.ownerSharePct} onChange={(e) => set('ownerSharePct', e.target.value)} aria-label="חלק בעלי הגג באחוזים" />
      )}
      {f.key === 'yieldKwhPerKw' && location && (
        <span className="pvgis-row">
          <button type="button" className="btn link sm" onClick={fetchYield} disabled={pvgis.state === 'loading'}>
            {pvgis.state === 'loading' ? <Loader2 size={14} className="spin" /> : <SunMedium size={14} />} תפוקה לפי מיקום הגג (PVGIS)
          </button>
          {pvgis.state === 'done' && <small className="hint">עודכן לפי PVGIS: {fmtNum(pvgis.value ?? 0)} kWh לכל kW (נטייה אופטימלית, 14% הפסדים).</small>}
          {pvgis.state === 'error' && <small className="hint">שירות PVGIS אינו זמין כרגע — ניתן להזין ערך ידנית.</small>}
        </span>
      )}
      {f.hint && <small className="hint">{f.hint}</small>}
    </label>
  );

  const summary =
    `הכנסה ברוטו ${fmtILS(r.gross)} בשנה. ` +
    `לבעלי הגג ${fmtILS(r.owner)}, למשקיע ${fmtILS(r.investor)}. ` +
    (r.paybackYears === null ? 'אין החזר בתרחיש זה.' : `החזר פשוט ${fmtNum(r.paybackYears, 1)} שנים.`);

  return (
    <section className="calc card-surface" id="calculator" aria-labelledby="calc-title">
      <div className="section-head">
        <h2 id="calc-title">
          <CalcIcon size={20} /> מחשבון פיננסי פשוט
        </h2>
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => {
            setInputs(defaults);
            setPvgis({ state: 'idle' });
          }}
        >
          <RotateCcw size={14} /> איפוס הנחות
        </button>
      </div>
      <p className="disclaimer">
        <Info size={15} /> כל המספרים הם הנחות להמחשה שניתן לערוך — לא תחזית, לא ייעוץ ולא הצעת השקעה.
      </p>

      <div className="calc-grid">
        <div className="calc-inputs">
          {FIELDS.map(renderField)}
          <fieldset className="calc-mode">
            <legend className="lbl">מודל התשלום לבעלי הגג</legend>
            <div className="seg">
              {MODES.map((m) => (
                <label key={m.value} className={mode === m.value ? 'on' : ''}>
                  <input
                    type="radio"
                    name="split-mode"
                    value={m.value}
                    checked={mode === m.value}
                    onChange={() =>
                      setInputs((p) => ({
                        ...p,
                        splitMode: m.value,
                        // Switching to fixed rent with no rent yet: start from an illustrative
                        // ₪15 per usable m² per year instead of a meaningless ₪0.
                        ownerFixedRentIls:
                          m.value === 'fixed_rent' && !p.ownerFixedRentIls ? Math.round((usableAreaSqm * 15) / 1000) * 1000 : p.ownerFixedRentIls,
                      }))
                    }
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </fieldset>
          {renderField(mode === 'fixed_rent' ? RENT_FIELD : SHARE_FIELD)}
        </div>

        <div className="calc-results">
          <p className="sr-only" aria-live="polite">
            {summary}
          </p>
          <div className="kpi-row">
            <div className="kpi">
              <span className="k">הכנסה ברוטו שנתית</span>
              <span className="v">{fmtILS(r.gross)}</span>
              <small>{fmtNum(r.annualKwh)} kWh בשנה</small>
            </div>
            <div className={`kpi${noCash ? ' neg' : ''}`}>
              <span className="k">תזרים שנתי לחלוקה</span>
              <span className="v">{fmtILS(r.distributable)}</span>
              <small>אחרי תפעול ורזרבה</small>
            </div>
          </div>

          <div className="split">
            <div className="split-col owner">
              <span className="k">
                {mode === 'fixed_rent' ? 'לבעלי הגג (שכירות קבועה)' : 'לבעלי הגג'}
                {pctLabel(ownerPct)}
              </span>
              <span className="v">{fmtILS(r.owner)}</span>
              <small>בשנה · כ-{fmtILS(r.ownerMonthly)} בחודש בממוצע</small>
            </div>
            <div className="split-col investor">
              <span className="k">
                {mode === 'fixed_rent' ? 'למשקיע (יתרת התזרים)' : 'למשקיע'}
                {pctLabel(investorPct)}
              </span>
              <span className="v">{fmtILS(r.investor)}</span>
              <small>בשנה · כ-{fmtILS(r.investorMonthly)} בחודש בממוצע</small>
            </div>
          </div>

          <div className={`payback${r.paybackYears === null ? ' none' : ''}`}>
            <span className="k">החזר פשוט למשקיע</span>
            {r.paybackYears === null ? <span className="v">אין החזר בתרחיש זה</span> : <span className="v">{fmtNum(r.paybackYears, 1)} שנים</span>}
            <small>עלות התקנה ÷ תזרים שנתי למשקיע</small>
          </div>

          {segments.length > 0 && (
            <figure className="alloc">
              <figcaption>לאן הולכת ההכנסה השנתית</figcaption>
              <div className="alloc-bar" role="img" aria-label="התפלגות ההכנסה השנתית">
                {segments.map((s) =>
                  s.value > 0 ? <span key={s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} title={`${s.label}: ${fmtILS(s.value)}`} /> : null,
                )}
              </div>
              <ul className="alloc-legend">
                {segments.map((s) => (
                  <li key={s.label}>
                    <span className="sw" style={{ background: s.color }} />
                    {s.label} <b>{fmtILS(s.value)}</b> <span className="muted">({fmtNum((s.value / total) * 100)}%)</span>
                  </li>
                ))}
              </ul>
              {mode === 'fixed_rent' && r.owner > Math.max(0, r.distributable) && (
                <p className="hint">השכירות גבוהה מהתזרים לחלוקה בתרחיש זה — המשקיע מממן את ההפרש.</p>
              )}
            </figure>
          )}

          <details className="method">
            <summary>איך זה מחושב?</summary>
            <ul>
              <li>הכנסה ברוטו = הספק × תפוקה שנתית לכל kW × מחיר מכירה.</li>
              <li>תזרים לחלוקה = הכנסה ברוטו − הוצאות תפעול − רזרבה לציוד.</li>
              <li>
                החלוקה בין בעלי הגג למשקיע מחושבת <b>אחרי</b> תפעול ורזרבה, אך <b>לפני</b> החזר ההשקעה הראשונית, מסים ועלויות מימון.
              </li>
              <li>חלוקת הכנסות: בעלי הגג מקבלים אחוז מהתזרים לחלוקה; כשאין תזרים חיובי — הם לא מקבלים דבר.</li>
              <li>שכירות קבועה: בעלי הגג מקבלים סכום שנתי קבוע גם כשהתזרים נמוך; המשקיע מקבל את יתרת התזרים (שעלולה להיות שלילית).</li>
              <li>החזר פשוט = עלות התקנה ÷ התזרים השנתי למשקיע. אם התזרים אינו חיובי — אין החזר בתרחיש זה.</li>
              <li>התזרים אינו תשואה נטו ואינו רווח לאחר החזר ההשקעה. אינו כולל ירידת תפוקה, הצמדה, מימון ומיסוי.</li>
            </ul>
          </details>
        </div>
      </div>
    </section>
  );
}
