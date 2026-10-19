'use client';

import { useState } from 'react';
import { Calculator } from '@/components/Calculator';
import { fmtNum } from '@/lib/labels';

const MIN_AREA = 50;
const MAX_AREA = 500_000;
const DEFAULT_AREA = 3000;

const parseArea = (raw: string): number | null => {
  const n = Number(raw);
  return raw.trim() !== '' && Number.isFinite(n) && n >= MIN_AREA && n <= MAX_AREA ? Math.round(n) : null;
};

/**
 * Usable-area input for /calculator. The Calculator stays mounted: a new area
 * re-derives only the size-based assumptions (capacity, install cost, opex,
 * reserve) and keeps the tariff, yield, payment model, share and rent the user set.
 */
export function AreaCalculator() {
  const [raw, setRaw] = useState(String(DEFAULT_AREA));
  const [area, setArea] = useState(DEFAULT_AREA);
  const invalid = parseArea(raw) === null;

  const onChange = (value: string) => {
    setRaw(value);
    const next = parseArea(value);
    if (next !== null) setArea(next);
  };

  return (
    <>
      <div className="calc-area">
        <label className="field">
          <span>שטח שמיש (מ״ר)</span>
          <input
            type="number"
            inputMode="numeric"
            min={MIN_AREA}
            max={MAX_AREA}
            step={100}
            value={raw}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={invalid}
            aria-describedby="calc-area-hint"
          />
        </label>
        <p id="calc-area-hint" className={invalid ? 'err' : 'hint'} aria-live="polite">
          {invalid
            ? `נא להזין שטח בין ${fmtNum(MIN_AREA)} ל-${fmtNum(MAX_AREA)} מ״ר. בינתיים מוצג תרחיש ל-${fmtNum(area)} מ״ר.`
            : 'החלק מהגג שאפשר להציב עליו פאנלים בפועל — בדרך כלל פחות מהשטח הכולל, בגלל שוליים, מעברים, הצללה ומתקנים על הגג. שינוי השטח מעדכן את ההספק, עלות ההתקנה, התפעול והרזרבה; שאר הנתונים שערכתם נשמרים.'}
        </p>
      </div>
      {/* No key: changing the area updates size-based assumptions and keeps the user's other edits. */}
      <Calculator usableAreaSqm={area} />
    </>
  );
}
