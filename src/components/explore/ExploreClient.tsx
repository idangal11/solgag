'use client';

import { List, LoaderCircle, Map as MapIcon, SlidersHorizontal, Sun } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useId, useMemo, useRef, useState, useTransition } from 'react';
import { ListingCard } from '@/components/ListingCard';
import { fmtNum } from '@/lib/labels';
import type { Listing } from '@/lib/types';
import '@/styles/explore.css';
import { ExploreFilters } from './ExploreFilters';
import { ExploreIntro } from './ExploreIntro';
import type { FlyRequest } from './ExploreMap';
import { activeFilterCount, applyFilters, EMPTY_FILTERS, filtersKey, parseFilters, toQueryString, writeFilters, type Filters } from './filters';
import { MapLegend } from './MapLegend';
import { MapPreview } from './MapPreview';
import { MOBILE_QUERY, prefersReducedMotion, useMediaQuery } from './useMediaQuery';

const ExploreMap = dynamic(() => import('./ExploreMap'), {
  ssr: false,
  loading: () => (
    <div className="map-loading" role="status">
      <LoaderCircle size={24} className="spin" aria-hidden />
      <span>טוען מפה…</span>
    </div>
  ),
});

/**
 * Rewrites the query string in place. Next.js syncs native history updates with
 * useSearchParams, without a server round trip and without scrolling — a
 * router.replace would re-render this dynamic page and refetch all listings on every click.
 */
function replaceQuery(mutate: (p: URLSearchParams) => void) {
  const p = new URLSearchParams(window.location.search);
  mutate(p);
  const qs = toQueryString(p);
  window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
}

function EmptyState() {
  return (
    <div className="empty explore-empty">
      <span className="explore-empty-icon" aria-hidden>
        <Sun size={26} />
      </span>
      <h2 className="explore-empty-title">עדיין אין גגות במפה — היו הראשונים לפרסם</h2>
      <p>יש לכם מחסן, מפעל, רפת או מבנה מסחרי עם גג גדול? פרסמו אותו ומשקיעים יוכלו לפנות אליכם.</p>
      <Link className="btn accent sm" href="/publish">
        יש לי גג — לפרסום
      </Link>
    </div>
  );
}

interface Props {
  listings: Listing[];
  /** ?focus=<listing id> from the server request. */
  focus?: string;
  loadFailed?: boolean;
}

type MobileView = 'list' | 'map';

