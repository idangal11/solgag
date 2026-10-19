import type { ListingStatus } from '@/lib/types';
import type { ListingVisibility } from './types';

/** The owner's own choice (listings.status). */
export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  published: 'מפורסמת',
  hidden: 'מוסתרת',
};

/** Staff moderation (listings.admin_hidden). */
export const ADMIN_HIDDEN_LABEL = 'הוסתרה ע״י הצוות';

export const VISIBILITY_LABEL: Record<ListingVisibility, string> = {
  public: 'גלויה לציבור',
  owner_hidden: 'הוסתרה ע״י המפרסם',
  admin_hidden: ADMIN_HIDDEN_LABEL,
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
