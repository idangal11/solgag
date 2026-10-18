// Result shape returned by the dashboard / inquiry Server Actions, plus a
// helper that turns Postgres / PostgREST errors into Hebrew UI messages.

export type ActionResult = { ok: true } | { ok: false; error: string };

export const NOT_SIGNED_IN = 'פג תוקף ההתחברות. נא להתחבר מחדש.';

const HEBREW = /[֐-׿]/;

/**
 * Domain errors raised by our triggers are already in Hebrew — show them as is.
 * Anything else (RLS, constraint names, network) gets a generic Hebrew message.
 */
export function dbErrorMessage(error: { message?: string; code?: string } | null | undefined, fallback: string): string {
  if (error?.message && HEBREW.test(error.message)) return error.message;
  if (error?.code === '42501') return 'אין לך הרשאה לבצע את הפעולה הזו.';
  return fallback;
}

export function fail(error: string): ActionResult {
  return { ok: false, error };
}
