import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { ExistingImage } from '@/components/publish/images';
import { ListingWizard } from '@/components/publish/ListingWizard';
import { publicImageUrl } from '@/lib/config';
import { getListing } from '@/lib/data/queries';
import { createClient, getCurrentUser } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'עריכת מודעה',
  robots: { index: false },
};

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/listing/${id}/edit`)}`);

  const listing = await getListing(id);
  if (!listing || !listing.isMine) notFound();

  // listing.images holds public URLs only; editing needs the row ids and storage paths.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('listing_images')
    .select('id, storage_path, sort_order')
    .eq('listing_id', listing.id)
    .order('sort_order')
    .order('created_at');
  if (error) throw new Error(`listing_images: ${error.message}`);

  const images: ExistingImage[] = (data as { id: string; storage_path: string; sort_order: number }[]).map((r) => ({
    id: r.id,
    path: r.storage_path,
    sortOrder: r.sort_order,
    url: publicImageUrl(r.storage_path),
  }));

  return <ListingWizard key={listing.id} userId={user.id} listing={listing} existingImages={images} />;
}
