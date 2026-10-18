import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ListingWizard } from '@/components/publish/ListingWizard';
import { getMyProfile } from '@/lib/data/queries';
import { getCurrentUser } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'פרסום גג',
  description: 'פרסום גג גדול להשכרה או לשיתוף הכנסות ממערכת סולארית — ארבעה שלבים קצרים.',
  robots: { index: false },
};

export default async function PublishPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/publish');
  const profile = await getMyProfile();

  return <ListingWizard userId={user.id} defaultOwnerName={profile?.fullName ?? ''} />;
}
