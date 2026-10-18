import { Calculator as CalcIcon, Info, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { calculate, defaultInputsFor, type FinanceInputs } from '../finance';
import { fmtILS, fmtNum } from '../labels';

interface FieldDef {
  key: keyof FinanceInputs;
  label: string;
  unit: string;
  step: number;
  min: number;
  max: number;
  hint?: string;
}

const FIELDS: FieldDef[] = [
  { key: 'capacityKw', label: 'הספק מותקן משוער', unit: 'kW', step: 5, min: 0, max: 5000, hint: 'ברירת מחדל: שטח שמיש ÷ 6.5 מ״ר לכל kW' },
  { key: 'yieldKwhPerKw', label: 'תפוקה שנתית לכל kW', unit: 'kWh', step: 10, min: 0, max: 2500 },
  { key: 'tariffIlsPerKwh', label: 'מחיר מכירת חשמל', unit: '₪ ל-kWh', step: 0.01, min: 0, max: 2, hint: 'הנחה מסחרית להמחשה — לא תעריף ביתי. יש לבדוק את המסלול הרלוונטי.' },
  { key: 'installCostIls', label: 'עלות התקנה כוללת', unit: '₪', step: 1000, min: 0, max: 50_000_000 },
  { key: 'opexIlsYear', label: 'הוצאות תפעול שנתיות', unit: '₪ לשנה', step: 500, min: 0, max: 5_000_000 },
  { key: 'reserveIlsYear', label: 'רזרבה לציוד (ממירים וכו׳)', unit: '₪ לשנה', step: 500, min: 0, max: 5_000_000 },
  { key: 'ownerSharePct', label: 'חלק בעלי הגג', unit: '%', step: 1, min: 0, max: 100 },
];

export function Calculator({ usableAreaSqm, ownerSharePct }: { usableAreaSqm: number; ownerSharePct?: number }) {
  const defaults = useMemo(() => defaultInputsFor(usableAreaSqm, ownerSharePct), [usableAreaSqm, ownerSharePct]);
  const [inputs, setInputs] = useState<FinanceInputs>(defaults);
  const r = calculate(inputs);
  const set = (k: keyof FinanceInputs, v: string) => {
    const n = Number(v);
    setInputs((p) => ({ ...p, [k]: Number.isFinite(n) ? n : 0 }));
  };

  // Allocation chart: where each shekel of gross revenue goes.
  const segments =
    r.gross > 0
      ? [
          { label: 'תפעול', value: Math.min(inputs.opexIlsYear, r.gross), color: '#9aa8a1' },
          { label: 'רזרבה', value: Math.max(0, Math.min(inputs.reserveIlsYear, r.gross - inputs.opexIlsYear)), color: '#c6cfca' },
          { label: 'בעלי הגג', value: Math.max(0, r.owner), color: '#f5b81c' },
          { label: 'משקיע', value: Math.max(0, r.investor), color: '#1f7a55' },
        ]
      : [];
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const noCash = r.distributable <= 0;

  return (
    <section className="calc card-surface" id="calculator" aria-labelledby="calc-title">
      <div className="section-head">
        <h2 id="calc-title">
          <CalcIcon size={20} /> מחשבון פיננסי פשוט
        </h2>
        <button className="btn ghost sm" onClick={() => setInputs(defaults)}>
          <RotateCcw size={14} /> איפוס הנחות
        </button>
      </div>
      <p className="disclaimer">
        <Info size={15} /> כל המספרים הם הנחות להמחשה שניתן לערוך — לא תחזית, לא ייעוץ ולא הצעת השקעה.
      </p>

      <div className="calc-grid">
        <div className="calc-inputs">
          {FIELDS.map((f) => (
            <label key={f.key} className="calc-field">
              <span className="lbl">{f.label}</span>
              <div className="input-unit">
                <input type="number" inputMode="decimal" min={f.min} max={f.max} step={f.step} value={inputs[f.key]} onChange={(e) => set(f.key, e.target.value)} />
                <span className="unit">{f.unit}</span>
              </div>
              {f.key === 'ownerSharePct' && (
                <input type="range" min={0} max={50} step={1} value={inputs.ownerSharePct} onChange={(e) => set('ownerSharePct', e.target.value)} aria-label="חלק בעלי הגג באחוזים" />
              )}
              {f.hint && <small className="hint">{f.hint}</small>}
            </label>
          ))}
        </div>

        <div className="calc-results" aria-live="polite">
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
              <span className="k">לבעלי הגג ({fmtNum(inputs.ownerSharePct)}%)</span>
              <span className="v">{fmtILS(r.owner)}</span>
              <small>בשנה · כ-{fmtILS(r.ownerMonthly)} בחודש בממוצע</small>
            </div>
            <div className="split-col investor">
              <span className="k">למשקיע ({fmtNum(100 - inputs.ownerSharePct)}%)</span>
              <span className="v">{fmtILS(r.investor)}</span>
              <small>בשנה · כ-{fmtILS(r.investorMonthly)} בחודש בממוצע</small>
            </div>
          </div>

          <div className={`payback${r.paybackYears === null ? ' none' : ''}`}>
            <span className="k">החזר פשוט למשקיע</span>
            {r.paybackYears === null ? (
              <span className="v">אין החזר בתרחיש זה</span>
            ) : (
              <span className="v">{fmtNum(r.paybackYears, 1)} שנים</span>
            )}
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
              <li>החזר פשוט = עלות התקנה ÷ התזרים השנתי למשקיע. אם התזרים אינו חיובי — אין החזר בתרחיש זה.</li>
              <li>התזרים אינו תשואה נטו ואינו רווח לאחר החזר ההשקעה. אינו כולל ירידת תפוקה, הצמדה, מימון ומיסוי.</li>
            </ul>
          </details>
        </div>
      </div>
    </section>
  );
}
