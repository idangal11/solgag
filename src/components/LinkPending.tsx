'use client';

import { useLinkStatus } from 'next/link';
import '@/styles/site.css';

/**
 * Navigation feedback without a route-level loading.tsx (which would make
 * dynamic pages stream before notFound() and answer 404s with HTTP 200).
 * Render inside a <Link>: while that link's navigation is pending, a thin
 * fixed progress bar appears under the header (styles in site.css).
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return pending ? <span className="route-progress" aria-hidden="true" /> : null;
}
