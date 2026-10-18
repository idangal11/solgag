-- ═══════════════════════════════════════════════════════════════════════
-- Fixes from the adversarial security/correctness review
--  1. Footprint size limits (stored DoS) + listing creation rate limits.
--  2. admin_hidden: moderation that owners cannot undo.
--  3. Badges reset when the facts they vouch for change (verification: who/where;
--     technical assessment: where/roof data). Pending requests are cancelled by an
--     AFTER trigger (no RPC surface) — replaces cancel_pending_verifications().
--  4. Race-safe rate limits (per-user advisory locks around count-then-insert).
--  5. Storage: uploads only into <uid>/<owned listing id>/<file>, with per-folder
--     file caps; admins can read/delete listing photos; strict DB path format.
--  6. Anonymous callers cannot read listings.owner_id.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 2. admin_hidden column ───────────────────────────────────────────
alter table public.listings add column admin_hidden boolean not null default false;

-- ─── 1. Footprint limits (≤ 200 vertices + closing point, single ring) ─
alter table public.listings
  add constraint footprint_size_limit check (
    footprint is null
    or (extensions.st_npoints(footprint::extensions.geometry) <= 201
        and extensions.st_nrings(footprint::extensions.geometry) = 1)
  );

-- ─── 3. Guard trigger (replaces the hardening version) ────────────────
drop function if exists public.cancel_pending_verifications(uuid);

create or replace function public.listings_guard() returns trigger
language plpgsql set search_path = '' as $$
declare
  supported_area extensions.geometry := extensions.st_makeenvelope(34.2, 29.4, 35.95, 33.4, 4326);
  moved boolean;
begin
  -- Cheap size checks first, before any expensive geometry work.
  if new.footprint is not null
     and (extensions.st_npoints(new.footprint::extensions.geometry) > 201
          or extensions.st_nrings(new.footprint::extensions.geometry) <> 1) then
    raise exception 'פוליגון הגג מורכב מדי (עד 200 נקודות, ללא חורים)' using errcode = '22023';
  end if;

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
      -- Rate limits (serialised per user so parallel requests cannot race the count).
      perform pg_advisory_xact_lock(hashtextextended('listings-insert:' || auth.uid()::text, 0));
      if (select count(*) from public.listings where owner_id = auth.uid() and created_at > now() - interval '1 hour') >= 5 then
        raise exception 'פרסמת מודעות רבות בזמן קצר. נסו שוב מאוחר יותר.' using errcode = '54000';
      end if;
      if (select count(*) from public.listings where owner_id = auth.uid() and created_at > now() - interval '1 day') >= 20 then
        raise exception 'הגעת למספר המודעות המרבי ליום. נסו שוב מחר.' using errcode = '54000';
      end if;
      if (select count(*) from public.listings where owner_id = auth.uid()) >= 100 then
        raise exception 'הגעת למספר המודעות המרבי לחשבון. פנו אלינו להגדלת המכסה.' using errcode = '54000';
      end if;

      new.owner_id := auth.uid();
      new.owner_verification := 'not_verified';
      new.is_fictional := false;
      new.polygon_illustrative := false;
      new.admin_hidden := false;
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
      new.admin_hidden := old.admin_hidden;
      new.created_at := old.created_at;
      new.declaration_accepted_at := old.declaration_accepted_at;
      new.owner_verification := old.owner_verification;
      if new.tech_assessment is distinct from old.tech_assessment
         and (new.tech_assessment not in ('not_assessed', 'owner_reported')
              or old.tech_assessment not in ('not_assessed', 'owner_reported')) then
        new.tech_assessment := old.tech_assessment;
      end if;

      moved := not extensions.st_equals(new.location::extensions.geometry, old.location::extensions.geometry)
               or new.footprint::text is distinct from old.footprint::text;

      -- Ownership verification vouches for WHO offers WHICH building: reset it
      -- when the location, boundary, locality or publisher name changes.
      if (moved
          or new.locality is distinct from old.locality
          or new.owner_display_name is distinct from old.owner_display_name)
         and old.owner_verification in ('verified', 'pending') then
        new.owner_verification := 'not_verified';
      end if;

      -- A technical survey vouches for the roof data: downgrade it when that data changes.
      if (moved
          or new.roof_type is distinct from old.roof_type
          or new.shading is distinct from old.shading
          or new.grid_connection is distinct from old.grid_connection
          or new.roof_age_years is distinct from old.roof_age_years
          or new.total_area_sqm is distinct from old.total_area_sqm
          or new.usable_area_sqm is distinct from old.usable_area_sqm)
         and old.tech_assessment in ('assessed', 'survey_planned') then
        new.tech_assessment := 'owner_reported';
      end if;
    end if;
  end if;

  new.updated_at := now();
  return new;
