-- =====================================================================
-- 0005_realtime.sql
-- Adds the business tables to Supabase's realtime publication so
-- changes make one authorized device visible to another without a
-- manual refresh (spec section 23). RLS still applies to realtime
-- payloads — a user only receives change events for rows they're
-- allowed to SELECT.
-- =====================================================================

do $$
begin
  execute 'alter publication supabase_realtime add table public.students';
exception when duplicate_object then null; end $$;

do $$
begin
  execute 'alter publication supabase_realtime add table public.payments';
exception when duplicate_object then null; end $$;

do $$
begin
  execute 'alter publication supabase_realtime add table public.attendance';
exception when duplicate_object then null; end $$;

do $$
begin
  execute 'alter publication supabase_realtime add table public.tests';
exception when duplicate_object then null; end $$;

do $$
begin
  execute 'alter publication supabase_realtime add table public.test_marks';
exception when duplicate_object then null; end $$;

do $$
begin
  execute 'alter publication supabase_realtime add table public.batches';
exception when duplicate_object then null; end $$;
