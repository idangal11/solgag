import type { ListingStatus } from '@/lib/types';

export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  published: 'מפורסמת',
  hidden: 'מוסתרת',
};

export const FICTIONAL_LABEL = 'לדוגמה — בדויה';

/** "How long has this request waited" in Hebrew, e.g. ממתינה יומיים. */
export function waitingLabel(iso: string, now = Date.now()): string {
  const days = Math.floor((now - Date.parse(iso)) / (24 * 60 * 60 * 1000));
  if (days < 1) return 'הוגשה היום';
  if (days === 1) return 'ממתינה יום אחד';
  if (days === 2) return 'ממתינה יומיים';
  return `ממתינה ${days} ימים`;
}
