-- ═══════════════════════════════════════════════════════════════════════
-- Hardening after the first integration pass
--  1. Storage: owners can list/remove their own listing photos; owners can remove
--     ownership documents that no verification request references; admins can
--     remove both (listing deletion cleanup).
--  2. Verification integrity: moving a building cancels any pending ownership
--     request, and an approval is refused unless the listing is still 'pending'
--     — so an admin can never approve a request for a location that changed.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Storage policies ──────────────────────────────────────────────
create policy "listing-images: users read own files" on storage.objects
  for select to authenticated
  using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "listing-images: admins delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'listing-images' and public.is_admin());

create policy "ownership-docs: users delete own unreferenced files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'ownership-docs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (select 1 from public.verification_requests v where v.document_path = name)
  );

create policy "ownership-docs: admins delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'ownership-docs' and public.is_admin());

-- ─── 2. Verification integrity ────────────────────────────────────────
-- Callable by the listing owner (from the listings_guard trigger, which runs as
-- the caller) or an admin; a no-op for anyone else.
create function public.cancel_pending_verifications(p_listing uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.is_listing_owner(p_listing) or public.is_admin()) then
    return;
  end if;
  update public.verification_requests
     set status = 'rejected',
         review_note = 'בוטל אוטומטית: מיקום או גבולות המבנה שונו לאחר ההגשה',
         reviewed_at = now()
   where listing_id = p_listing and status = 'pending';
end $$;

revoke execute on function public.cancel_pending_verifications(uuid) from public, anon;
grant execute on function public.cancel_pending_verifications(uuid) to authenticated;

create or replace function public.listings_guard() returns trigger
language plpgsql set search_path = '' as $$
declare
  supported_area extensions.geometry := extensions.st_makeenvelope(34.2, 29.4, 35.95, 33.4, 4326);
begin
  -- Geometry sanity: inside Israel's bounding box, valid polygon.
  if not extensions.st_intersects(new.location::extensions.geometry, supported_area) then
    raise exception 'המיקום מחוץ לאזור הנתמך' using errcode = '22023';
  end if;

  if new.footprint is not null then
    if not extensions.st_isvalid(new.footprint::extensions.geometry) then
      raise exception 'פוליגון הגג אינו תקין (קווים חוצים?)' using errcode = '22023';
    end if;
    if not extensions.st_within(new.footprint::extensions.geometry, supported_area) then
      raise exception 'פוליגון הגג מחוץ לאזור הנתמך' using errcode = '22023';
    end if;
    if new.area_source = 'polygon' then
      -- Never trust a client-side area: recompute geodesic m² from the polygon.
      new.total_area_sqm := round(extensions.st_area(new.footprint)::numeric, 1);
      if new.total_area_sqm < 50 then
        raise exception 'שטח הגג שחושב מהשרטוט קטן מ-50 מ״ר' using errcode = '22023';
      end if;
      if new.usable_area_sqm > new.total_area_sqm then
        new.usable_area_sqm := new.total_area_sqm;
      end if;
    end if;
  elsif new.area_source = 'polygon' then
    raise exception 'מקור שטח "פוליגון" מחייב שרטוט גבולות' using errcode = '22023';
  end if;

  if public.is_untrusted_caller() then
    if tg_op = 'INSERT' then
      new.owner_id := auth.uid();
      new.owner_verification := 'not_verified';
      new.is_fictional := false;
      new.polygon_illustrative := false;
      new.created_at := now();
      -- The client only signals that the declaration was accepted; the server stamps the time.
      if new.declaration_accepted_at is not null then
        new.declaration_accepted_at := now();
      end if;
      if new.tech_assessment not in ('not_assessed', 'owner_reported') then
        new.tech_assessment := 'not_assessed';
      end if;
    else
      new.owner_id := old.owner_id;
      new.is_fictional := old.is_fictional;
      new.polygon_illustrative := old.polygon_illustrative;
      new.created_at := old.created_at;
      new.declaration_accepted_at := old.declaration_accepted_at;
      new.owner_verification := old.owner_verification;
      if new.tech_assessment is distinct from old.tech_assessment
         and (new.tech_assessment not in ('not_assessed', 'owner_reported')
              or old.tech_assessment not in ('not_assessed', 'owner_reported')) then
        new.tech_assessment := old.tech_assessment;
      end if;
      -- Moving the building invalidates any ownership verification, including a pending request.
      if not extensions.st_equals(new.location::extensions.geometry, old.location::extensions.geometry)
         or new.footprint::text is distinct from old.footprint::text then
        if old.owner_verification in ('verified', 'pending') then
          new.owner_verification := 'not_verified';
        end if;
        perform public.cancel_pending_verifications(new.id);
      end if;
    end if;
  end if;

  new.updated_at := now();
  return new;
end $$;

create or replace function public.review_verification(p_request uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_listing uuid;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  select listing_id into v_listing
    from public.verification_requests
   where id = p_request and status = 'pending'
   for update;

  if v_listing is null then
    raise exception 'הבקשה לא נמצאה או שכבר נבדקה' using errcode = 'P0002';
  end if;

  if p_approve and not exists (
    select 1 from public.listings where id = v_listing and owner_verification = 'pending'
  ) then
    raise exception 'המודעה השתנתה מאז הגשת המסמך — לא ניתן לאשר את הבקשה הזו' using errcode = '22023';
  end if;

  update public.verification_requests
     set status = case when p_approve then 'approved'::public.verification_status else 'rejected'::public.verification_status end,
         reviewer_id = auth.uid(),
         review_note = left(p_note, 1000),
         reviewed_at = now()
   where id = p_request;

  update public.listings
     set owner_verification = case when p_approve then 'verified'::public.owner_verification else 'rejected'::public.owner_verification end
   where id = v_listing;
end $$;
