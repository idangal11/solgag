import { publicImageUrl } from '@/lib/config';
import { fromGeoJSONPolygon } from '@/lib/geo';
import type {
  AgreementModel,
  AreaSource,
  Availability,
  BuildingType,
  Inquiry,
  InquiryMessage,
  InquiryRole,
  InquiryStatus,
  Listing,
  ListingStatus,
  OwnerVerification,
  Profile,
  Region,
  TechAssessment,
  UserRole,
  VerificationRequest,
  VerificationStatus,
} from '@/lib/types';

/** Row shape of the public.listing_feed view. */
export interface ListingFeedRow {
  id: string;
  title: string;
  locality: string;
  region: Region;
  building_type: BuildingType;
  lat: number;
  lng: number;
  footprint: { type: string; coordinates: number[][][] } | null;
  polygon_illustrative: boolean;
  total_area_sqm: number | string;
  usable_area_sqm: number | string;
  area_source: AreaSource;
  availability: Availability;
  agreement: AgreementModel;
  rent_per_sqm_year: number | string | null;
  share_pct: number | string | null;
  term_years: number | null;
  terms_notes: string;
  description: string;
  owner_display_name: string;
  owner_verification: OwnerVerification;
  tech_assessment: TechAssessment;
  roof_type: string | null;
  shading: string | null;
  grid_connection: string | null;
  roof_age_years: number | null;
  is_fictional: boolean;
  status: ListingStatus;
  is_mine: boolean;
  created_at: string;
  updated_at: string;
  image_paths: string[] | null;
}

const num = (v: number | string) => (typeof v === 'number' ? v : Number(v));
const numOrNull = (v: number | string | null) => (v === null || v === undefined ? null : num(v));

export function mapListing(r: ListingFeedRow): Listing {
  return {
    id: r.id,
    title: r.title,
    locality: r.locality,
    region: r.region,
    buildingType: r.building_type,
    center: [r.lat, r.lng],
    polygon: fromGeoJSONPolygon(r.footprint),
    polygonIllustrative: r.polygon_illustrative,
    totalAreaSqm: num(r.total_area_sqm),
    usableAreaSqm: num(r.usable_area_sqm),
    areaSource: r.area_source,
    availability: r.availability,
    agreement: r.agreement,
    terms: {
      rentPerSqmYear: numOrNull(r.rent_per_sqm_year),
      sharePct: numOrNull(r.share_pct),
      years: r.term_years,
      notes: r.terms_notes ?? '',
    },
    description: r.description ?? '',
    ownerDisplayName: r.owner_display_name,
    ownerVerification: r.owner_verification,
    techAssessment: r.tech_assessment,
    tech: {
      roofType: r.roof_type,
      shading: r.shading,
      grid: r.grid_connection,
      roofAgeYears: r.roof_age_years,
    },
    images: (r.image_paths ?? []).map(publicImageUrl),
    isFictional: r.is_fictional,
    isMine: r.is_mine,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export interface ProfileRow {
  id: string;
  full_name: string;
  phone: string | null;
  contact_email: string | null;
  role: UserRole;
  is_admin: boolean;
}

export function mapProfile(r: ProfileRow): Profile {
  return {
    id: r.id,
    fullName: r.full_name,
    phone: r.phone,
    contactEmail: r.contact_email,
    role: r.role,
    isAdmin: r.is_admin,
  };
}

export interface InquiryRow {
  id: string;
  listing_id: string;
  sender_id: string;
  sender_name: string;
  sender_contact: string;
  sender_role: InquiryRole;
  message: string;
  status: InquiryStatus;
  created_at: string;
  listings: { title: string } | { title: string }[] | null;
}

export function mapInquiry(r: InquiryRow, currentUserId: string): Inquiry {
  const listing = Array.isArray(r.listings) ? r.listings[0] : r.listings;
  return {
    id: r.id,
    listingId: r.listing_id,
    listingTitle: listing?.title ?? 'מודעה שהוסרה',
    senderName: r.sender_name,
    senderContact: r.sender_contact,
    senderRole: r.sender_role,
    message: r.message,
    status: r.status,
    createdAt: r.created_at,
    sentByMe: r.sender_id === currentUserId,
  };
}

export interface InquiryMessageRow {
  id: string;
  inquiry_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export function mapInquiryMessage(r: InquiryMessageRow, currentUserId: string): InquiryMessage {
  return { id: r.id, inquiryId: r.inquiry_id, body: r.body, createdAt: r.created_at, mine: r.sender_id === currentUserId };
}

export interface VerificationRequestRow {
  id: string;
  listing_id: string;
  document_path: string;
  note: string;
  status: VerificationStatus;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  listings: { title: string } | { title: string }[] | null;
}

export function mapVerificationRequest(r: VerificationRequestRow): VerificationRequest {
  const listing = Array.isArray(r.listings) ? r.listings[0] : r.listings;
  return {
    id: r.id,
    listingId: r.listing_id,
    listingTitle: listing?.title ?? '—',
    documentPath: r.document_path,
    note: r.note,
    status: r.status,
    reviewNote: r.review_note,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at,
  };
}
