-- Business-prospect pilot: large commercial roofs found in open building data,
-- and businesses publicly listed at or near them, for investors to approach.
--
-- ADMIN-ONLY. Every row is unverified research until a reviewer approves it:
-- nothing here is readable by anon or regular users, and nothing feeds the
-- public map. See research/prospects-emek-hefer-park/LICENSES-AND-CHECKS.md.
--
-- Accuracy rules enforced here:
--   * building confidence (prospect_roofs) is separate from business-match
--     confidence (prospect_businesses);
--   * a business is an occupant of unknown tenure unless evidence says otherwise
--     ("owner_evidence" requires a written evidence note);
--   * every stored website/phone/e-mail must carry the URL it was taken from;
--   * is_demo separates demonstration rows from real records;
--   * roof suitability starts as a preliminary, unverified estimate.

create type public.prospect_confidence as enum ('high', 'medium', 'low');
create type public.prospect_review as enum ('pending', 'approved', 'corrected', 'rejected');
create type public.prospect_relation as enum ('occupant_unverified', 'occupant_confirmed', 'owner_evidence', 'not_at_roof');

create table public.prospect_roofs (
  id uuid primary key default gen_random_uuid(),
  batch text not null check (batch ~ '^[a-z0-9-]{3,60}$'),
  ref text not null check (length(ref) between 1 and 40),
  -- Stable key in the source dataset (e.g. msbf:<lat>,<lon>), so re-imports update in place.
  source_key text not null check (length(source_key) between 1 and 120),
  is_demo boolean not null default false,
  footprint extensions.geography(Polygon, 4326) not null,
  centroid extensions.geography(Point, 4326) not null,
  -- Geodesic area of the footprint, computed by PostGIS on import (approximate roof area).
  area_m2 numeric(10, 1) not null check (area_m2 > 0),
  building_source text not null check (length(building_source) between 1 and 200),
  building_source_url text check (building_source_url ~ '^https?://'),
  building_license text not null check (length(building_license) between 1 and 100),
  building_confidence public.prospect_confidence not null,
  building_basis jsonb not null default '[]' check (jsonb_typeof(building_basis) = 'array'),
  building_evidence jsonb not null default '{}' check (jsonb_typeof(building_evidence) = 'object'),
  -- Best address; every candidate (with source, method and confidence) is kept in address_candidates.
  address_street text check (length(address_street) <= 120),
  address_house_number text check (length(address_house_number) <= 20),
  address_locality text check (length(address_locality) <= 120),
  address_source text check (length(address_source) <= 300),
  address_source_url text check (address_source_url ~ '^https?://'),
  address_method text check (length(address_method) <= 500),
  address_confidence public.prospect_confidence,
  address_candidates jsonb not null default '[]' check (jsonb_typeof(address_candidates) = 'array'),
  suitability text not null default 'preliminary_unverified'
    check (suitability in ('preliminary_unverified', 'plausible_after_review', 'unsuitable')),
  suitability_detail jsonb not null default '{}' check (jsonb_typeof(suitability_detail) = 'object'),
  review_status public.prospect_review not null default 'pending',
  review_note text check (length(review_note) <= 2000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch, ref),
  unique (batch, source_key),
  constraint prospect_roofs_address_has_source check (address_street is null or address_source is not null)
);

create index prospect_roofs_footprint_idx on public.prospect_roofs using gist (footprint);
create index prospect_roofs_batch_idx on public.prospect_roofs (batch, area_m2 desc);

create table public.prospect_businesses (
  id uuid primary key default gen_random_uuid(),
  roof_id uuid not null references public.prospect_roofs (id) on delete cascade,
  is_demo boolean not null default false,
  -- Identifies "the same business on the same roof" across re-imports.
  dedupe_key text not null check (length(dedupe_key) between 1 and 200),
  name text not null check (length(trim(name)) between 1 and 200),
  name_en text check (length(name_en) <= 200),
  category text check (length(category) <= 200),
  company_number text check (company_number ~ '^\d{9}$'),
  relation public.prospect_relation not null default 'occupant_unverified',
  relation_evidence text check (length(relation_evidence) <= 1000),
  match_confidence public.prospect_confidence not null,
  match_basis text not null check (length(match_basis) between 1 and 1000),
  business_address text check (length(business_address) <= 300),
  business_address_source_url text check (business_address_source_url ~ '^https?://'),
  website text check (website ~ '^https?://' and length(website) <= 500),
  website_source_url text check (website_source_url ~ '^https?://'),
  phone text check (length(phone) <= 40),
  phone_source_url text check (phone_source_url ~ '^https?://'),
  phone_snippet text check (length(phone_snippet) <= 300),
  email text check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 200),
  email_source_url text check (email_source_url ~ '^https?://'),
  email_snippet text check (length(email_snippet) <= 300),
  -- When the contact values were last re-checked against their source pages.
  contacts_checked_at timestamptz,
  sources jsonb not null default '[]' check (jsonb_typeof(sources) = 'array'),
  review_status public.prospect_review not null default 'pending',
  review_note text check (length(review_note) <= 2000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (roof_id, dedupe_key),
  -- A business at an address may be a tenant: "owner" needs written evidence.
  constraint prospect_businesses_owner_needs_evidence
    check (relation <> 'owner_evidence' or length(trim(coalesce(relation_evidence, ''))) >= 10),
  -- Never store a contact detail without the page it came from.
  constraint prospect_businesses_website_sourced check (website is null or website_source_url is not null),
  constraint prospect_businesses_phone_sourced check (phone is null or phone_source_url is not null),
  constraint prospect_businesses_email_sourced check (email is null or email_source_url is not null)
);

