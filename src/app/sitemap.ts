import { createClient } from '@supabase/supabase-js';
import type { MetadataRoute } from 'next';
import { publicConfig } from '@/lib/config';

// Regenerated at most once an hour. Reads with the anon key (no cookies), so
// RLS exposes exactly what an anonymous visitor can see.
export const revalidate = 3600;

const STATIC_ROUTES: { path: string; changeFrequency: 'daily' | 'monthly' | 'yearly'; priority: number }[] = [
  { path: '/', changeFrequency: 'daily', priority: 1 },
  { path: '/calculator', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.2 },
];

/** PostgREST returns at most 1000 rows per request; a sitemap holds at most 50,000 URLs. */
const PAGE_SIZE = 1000;
const MAX_LISTINGS = 49_000;
const TIMEOUT_MS = 8000;

interface ListingRef {
  id: string;
  updated_at: string;
}

/** Published, real listings — or none if Supabase is not configured or unreachable. */
async function publishedListings(): Promise<ListingRef[]> {
  const { supabaseUrl, supabaseAnonKey } = publicConfig;
  if (!supabaseUrl || !supabaseAnonKey) return [];
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    const rows: ListingRef[] = [];
    for (let from = 0; from < MAX_LISTINGS; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('listing_feed')
        .select('id, updated_at')
        .eq('status', 'published')
        .eq('admin_hidden', false)
        .eq('is_fictional', false)
        .order('updated_at', { ascending: false })
        .order('id')
        .range(from, from + PAGE_SIZE - 1)
        .abortSignal(signal);
      if (error) throw new Error(error.message);
      rows.push(...((data ?? []) as ListingRef[]));
      if (!data || data.length < PAGE_SIZE) break;
    }
    return rows;
  } catch (err) {
    console.error('[sitemap] could not load listings — serving static routes only', err);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicConfig.siteUrl;
  const listings = await publishedListings();
  const newest = listings[0]?.updated_at;

  return [
    ...STATIC_ROUTES.map(({ path, changeFrequency, priority }) => ({
      url: `${base}${path === '/' ? '' : path}`,
      ...(path === '/' && newest ? { lastModified: newest } : {}),
      changeFrequency,
      priority,
    })),
    ...listings.map((l) => ({
      url: `${base}/listing/${l.id}`,
      lastModified: l.updated_at,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
