import { pointEWKT, polygonEWKT } from '@/lib/geo';
import type { TechAssessment } from '@/lib/types';
import type { ListingInput } from '@/lib/validation';

/**
 * Validated wizard input → public.listings insert/update object (snake_case).
 *
 * Trust-sensitive columns (owner_id, owner_verification, is_fictional,
 * polygon_illustrative) are deliberately absent: the listings_guard trigger
 * sets them for API callers. For area_source = 'polygon' the trigger also
 * recomputes total_area_sqm from the footprint with PostGIS.
 */
export function toListingRow(input: ListingInput) {
  const hasTech = [input.roofType, input.shading, input.grid, input.roofAgeYears].some((v) => v !== null);
  const techAssessment: TechAssessment = hasTech ? 'owner_reported' : 'not_assessed';

  return {
    owner_display_name: input.ownerDisplayName,
    title: input.title,
    building_type: input.buildingType,
    region: input.region,
    locality: input.locality,
    description: input.description,
    location: pointEWKT(input.location),
    footprint: input.polygon.length >= 3 ? polygonEWKT(input.polygon) : null,
    area_source: input.areaSource,
    total_area_sqm: input.totalAreaSqm,
    usable_area_sqm: input.usableAreaSqm,
    roof_type: input.roofType,
    shading: input.shading,
    grid_connection: input.grid,
    roof_age_years: input.roofAgeYears,
    tech_assessment: techAssessment,
    agreement: input.agreement,
    rent_per_sqm_year: input.agreement === 'fixed_rent' ? input.rentPerSqmYear : null,
    share_pct: input.agreement === 'revenue_share' ? input.sharePct : null,
    term_years: input.termYears,
    terms_notes: input.termsNotes,
    availability: input.availability,
    // The trigger stamps the server time on insert and keeps the original on update.
    declaration_accepted_at: new Date().toISOString(),
  };
}

export type ListingRow = ReturnType<typeof toListingRow>;
