import { Info, List, Map as MapIcon, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ExploreMap } from '../components/ExploreMap';
import { ListingCard } from '../components/ListingCard';
import { AGREEMENT_LABEL, AVAILABILITY, BUILDING_LABEL, REGION_LABEL } from '../labels';
import { href } from '../router';
import { useStore } from '../store';
import type { AgreementModel, Availability, BuildingType, Region } from '../types';

interface Filters {
  region: Region | 'all';
  minArea: number;
  types: BuildingType[];
  agreements: AgreementModel[];
  openOnly: boolean;
}

const EMPTY: Filters = { region: 'all', minArea: 0, types: [], agreements: [], openOnly: false };
const AREA_OPTIONS = [
  { v: 0, label: 'כל גודל' },
  { v: 1000, label: '1,000+ מ״ר' },
  { v: 2500, label: '2,500+ מ״ר' },
  { v: 5000, label: '5,000+ מ״ר' },
  { v: 8000, label: '8,000+ מ״ר' },
];

function toggle<T>(arr: T[], v: T) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export function ExplorePage({ focus }: { focus?: string }) {
  const { listings } = useStore();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const patch = (p: Partial<Filters>) => setFilters((f) => ({ ...f, ...p }));
  const [selectedId, setSelectedId] = useState<string | null>(focus ?? null);
  const [flyKey, setFlyKey] = useState(focus ? 1 : 0);
  const [mobileView, setMobileView] = useState<'map' | 'list'>(focus ? 'map' : 'list');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(() => !window.matchMedia('(max-width: 860px)').matches);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const [introOpen, setIntroOpen] = useState(() => {
    try {
      return localStorage.getItem('solgag.v1.introClosed') !== '1';
    } catch {
      return true;
    }
  });
  const closeIntro = () => {
    setIntroOpen(false);
    try {
      localStorage.setItem('solgag.v1.introClosed', '1');
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (focus) {
      setSelectedId(focus);
      setFlyKey((k) => k + 1);
      setMobileView('map');
    }
  }, [focus]);

  const filtered = useMemo(
    () =>
      listings.filter(
        (l) =>
          (filters.region === 'all' || l.region === filters.region) &&
          l.usableAreaSqm >= filters.minArea &&
          (!filters.types.length || filters.types.includes(l.buildingType)) &&
          (!filters.agreements.length || filters.agreements.includes(l.agreement)) &&
          (!filters.openOnly || l.availability === 'available'),
      ),
    [listings, filters],
  );
  const activeCount =
    (filters.region !== 'all' ? 1 : 0) + (filters.minArea ? 1 : 0) + filters.types.length + filters.agreements.length + (filters.openOnly ? 1 : 0);

  const selected = filtered.find((l) => l.id === selectedId) ?? null;

  // From the list: focus the map on the rooftop.
  const focusFromList = (id: string) => {
    setSelectedId(id);
    setFlyKey((k) => k + 1);
    setMobileView('map');
  };
  // From the map: open the rooftop's listing (preview + highlight in list).
  const selectFromMap = (id: string) => {
    setSelectedId(id);
    const el = cardRefs.current.get(id);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const filterPanel = (
    <div className="filters" role="search">
      <label className="field">
        <span>אזור</span>
        <select value={filters.region} onChange={(e) => patch({ region: e.target.value as Filters['region'] })}>
          <option value="all">כל הארץ</option>
          {(Object.keys(REGION_LABEL) as Region[]).map((r) => (
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
      <div className="field">
        <span>סוג מבנה</span>
        <div className="chips">
          {(Object.keys(BUILDING_LABEL) as BuildingType[]).map((t) => (
            <button key={t} className={`chip${filters.types.includes(t) ? ' on' : ''}`} aria-pressed={filters.types.includes(t)} onClick={() => setFilters((f) => ({ ...f, types: toggle(f.types, t) }))}>
              {BUILDING_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>מודל התקשרות</span>
        <div className="chips">
          {(Object.keys(AGREEMENT_LABEL) as AgreementModel[]).map((a) => (
            <button key={a} className={`chip${filters.agreements.includes(a) ? ' on' : ''}`} aria-pressed={filters.agreements.includes(a)} onClick={() => setFilters((f) => ({ ...f, agreements: toggle(f.agreements, a) }))}>
              {AGREEMENT_LABEL[a]}
            </button>
          ))}
        </div>
      </div>
      <label className="switch-row">
        <input type="checkbox" checked={filters.openOnly} onChange={(e) => patch({ openOnly: e.target.checked })} />
        <span>רק גגות שפתוחים לפניות</span>
      </label>
      {activeCount > 0 && (
        <button className="btn link" onClick={() => setFilters(EMPTY)}>
          נקה סינון ({activeCount})
        </button>
      )}
    </div>
  );

  return (
    <div className={`explore view-${mobileView}`}>
      <aside className="explore-side">
        <div className="side-head">
          <div>
            <h1>גגות זמינים לסולארי</h1>
            <p className="muted">
              {filtered.length} מתוך {listings.length} גגות · מודעות הדמו בדויות
            </p>
          </div>
          <button className="btn ghost sm filters-toggle" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}>
            <SlidersHorizontal size={16} /> סינון{activeCount ? ` (${activeCount})` : ''}
          </button>
        </div>
        {introOpen && (
          <div className="intro">
            <button className="icon-btn close" aria-label="סגור הסבר" onClick={closeIntro}>
              <X size={14} />
            </button>
            <b>איך זה עובד?</b>
            <ol>
              <li>
                <span>1</span>בעלי מחסנים, מפעלים ורפתות מציעים גג פנוי
              </li>
              <li>
                <span>2</span>משקיע מממן מערכת סולארית ומחשב תרחיש
              </li>
              <li>
                <span>3</span>הצדדים מתקשרים בשכירות או בחלוקת הכנסות
              </li>
            </ol>
            <div className="intro-cta">
              <a className="btn accent sm" href={href.publish()}>
                יש לי גג — לפרסום
              </a>
              <button className="btn ghost sm" onClick={closeIntro}>
                אני משקיע/ה — לגגות
              </button>
            </div>
          </div>
        )}
        <div className={`filters-wrap${filtersOpen ? ' open' : ''}`}>{filterPanel}</div>
        <div className="listing-list">
          {filtered.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              selected={l.id === selectedId}
              onFocus={focusFromList}
              ref={(el) => {
                if (el) cardRefs.current.set(l.id, el);
                else cardRefs.current.delete(l.id);
              }}
            />
          ))}
          {!filtered.length && (
            <div className="empty">
              <p>אין גגות שתואמים לסינון.</p>
              <button className="btn ghost sm" onClick={() => setFilters(EMPTY)}>
                נקה סינון
              </button>
            </div>
          )}
        </div>
      </aside>

      <section className="explore-map" aria-label="מפת גגות">
        <ExploreMap listings={filtered} selectedId={selectedId} flyKey={flyKey} onSelect={selectFromMap} visible={mobileView === 'map'} />

        <div className={`legend${legendOpen ? '' : ' collapsed'}`}>
          <button className="legend-head" onClick={() => setLegendOpen((o) => !o)} aria-expanded={legendOpen}>
            <Info size={15} /> מקרא {legendOpen ? <X size={14} /> : null}
          </button>
          {legendOpen && (
            <ul>
              {(Object.keys(AVAILABILITY) as Availability[]).map((s) => (
                <li key={s}>
                  <span className="sw" style={{ background: AVAILABILITY[s].color }} />
                  {AVAILABILITY[s].label}
                </li>
              ))}
              <li>
                <span className="sw dashed" /> גבול גג להמחשה (לא מדידה)
              </li>
              <li>
                <span className="sw solid" /> גבול ששורטט ע״י המפרסם
              </li>
              <li className="legend-note">הופעה במפה אינה מעידה שהגג זמין לעסקה.</li>
            </ul>
          )}
        </div>

        {selected && (
          <div className="map-preview" role="dialog" aria-label={selected.title}>
            <button className="icon-btn close" aria-label="סגור" onClick={() => setSelectedId(null)}>
              <X size={16} />
            </button>
            <ListingCard listing={selected} compact onFocus={() => setFlyKey((k) => k + 1)} />
            <p className="preview-note">{selected.polygonIllustrative ? 'הגבול המסומן להמחשה בלבד ואינו מייצג מבנה אמיתי.' : 'הגבול שורטט על ידי המפרסם ולא נמדד.'}</p>
            <a className="btn primary block" href={href.listing(selected.id)}>
              פתח מודעה מלאה
            </a>
          </div>
        )}
      </section>

      <div className="mobile-switch" role="tablist" aria-label="תצוגה">
        <button role="tab" aria-selected={mobileView === 'list'} className={mobileView === 'list' ? 'on' : ''} onClick={() => setMobileView('list')}>
          <List size={17} /> רשימה
        </button>
        <button role="tab" aria-selected={mobileView === 'map'} className={mobileView === 'map' ? 'on' : ''} onClick={() => setMobileView('map')}>
          <MapIcon size={17} /> מפה
        </button>
      </div>
    </div>
  );
}
