import type { Metadata } from 'next';
import { unstable_rethrow } from 'next/navigation';
import { ExploreClient } from '@/components/explore/ExploreClient';
import { getPublishedListings } from '@/lib/data/queries';
import type { Listing } from '@/lib/types';

export const metadata: Metadata = {
  title: 'מפת גגות לסולארי',
  description:
    'מפה ורשימה של גגות גדולים בישראל — מחסנים, מפעלים, רפתות ומבנים מסחריים — שבעליהם מציעים אותם להקמת מערכות סולאריות. סינון לפי אזור, שטח שמיש, סוג מבנה ומודל התקשרות.',
  alternates: { canonical: '/' },
};

/** The explore UI never shows long free text — keep it out of the client payload. */
function forExplore(l: Listing): Listing {
  return { ...l, description: '', terms: { ...l.terms, notes: '' } };
}

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { focus } = await searchParams;

  let listings: Listing[] = [];
  let loadFailed = false;
  try {
    listings = (await getPublishedListings()).map(forExplore);
  } catch (err) {
    unstable_rethrow(err);
    console.error('[explore] loading listings failed', err);
    loadFailed = true;
  }

  return <ExploreClient listings={listings} focus={typeof focus === 'string' ? focus : undefined} loadFailed={loadFailed} />;
}