create index prospect_businesses_roof_idx on public.prospect_businesses (roof_id);

-- ─── Review stamps ──────────────────────────────────────────────────────
-- SECURITY INVOKER: runs as the calling admin, so auth.uid() is the reviewer.
create function public.prospects_touch() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and (new.review_status is distinct from old.review_status
      or new.review_note is distinct from old.review_note) then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

create trigger prospect_roofs_touch before update on public.prospect_roofs
  for each row execute function public.prospects_touch();
create trigger prospect_businesses_touch before update on public.prospect_businesses
  for each row execute function public.prospects_touch();

-- ─── Admin-only access ──────────────────────────────────────────────────
alter table public.prospect_roofs enable row level security;
alter table public.prospect_businesses enable row level security;

revoke all on public.prospect_roofs, public.prospect_businesses from anon;

create policy "prospect_roofs: admins only" on public.prospect_roofs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "prospect_businesses: admins only" on public.prospect_businesses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Read model with GeoJSON geometry. security_invoker: the RLS above applies.
create view public.prospect_roof_feed with (security_invoker = true) as
select
  r.id, r.batch, r.ref, r.source_key, r.is_demo,
  extensions.st_asgeojson(r.footprint, 7)::jsonb as footprint,
  extensions.st_y(r.centroid::extensions.geometry) as lat,
  extensions.st_x(r.centroid::extensions.geometry) as lng,
  r.area_m2, r.building_source, r.building_source_url, r.building_license, r.building_confidence,
  r.building_basis, r.building_evidence,
  r.address_street, r.address_house_number, r.address_locality, r.address_source, r.address_source_url,
  r.address_method, r.address_confidence, r.address_candidates,
  r.suitability, r.suitability_detail,
  r.review_status, r.review_note, r.reviewed_at, r.imported_at, r.updated_at
from public.prospect_roofs r;

revoke all on public.prospect_roof_feed from anon;

