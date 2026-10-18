import 'server-only';

import { cache } from 'react';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import type { Inquiry, Listing, Profile } from '@/lib/types';
import {
  mapInquiry,
  mapListing,
  mapProfile,
  type InquiryRow,
  type ListingFeedRow,
  type ProfileRow,
} from './mappers';

// Server-side read helpers. All of them run under the caller's RLS.

export async function getPublishedListings(): Promise<Listing[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('listing_feed')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(`listing_feed: ${error.message}`);
  return (data as ListingFeedRow[]).map(mapListing);
}

export const getListing = cache(async (id: string): Promise<Listing | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from('listing_feed').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`listing_feed: ${error.message}`);
  return data ? mapListing(data as ListingFeedRow) : null;
});

export async function getMyListings(): Promise<Listing[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('listing_feed')
    .select('*')
    .eq('is_mine', true)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listing_feed: ${error.message}`);
  return (data as ListingFeedRow[]).map(mapListing);
}

export const getMyProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, contact_email, role, is_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw new Error(`profiles: ${error.message}`);
  return data ? mapProfile(data as ProfileRow) : null;
});

export async function getMyFavoriteIds(): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from('favorites').select('listing_id').eq('user_id', user.id);
  if (error) throw new Error(`favorites: ${error.message}`);
  return (data ?? []).map((r: { listing_id: string }) => r.listing_id);
}

export async function getFavoriteListings(): Promise<Listing[]> {
  const ids = await getMyFavoriteIds();
  if (!ids.length) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from('listing_feed').select('*').in('id', ids);
  if (error) throw new Error(`listing_feed: ${error.message}`);
  return (data as ListingFeedRow[]).map(mapListing);
}

const INQUIRY_COLUMNS = 'id, listing_id, sender_id, sender_name, sender_contact, sender_role, message, status, created_at, listings(title)';

/** Inquiries the current user sent, and inquiries received on their own listings. */
export async function getMyInquiries(): Promise<{ sent: Inquiry[]; received: Inquiry[] }> {
  const user = await getCurrentUser();
  if (!user) return { sent: [], received: [] };
  const supabase = await createClient();
  // Filter explicitly by role in each query: admins can read every inquiry under
  // RLS, and "received" must only mean inquiries on listings the user owns.
  const [sent, received] = await Promise.all([
    supabase.from('inquiries').select(INQUIRY_COLUMNS).eq('sender_id', user.id).order('created_at', { ascending: false }).limit(200),
    supabase
      .from('inquiries')
      .select(`${INQUIRY_COLUMNS.replace('listings(title)', 'listings!inner(title, owner_id)')}`)
      .eq('listings.owner_id', user.id)
      .neq('sender_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200),
  ]);
  if (sent.error) throw new Error(`inquiries: ${sent.error.message}`);
  if (received.error) throw new Error(`inquiries: ${received.error.message}`);
  return {
    sent: (sent.data as unknown as InquiryRow[]).map((r) => mapInquiry(r, user.id)),
    received: (received.data as unknown as InquiryRow[]).map((r) => mapInquiry(r, user.id)),
  };
}

export async function getInquiry(id: string): Promise<Inquiry | null> {
  const user = await getCurrentUser();
  if (!user || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from('inquiries').select(INQUIRY_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new Error(`inquiries: ${error.message}`);
  return data ? mapInquiry(data as unknown as InquiryRow, user.id) : null;
}
