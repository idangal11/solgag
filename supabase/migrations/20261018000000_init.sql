-- ═══════════════════════════════════════════════════════════════════════
-- SolGag — initial schema
-- Rooftop listings (PostGIS), favorites, inquiries + message threads,
-- ownership verification requests, storage buckets, and row-level security.
--
-- Security model
--  • Every table has RLS enabled. anon can only read published listings/images.
--  • Trust-sensitive columns (owner_verification, is_fictional, owner_id,
--    polygon_illustrative, "assessed" tech status) can only be changed by an
--    admin or by privileged server code — enforced by triggers, not the UI.
--  • Polygon areas are recomputed server-side with PostGIS (geodesic m²).
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists postgis with schema extensions;

-- ─── Enums ────────────────────────────────────────────────────────────
create type public.user_role as enum ('owner', 'investor');
create type public.region as enum ('galilee', 'haifa', 'valleys', 'sharon', 'center', 'jerusalem', 'shfela', 'south', 'arava');
create type public.building_type as enum ('warehouse', 'factory', 'dairy', 'commercial', 'agri');
create type public.agreement_model as enum ('fixed_rent', 'revenue_share', 'open');
create type public.availability as enum ('available', 'in_talks', 'unavailable');
create type public.owner_verification as enum ('not_verified', 'pending', 'verified', 'rejected');
create type public.tech_assessment as enum ('not_assessed', 'owner_reported', 'survey_planned', 'assessed');
create type public.area_source as enum ('polygon', 'manual_measured', 'manual_estimate');
create type public.listing_status as enum ('published', 'hidden');
create type public.inquiry_role as enum ('investor', 'installer', 'other');
create type public.inquiry_status as enum ('new', 'in_progress', 'closed');
create type public.verification_status as enum ('pending', 'approved', 'rejected');

-- ─── Helpers ──────────────────────────────────────────────────────────
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ─── Profiles ─────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 100),
  phone text check (char_length(phone) <= 30),
  contact_email text check (char_length(contact_email) <= 254),
  role public.user_role not null default 'investor',
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, contact_email, phone, full_name)
  values (new.id, new.email, new.phone, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 100));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep the notification address in sync if the user changes their email.
create function public.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set contact_email = new.email where id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function public.handle_user_email_change();

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- True for API callers (anon/authenticated) that are not admins. Seed scripts,
-- migrations, the service role and SECURITY DEFINER functions are privileged.
-- NOTE: it reads current_user, so it must only be called from SECURITY INVOKER
-- trigger functions — inside a SECURITY DEFINER function it would always be false.
create function public.is_untrusted_caller() returns boolean
language sql stable set search_path = '' as $$
  select current_user in ('anon', 'authenticated') and not public.is_admin();
$$;

alter table public.profiles enable row level security;

create policy "profiles: read own (admins read all)" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, phone, role) on public.profiles to authenticated;

-- ─── Listings ─────────────────────────────────────────────────────────
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 4 and 120),
  locality text not null check (char_length(locality) between 2 and 80),
  region public.region not null,
  building_type public.building_type not null,
  location extensions.geography(Point, 4326) not null,
  footprint extensions.geography(Polygon, 4326),
  polygon_illustrative boolean not null default false,
  total_area_sqm numeric(10, 1) not null check (total_area_sqm between 50 and 500000),
  usable_area_sqm numeric(10, 1) not null check (usable_area_sqm > 0),
  area_source public.area_source not null,
  availability public.availability not null default 'available',
  agreement public.agreement_model not null,
  rent_per_sqm_year numeric(8, 2) check (rent_per_sqm_year between 0 and 1000),
  share_pct numeric(5, 2) check (share_pct > 0 and share_pct < 100),
  term_years smallint check (term_years between 1 and 50),
  terms_notes text not null default '' check (char_length(terms_notes) <= 1000),
  description text not null default '' check (char_length(description) <= 3000),
  owner_display_name text not null check (char_length(owner_display_name) between 2 and 100),
  owner_verification public.owner_verification not null default 'not_verified',
  tech_assessment public.tech_assessment not null default 'not_assessed',
  roof_type text check (char_length(roof_type) <= 120),
  shading text check (char_length(shading) <= 200),
  grid_connection text check (char_length(grid_connection) <= 200),
  roof_age_years smallint check (roof_age_years between 0 and 150),
  is_fictional boolean not null default false,
  status public.listing_status not null default 'published',
  declaration_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint usable_le_total check (usable_area_sqm <= total_area_sqm),
  constraint real_listing_has_owner check (is_fictional or (owner_id is not null and declaration_accepted_at is not null)),
  constraint rent_requires_fixed_model check (rent_per_sqm_year is null or agreement = 'fixed_rent'),
  constraint share_requires_share_model check (share_pct is null or agreement = 'revenue_share')
);

create index listings_location_idx on public.listings using gist (location);
create index listings_owner_idx on public.listings (owner_id);
create index listings_feed_idx on public.listings (status, created_at desc);

