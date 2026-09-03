-- =====================================================================
-- 0001_initial_schema.sql
-- Coaching Management System — core schema
-- Run this in the Supabase SQL Editor (or via `supabase db push`) on a
-- freshly created Supabase project, in order (0001, 0002, 0003, ...).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;    -- fast fuzzy/ILIKE search on names & phones

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('admin', 'accountant', 'teacher', 'staff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('cash', 'upi', 'bank_transfer', 'card', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attendance_status as enum ('present', 'absent');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- profiles — one row per authenticated user (mirrors auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  email       text not null,
  role        public.user_role not null default 'staff',
  phone       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Application user profile + role. 1:1 with auth.users.';

-- Auto-create a profile row whenever a new auth user signs up / is invited.
-- Role defaults to 'staff' — an admin must promote the user afterwards
-- (see README: "How to add teachers/accountants").
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'staff')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- batches
-- ---------------------------------------------------------------------
create table if not exists public.batches (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  code         text not null unique,
  description  text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.profiles (id) on delete set null,
  updated_by   uuid references public.profiles (id) on delete set null
);

-- ---------------------------------------------------------------------
-- teacher_batches — which batches a teacher is assigned to
-- ---------------------------------------------------------------------
create table if not exists public.teacher_batches (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  batch_id    uuid not null references public.batches (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (profile_id, batch_id)
);

-- ---------------------------------------------------------------------
-- user_permissions — per-module view/edit grants for the "staff" role
-- (extensible permission system so new modules/roles can plug in later)
-- ---------------------------------------------------------------------
create table if not exists public.user_permissions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  module      text not null check (module in
                ('students','fees','attendance','tests','batches','reports','users','settings','audit_logs')),
  can_view    boolean not null default true,
  can_edit    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (profile_id, module)
);

-- ---------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------
create sequence if not exists public.student_code_seq start 1;

create table if not exists public.students (
  id                      uuid primary key default gen_random_uuid(),
  student_code            text not null unique,
  full_name               text not null,
  father_name             text,
  mother_name             text,
  primary_parent_relation text default 'Father',
  student_phone           text,
  father_phone            text,
  mother_phone            text,
  primary_parent_phone    text,
  address                 text,
  batch_id                uuid references public.batches (id) on delete restrict,
  admission_date          date not null default current_date,
  original_fee            numeric(12,2) not null default 0 check (original_fee >= 0),
  discount                numeric(12,2) not null default 0 check (discount >= 0),
  final_fee               numeric(12,2) not null default 0 check (final_fee >= 0),
  is_active               boolean not null default true,
  deleted_at              timestamptz,
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  created_by              uuid references public.profiles (id) on delete set null,
  updated_by              uuid references public.profiles (id) on delete set null
);

create index if not exists idx_students_batch on public.students (batch_id);
create index if not exists idx_students_active on public.students (is_active);
create index if not exists idx_students_name_trgm on public.students using gin (full_name gin_trgm_ops);
create index if not exists idx_students_phone_trgm on public.students using gin (student_phone gin_trgm_ops);
create index if not exists idx_students_parent_phone_trgm on public.students using gin (primary_parent_phone gin_trgm_ops);

-- Auto-generate STU-0001, STU-0002, ... when student_code is not supplied.
create or replace function public.generate_student_code()
returns trigger
language plpgsql
as $$
begin
  if new.student_code is null or new.student_code = '' then
    new.student_code := 'STU-' || lpad(nextval('public.student_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_generate_student_code on public.students;
create trigger trg_generate_student_code
  before insert on public.students
  for each row execute function public.generate_student_code();

-- ---------------------------------------------------------------------
-- payments (installments)
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references public.students (id) on delete restrict,
  installment_number int not null,
  payment_date       date not null default current_date,
  amount             numeric(12,2) not null check (amount > 0),
  payment_method     public.payment_method not null default 'cash',
  reference_number   text,
  notes              text,
  is_voided          boolean not null default false,
  voided_reason      text,
  voided_by          uuid references public.profiles (id) on delete set null,
  voided_at          timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references public.profiles (id) on delete set null,
  updated_by         uuid references public.profiles (id) on delete set null,
  unique (student_id, installment_number)
);

create index if not exists idx_payments_student on public.payments (student_id);
create index if not exists idx_payments_date on public.payments (payment_date);

-- Auto-assign the next installment number per student (advisory-locked to
-- avoid a race if two staff record a payment for the same student at once).
create or replace function public.generate_installment_number()
returns trigger
language plpgsql
as $$
declare
  next_num int;
begin
  if new.installment_number is null then
    perform pg_advisory_xact_lock(hashtextextended(new.student_id::text, 0));
    select coalesce(max(installment_number), 0) + 1 into next_num
    from public.payments where student_id = new.student_id;
    new.installment_number := next_num;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_generate_installment_number on public.payments;
create trigger trg_generate_installment_number
  before insert on public.payments
  for each row execute function public.generate_installment_number();

-- ---------------------------------------------------------------------
-- attendance
-- ---------------------------------------------------------------------
create table if not exists public.attendance (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students (id) on delete restrict,
  batch_id         uuid not null references public.batches (id) on delete restrict,
  attendance_date  date not null,
  status           public.attendance_status not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references public.profiles (id) on delete set null,
  updated_by       uuid references public.profiles (id) on delete set null,
  unique (student_id, attendance_date)
);

create index if not exists idx_attendance_batch_date on public.attendance (batch_id, attendance_date);
create index if not exists idx_attendance_student on public.attendance (student_id);

-- ---------------------------------------------------------------------
-- tests
-- ---------------------------------------------------------------------
create table if not exists public.tests (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  topic        text,
  test_date    date not null default current_date,
  batch_id     uuid not null references public.batches (id) on delete restrict,
  max_marks    numeric(6,2) not null check (max_marks > 0),
  description  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.profiles (id) on delete set null,
  updated_by   uuid references public.profiles (id) on delete set null
);

create index if not exists idx_tests_batch on public.tests (batch_id);
create index if not exists idx_tests_date on public.tests (test_date);

-- ---------------------------------------------------------------------
-- test_marks
-- ---------------------------------------------------------------------
create table if not exists public.test_marks (
  id              uuid primary key default gen_random_uuid(),
  test_id         uuid not null references public.tests (id) on delete cascade,
  student_id      uuid not null references public.students (id) on delete restrict,
  marks_obtained  numeric(6,2) check (marks_obtained is null or marks_obtained >= 0),
  is_absent       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id) on delete set null,
  updated_by      uuid references public.profiles (id) on delete set null,
  unique (test_id, student_id)
);