end $$;

-- Cancels pending ownership requests once the guard has reset a 'pending'
-- listing. A trigger, not an RPC: owners cannot call it directly.
create function public.listings_after_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.owner_verification = 'pending' and new.owner_verification = 'not_verified' then
    update public.verification_requests
       set status = 'rejected',
           review_note = 'בוטל אוטומטית: פרטי הבעלות או מיקום המבנה שונו לאחר ההגשה',
           reviewed_at = now()
     where listing_id = new.id and status = 'pending';
  end if;
  return null;
end $$;

create trigger listings_after_update after update of owner_verification on public.listings
  for each row execute function public.listings_after_update();

revoke execute on function public.listings_after_update() from public, anon, authenticated;

-- ─── 2. Visibility with admin_hidden ──────────────────────────────────
drop policy "listings: read published, own, or admin" on public.listings;
create policy "listings: read published, own, or admin" on public.listings
  for select to anon, authenticated
  using ((status = 'published' and not admin_hidden) or owner_id = (select auth.uid()) or public.is_admin());

drop policy "inquiries: send to open, real listings of others" on public.inquiries;
create policy "inquiries: send to open, real listings of others" on public.inquiries
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.listings l
       where l.id = listing_id
         and l.status = 'published'
         and not l.admin_hidden
         and l.availability <> 'unavailable'
         and not l.is_fictional
         and l.owner_id is distinct from (select auth.uid())
    )
  );

-- Same columns/order as before (CREATE OR REPLACE requires it); is_mine no longer
-- reads owner_id so anon needs no privilege on it; admin_hidden appended.
create or replace view public.listing_feed with (security_invoker = true) as
select
  l.id,
  l.title,
  l.locality,
  l.region,
  l.building_type,
  extensions.st_y(l.location::extensions.geometry) as lat,
  extensions.st_x(l.location::extensions.geometry) as lng,
  case when l.footprint is null then null else extensions.st_asgeojson(l.footprint, 7)::jsonb end as footprint,
  l.polygon_illustrative,
  l.total_area_sqm,
  l.usable_area_sqm,
  l.area_source,
  l.availability,
  l.agreement,
  l.rent_per_sqm_year,
  l.share_pct,
  l.term_years,
  l.terms_notes,
  l.description,
  l.owner_display_name,
  l.owner_verification,
  l.tech_assessment,
  l.roof_type,
  l.shading,
  l.grid_connection,
  l.roof_age_years,
  l.is_fictional,
  l.status,
  case when (select auth.uid()) is null then false else public.is_listing_owner(l.id) end as is_mine,
  l.created_at,
  l.updated_at,
  coalesce(
    (select array_agg(i.storage_path order by i.sort_order, i.created_at)
       from public.listing_images i where i.listing_id = l.id),
    '{}'::text[]
  ) as image_paths,
  l.admin_hidden
from public.listings l;

-- ─── 6. Anonymous column privileges on listings ───────────────────────
revoke select on public.listings from anon;
grant select (
  id, title, locality, region, building_type, location, footprint, polygon_illustrative,
  total_area_sqm, usable_area_sqm, area_source, availability, agreement, rent_per_sqm_year,
  share_pct, term_years, terms_notes, description, owner_display_name, owner_verification,
  tech_assessment, roof_type, shading, grid_connection, roof_age_years, is_fictional, status,
  created_at, updated_at, admin_hidden
) on public.listings to anon;

-- ─── 4. Race-safe count-then-insert limits ────────────────────────────
create or replace function public.inquiries_before_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.is_untrusted_caller() then
    new.sender_id := auth.uid();
    new.status := 'new';
    new.created_at := now();
    perform pg_advisory_xact_lock(hashtextextended('inquiries-insert:' || new.sender_id::text, 0));
    if (select count(*) from public.inquiries
         where sender_id = new.sender_id and created_at > now() - interval '1 hour') >= 10 then
      raise exception 'שלחת פניות רבות בזמן קצר. נסו שוב מאוחר יותר.' using errcode = '54000';
    end if;
  end if;
  return new;
