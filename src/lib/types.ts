// Domain model shared by server and client code. DB rows are mapped into these
// shapes in src/lib/data/mappers.ts so UI code never depends on column names.

export type Region = 'galilee' | 'haifa' | 'valleys' | 'sharon' | 'center' | 'jerusalem' | 'shfela' | 'south' | 'arava';
export type BuildingType = 'warehouse' | 'factory' | 'dairy' | 'commercial' | 'agri';
export type AgreementModel = 'fixed_rent' | 'revenue_share' | 'open';
export type Availability = 'available' | 'in_talks' | 'unavailable';
export type OwnerVerification = 'not_verified' | 'pending' | 'verified' | 'rejected';
export type TechAssessment = 'not_assessed' | 'owner_reported' | 'survey_planned' | 'assessed';
export type AreaSource = 'polygon' | 'manual_measured' | 'manual_estimate';
export type ListingStatus = 'published' | 'hidden';
export type InquiryRole = 'investor' | 'installer' | 'other';
export type InquiryStatus = 'new' | 'in_progress' | 'closed';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';
export type UserRole = 'owner' | 'investor';

/** [lat, lng] — Leaflet order. */
export type LatLng = [number, number];

export interface Listing {
  id: string;
  title: string;
  locality: string;
  region: Region;
  buildingType: BuildingType;
  center: LatLng;
  /** Outer ring without the closing point; empty when no footprint was drawn. */
  polygon: LatLng[];
  polygonIllustrative: boolean;
  totalAreaSqm: number;
  usableAreaSqm: number;
  areaSource: AreaSource;
  availability: Availability;
  agreement: AgreementModel;
  terms: {
    rentPerSqmYear: number | null;
    sharePct: number | null;
    years: number | null;
    notes: string;
  };
  description: string;
  ownerDisplayName: string;
  ownerVerification: OwnerVerification;
  techAssessment: TechAssessment;
  tech: {
    roofType: string | null;
    shading: string | null;
    grid: string | null;
    roofAgeYears: number | null;
  };
  /** Public URLs of uploaded photos, in display order. */
  images: string[];
  isFictional: boolean;
  isMine: boolean;
  /** Owner-controlled visibility. */
  status: ListingStatus;
  /** Hidden by platform staff (moderation). Owners cannot undo it. */
  adminHidden: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Profile {
  id: string;
  fullName: string;
  phone: string | null;
  contactEmail: string | null;
  role: UserRole;
  isAdmin: boolean;
}

export interface Inquiry {
  id: string;
  listingId: string;
  listingTitle: string;
  senderName: string;
  senderContact: string;
  senderRole: InquiryRole;
  message: string;
  status: InquiryStatus;
  createdAt: string;
  /** true when the current user sent it, false when it was received on their listing */
  sentByMe: boolean;
}

export interface InquiryMessage {
  id: string;
  inquiryId: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

export interface VerificationRequest {
  id: string;
  listingId: string;
  listingTitle: string;
  documentPath: string;
  note: string;
  status: VerificationStatus;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}
