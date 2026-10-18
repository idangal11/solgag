'use client';

import { useId } from 'react';
import { AGREEMENT_LABEL, BUILDING_LABEL, REGION_LABEL } from '@/lib/labels';
import { activeFilterCount, AGREEMENTS, AREA_OPTIONS, BUILDING_TYPES, EMPTY_FILTERS, REGIONS, toggle, type Filters } from './filters';

interface Props {
  filters: Filters;
  /** Functional update, applied to the latest filters. */
  onChange: (update: (f: Filters) => Filters) => void;
}

export function ExploreFilters({ filters, onChange }: Props) {
  const id = useId();
  const active = activeFilterCount(filters);
  const patch = (p: Partial<Filters>) => onChange((f) => ({ ...f, ...p }));

  return (
    <div className="filters" role="search" aria-label="סינון גגות">
      <label className="field">
        <span>אזור</span>
        <select value={filters.region} onChange={(e) => patch({ region: e.target.value as Filters['region'] })}>
          <option value="all">כל הארץ</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {REGION_LABEL[r]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>שטח שמיש מינימלי</span>
        <select value={filters.minArea} onChange={(e) => patch({ minArea: Number(e.target.value) })}>
          {AREA_OPTIONS.map((o) => (
            <option key={o.v} value={o.v}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <div className="field" role="group" aria-labelledby={`${id}-types`}>
        <span id={`${id}-types`}>סוג מבנה</span>
        <div className="chips">
          {BUILDING_TYPES.map((t) => {
            const on = filters.types.includes(t);
            return (
              <button key={t} type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => onChange((f) => ({ ...f, types: toggle(f.types, t) }))}>
                {BUILDING_LABEL[t]}
              </button>
            );
          })}
        </div>
      </div>
      <div className="field" role="group" aria-labelledby={`${id}-agreements`}>
        <span id={`${id}-agreements`}>מודל התקשרות</span>
        <div className="chips">
          {AGREEMENTS.map((a) => {
            const on = filters.agreements.includes(a);
            return (
              <button key={a} type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => onChange((f) => ({ ...f, agreements: toggle(f.agreements, a) }))}>
                {AGREEMENT_LABEL[a]}
              </button>
            );
          })}
        </div>
      </div>
      <label className="switch-row">
        <input type="checkbox" checked={filters.openOnly} onChange={(e) => patch({ openOnly: e.target.checked })} />
        <span>רק גגות שפתוחים לפניות</span>
      </label>
      {active > 0 && (
        <button type="button" className="btn link" onClick={() => onChange(() => EMPTY_FILTERS)}>
          נקה סינון ({active})
        </button>
      )}
    </div>
  );
}
