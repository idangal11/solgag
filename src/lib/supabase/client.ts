'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { publicConfig } from '@/lib/config';

let browserClient: SupabaseClient | undefined;

/** Supabase client for Client Components. RLS applies with the user's session. */
export function createClient(): SupabaseClient {
  browserClient ??= createBrowserClient(publicConfig.supabaseUrl, publicConfig.supabaseAnonKey);
  return browserClient;
}