export function ExploreClient({ listings, focus, loadFailed = false }: Props) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();

  // Filters live in the URL so filtered views can be shared.
  const searchParams = useSearchParams();
  const filterKey = filtersKey(searchParams);
  const filters = useMemo(() => parseFilters(new URLSearchParams(filterKey)), [filterKey]);
  const filtered = useMemo(() => applyFilters(listings, filters), [listings, filters]);
  const activeCount = activeFilterCount(filters);
  const setFilters = useCallback((update: (f: Filters) => Filters) => {
    replaceQuery((p) => writeFilters(p, update(parseFilters(p))));
  }, []);

  // ?focus=<id> selects and flies to a rooftop on load. The live URL wins over the
  // prop: after back/forward the page may be restored with the props of an older URL.
  const [initial] = useState(() => {
    const id = searchParams.get('focus') ?? focus ?? null;
    return { id, target: id ? (filtered.find((l) => l.id === id) ?? null) : null };
  });
  const [selectedId, setSelectedId] = useState<string | null>(initial.id);
  const [flyTo, setFlyTo] = useState<FlyRequest | null>(initial.target && { target: initial.target });
  const [mobileView, setMobileView] = useState<MobileView>(initial.target ? 'map' : 'list');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const isMobile = useMediaQuery(MOBILE_QUERY);

  const cardRefs = useRef(new Map<string, HTMLElement>());
  const previewRef = useRef<HTMLElement>(null);
  const mapRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const filtersId = useId();

  const selected = filtered.find((l) => l.id === selectedId) ?? null;
  const fictionalShown = filtered.filter((l) => l.isFictional).length;
  const hasListings = listings.length > 0;

  /** Selection is mirrored to ?focus= so it survives a visit to the listing page and back. */
  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    replaceQuery((p) => {
      if (id) p.set('focus', id);
      else p.delete('focus');
    });
  }, []);

  // From the list: fly the map to the rooftop.
  const focusFromList = (id: string) => {
    const target = listings.find((l) => l.id === id);
    if (!target) return;
    select(id);
    setFlyTo({ target });
    setMobileView('map');
    // On mobile the list is now hidden — move focus to the preview on the map.
    if (isMobile) setTimeout(() => previewRef.current?.focus({ preventScroll: true }), 120);
  };

  // From the map: select the rooftop and bring its card into view in the list.
  const selectFromMap = useCallback(
    (id: string) => {
      select(id);
      cardRefs.current.get(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
    },
    [select],
  );

  const closePreview = () => {
    const hadFocus = !!previewRef.current?.contains(document.activeElement);
    const id = selectedId;
    select(null);
    if (!hadFocus) return;
    const card = id && !isMobile ? cardRefs.current.get(id) : undefined;
    (card ?? mapRef.current)?.focus({ preventScroll: true });
  };

  return (
    <div className={`explore view-${mobileView}`}>
      <aside className="explore-side" aria-label="רשימת גגות">
        <div className="side-head">
          <div>
            <h1 ref={headingRef} tabIndex={-1}>
              מפת גגות לסולארי
            </h1>
            <p className="muted" aria-live="polite">
              {loadFailed
                ? 'רשימת הגגות אינה זמינה כרגע'
                : hasListings
                  ? `מוצגים ${fmtNum(filtered.length)} מתוך ${fmtNum(listings.length)} גגות`
                  : 'עדיין אין גגות במפה'}
              {fictionalShown > 0 &&
                (fictionalShown === 1 ? ' · אחד מהם מודעה לדוגמה (בדויה)' : ` · ${fmtNum(fictionalShown)} מהם מודעות לדוגמה (בדויות)`)}
            </p>
          </div>
          {hasListings && (
            <button
              type="button"
              className="btn ghost sm filters-toggle"
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
              aria-controls={filtersId}
            >
              <SlidersHorizontal size={16} aria-hidden /> סינון{activeCount ? ` (${activeCount})` : ''}
            </button>
          )}
        </div>

        <ExploreIntro onClose={() => headingRef.current?.focus({ preventScroll: true })} />

        {hasListings && (
          <div id={filtersId} className={`filters-wrap${filtersOpen ? ' open' : ''}`}>
            <ExploreFilters filters={filters} onChange={setFilters} />
          </div>
        )}

        <div className="listing-list">
          {loadFailed ? (
            <div className="empty" role="alert">
              <p>לא הצלחנו לטעון את הגגות כרגע.</p>
              <button type="button" className="btn ghost sm" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())}>
                {refreshing ? 'טוען…' : 'נסו שוב'}
              </button>
            </div>
          ) : !hasListings ? (
            <EmptyState />
          ) : (
            <>
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
                  <button type="button" className="btn ghost sm" onClick={() => setFilters(() => EMPTY_FILTERS)}>
                    נקה סינון
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      <section ref={mapRef} className="explore-map" aria-label="מפת גגות" tabIndex={-1}>
        <ExploreMap
          listings={filtered}
          selectedId={selectedId}
          flyTo={flyTo}
          onSelect={selectFromMap}
          visible={!isMobile || mobileView === 'map'}
          overlayRef={previewRef}
        />
        <MapLegend />
        {!hasListings && !loadFailed && (
          <p className="map-empty-note" role="note">
            עדיין אין גגות במפה — <Link href="/publish">היו הראשונים לפרסם</Link>
          </p>
        )}
        {selected && (
          <MapPreview ref={previewRef} listing={selected} onClose={closePreview} onRefocus={() => setFlyTo({ target: selected })} />
        )}
      </section>

      <div className="mobile-switch" role="group" aria-label="תצוגה">
        <button type="button" aria-pressed={mobileView === 'list'} className={mobileView === 'list' ? 'on' : ''} onClick={() => setMobileView('list')}>
          <List size={17} aria-hidden /> רשימה
        </button>
        <button type="button" aria-pressed={mobileView === 'map'} className={mobileView === 'map' ? 'on' : ''} onClick={() => setMobileView('map')}>
          <MapIcon size={17} aria-hidden /> מפה
        </button>
      </div>
    </div>
  );
}