create function public.listings_guard() returns trigger
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
      -- Moving the building invalidates any ownership verification.
      if not extensions.st_equals(new.location::extensions.geometry, old.location::extensions.geometry)
         or new.footprint::text is distinct from old.footprint::text then
        if old.owner_verification in ('verified', 'pending') then
          new.owner_verification := 'not_verified';
        end if;
      end if;
    end if;
  end if;

  new.updated_at := now();
  return new;
end $$;

create trigger listings_guard before insert or update on public.listings
  for each row execute function public.listings_guard();

alter table public.listings enable row level security;

create policy "listings: read published, own, or admin" on public.listings
  for select to anon, authenticated
  using (status = 'published' or owner_id = (select auth.uid()) or public.is_admin());

create policy "listings: owners create" on public.listings
  for insert to authenticated
  with check (owner_id = (select auth.uid()) or public.is_admin());

create policy "listings: owners update" on public.listings
  for update to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin())
  with check (owner_id = (select auth.uid()) or public.is_admin());

create policy "listings: owners delete" on public.listings
  for delete to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin());

revoke insert, update, delete on public.listings from anon;

-- ─── Listing images ───────────────────────────────────────────────────
create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  storage_path text not null check (char_length(storage_path) <= 300),
  sort_order smallint not null default 0 check (sort_order between 0 and 50),
  created_at timestamptz not null default now()
);

create index listing_images_listing_idx on public.listing_images (listing_id, sort_order);

create function public.listing_images_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.listing_images where listing_id = new.listing_id) >= 8 then
    raise exception 'ניתן לצרף עד 8 תמונות למודעה' using errcode = '22023';
  end if;
  return new;
end $$;

create trigger listing_images_limit before insert on public.listing_images
  for each row execute function public.listing_images_limit();

alter table public.listing_images enable row level security;

create policy "listing_images: readable with listing" on public.listing_images
  for select to anon, authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id));

create policy "listing_images: owner adds own files" on public.listing_images
  for insert to authenticated
  with check (
    exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid()))
    and storage_path like (select auth.uid())::text || '/%'
  );

create policy "listing_images: owner or admin deletes" on public.listing_images
  for delete to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid()))
  );

revoke insert, update, delete on public.listing_images from anon;
revoke update on public.listing_images from authenticated;

-- ─── Public read model ────────────────────────────────────────────────
-- security_invoker: the caller's RLS on listings/listing_images applies.
create view public.listing_feed with (security_invoker = true) as
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
  coalesce(l.owner_id = auth.uid(), false) as is_mine,
  l.created_at,
  l.updated_at,
  coalesce(
    (select array_agg(i.storage_path order by i.sort_order, i.created_at)
       from public.listing_images i where i.listing_id = l.id),
    '{}'::text[]
  ) as image_paths
from public.listings l;

revoke all on public.listing_feed from anon, authenticated;
grant select on public.listing_feed to anon, authenticated;

-- ─── Favorites ────────────────────────────────────────────────────────
create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index favorites_listing_idx on public.favorites (listing_id);

alter table public.favorites enable row level security;

create policy "favorites: read own" on public.favorites
  for select to authenticated using (user_id = (select auth.uid()));
create policy "favorites: add own" on public.favorites
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "favorites: remove own" on public.favorites
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.favorites from anon;
revoke update on public.favorites from authenticated;

-- ─── Inquiries ────────────────────────────────────────────────────────
create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  sender_name text not null check (char_length(sender_name) between 2 and 100),
  sender_contact text not null check (char_length(sender_contact) between 5 and 254),
  sender_role public.inquiry_role not null default 'investor',
  message text not null check (char_length(message) between 5 and 2000),
  status public.inquiry_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inquiries_listing_idx on public.inquiries (listing_id, created_at desc);
create index inquiries_sender_idx on public.inquiries (sender_id, created_at desc);

-- SECURITY INVOKER on purpose (see is_untrusted_caller). The sender can see their
-- own inquiries under RLS, so the rate-limit count works without elevation.
create function public.inquiries_before_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.is_untrusted_caller() then
    new.sender_id := auth.uid();
    new.status := 'new';
    new.created_at := now();
    if (select count(*) from public.inquiries
         where sender_id = new.sender_id and created_at > now() - interval '1 hour') >= 10 then
      raise exception 'שלחת פניות רבות בזמן קצר. נסו שוב מאוחר יותר.' using errcode = '54000';
    end if;
  end if;
  return new;
end $$;

create trigger inquiries_before_insert before insert on public.inquiries
  for each row execute function public.inquiries_before_insert();
create trigger inquiries_updated_at before update on public.inquiries
  for each row execute function public.set_updated_at();

create function public.is_listing_owner(p_listing uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.listings l where l.id = p_listing and l.owner_id = auth.uid());
$$;

create function public.is_inquiry_participant(p_inquiry uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.inquiries i
      join public.listings l on l.id = i.listing_id
     where i.id = p_inquiry
       and (i.sender_id = auth.uid() or l.owner_id = auth.uid())
  );
$$;

alter table public.inquiries enable row level security;

