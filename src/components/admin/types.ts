import type { ListingStatus, OwnerVerification, TechAssessment, VerificationStatus } from '@/lib/types';

// View models for the admin back-office, shared by the server pages
// (src/app/admin) and the client components that render their actions.

export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface AdminListingRow {
  id: string;
  title: string;
  locality: string;
  ownerDisplayName: string;
  status: ListingStatus;
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
