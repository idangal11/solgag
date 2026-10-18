import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DashboardTabs } from '@/components/dashboard/DashboardTabs';
import { InvestorPanel } from '@/components/dashboard/InvestorPanel';
import { OwnerPanel } from '@/components/dashboard/OwnerPanel';
import { STORAGE_BUCKETS } from '@/lib/config';
import { mapVerificationRequest, type VerificationRequestRow } from '@/lib/data/mappers';
import { getFavoriteListings, getMyInquiries, getMyListings, getMyProfile } from '@/lib/data/queries';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import type { UserRole, VerificationRequest } from '@/lib/types';
import '@/styles/dashboard.css';

export const metadata: Metadata = {
  title: 'האזור האישי',
  robots: { index: false, follow: false },
};

const VERIFICATION_COLUMNS = 'id, listing_id, status, review_note, created_at, reviewed_at, note, document_path, listings(title)';
const DOC_LINK_TTL_SECONDS = 60 * 60;

/** The user's ownership verification requests, plus short-lived links to the documents they uploaded. */
async function getMyVerificationRequests(userId: string): Promise<{ requests: VerificationRequest[]; documentUrls: Record<string, string> }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('verification_requests')
    .select(VERIFICATION_COLUMNS)
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`verification_requests: ${error.message}`);
  const requests = (data as unknown as VerificationRequestRow[]).map(mapVerificationRequest);

  const documentUrls: Record<string, string> = {};
  if (requests.length) {
    const { data: signed, error: signError } = await supabase.storage
      .from(STORAGE_BUCKETS.ownershipDocs)
      .createSignedUrls(
        requests.map((r) => r.documentPath),
        DOC_LINK_TTL_SECONDS,
      );
    if (signError) console.warn('ownership-docs signed URLs', signError.message);
    for (const s of signed ?? []) if (s.path && s.signedUrl) documentUrls[s.path] = s.signedUrl;
  }
  return { requests, documentUrls };
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=%2Fdashboard');

  const [{ tab }, profile, listings, inquiries, favorites, verification] = await Promise.all([
    searchParams,
    getMyProfile(),
    getMyListings(),
    getMyInquiries(),
    getFavoriteListings(),
    getMyVerificationRequests(user.id),
  ]);

  const initialTab: UserRole = tab === 'owner' || tab === 'investor' ? tab : (profile?.role ?? 'investor');
  // Admins can read every inquiry under RLS; "received" here means received on my own listings.
  const myListingIds = new Set(listings.map((l) => l.id));
  const received = inquiries.received.filter((i) => myListingIds.has(i.listingId));

  return (
    <div className="page dashboard">
      <DashboardTabs
        initialTab={initialTab}
        name={profile?.fullName.trim() || null}
        owner={<OwnerPanel listings={listings} received={received} requests={verification.requests} documentUrls={verification.documentUrls} />}
        investor={<InvestorPanel favorites={favorites} sent={inquiries.sent} />}
      />
    </div>
  );
}