-- ─── Import ─────────────────────────────────────────────────────────────
-- Loads one research batch (JSON produced by research/prospects-*/build-import.mjs)
-- in a single transaction. Re-importing updates evidence in place but never
-- overwrites a reviewer's decision: reviewed roofs keep their address and
-- reviewed businesses are left untouched.
create function public.import_prospect_batch(p jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_batch text := p ->> 'batch';
  v_demo boolean := coalesce((p ->> 'isDemo')::boolean, false);
  r jsonb;
  b jsonb;
  v_geom extensions.geometry;
  v_roof uuid;
  n_roofs int := 0;
  n_businesses int := 0;
begin
  if not public.is_admin() then
    raise exception 'רק מנהלים יכולים לייבא נתוני פיילוט' using errcode = '42501';
  end if;
  if v_batch is null or v_batch !~ '^[a-z0-9-]{3,60}$' then
    raise exception 'שם האצווה בקובץ אינו תקין' using errcode = '22023';
  end if;
  if jsonb_typeof(p -> 'roofs') is distinct from 'array' or jsonb_array_length(p -> 'roofs') > 500 then
    raise exception 'הקובץ צריך לכלול רשימת גגות (עד 500)' using errcode = '22023';
  end if;

  for r in select value from jsonb_array_elements(p -> 'roofs') loop
    begin
      v_geom := extensions.st_setsrid(extensions.st_geomfromgeojson(r -> 'geometry'), 4326);
    exception when others then
      raise exception 'גבול הגג % אינו GeoJSON תקין', r ->> 'ref' using errcode = '22023';
    end;
    if extensions.geometrytype(v_geom) <> 'POLYGON' or not extensions.st_isvalid(v_geom)
       or extensions.st_npoints(v_geom) > 2000 then
      raise exception 'גבול הגג % אינו מצולע תקין', r ->> 'ref' using errcode = '22023';
    end if;

    insert into public.prospect_roofs as t (
      batch, ref, source_key, is_demo, footprint, centroid, area_m2,
      building_source, building_source_url, building_license, building_confidence, building_basis, building_evidence,
      address_street, address_house_number, address_locality, address_source, address_source_url, address_method,
      address_confidence, address_candidates, suitability_detail
    ) values (
      v_batch, r ->> 'ref', r ->> 'sourceKey', coalesce((r ->> 'isDemo')::boolean, v_demo),
      v_geom::extensions.geography,
      extensions.st_pointonsurface(v_geom)::extensions.geography,
      round(extensions.st_area(v_geom::extensions.geography)::numeric, 1),
      r ->> 'buildingSource', r ->> 'buildingSourceUrl', r ->> 'buildingLicense',
      (r ->> 'buildingConfidence')::public.prospect_confidence,
      coalesce(r -> 'buildingBasis', '[]'), coalesce(r -> 'buildingEvidence', '{}'),
      r #>> '{address,street}', r #>> '{address,houseNumber}', r #>> '{address,locality}',
      r #>> '{address,source}', r #>> '{address,sourceUrl}', r #>> '{address,method}',
      (r #>> '{address,confidence}')::public.prospect_confidence,
      coalesce(r -> 'addressCandidates', '[]'), coalesce(r -> 'suitability', '{}')
    )
    on conflict (batch, source_key) do update set
      ref = excluded.ref,
      is_demo = excluded.is_demo,
      footprint = excluded.footprint,
      centroid = excluded.centroid,
      area_m2 = excluded.area_m2,
      building_source = excluded.building_source,
      building_source_url = excluded.building_source_url,
      building_license = excluded.building_license,
      building_confidence = excluded.building_confidence,
      building_basis = excluded.building_basis,
      building_evidence = excluded.building_evidence,
      address_candidates = excluded.address_candidates,
      suitability_detail = excluded.suitability_detail,
      -- A reviewer's address choice wins over re-imported evidence.
      address_street = case when t.review_status = 'pending' then excluded.address_street else t.address_street end,
      address_house_number = case when t.review_status = 'pending' then excluded.address_house_number else t.address_house_number end,
      address_locality = case when t.review_status = 'pending' then excluded.address_locality else t.address_locality end,
      address_source = case when t.review_status = 'pending' then excluded.address_source else t.address_source end,
      address_source_url = case when t.review_status = 'pending' then excluded.address_source_url else t.address_source_url end,
      address_method = case when t.review_status = 'pending' then excluded.address_method else t.address_method end,
      address_confidence = case when t.review_status = 'pending' then excluded.address_confidence else t.address_confidence end,
      imported_at = now()
    returning id into v_roof;
    n_roofs := n_roofs + 1;

    for b in select value from jsonb_array_elements(coalesce(r -> 'businesses', '[]')) loop
      insert into public.prospect_businesses as t (
        roof_id, is_demo, dedupe_key, name, name_en, category, company_number, relation, relation_evidence,
        match_confidence, match_basis, business_address, business_address_source_url,
        website, website_source_url, phone, phone_source_url, phone_snippet,
        email, email_source_url, email_snippet, contacts_checked_at, sources
      ) values (
        v_roof, coalesce((b ->> 'isDemo')::boolean, (r ->> 'isDemo')::boolean, v_demo),
        b ->> 'dedupeKey', b ->> 'name', b ->> 'nameEn', b ->> 'category', b ->> 'companyNumber',
        coalesce(b ->> 'relation', 'occupant_unverified')::public.prospect_relation, b ->> 'relationEvidence',
        (b ->> 'matchConfidence')::public.prospect_confidence, b ->> 'matchBasis',
        b ->> 'businessAddress', b ->> 'businessAddressSourceUrl',
        b ->> 'website', b ->> 'websiteSourceUrl', b ->> 'phone', b ->> 'phoneSourceUrl', b ->> 'phoneSnippet',
        b ->> 'email', b ->> 'emailSourceUrl', b ->> 'emailSnippet',
        (b ->> 'contactsCheckedAt')::timestamptz, coalesce(b -> 'sources', '[]')
      )
      on conflict (roof_id, dedupe_key) do update set
        is_demo = excluded.is_demo, name = excluded.name, name_en = excluded.name_en, category = excluded.category,
        company_number = excluded.company_number, relation = excluded.relation, relation_evidence = excluded.relation_evidence,
        match_confidence = excluded.match_confidence, match_basis = excluded.match_basis,
        business_address = excluded.business_address, business_address_source_url = excluded.business_address_source_url,
        website = excluded.website, website_source_url = excluded.website_source_url,
        phone = excluded.phone, phone_source_url = excluded.phone_source_url, phone_snippet = excluded.phone_snippet,
        email = excluded.email, email_source_url = excluded.email_source_url, email_snippet = excluded.email_snippet,
        contacts_checked_at = excluded.contacts_checked_at, sources = excluded.sources, imported_at = now()
      -- Reviewed businesses are the reviewer's; a re-import never overwrites them.
      where t.review_status = 'pending';
      n_businesses := n_businesses + 1;
    end loop;
  end loop;

  return jsonb_build_object('batch', v_batch, 'roofs', n_roofs, 'businesses', n_businesses);
end;
$$;

revoke all on function public.import_prospect_batch(jsonb) from public, anon;
grant execute on function public.import_prospect_batch(jsonb) to authenticated;
