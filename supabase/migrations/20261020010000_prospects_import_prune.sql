-- Business-prospect pilot: a re-import also removes the roof's still-pending
-- business matches that the new research file no longer contains (e.g. after
-- duplicate businesses were merged). Reviewed matches and matches a reviewer
-- added by hand (dedupe_key 'manual:…') are never removed.

create or replace function public.import_prospect_batch(p jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_batch text := p ->> 'batch';
  v_demo boolean := coalesce((p ->> 'isDemo')::boolean, false);
  r jsonb;
  b jsonb;
  v_geom extensions.geometry;
  v_roof uuid;
  v_keys text[];
  n_roofs int := 0;
  n_businesses int := 0;
  n_pruned int := 0;
  n int;
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

    v_keys := array(select x ->> 'dedupeKey' from jsonb_array_elements(coalesce(r -> 'businesses', '[]')) x);
    delete from public.prospect_businesses d
    where d.roof_id = v_roof
      and d.review_status = 'pending'
      and d.dedupe_key not like 'manual:%'
      and d.dedupe_key <> all (v_keys);
    get diagnostics n = row_count;
    n_pruned := n_pruned + n;

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
      where t.review_status = 'pending';
      n_businesses := n_businesses + 1;
    end loop;
  end loop;

  return jsonb_build_object('batch', v_batch, 'roofs', n_roofs, 'businesses', n_businesses, 'pruned', n_pruned);
end;
$$;

revoke all on function public.import_prospect_batch(jsonb) from public, anon;
grant execute on function public.import_prospect_batch(jsonb) to authenticated;
