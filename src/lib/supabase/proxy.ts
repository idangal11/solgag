import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { publicConfig } from '@/lib/config';

/** Paths that require a signed-in user. Others are public. */
const PROTECTED_PREFIXES = ['/publish', '/dashboard', '/inquiries', '/admin', '/account'];

function isProtectedPath(path: string): boolean {
  return PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`)) || /^\/listing\/[^/]+\/edit\/?$/.test(path);
}

/**
 * Refreshes the Supabase session cookie on every request and redirects
 * anonymous visitors away from protected pages.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  let cacheHeaders: Record<string, string> = {};

  const supabase = createServerClient(publicConfig.supabaseUrl, publicConfig.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        // A refreshed session cookie must never be stored by a shared cache.
        cacheHeaders = headers ?? {};
        Object.entries(cacheHeaders).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Do not run code between createServerClient and getUser — it refreshes the token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // Server Action POSTs are answered by the action itself (it returns a
  // "not signed in" result the client can show); a redirect here would make
  // the client-side action call throw instead.
  const isServerAction = request.method === 'POST' && request.headers.has('next-action');

  if (!user && !isServerAction && isProtectedPath(path)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', path + request.nextUrl.search);
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    Object.entries(cacheHeaders).forEach(([key, value]) => redirect.headers.set(key, value));
    return redirect;
  }

  return response;
}
