'use client';

import { Download, LoaderCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { Tag } from '@/components/ui';
import { fmtNum } from '@/lib/labels';
import {
  applyProspectFilters,
  CONFIDENCE,
  DEFAULT_FILTERS,
  filtersToQuery,
  REVIEW,
  UNAVAILABLE,
  type ProspectFilters,
  type ProspectRoof,
} from '@/lib/prospects';
import { RoofDetail } from './RoofDetail';

const ProspectsMap = dynamic(() => import('./ProspectsMap'), {
  ssr: false,
  loading: () => (
    <div className="map-loading" role="status">
      <LoaderCircle size={24} className="spin" aria-hidden />
      <span>טוען מפה…</span>
    </div>
  ),
});

const AREA_PRESETS = [0, 1500, 2500, 4000];

function bestBusiness(r: ProspectRoof) {
  return r.businesses.find((b) => b.reviewStatus !== 'rejected' && b.relation !== 'not_at_roof') ?? null;
}

export function ProspectsWorkspace({ roofs, initialFilters }: { roofs: ProspectRoof[]; initialFilters: ProspectFilters }) {
  const [filters, setFilters] = useState(initialFilters);
  const visible = useMemo(() => applyProspectFilters(roofs, filters), [roofs, filters]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = roofs.find((r) => r.id === selectedId) ?? null;
  const query = filtersToQuery(filters);

  function update(patch: Partial<ProspectFilters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    // Keep the filters in the address (shareable, survives refresh) without a server round trip.
    const qs = filtersToQuery(next);
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  }

  const totals = useMemo(
    () => ({
      area: visible.reduce((s, r) => s + r.areaM2, 0),
      withBusiness: visible.filter((r) => bestBusiness(r)).length,
      pending: visible.filter((r) => r.reviewStatus === 'pending').length,
    }),
    [visible],
  );

  return (
    <>
      <div className="admin-filters pr-filters" role="search" aria-label="סינון גגות">
        <label className="field">
          <span>שטח מינימלי (מ״ר)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={100}
            value={filters.minArea || ''}
            placeholder="0"
            onChange={(e) => update({ minArea: Math.max(0, Number.parseInt(e.target.value, 10) || 0) })}
          />
        </label>
        <div className="pr-presets" role="group" aria-label="שטח מינימלי מהיר">
          {AREA_PRESETS.map((a) => (
            <button key={a} type="button" className={`btn xs ${filters.minArea === a ? 'primary' : 'ghost'}`} onClick={() => update({ minArea: a })} aria-pressed={filters.minArea === a}>
              {a ? `${fmtNum(a)}+` : 'הכול'}
            </button>
          ))}
        </div>
        <label className="field">
          <span>סטטוס בדיקה</span>
          <select value={filters.review} onChange={(e) => update({ review: e.target.value as ProspectFilters['review'] })}>
            <option value="all">הכול</option>
            {(Object.keys(REVIEW) as (keyof typeof REVIEW)[]).map((k) => (
              <option key={k} value={k}>
                {REVIEW[k].label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>ביטחון במבנה</span>
          <select value={filters.building} onChange={(e) => update({ building: e.target.value as ProspectFilters['building'] })}>
            <option value="all">הכול</option>
            <option value="high">{CONFIDENCE.high.label}</option>
            <option value="medium">{CONFIDENCE.medium.label}</option>
            <option value="low">{CONFIDENCE.low.label}</option>
          </select>
        </label>
        <label className="field">
          <span>עסק משויך</span>
          <select value={filters.business} onChange={(e) => update({ business: e.target.value as ProspectFilters['business'] })}>
            <option value="all">הכול</option>
            <option value="with">יש מועמד</option>
            <option value="strong">התאמה בינונית ומעלה</option>
            <option value="none">אין מועמד</option>
          </select>
        </label>
        <label className="field">
          <span>סוג נתונים</span>
          <select value={filters.demo} onChange={(e) => update({ demo: e.target.value as ProspectFilters['demo'] })}>
            <option value="all">הכול</option>
            <option value="real">אמיתיים בלבד</option>
            <option value="demo">הדגמה בלבד</option>
          </select>
        </label>
        <div className="admin-filter-btns">
          <a className="btn ghost sm" href={`/admin/prospects/export${query ? `?${query}` : ''}`} download>
            <Download size={15} aria-hidden /> ייצוא CSV
          </a>
          {query && (
            <button type="button" className="btn link sm" onClick={() => update(DEFAULT_FILTERS)}>
              ניקוי
            </button>
          )}
        </div>
      </div>

      <p className="muted small admin-result-count" role="status">
        {fmtNum(visible.length)} מתוך {fmtNum(roofs.length)} גגות · שטח כולל משוער {fmtNum(Math.round(totals.area))} מ״ר · {fmtNum(totals.withBusiness)} עם עסק מועמד ·{' '}
        {fmtNum(totals.pending)} ממתינים לבדיקה
      </p>

      <div className="pr-layout">
        <div className="pr-map">
          <ProspectsMap roofs={visible} selectedId={selectedId} onSelect={setSelectedId} />
          <ul className="pr-legend" aria-label="מקרא">
            {(Object.keys(REVIEW) as (keyof typeof REVIEW)[]).map((k) => (
              <li key={k}>
                <span className="pr-swatch" style={{ background: REVIEW[k].color }} aria-hidden /> {REVIEW[k].label}
              </li>
            ))}
            <li>
              <span className="pr-swatch dashed" aria-hidden /> נתוני הדגמה
            </li>
          </ul>
        </div>
        <div className="pr-side">
          {selected ? (
            <RoofDetail key={selected.id} roof={selected} />
          ) : (
            <div className="empty">
              <p>בחרו גג במפה או ברשימה כדי לראות את הכתובת, העסקים המועמדים, המקורות ורמות הביטחון.</p>
            </div>
          )}
        </div>
      </div>

      <div className="admin-table-wrap pr-table">
        <table className="admin-table">
          <caption className="sr-only">גגות מועמדים</caption>
          <thead>
            <tr>
              <th scope="col">גג</th>
              <th scope="col">שטח משוער</th>
              <th scope="col">ביטחון במבנה</th>
              <th scope="col">כתובת</th>
              <th scope="col">עסק מועמד מוביל</th>
              <th scope="col">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const b = bestBusiness(r);
              const others = r.businesses.filter((x) => x.reviewStatus !== 'rejected').length - (b ? 1 : 0);
              return (
                <tr key={r.id} className={r.id === selectedId ? 'is-selected' : undefined}>
                  <td className="al-title">
                    <button type="button" className="pr-row-btn" onClick={() => setSelectedId(r.id)} aria-pressed={r.id === selectedId}>
                      {r.ref}
                    </button>
                    {r.isDemo && <Tag tone="warn">הדגמה</Tag>}
                  </td>
                  <td data-label="שטח משוער">{fmtNum(r.areaM2)} מ״ר</td>
                  <td data-label="ביטחון במבנה">
                    <Tag tone={CONFIDENCE[r.building.confidence].tone}>{CONFIDENCE[r.building.confidence].label}</Tag>
                  </td>
                  <td data-label="כתובת">
                    {r.address ? (
                      <>
                        {r.address.street} {r.address.houseNumber ?? ''}
                        {r.address.confidence && <span className="muted small"> ({CONFIDENCE[r.address.confidence].label})</span>}
                      </>
                    ) : (
                      <span className="pr-unavailable">{UNAVAILABLE}</span>
                    )}
                  </td>
                  <td data-label="עסק מועמד מוביל">
                    {b ? (
                      <>
                        {b.name} <span className="muted small">({CONFIDENCE[b.matchConfidence].label})</span>
                        {others > 0 && <span className="muted small"> +{others}</span>}
                      </>
                    ) : (
                      <span className="pr-unavailable">אין</span>
                    )}
                  </td>
                  <td data-label="סטטוס">
                    <Tag tone={REVIEW[r.reviewStatus].tone}>{REVIEW[r.reviewStatus].label}</Tag>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
