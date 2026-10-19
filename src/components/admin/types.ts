import type { ListingStatus, OwnerVerification, TechAssessment, VerificationStatus } from '@/lib/types';

// View models for the admin back-office, shared by the server pages
// (src/app/admin) and the client components that render their actions.

/**
 * Result of an admin Server Action. `stale` marks a failure caused by data that
 * changed since the page was rendered, so the client should refresh it.
 */
export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string; stale?: boolean };

/**
 * Who, if anyone, keeps a listing from the public. Every listing is in exactly one:
 * public = published by the owner and not hidden by staff; admin_hidden wins over
 * the owner's status; owner_hidden = hidden by the owner only.
 */
export type ListingVisibility = 'public' | 'owner_hidden' | 'admin_hidden';

export interface AdminListingRow {
  id: string;
  title: string;
  locality: string;
  ownerDisplayName: string;
  /** The owner's own published/hidden choice. */
  status: ListingStatus;
  /** Hidden by site staff (moderation). Owners cannot change it; it overrides `status`. */
  adminHidden: boolean;
  isFictional: boolean;
  ownerVerification: OwnerVerification;
  techAssessment: TechAssessment;
  createdAt: string;
}

export interface AdminVerificationItem {
  id: string;
  listingId: string;
  listingTitle: string;
  locality: string;
  ownerDisplayName: string;
  listingIsFictional: boolean;
  /** The listing's current badge, which the decision will change. */
  listingVerification: OwnerVerification | null;
  /** The submitting account (not the public display name). */
  accountName: string | null;
  accountEmail: string | null;
  note: string;
  status: VerificationStatus;
  reviewNote: string | null;
  reviewerName: string | null;
  createdAt: string;
  reviewedAt: string | null;
}
