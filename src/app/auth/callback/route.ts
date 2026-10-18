import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { safeNextPath, welcomePath } from '@/components/auth/paths';
import { createClient } from '@/lib/supabase/server';

const EMAIL_OTP_TYPES: readonly string[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];

/**
 * Landing point for links in auth emails: PKCE (?code=) or token-hash
 * (?token_hash=&type=) links. Sets the session cookie, then continues to `next`.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get('next'));
  const code = params.get('code');
  const tokenHash = params.get('token_hash');
  const type = params.get('type');

  const supabase = await createClient();
  let userId: string | null = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) userId = data.user?.id ?? null;
  } else if (tokenHash && type && EMAIL_OTP_TYPES.includes(type)) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
    if (!error) userId = data.user?.id ?? null;
  }

  if (!userId) {
    return NextResponse.redirect(new URL(`/login?error=1&next=${encodeURIComponent(next)}`, request.url));
  }

  // Same client instance: it already holds the new session, so RLS sees the user.
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle();
  const needsName = profile !== null && !String(profile.full_name ?? '').trim();
  return NextResponse.redirect(new URL(needsName ? welcomePath(next) : next, request.url));
}
