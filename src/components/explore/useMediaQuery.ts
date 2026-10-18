import { useCallback, useSyncExternalStore } from 'react';

/** Same breakpoint as globals.css (bottom nav, list/map toggle, bottom-sheet preview). */
export const MOBILE_QUERY = '(max-width: 860px)';

/**
 * Live `matchMedia` result. `serverValue` is used for the server render and
 * hydration; the real value takes over right after hydration.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
