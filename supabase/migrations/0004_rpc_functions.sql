-- =====================================================================
-- 0004_rpc_functions.sql
-- Bulk upsert helpers for attendance marking and marks entry
-- (spec sections 11 & 14: "make attendance marking / marks entry
-- extremely fast", "allow saving marks individually or in bulk").
--
-- These are SECURITY INVOKER (the default — stated explicitly for
-- clarity) so they run as the calling user and are still fully subject
-- to the RLS policies on public.attendance / public.test_marks. Using
-- a real INSERT ... ON CONFLICT DO UPDATE (rather than a naive upsert)
-- lets us preserve created_by/created_at on a row that already existed
-- while still updating updated_by/updated_at — a plain client-side
-- upsert would overwrite created_by with whoever saved most recently,
-- which would corrupt the audit trail.
-- =====================================================================

create or replace function public.upsert_attendance(rows jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.attendance (student_id, batch_id, attendance_date, status, created_by, updated_by)
  select
    (r ->> 'student_id')::uuid,
    (r ->> 'batch_id')::uuid,
    (r ->> 'attendance_date')::date,
    (r ->> 'status')::public.attendance_status,
    (r ->> 'created_by')::uuid,
    (r ->> 'updated_by')::uuid
  from jsonb_array_elements(rows) as r
  on conflict (student_id, attendance_date) do update
    set status = excluded.status,
        batch_id = excluded.batch_id,
        updated_by = excluded.updated_by,
        updated_at = now();
end;
$$;

create or replace function public.upsert_test_marks(rows jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.test_marks (test_id, student_id, marks_obtained, is_absent, created_by, updated_by)
  select
    (r ->> 'test_id')::uuid,
    (r ->> 'student_id')::uuid,
    nullif(r ->> 'marks_obtained', '')::numeric,
    coalesce((r ->> 'is_absent')::boolean, false),
    (r ->> 'created_by')::uuid,
    (r ->> 'updated_by')::uuid
  from jsonb_array_elements(rows) as r
  on conflict (test_id, student_id) do update
    set marks_obtained = excluded.marks_obtained,
        is_absent = excluded.is_absent,
        updated_by = excluded.updated_by,
        updated_at = now();
end;
$$;

grant execute on function public.upsert_attendance(jsonb) to authenticated;
grant execute on function public.upsert_test_marks(jsonb) to authenticated;
