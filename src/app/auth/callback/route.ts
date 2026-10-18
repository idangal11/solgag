import { NextResponse, type NextRequest } from 'next/server';
import { safeNextPath, welcomePath } from '@/components/auth/paths';
import { createClient } from '@/lib/supabase/server';

/**
 * Landing point for PKCE auth links (?code=). The code can only be exchanged
 * by the browser that started the sign-in (it holds the PKCE verifier cookie),
 * so a link sent by someone else cannot log the victim into another account.
 *
 * Token-hash links (?token_hash=) are deliberately NOT supported: they log in
 * whoever opens them, which enables login CSRF. Our emails only contain a code.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get('next'));
  const code = params.get('code');

  const supabase = await createClient();
  let userId: string | null = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
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