create index if not exists idx_test_marks_test on public.test_marks (test_id);
create index if not exists idx_test_marks_student on public.test_marks (student_id);

-- Enforce marks_obtained <= tests.max_marks at the database level too
-- (never trust the frontend alone — see spec section 21).
create or replace function public.validate_test_marks()
returns trigger
language plpgsql
as $$
declare
  v_max numeric(6,2);
begin
  if new.marks_obtained is not null then
    select max_marks into v_max from public.tests where id = new.test_id;
    if new.marks_obtained > v_max then
      raise exception 'marks_obtained (%) cannot exceed max_marks (%) for this test', new.marks_obtained, v_max;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_test_marks on public.test_marks;
create trigger trg_validate_test_marks
  before insert or update on public.test_marks
  for each row execute function public.validate_test_marks();

-- ---------------------------------------------------------------------
-- audit_logs (append-only — write access is via SECURITY DEFINER trigger
-- functions only, see 0003_audit_triggers.sql)
-- ---------------------------------------------------------------------
create table if not exists public.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  actor_id        uuid references public.profiles (id) on delete set null,
  actor_name      text,
  actor_role      text,
  action          text not null,       -- created | updated | deleted | voided
  entity          text not null,       -- table name
  entity_id       uuid,
  previous_value  jsonb,
  new_value       jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_audit_entity on public.audit_logs (entity, entity_id);
create index if not exists idx_audit_actor on public.audit_logs (actor_id);
create index if not exists idx_audit_created on public.audit_logs (created_at desc);

-- ---------------------------------------------------------------------
-- app_settings — simple key/value store for branding & config
-- ---------------------------------------------------------------------
create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id) on delete set null
);

insert into public.app_settings (key, value) values
  ('coaching_name', '"My Coaching Institute"'),
  ('logo_url', 'null'),
  ('contact_email', '""'),
  ('contact_phone', '""'),
  ('academic_session', '"2026-27"'),
  ('currency', '"INR"'),
  ('fee_overdue_days', '30')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- updated_at auto-touch trigger (generic, reused on every table below)
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['profiles','batches','students','payments','attendance','tests','test_marks','user_permissions']
  loop
    execute format(
      'drop trigger if exists trg_set_updated_at on public.%I; create trigger trg_set_updated_at before update on public.%I for each row execute function public.set_updated_at();',
      t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Views — centralised calculations so the frontend never re-derives
-- financial or attendance math in more than one place.
-- ---------------------------------------------------------------------

-- NOTE on security_invoker: by default a Postgres view runs with the
-- privileges of whoever OWNS the view (the migration role, effectively
-- an admin), not the querying user — which would silently bypass every
-- RLS policy above. `security_invoker = true` (Postgres 15+, supported
-- by Supabase) makes each view re-check RLS as the actual caller. This
-- is required, not optional, for these views to be safe to expose.

-- Per-student fee totals (never negative — see spec section 9).
create or replace view public.student_financials
with (security_invoker = true) as
select
  s.id as student_id,
  s.final_fee,
  coalesce(sum(p.amount) filter (where not p.is_voided), 0) as total_paid,
  greatest(s.final_fee - coalesce(sum(p.amount) filter (where not p.is_voided), 0), 0) as pending_fee,
  max(p.payment_date) filter (where not p.is_voided) as last_payment_date
from public.students s
left join public.payments p on p.student_id = s.id
group by s.id, s.final_fee;

-- Per-student attendance totals.
create or replace view public.student_attendance_summary
with (security_invoker = true) as
select
  student_id,
  count(*) as total_classes,
  count(*) filter (where status = 'present') as present_count,
  count(*) filter (where status = 'absent') as absent_count,
  case when count(*) = 0 then 0
       else round(100.0 * count(*) filter (where status = 'present') / count(*), 2)
  end as attendance_percentage
from public.attendance
group by student_id;

-- Per-test aggregate stats (spec section 15).
create or replace view public.test_stats
with (security_invoker = true) as
select
  t.id as test_id,
  t.name,
  t.batch_id,
  t.max_marks,
  count(tm.id) filter (where not tm.is_absent) as appeared_count,
  count(tm.id) filter (where tm.is_absent) as absent_count,
  max(tm.marks_obtained) filter (where not tm.is_absent) as highest_marks,
  min(tm.marks_obtained) filter (where not tm.is_absent) as lowest_marks,
  round(avg(tm.marks_obtained) filter (where not tm.is_absent), 2) as average_marks,
  case when t.max_marks > 0 and count(tm.id) filter (where not tm.is_absent) > 0
       then round(avg(tm.marks_obtained) filter (where not tm.is_absent) / t.max_marks * 100, 2)
       else null
  end as average_percentage
from public.tests t
left join public.test_marks tm on tm.test_id = t.id
group by t.id, t.name, t.batch_id, t.max_marks;
