-- =====================================================================
-- 0007_assistant_conversations.sql
-- Persists each admin's assistant conversation for later visits.
-- =====================================================================

create table if not exists public.assistant_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references public.profiles (id) on delete cascade,
  messages   jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

update public.profiles
set full_name = 'Vidhan Srivastava', updated_at = now()
where email = 'admin@demo.coaching';

alter table public.assistant_conversations enable row level security;

drop policy if exists assistant_conversations_select on public.assistant_conversations;
create policy assistant_conversations_select on public.assistant_conversations for select
  using (user_id = auth.uid() and public.is_admin());

drop policy if exists assistant_conversations_insert on public.assistant_conversations;
create policy assistant_conversations_insert on public.assistant_conversations for insert
  with check (user_id = auth.uid() and public.is_admin());

drop policy if exists assistant_conversations_update on public.assistant_conversations;
create policy assistant_conversations_update on public.assistant_conversations for update
  using (user_id = auth.uid() and public.is_admin())
  with check (user_id = auth.uid() and public.is_admin());