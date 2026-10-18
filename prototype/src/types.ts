// Domain model. Kept serialisable so the same shapes can later come from an API.

export type Region =
  | 'galilee'
  | 'haifa'
  | 'valleys'
  | 'sharon'
  | 'center'
  | 'jerusalem'
  | 'shfela'
  | 'south'
  | 'arava';

export type BuildingType = 'warehouse' | 'factory' | 'dairy' | 'commercial' | 'agri';

export type AgreementModel = 'fixed_rent' | 'revenue_share' | 'open';

export type Availability = 'available' | 'in_talks' | 'unavailable';

export type OwnerVerification = 'not_verified' | 'pending' | 'self_declared';

export type TechAssessment = 'not_assessed' | 'owner_reported' | 'survey_planned';

export type AreaSource = 'polygon' | 'manual_measured' | 'manual_estimate';

/** [lat, lng] */
export type LatLng = [number, number];

export interface Terms {
  /** Requested fixed rent, ₪ per m² of usable area per year */
  rentPerSqmYear?: number;
  /** Requested owner share of distributable cash flow, % */
  sharePct?: number;
  /** Requested agreement length, years */
  years?: number;
  notes: string;
}

export interface TechInfo {
  roofType: string | null; // null = not assessed
  shading: string | null;
  grid: string | null;
  roofAgeYears: number | null;
}

export interface Listing {
  id: string;
  title: string;
  locality: string;
  region: Region;
  buildingType: BuildingType;
  center: LatLng;
  polygon: LatLng[];
  /** true for seeded / drawn-as-demo boundaries that are illustrative only */
  polygonIllustrative: boolean;
  totalAreaSqm: number;
  usableAreaSqm: number;
  areaSource: AreaSource;
  availability: Availability;
  agreement: AgreementModel;
  terms: Terms;
  description: string;
  ownerName: string;
  ownerVerification: OwnerVerification;
  techAssessment: TechAssessment;
  tech: TechInfo;
  images: string[]; // data URLs (user uploads); empty = use illustration
  createdAt: string;
  /** Created by the current demo user via "publish" */
  isMine: boolean;
  /** Seed listings are fictional */
  isFictional: boolean;
}

export interface Inquiry {
  id: string;
  listingId: string;
  listingTitle: string;
  name: string;
  contact: string;
  role: 'investor' | 'installer' | 'other';
  message: string;
  createdAt: string;
  /** 'sent' = submitted by the demo user; 'received' = simulated incoming inquiry on my listing */
  direction: 'sent' | 'received';
}

export type DemoRole = 'owner' | 'investor';
