import 'server-only';

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicConfig } from '@/lib/config';

/**
 * Service-role client. BYPASSES RLS — use only for narrow server tasks that
 * cannot be expressed under the caller's permissions (e.g. looking up a listing
 * owner's notification email). Returns null when the key is not configured.
 */
export function createAdminClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !publicConfig.supabaseUrl) return null;
  return createSupabaseClient(publicConfig.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
