import 'server-only';

import { notFound } from 'next/navigation';
import type { AdminListingRow, AdminVerificationItem, ListingVisibility } from '@/components/admin/types';
import { getMyProfile } from '@/lib/data/queries';
import { createClient } from '@/lib/supabase/server';
import type { ListingStatus, OwnerVerification, Profile, TechAssessment, VerificationStatus } from '@/lib/types';

// Admin reads. They run under the admin's own session: admin powers come from
// profiles.is_admin through RLS — never from the service role.

/** 404 for everyone who is not an admin (the area's existence is not advertised). */
export async function requireAdmin(): Promise<Profile> {
  const profile = await getMyProfile();
  if (!profile?.isAdmin) notFound();
  return profile;
}

const COUNT_ONLY = { count: 'exact', head: true } as const;

export interface AdminCounts {
  /** Published by the owner and not hidden by staff — what the public sees. */
  visible: number;
  visibleFictional: number;
  /** Hidden by the owner (and not by staff). */
  ownerHidden: number;
  /** Hidden by staff, whatever the owner's status. */
  adminHidden: number;
  pendingVerifications: number;
  inquiriesLastWeek: number;
}

export async function getAdminCounts(): Promise<AdminCounts> {
  const supabase = await createClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const listings = () => supabase.from('listings').select('id', COUNT_ONLY);
  const results = await Promise.all([
    listings().eq('status', 'published').eq('admin_hidden', false),
    listings().eq('status', 'published').eq('admin_hidden', false).eq('is_fictional', true),
    listings().eq('status', 'hidden').eq('admin_hidden', false),
    listings().eq('admin_hidden', true),
    supabase.from('verification_requests').select('id', COUNT_ONLY).eq('status', 'pending'),
    supabase.from('inquiries').select('id', COUNT_ONLY).gte('created_at', weekAgo),
  ]);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(`admin counts: ${failed.error.message}`);
  const [visible, visibleFictional, ownerHidden, adminHidden, pendingVerifications, inquiriesLastWeek] = results.map(
    (r) => r.count ?? 0,
  );
  return { visible, visibleFictional, ownerHidden, adminHidden, pendingVerifications, inquiriesLastWeek };
}

/** For the nav badge; never fails the whole admin layout. */
export async function getPendingVerificationCount(): Promise<number | null> {
  const supabase = await createClient();
  const { count, error } = await supabase.from('verification_requests').select('id', COUNT_ONLY).eq('status', 'pending');
  return error ? null : (count ?? 0);
}

// ─── Verification requests ──────────────────────────────────────────────

type One<T> = T | T[] | null;
const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

interface VerificationRow {
  id: string;
  listing_id: string;
  note: string;
  status: VerificationStatus;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  listings: One<{
    title: string;
    locality: string;
    owner_display_name: string;
    is_fictional: boolean;
    owner_verification: OwnerVerification;
  }>;
  owner: One<{ full_name: string; contact_email: string | null }>;
  reviewer: One<{ full_name: string }>;
}

// verification_requests has two FKs to profiles (owner_id, reviewer_id), so the
// embeds name the FK column to disambiguate.
const VERIFICATION_COLUMNS =
  'id, listing_id, note, status, review_note, created_at, reviewed_at, ' +
  'listings(title, locality, owner_display_name, is_fictional, owner_verification), ' +
  'owner:profiles!owner_id(full_name, contact_email), ' +
  'reviewer:profiles!reviewer_id(full_name)';

function mapVerification(r: VerificationRow): AdminVerificationItem {
  const listing = one(r.listings);
  const owner = one(r.owner);
  return {
    id: r.id,
    listingId: r.listing_id,
    listingTitle: listing?.title ?? 'מודעה שהוסרה',
    locality: listing?.locality ?? '—',
    ownerDisplayName: listing?.owner_display_name ?? '—',
    listingIsFictional: listing?.is_fictional ?? false,
    listingVerification: listing?.owner_verification ?? null,
    accountName: owner?.full_name || null,
    accountEmail: owner?.contact_email ?? null,
    note: r.note,
    status: r.status,
    reviewNote: r.review_note,
    reviewerName: one(r.reviewer)?.full_name || null,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at,
  };
}

/** Pending requests, oldest first — first in, first reviewed. */
export async function getVerificationQueue(limit = 100): Promise<AdminVerificationItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('verification_requests')
    .select(VERIFICATION_COLUMNS)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`verification_requests: ${error.message}`);
  return (data as unknown as VerificationRow[]).map(mapVerification);
}

export async function getRecentReviews(limit = 20): Promise<AdminVerificationItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('verification_requests')
    .select(VERIFICATION_COLUMNS)
    .neq('status', 'pending')
    .order('reviewed_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`verification_requests: ${error.message}`);
  return (data as unknown as VerificationRow[]).map(mapVerification);
}

// ─── Listings moderation ────────────────────────────────────────────────

export const ADMIN_LISTINGS_LIMIT = 200;

export interface ListingFilters {
  q: string;
  visibility: 'all' | ListingVisibility;
  kind: 'all' | 'real' | 'fictional';
}

interface AdminListingFeedRow {
  id: string;
  title: string;
  locality: string;
  owner_display_name: string;
  status: ListingStatus;
  admin_hidden: boolean;
  is_fictional: boolean;
  owner_verification: OwnerVerification;
  tech_assessment: TechAssessment;
  created_at: string;
}

/** Characters that could break out of a quoted PostgREST value or act as LIKE wildcards. */
const FILTER_SYNTAX = /[%*,()\\"]/g;

export async function getAdminListings(f: ListingFilters): Promise<{ rows: AdminListingRow[]; total: number }> {
  const supabase = await createClient();
  // listing_feed is security_invoker, so admin RLS returns hidden listings too.
  let query = supabase
    .from('listing_feed')
    .select(
      'id, title, locality, owner_display_name, status, admin_hidden, is_fictional, owner_verification, tech_assessment, created_at',
      { count: 'exact' },
    );
  // The three visibility values partition all listings (see ListingVisibility).
  if (f.visibility === 'admin_hidden') query = query.eq('admin_hidden', true);
  else if (f.visibility !== 'all') {
    query = query.eq('admin_hidden', false).eq('status', f.visibility === 'public' ? 'published' : 'hidden');
  }
  if (f.kind !== 'all') query = query.eq('is_fictional', f.kind === 'fictional');
  const term = f.q.replace(FILTER_SYNTAX, ' ').trim();
  if (term) {
    // Quoted, so reserved characters such as "." or ":" in the term are taken literally.
    const like = `"%${term}%"`;
    query = query.or(`title.ilike.${like},locality.ilike.${like},owner_display_name.ilike.${like}`);
  }
  const { data, error, count } = await query.order('created_at', { ascending: false }).limit(ADMIN_LISTINGS_LIMIT);
  if (error) throw new Error(`listing_feed: ${error.message}`);
  const rows = (data as AdminListingFeedRow[]).map((r) => ({
    id: r.id,
    title: r.title,
    locality: r.locality,
    ownerDisplayName: r.owner_display_name,
    status: r.status,
    adminHidden: r.admin_hidden,
    isFictional: r.is_fictional,
    ownerVerification: r.owner_verification,
    techAssessment: r.tech_assessment,
    createdAt: r.created_at,
  }));
  return { rows, total: count ?? rows.length };
}