create policy "inquiries: sender, listing owner, or admin reads" on public.inquiries
  for select to authenticated
  using (sender_id = (select auth.uid()) or public.is_listing_owner(listing_id) or public.is_admin());

create policy "inquiries: send to open, real listings of others" on public.inquiries
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.listings l
       where l.id = listing_id
         and l.status = 'published'
         and l.availability <> 'unavailable'
         and not l.is_fictional
         and l.owner_id is distinct from (select auth.uid())
    )
  );

create policy "inquiries: listing owner updates status" on public.inquiries
  for update to authenticated
  using (public.is_listing_owner(listing_id) or public.is_admin())
  with check (public.is_listing_owner(listing_id) or public.is_admin());

revoke all on public.inquiries from anon;
revoke update, delete on public.inquiries from authenticated;
grant update (status) on public.inquiries to authenticated;

-- ─── Inquiry messages (simple thread) ─────────────────────────────────
create table public.inquiry_messages (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index inquiry_messages_thread_idx on public.inquiry_messages (inquiry_id, created_at);

-- SECURITY INVOKER on purpose (see is_untrusted_caller).
create function public.inquiry_messages_before_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.is_untrusted_caller() then
    new.sender_id := auth.uid();
    new.created_at := now();
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

create trigger inquiry_messages_before_insert before insert on public.inquiry_messages
  for each row execute function public.inquiry_messages_before_insert();

alter table public.inquiry_messages enable row level security;

create policy "inquiry_messages: participants read" on public.inquiry_messages
  for select to authenticated
  using (public.is_inquiry_participant(inquiry_id) or public.is_admin());

create policy "inquiry_messages: participants write" on public.inquiry_messages
  for insert to authenticated
  with check (sender_id = (select auth.uid()) and public.is_inquiry_participant(inquiry_id));

revoke all on public.inquiry_messages from anon;
revoke update, delete on public.inquiry_messages from authenticated;

-- ─── Ownership verification ───────────────────────────────────────────
create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  document_path text not null check (char_length(document_path) <= 300),
  note text not null default '' check (char_length(note) <= 1000),
  status public.verification_status not null default 'pending',
  reviewer_id uuid references public.profiles (id) on delete set null,
  review_note text check (char_length(review_note) <= 1000),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index verification_requests_status_idx on public.verification_requests (status, created_at);
create index verification_requests_listing_idx on public.verification_requests (listing_id);

-- SECURITY INVOKER on purpose (see is_untrusted_caller).
create function public.verification_requests_before_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.is_untrusted_caller() then
    new.owner_id := auth.uid();
    new.status := 'pending';
    new.reviewer_id := null;
    new.review_note := null;
    new.reviewed_at := null;
    new.created_at := now();
    if exists (select 1 from public.verification_requests
                where listing_id = new.listing_id and status = 'pending') then
      raise exception 'כבר קיימת בקשת אימות ממתינה למודעה זו' using errcode = '23505';
    end if;
  end if;
  return new;
end $$;

create trigger verification_requests_before_insert before insert on public.verification_requests
  for each row execute function public.verification_requests_before_insert();

create function public.verification_requests_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.listings
     set owner_verification = 'pending'
   where id = new.listing_id and owner_verification in ('not_verified', 'rejected');
  return new;
end $$;

create trigger verification_requests_after_insert after insert on public.verification_requests
  for each row execute function public.verification_requests_after_insert();

alter table public.verification_requests enable row level security;

create policy "verification_requests: owner or admin reads" on public.verification_requests
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin());

create policy "verification_requests: owner submits for own listing" on public.verification_requests
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and public.is_listing_owner(listing_id)
    and document_path like (select auth.uid())::text || '/%'
  );

revoke all on public.verification_requests from anon;
revoke update, delete on public.verification_requests from authenticated;

-- Admin decision: the only path to owner_verification = 'verified'.
create function public.review_verification(p_request uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_listing uuid;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  update public.verification_requests
     set status = case when p_approve then 'approved'::public.verification_status else 'rejected'::public.verification_status end,
         reviewer_id = auth.uid(),
         review_note = left(p_note, 1000),
         reviewed_at = now()
   where id = p_request and status = 'pending'
  returning listing_id into v_listing;

  if v_listing is null then
    raise exception 'request not found or already reviewed' using errcode = 'P0002';
  end if;

  update public.listings
     set owner_verification = case when p_approve then 'verified'::public.owner_verification else 'rejected'::public.owner_verification end
   where id = v_listing;
end $$;

revoke execute on function public.review_verification(uuid, boolean, text) from public, anon;
grant execute on function public.review_verification(uuid, boolean, text) to authenticated;

-- ─── Storage ──────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-images', 'listing-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('ownership-docs', 'ownership-docs', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "listing-images: users upload into own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'listing-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "listing-images: users delete own files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "ownership-docs: users upload into own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ownership-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "ownership-docs: owner or admin reads" on storage.objects
  for select to authenticated
  using (bucket_id = 'ownership-docs' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));

-- ─── Privileges hygiene ───────────────────────────────────────────────
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;
-- TRUNCATE bypasses RLS; API roles never need it (nor TRIGGER/REFERENCES).
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
