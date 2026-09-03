-- =====================================================================
-- 0002_rls_policies.sql
-- Row Level Security — this is the REAL permission boundary. The
-- frontend also hides buttons/menus per role (see src/lib/permissions.ts)
-- but that is only a UX nicety; every policy below is what actually
-- stops an unauthorized request, per spec section 21.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so they can read `profiles`
-- without recursing back into the RLS policy that is calling them).
-- ---------------------------------------------------------------------
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() = 'admin';
$$;

create or replace function public.is_admin_or_accountant()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() in ('admin', 'accountant');
$$;

create or replace function public.teaches_batch(p_batch_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.teacher_batches
    where profile_id = auth.uid() and batch_id = p_batch_id
  );
$$;

create or replace function public.has_module_permission(p_module text, p_need text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case p_need when 'view' then can_view when 'edit' then can_edit else false end
     from public.user_permissions
     where profile_id = auth.uid() and module = p_module),
    false
  );
$$;

grant execute on function public.current_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin_or_accountant() to authenticated;
grant execute on function public.teaches_batch(uuid) to authenticated;
grant execute on function public.has_module_permission(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.batches            enable row level security;
alter table public.teacher_batches    enable row level security;
alter table public.user_permissions   enable row level security;
alter table public.students           enable row level security;
alter table public.payments           enable row level security;
alter table public.attendance         enable row level security;
alter table public.tests              enable row level security;
alter table public.test_marks         enable row level security;
alter table public.audit_logs         enable row level security;
alter table public.app_settings       enable row level security;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin on public.profiles for insert
  with check (public.is_admin());

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles for delete
  using (public.is_admin());

-- Prevent a non-admin from promoting themselves or reactivating their
-- own disabled account via the "update own profile" policy above.
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.role is distinct from old.role or new.is_active is distinct from old.is_active then
      raise exception 'Only an admin can change role or active status';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_self_role_escalation on public.profiles;
create trigger trg_prevent_self_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_self_role_escalation();

-- ---------------------------------------------------------------------
-- batches — readable by every authenticated user (needed for dropdowns),
-- writable by admin only.
-- ---------------------------------------------------------------------
drop policy if exists batches_select on public.batches;
create policy batches_select on public.batches for select
  using (auth.role() = 'authenticated');

drop policy if exists batches_write on public.batches;
create policy batches_write on public.batches for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- teacher_batches
-- ---------------------------------------------------------------------
drop policy if exists teacher_batches_select on public.teacher_batches;
create policy teacher_batches_select on public.teacher_batches for select
  using (profile_id = auth.uid() or public.is_admin());

drop policy if exists teacher_batches_write on public.teacher_batches;
create policy teacher_batches_write on public.teacher_batches for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- user_permissions
-- ---------------------------------------------------------------------
drop policy if exists user_permissions_select on public.user_permissions;
create policy user_permissions_select on public.user_permissions for select
  using (profile_id = auth.uid() or public.is_admin());

drop policy if exists user_permissions_write on public.user_permissions;
create policy user_permissions_write on public.user_permissions for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------
drop policy if exists students_select on public.students;
create policy students_select on public.students for select
  using (
    public.is_admin_or_accountant()
    or public.teaches_batch(batch_id)
    or public.has_module_permission('students', 'view')
  );

drop policy if exists students_insert on public.students;
create policy students_insert on public.students for insert
  with check (
    public.is_admin_or_accountant()
    or public.has_module_permission('students', 'edit')
  );

drop policy if exists students_update on public.students;
create policy students_update on public.students for update
  using (
    public.is_admin_or_accountant()
    or public.has_module_permission('students', 'edit')
  )
  with check (
    public.is_admin_or_accountant()
    or public.has_module_permission('students', 'edit')
  );

drop policy if exists students_delete on public.students;
create policy students_delete on public.students for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- payments — financial data. Teachers get NO access at all, by design.
-- ---------------------------------------------------------------------
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments for select
  using (
    public.is_admin_or_accountant()
    or public.has_module_permission('fees', 'view')
  );

drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments for insert
  with check (
    public.is_admin_or_accountant()
    or public.has_module_permission('fees', 'edit')
  );

drop policy if exists payments_update on public.payments;
create policy payments_update on public.payments for update
  using (
    public.is_admin_or_accountant()
    or public.has_module_permission('fees', 'edit')
  )
  with check (
    public.is_admin_or_accountant()
    or public.has_module_permission('fees', 'edit')
  );

drop policy if exists payments_delete on public.payments;
create policy payments_delete on public.payments for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- attendance
-- ---------------------------------------------------------------------
drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance for select
  using (
    public.is_admin()
    or public.teaches_batch(batch_id)
    or public.has_module_permission('attendance', 'view')
  );

drop policy if exists attendance_insert on public.attendance;
create policy attendance_insert on public.attendance for insert
  with check (
    public.is_admin()
    or public.teaches_batch(batch_id)
    or public.has_module_permission('attendance', 'edit')
  );

drop policy if exists attendance_update on public.attendance;
create policy attendance_update on public.attendance for update
  using (
    public.is_admin()
    or public.teaches_batch(batch_id)
    or public.has_module_permission('attendance', 'edit')
  )
  with check (
    public.is_admin()
    or public.teaches_batch(batch_id)
    or public.has_module_permission('attendance', 'edit')
  );

drop policy if exists attendance_delete on public.attendance;
create policy attendance_delete on public.attendance for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- tests
-- ---------------------------------------------------------------------
drop policy if exists tests_select on public.tests;
create policy tests_select on public.tests for select
  using (
    public.is_admin()
    or public.teaches_batch(batch_id)
    or public.has_module_permission('tests', 'view')
  );

drop policy if exists tests_insert on public.tests;
create policy tests_insert on public.tests for insert
  with check (
    public.is_admin()
    or public.teaches_batch(batch_id)
    or public.has_module_permission('tests', 'edit')
  );

drop policy if exists tests_update on public.tests;
create policy tests_update on public.tests for update
  using (
    public.is_admin()
    or public.teaches_batch(batch_id)
    or public.has_module_permission('tests', 'edit')
  )
  with check (
    public.is_admin()
    or public.teaches_batch(batch_id)
    or public.has_module_permission('tests', 'edit')
  );

drop policy if exists tests_delete on public.tests;
create policy tests_delete on public.tests for delete
  using (public.is_admin() or public.teaches_batch(batch_id));

-- ---------------------------------------------------------------------
-- test_marks (mirrors tests, joined via test_id)
-- ---------------------------------------------------------------------
drop policy if exists test_marks_select on public.test_marks;
create policy test_marks_select on public.test_marks for select
  using (
    public.is_admin()
    or exists (select 1 from public.tests t where t.id = test_id and public.teaches_batch(t.batch_id))
    or public.has_module_permission('tests', 'view')
  );

drop policy if exists test_marks_insert on public.test_marks;
create policy test_marks_insert on public.test_marks for insert
  with check (
    public.is_admin()
    or exists (select 1 from public.tests t where t.id = test_id and public.teaches_batch(t.batch_id))
    or public.has_module_permission('tests', 'edit')
  );

drop policy if exists test_marks_update on public.test_marks;
create policy test_marks_update on public.test_marks for update
  using (
    public.is_admin()
    or exists (select 1 from public.tests t where t.id = test_id and public.teaches_batch(t.batch_id))
    or public.has_module_permission('tests', 'edit')
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.tests t where t.id = test_id and public.teaches_batch(t.batch_id))
    or public.has_module_permission('tests', 'edit')
  );

drop policy if exists test_marks_delete on public.test_marks;
create policy test_marks_delete on public.test_marks for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- audit_logs — admin read-only. No insert/update/delete policy exists
-- for any application role; rows are written exclusively by the
-- SECURITY DEFINER trigger functions in 0003_audit_triggers.sql, which
-- run as the table owner and therefore bypass RLS.
-- ---------------------------------------------------------------------
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs for select
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- app_settings — readable by anyone (including logged-out visitors, so
-- the login page can show the coaching's name/logo), writable by admin
-- only. Nothing stored here is sensitive (see spec section 2 & 36).
-- ---------------------------------------------------------------------
drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings for select
  using (true);

drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_write on public.app_settings for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Views inherit the RLS of their underlying tables automatically in
-- Postgres when queried by a regular (non-owner) role, so
-- student_financials / student_attendance_summary / test_stats are
-- already protected by the policies above.
-- ---------------------------------------------------------------------
