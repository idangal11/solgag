'use client';

import { AlertTriangle, Crosshair, Loader2, MapPin, PenLine, Search, Trash2, Undo2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { isSelfIntersecting, polygonAreaSqm } from '@/lib/geo';
import { AREA_SOURCE_LABEL, fmtSqm } from '@/lib/labels';
import type { LatLng } from '@/lib/types';
import { roundLatLng, totalArea, usableArea, USABLE_PCT, type Draft, type DrawMode, type ManualSource } from './draft';
import type { MapApi } from './DrawMap';
import { FieldError, errProps } from './FieldError';

const DrawMap = dynamic(() => import('./DrawMap').then((m) => m.DrawMap), {
  ssr: false,
  loading: () => (
    <div className="draw-map draw-map-loading" role="status">
      <Loader2 className="spin" size={20} /> טוען מפה…
    </div>
  ),
});

interface GeoResult {
  label: string;
  lat: number;
  lng: number;
}

interface Props {
  d: Draft;
  set: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
  errors: Record<string, string>;
  /** Edit mode: the listing's ownership is verified or under review. */
  verificationAtRisk: boolean;
}

export function LocationStep({ d, set, errors, verificationAtRisk }: Props) {
  const [mode, setMode] = useState<DrawMode>(d.location || d.polygon.length === 0 ? 'locate' : 'draw');
  const [flyTo, setFlyTo] = useState<{ at: LatLng; key: number } | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searchMsg, setSearchMsg] = useState('');
  const [mapApi, setMapApi] = useState<MapApi | null>(null);

  const polyArea = useMemo(() => polygonAreaSqm(d.polygon), [d.polygon]);
  const crossing = useMemo(() => isSelfIntersecting(d.polygon), [d.polygon]);
  const total = totalArea(d);
  const usable = usableArea(d);

  const onLocation = (p: LatLng) => set('location', roundLatLng(p));
  const onPolygon = (ring: LatLng[]) => set('polygon', ring.map(roundLatLng));

  const search = async () => {
    const q = query.trim();
    if (q.length < 2) {
      setSearchMsg('נא להקליד לפחות 2 תווים');
      return;
    }
    setSearching(true);
    setSearchMsg('');
    setResults([]);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as GeoResult[];
      setResults(data);
      if (!data.length) setSearchMsg('לא נמצאו תוצאות. אפשר לבחור מיקום ידנית בלחיצה על המפה.');
    } catch {
      setSearchMsg('חיפוש הכתובות אינו זמין כרגע. אפשר להמשיך ולבחור מיקום ידנית בלחיצה על המפה.');
    } finally {
      setSearching(false);
    }
  };

  const pickResult = (r: GeoResult) => {
    const at: LatLng = [r.lat, r.lng];
    onLocation(at);
    setMode('locate');
    setFlyTo((f) => ({ at, key: (f?.key ?? 0) + 1 }));
    setResults([]);
    setSearchMsg(`נבחר: ${r.label}. ניתן לגרור את הסמן לדיוק.`);
  };

  return (
    <div className="locate-step">
      {verificationAtRisk && (
        <p className="note">
          <AlertTriangle size={15} />
          שינוי המיקום או גבולות הגג יחזיר את סטטוס הבעלות ל„בעלות לא אומתה״, ויהיה צורך להגיש מסמכים לבדיקה מחדש.
        </p>
      )}

      <div className="locate-tools">
        <form
          className="search-row"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
        >
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש כתובת או יישוב"
            aria-label="חיפוש כתובת או יישוב"
            maxLength={200}
            enterKeyHint="search"
          />
          <button type="submit" className="btn ghost" disabled={searching}>
            {searching ? <Loader2 size={16} className="spin" /> : <Search size={16} />} חיפוש
          </button>
        </form>
        {results.length > 0 && (
          <ul className="geo-results" aria-label="תוצאות חיפוש">
            {results.map((r) => (
              <li key={`${r.lat},${r.lng}`}>
                <button type="button" onClick={() => pickResult(r)}>
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="hint" aria-live="polite">
          {searchMsg}
        </p>

        <div className="seg" role="radiogroup" aria-label="מצב עבודה במפה">
          <button type="button" role="radio" aria-checked={mode === 'locate'} className={mode === 'locate' ? 'on' : ''} onClick={() => setMode('locate')}>
            <Crosshair size={15} /> סימון מיקום
          </button>
          <button type="button" role="radio" aria-checked={mode === 'draw'} className={mode === 'draw' ? 'on' : ''} onClick={() => setMode('draw')}>
            <PenLine size={15} /> שרטוט גבולות הגג
          </button>
        </div>
        <p className="hint">
          {mode === 'locate'
            ? 'לחצו על המפה כדי לסמן את המבנה. הסמן ניתן לגרירה. אפשר גם להזיז את המפה (גם בחיצי המקלדת) וללחוץ „סימון במרכז המפה״.'
            : 'לחצו על פינות הגג לפי הסדר. גררו נקודה כדי לערוך; לחיצה ימנית (או לחיצה ארוכה בנייד) מוחקת נקודה. מומלץ לעבוד על „תצלום אוויר״.'}
        </p>
        <FieldError id="err-location" msg={errors.location} />
      </div>

      <DrawMap
        mode={mode}
        location={d.location}
        polygon={d.polygon}
        invalid={crossing}
        flyTo={flyTo}
        onLocation={onLocation}
        onPolygon={onPolygon}
        onReady={setMapApi}
      />

      <div className="draw-actions">
        <span className="pts" aria-live="polite">
          {d.polygon.length} נקודות
        </span>
        {mode === 'locate' && (
          <button type="button" className="btn ghost sm" disabled={!mapApi} onClick={() => mapApi && onLocation(mapApi.center())}>
            <MapPin size={14} /> סימון במרכז המפה
          </button>
        )}
        <button type="button" className="btn ghost sm" disabled={!d.polygon.length} onClick={() => set('polygon', d.polygon.slice(0, -1))}>
          <Undo2 size={14} /> בטל נקודה
        </button>
        <button type="button" className="btn ghost sm" disabled={!d.polygon.length} onClick={() => set('polygon', [])}>
          <Trash2 size={14} /> נקה שרטוט
        </button>
      </div>
      <FieldError id="err-polygon" msg={errors.polygon} />

      <div className="area-box">
        <div className="seg" role="radiogroup" aria-label="מקור שטח הגג">
          <button type="button" role="radio" aria-checked={d.areaMode === 'polygon'} className={d.areaMode === 'polygon' ? 'on' : ''} onClick={() => set('areaMode', 'polygon')}>
            שטח מהשרטוט
          </button>
          <button type="button" role="radio" aria-checked={d.areaMode === 'manual'} className={d.areaMode === 'manual' ? 'on' : ''} onClick={() => set('areaMode', 'manual')}>
            הזנה ידנית
          </button>
        </div>
        {d.areaMode === 'polygon' ? (
          <div className="area-readout" aria-live="polite">
            <span className="k">שטח מחושב (גיאודזי, Turf.js)</span>
            <span className="v">{d.polygon.length >= 3 ? fmtSqm(polyArea) : '—'}</span>
            <small className="muted">
              השרטוט הוא הערכה של המפרסם ואינו מדידה מוסמכת. בשמירה השטח מחושב מחדש בשרת (PostGIS) מתוך הפוליגון, ולכן עשוי להשתנות מעט.
            </small>
          </div>
        ) : (
          <div className="form-grid">
            <label className="field">
              <span>שטח גג כולל (מ״ר)</span>
              <input
                type="number"
                inputMode="decimal"
                min={50}
                max={500000}
                value={d.manualArea}
                onChange={(e) => set('manualArea', e.target.value)}
                {...errProps('area', errors)}
              />
            </label>
            <label className="field">
              <span>מקור הנתון</span>
              <select value={d.manualSource} onChange={(e) => set('manualSource', e.target.value as ManualSource)}>
                <option value="manual_measured">{AREA_SOURCE_LABEL.manual_measured}</option>
                <option value="manual_estimate">{AREA_SOURCE_LABEL.manual_estimate}</option>
              </select>
            </label>
            {d.polygon.length >= 3 && <small className="muted span2">לשם השוואה, שטח השרטוט: {fmtSqm(polyArea)}</small>}
          </div>
        )}
        <label className="field">
          <span>
            שטח שמיש להתקנה: {d.usablePct}% ≈ <b>{fmtSqm(usable)}</b>
          </span>
          <input
            type="range"
            min={USABLE_PCT.min}
            max={USABLE_PCT.max}
            value={d.usablePct}
            onChange={(e) => set('usablePct', Number(e.target.value))}
            aria-valuetext={`${d.usablePct}% — כ-${fmtSqm(usable)} מתוך ${fmtSqm(total)}`}
          />
          <small className="hint">בניכוי מעברים, מערכות על הגג ושוליים. הערכה בלבד.</small>
        </label>
        <FieldError id="err-area" msg={errors.area} />
      </div>
    </div>
  );
}
