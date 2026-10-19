-- Fix: the trigger that cancels pending ownership requests never fired for owner
-- edits. It was declared "after update OF owner_verification", and Postgres only
-- fires column-specific triggers when the column is in the UPDATE's SET list —
-- here the column is changed by the BEFORE trigger (listings_guard), and
-- PostgREST PATCHes only list the edited columns. Use a WHEN condition instead.

drop trigger listings_after_update on public.listings;

create trigger listings_after_update after update on public.listings
  for each row
  when (old.owner_verification = 'pending' and new.owner_verification = 'not_verified')
  execute function public.listings_after_update();
