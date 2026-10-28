import 'server-only';

import { fromGeoJSONPolygon } from '@/lib/geo';
import type { AddressCandidate, Confidence, ProspectBusiness, ProspectRoof, ProspectSource, Relation, ReviewStatus } from '@/lib/prospects';
import { createClient } from '@/lib/supabase/server';

// Admin-only reads for the business-prospect pilot. RLS (is_admin) applies:
// the tables and the security_invoker view return nothing to anyone else.

interface RoofFeedRow {
  id: string;
  batch: string;
  ref: string;
  is_demo: boolean;
  footprint: { type: string; coordinates: number[][][] } | null;
  lat: number;
  lng: number;
  area_m2: number | string;
  building_source: string;
  building_source_url: string | null;
  building_license: string;
  building_confidence: Confidence;
  building_basis: string[] | null;
  address_street: string | null;
  address_house_number: string | null;
  address_locality: string | null;
  address_source: string | null;
  address_source_url: string | null;
  address_method: string | null;
  address_confidence: Confidence | null;
  address_candidates: AddressCandidate[] | null;
  suitability: ProspectRoof['suitability'];
  suitability_detail: ProspectRoof['suitabilityDetail'] | null;
  review_status: ReviewStatus;
  review_note: string | null;
  reviewed_at: string | null;
}

interface BusinessRow {
  id: string;
  roof_id: string;
  is_demo: boolean;
  name: string;
  name_en: string | null;
  category: string | null;
  company_number: string | null;
  relation: Relation;
  relation_evidence: string | null;
  match_confidence: Confidence;
  match_basis: string;
  business_address: string | null;
  business_address_source_url: string | null;
  website: string | null;
  website_source_url: string | null;
  phone: string | null;
  phone_source_url: string | null;
  phone_snippet: string | null;
  email: string | null;
  email_source_url: string | null;
  email_snippet: string | null;
  contacts_checked_at: string | null;
  sources: ProspectSource[] | null;
  review_status: ReviewStatus;
  review_note: string | null;
}

const CONFIDENCE_RANK: Record<Confidence, number> = { high: 0, medium: 1, low: 2 };

export function mapBusiness(b: BusinessRow): ProspectBusiness {
  return {
    id: b.id,
    roofId: b.roof_id,
    isDemo: b.is_demo,
    name: b.name,
    nameEn: b.name_en,
    category: b.category,
    companyNumber: b.company_number,
    relation: b.relation,
    relationEvidence: b.relation_evidence,
    matchConfidence: b.match_confidence,
    matchBasis: b.match_basis,
    businessAddress: b.business_address,
    businessAddressSourceUrl: b.business_address_source_url,
    website: b.website,
    websiteSourceUrl: b.website_source_url,
    phone: b.phone,
    phoneSourceUrl: b.phone_source_url,
    phoneSnippet: b.phone_snippet,
    email: b.email,
    emailSourceUrl: b.email_source_url,
    emailSnippet: b.email_snippet,
    contactsCheckedAt: b.contacts_checked_at,
    sources: b.sources ?? [],
    reviewStatus: b.review_status,
    reviewNote: b.review_note,
  };
}

function mapRoof(r: RoofFeedRow, businesses: ProspectBusiness[]): ProspectRoof {
  return {
    id: r.id,
    batch: r.batch,
    ref: r.ref,
    isDemo: r.is_demo,
    polygon: fromGeoJSONPolygon(r.footprint),
    center: [r.lat, r.lng],
    areaM2: Number(r.area_m2),
    building: {
      source: r.building_source,
      sourceUrl: r.building_source_url,
      license: r.building_license,
      confidence: r.building_confidence,
      basis: r.building_basis ?? [],
    },
    address: r.address_street
      ? {
          street: r.address_street,
          houseNumber: r.address_house_number,
          locality: r.address_locality,
          source: r.address_source,
          sourceUrl: r.address_source_url,
          method: r.address_method,
          confidence: r.address_confidence,
        }
      : null,
    addressCandidates: r.address_candidates ?? [],
    suitability: r.suitability,
    suitabilityDetail: r.suitability_detail ?? {},
    reviewStatus: r.review_status,
    reviewNote: r.review_note,
    reviewedAt: r.reviewed_at,
    // Strongest match first; rejected candidates last.
    businesses: businesses.sort(
      (a, b) =>
        Number(a.reviewStatus === 'rejected') - Number(b.reviewStatus === 'rejected') ||
        CONFIDENCE_RANK[a.matchConfidence] - CONFIDENCE_RANK[b.matchConfidence] ||
        a.name.localeCompare(b.name, 'he'),
    ),
  };
}

const ROOF_COLUMNS =
  'id, batch, ref, is_demo, footprint, lat, lng, area_m2, building_source, building_source_url, building_license, ' +
  'building_confidence, building_basis, address_street, address_house_number, address_locality, address_source, ' +
  'address_source_url, address_method, address_confidence, address_candidates, suitability, suitability_detail, ' +
  'review_status, review_note, reviewed_at';

export const PROSPECT_ROOF_LIMIT = 1000;

/** All pilot roofs with their candidate businesses, largest roof first. */
export async function getProspectRoofs(): Promise<ProspectRoof[]> {
  const supabase = await createClient();
  const [roofs, businesses] = await Promise.all([
    supabase.from('prospect_roof_feed').select(ROOF_COLUMNS).order('area_m2', { ascending: false }).limit(PROSPECT_ROOF_LIMIT),
    supabase.from('prospect_businesses').select('*').limit(PROSPECT_ROOF_LIMIT * 10),
  ]);
  if (roofs.error) throw new Error(`prospect_roof_feed: ${roofs.error.message}`);
  if (businesses.error) throw new Error(`prospect_businesses: ${businesses.error.message}`);
  const byRoof = new Map<string, ProspectBusiness[]>();
  for (const b of businesses.data as BusinessRow[]) {
    const list = byRoof.get(b.roof_id) ?? [];
    list.push(mapBusiness(b));
    byRoof.set(b.roof_id, list);
  }
  return (roofs.data as unknown as RoofFeedRow[]).map((r) => mapRoof(r, byRoof.get(r.id) ?? []));
}
