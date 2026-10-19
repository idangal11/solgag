// Client-side wrapper for Server Action calls made from dashboard / inquiry
// components. A Server Action promise rejects (instead of resolving to an
// ActionResult) when the network drops, a function times out, or the deployed
// build no longer knows the action ID (an open tab after a deploy). Inside
// startTransition such a rejection would be rethrown to the route's error.tsx
// and wipe the page, so every call goes through here and gets a Hebrew error.
// Import only from client components.

import { unstable_isUnrecognizedActionError, unstable_rethrow } from 'next/navigation';
import type { ActionResult } from './actionResult';

/** The request may or may not have reached the server, so never claim either way. */
export const CONNECTION_ERROR = 'החיבור לשרת נכשל, וייתכן שהפעולה לא בוצעה. בדקו את החיבור לאינטרנט ונסו שוב.';
export const STALE_VERSION_ERROR = 'האתר עודכן לגרסה חדשה. נא לרענן את העמוד ולנסות שוב.';

export type CallResult =
  | { ok: true }
  /** server: the action answered with an error; network: no usable answer; stale: the page is from an older build. */
  | { ok: false; error: string; reason: 'server' | 'network' | 'stale' };

export async function callAction(run: () => Promise<ActionResult>): Promise<CallResult> {
  try {
    const res = await run();
    return res.ok ? res : { ok: false, error: res.error, reason: 'server' };
  } catch (e) {
    // Never swallow Next's own control-flow errors (redirect / notFound).
    unstable_rethrow(e);
    if (unstable_isUnrecognizedActionError(e)) return { ok: false, error: STALE_VERSION_ERROR, reason: 'stale' };
    console.error('Server Action call failed', e);
    return { ok: false, error: CONNECTION_ERROR, reason: 'network' };
  }
}
