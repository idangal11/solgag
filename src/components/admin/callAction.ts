import { unstable_isUnrecognizedActionError, unstable_rethrow } from 'next/navigation';
import type { ActionResult } from './types';

// A Server Action promise rejects on a network drop, a function timeout, or when
// a deploy replaced the action this tab still references. Inside startTransition
// that rejection would replace the admin page with error.tsx, so every admin
// call goes through here and gets a Hebrew failure result instead.
// Import only from client components.

const NETWORK_ERROR = 'החיבור לשרת נכשל, וייתכן שהפעולה לא בוצעה. רעננו את הדף כדי לבדוק את המצב ונסו שוב.';
const OUTDATED_ERROR = 'גרסה חדשה של האתר עלתה בינתיים. רעננו את הדף ונסו שוב.';

export async function callAction<T extends object>(action: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await action();
  } catch (e) {
    // Never swallow Next's own control-flow errors (redirect / notFound).
    unstable_rethrow(e);
    if (unstable_isUnrecognizedActionError(e)) return { ok: false, error: OUTDATED_ERROR };
    console.error('[admin] server action failed', e);
    return { ok: false, error: NETWORK_ERROR };
  }
}
