'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MouseEvent } from 'react';

/** Minimal shape of the Navigation API (not in every browser, nor in TS's DOM lib). */
type NavigationLike = {
  currentEntry: { index: number } | null;
  entries(): { url: string | null }[];
};

const isExploreUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  const u = new URL(url, window.location.href);
  return u.origin === window.location.origin && u.pathname === '/';
};

/**
 * How many history entries back this site's explore page is (0 = not reachable by going
 * back). Going back restores its filters and selection, which explore keeps in its URL.
 * Entries of this same listing in between (in-page links such as "#calculator") are skipped.
 */
function stepsBackToExplore(): number {
  try {
    const here = window.location.pathname;
    const nav = (window as unknown as { navigation?: NavigationLike }).navigation;
    if (nav?.currentEntry && typeof nav.entries === 'function') {
      // entries() lists only this site's entries, so a visitor from another site sees index 0.
      const entries = nav.entries();
      const { index } = nav.currentEntry;
      for (let i = index - 1; i >= 0; i--) {
        const url = entries[i]?.url;
        if (!url) return 0;
        if (isExploreUrl(url)) return index - i;
        const u = new URL(url);
        if (u.origin !== window.location.origin || u.pathname !== here) return 0;
      }
      return 0;
    }
    // No Navigation API: trust document.referrer only while this is still the page the
    // document was loaded for (the referrer does not change on client-side navigations)
    // and no in-page jump added an entry we cannot count.
    if (window.history.length < 2 || window.location.hash) return 0;
    const first = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (!first || new URL(first.name).pathname !== here) return 0;
    return isExploreUrl(document.referrer) ? 1 : 0;
  } catch {
    return 0;
  }
}

/**
 * "Back to search": returns to the previous explore state (filters, selected rooftop)
 * when the visitor came from there; otherwise opens explore at `fallbackHref`.
 */
export function BackToSearch({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Let the browser handle new-tab / new-window clicks.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const steps = stepsBackToExplore();
    if (!steps) return;
    e.preventDefault();
    if (steps === 1) router.back();
    else window.history.go(-steps);
  };

  return (
    <Link className="back-link" href={fallbackHref} onClick={onClick}>
      <ArrowRight size={16} aria-hidden="true" /> חזרה לחיפוש
    </Link>
  );
}
