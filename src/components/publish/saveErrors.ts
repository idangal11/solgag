import { MAX_VERTICES } from './draft';

// Listing save failures (PostgREST / DB triggers / network) → Hebrew messages.
// Nothing technical or English reaches the owner.

export interface SaveFailure {
  code?: string;
  message?: string;
  /** HTTP status of the PostgREST response (0 when the request never completed). */
  status?: number;
}

const hasHebrew = (s: string) => /[֐-׿]/.test(s);

/** PostgREST error + HTTP status → plain object (Error.message is not enumerable). */
export const saveFailure = (error: { code?: string; message?: string }, status?: number): SaveFailure => ({
  code: error.code,
  message: error.message,
  status,
});

const CHECK_MESSAGES: Record<string, string> = {
  footprint_size_limit: `שרטוט הגג מורכב מדי (עד ${MAX_VERTICES} נקודות, ללא חורים). מחקו נקודות ונסו שוב.`,
  usable_le_total: 'השטח השמיש גדול מהשטח הכולל. הקטינו את אחוז השטח השמיש ונסו שוב.',
};

export function saveErrorMessage(e: SaveFailure | null | undefined): string {
  const err = e ?? {};
  const msg = err.message ?? '';
  if (err.code === '42501') return 'אין הרשאה לשמור את המודעה. ייתכן שתוקף ההתחברות פג — התחברו מחדש ונסו שוב (הטיוטה נשמרת בלשונית זו).';
  if (err.status === 401 || err.code === 'PGRST301' || err.code === 'PGRST303') {
    return 'תוקף ההתחברות פג. התחברו מחדש בלשונית אחרת ונסו לשמור שוב — הטיוטה נשמרת כאן.';
  }
  if (msg === 'not-found') return 'המודעה לא נמצאה, או שאין לך הרשאה לערוך אותה.';
  // Rate limits (5 per hour, 20 per day, 100 per account) arrive in Hebrew from listings_guard.
  if (err.code === '54000') return hasHebrew(msg) ? msg : 'חרגתם ממכסת פרסום המודעות. נסו שוב מאוחר יותר.';
  if (err.status === 413 || /too large|payload/i.test(msg)) {
    return 'המודעה גדולה מדי לשמירה. צמצמו את מספר הנקודות בשרטוט או קצרו את הטקסטים ונסו שוב.';
  }
  // Domain errors raised by the DB triggers (polygon size, area, location) are already in Hebrew.
  if (hasHebrew(msg)) return msg;
  if (err.code === '23514') {
    const constraint = Object.keys(CHECK_MESSAGES).find((c) => msg.includes(`"${c}"`));
    return constraint ? CHECK_MESSAGES[constraint] : 'אחד הערכים חורג מהטווח המותר. בדקו את השדות ונסו שוב.';
  }
  if (err.code === '22001') return 'אחד השדות ארוך מדי. קצרו את הטקסט ונסו שוב.';
  if (err.code?.startsWith('22') || err.code?.startsWith('23')) return 'חלק מהנתונים אינם תקינים. בדקו את השדות ונסו שוב.';
  if (err.status && err.status >= 500) return 'השרת אינו זמין כרגע. נסו שוב בעוד מספר דקות — הטיוטה נשמרת בלשונית זו.';
  return 'שמירת המודעה נכשלה. בדקו את החיבור לאינטרנט ונסו שוב.';
}
