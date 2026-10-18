'use client';

import { useRouter } from 'next/navigation';
import { ListingCard } from '@/components/ListingCard';
import type { Listing } from '@/lib/types';

/** Saved rooftops; "show on map" opens the explore map focused on the rooftop. */
export function FavoritesGrid({ listings }: { listings: Listing[] }) {
  const router = useRouter();
  return (
    <div className="grid-cards">
      {listings.map((l) => (
        <ListingCard key={l.id} listing={l} onFocus={(id) => router.push(`/?focus=${encodeURIComponent(id)}`)} />
      ))}
    </div>
  );
}