end $$;

create or replace function public.inquiry_messages_before_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.is_untrusted_caller() then
    new.sender_id := auth.uid();
    new.created_at := now();
    perform pg_advisory_xact_lock(hashtextextended('messages-insert:' || new.sender_id::text, 0));
    if (select count(*) from public.inquiry_messages
         where sender_id = new.sender_id and created_at > now() - interval '1 hour') >= 60 then
      raise exception 'נשלחו הודעות רבות בזמן קצר. נסו שוב מאוחר יותר.' using errcode = '54000';
    end if;
  end if;
  -- A reply from the listing owner moves a new inquiry to "in progress".
  update public.inquiries i
     set status = 'in_progress'
    from public.listings l
   where i.id = new.inquiry_id and l.id = i.listing_id
     and l.owner_id = new.sender_id and i.status = 'new';
  return new;
end $$;

create or replace function public.verification_requests_before_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.is_untrusted_caller() then
    new.owner_id := auth.uid();
    new.status := 'pending';
    new.reviewer_id := null;
    new.review_note := null;
    new.reviewed_at := null;
    new.created_at := now();
    perform pg_advisory_xact_lock(hashtextextended('verification-insert:' || new.listing_id::text, 0));
    if exists (select 1 from public.verification_requests
                where listing_id = new.listing_id and status = 'pending') then
      raise exception 'כבר קיימת בקשת אימות ממתינה למודעה זו' using errcode = '23505';
    end if;
  end if;
  return new;
end $$;

create or replace function public.listing_images_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('listing-images:' || new.listing_id::text, 0));
  if (select count(*) from public.listing_images where listing_id = new.listing_id) >= 8 then
    raise exception 'ניתן לצרף עד 8 תמונות למודעה' using errcode = '22023';
  end if;
  return new;
end $$;

-- ─── 5. Storage ───────────────────────────────────────────────────────
-- True when `name` is "<caller uid>/<listing id the caller owns>/<safe file name>"
-- and that folder holds fewer than p_max_files objects. SECURITY INVOKER: it
-- only sees the caller's own listings and own files (RLS), which is exactly
-- what it needs.
create function public.can_upload_listing_file(p_bucket text, p_name text, p_max_files int) returns boolean
language plpgsql stable set search_path = '' as $$
declare
  parts text[] := string_to_array(p_name, '/');
  v_listing uuid;
begin
  if auth.uid() is null or array_length(parts, 1) <> 3 then return false; end if;
  if parts[1] <> auth.uid()::text then return false; end if;
  if parts[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  if parts[3] !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$' or parts[3] like '%..%' then return false; end if;
  v_listing := parts[2]::uuid;
  if not exists (select 1 from public.listings l where l.id = v_listing and l.owner_id = auth.uid()) then
    return false;
  end if;
  return (select count(*) from storage.objects o
           where o.bucket_id = p_bucket and o.name like parts[1] || '/' || parts[2] || '/%') < p_max_files;
end $$;

drop policy "listing-images: users upload into own folder" on storage.objects;
create policy "listing-images: owners upload into own listing folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'listing-images' and public.can_upload_listing_file('listing-images', name, 12));

drop policy "ownership-docs: users upload into own folder" on storage.objects;
create policy "ownership-docs: owners upload into own listing folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ownership-docs' and public.can_upload_listing_file('ownership-docs', name, 10));

-- Storage remove() first looks the objects up, so admins need SELECT to delete photos.
create policy "listing-images: admins read" on storage.objects
  for select to authenticated
  using (bucket_id = 'listing-images' and public.is_admin());

-- DB rows must point at exactly <uid>/<listing>/<safe file name>.
drop policy "listing_images: owner adds own files" on public.listing_images;
create policy "listing_images: owner adds own files" on public.listing_images
  for insert to authenticated
  with check (
    exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid()))
    and storage_path ~ ('^' || (select auth.uid())::text || '/' || listing_id::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,120}$')
    and storage_path not like '%..%'
  );

drop policy "verification_requests: owner submits for own listing" on public.verification_requests;
create policy "verification_requests: owner submits for own listing" on public.verification_requests
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and public.is_listing_owner(listing_id)
    and document_path ~ ('^' || (select auth.uid())::text || '/' || listing_id::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,120}$')
    and document_path not like '%..%'
  );
