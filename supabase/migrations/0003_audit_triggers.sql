-- =====================================================================
-- 0003_audit_triggers.sql
-- Generic audit logging. One trigger function, attached to every
-- business table that matters for an audit trail (spec section 22).
-- SECURITY DEFINER so it can write to audit_logs even though no role
-- has an INSERT policy on that table (see 0002_rls_policies.sql).
-- =====================================================================

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name text;
  v_actor_role text;
  v_action text;
  v_entity_id uuid;
begin
  select full_name, role::text into v_actor_name, v_actor_role
  from public.profiles where id = auth.uid();

  if tg_op = 'INSERT' then
    v_action := 'created';
    v_entity_id := new.id;
    insert into public.audit_logs (actor_id, actor_name, actor_role, action, entity, entity_id, previous_value, new_value)
    values (auth.uid(), v_actor_name, v_actor_role, v_action, tg_table_name, v_entity_id, null, to_jsonb(new));
    return new;

  elsif tg_op = 'UPDATE' then
    v_action := 'updated';
    v_entity_id := new.id;
    insert into public.audit_logs (actor_id, actor_name, actor_role, action, entity, entity_id, previous_value, new_value)
    values (auth.uid(), v_actor_name, v_actor_role, v_action, tg_table_name, v_entity_id, to_jsonb(old), to_jsonb(new));
    return new;

  elsif tg_op = 'DELETE' then
    v_action := 'deleted';
    v_entity_id := old.id;
    insert into public.audit_logs (actor_id, actor_name, actor_role, action, entity, entity_id, previous_value, new_value)
    values (auth.uid(), v_actor_name, v_actor_role, v_action, tg_table_name, v_entity_id, to_jsonb(old), null);
    return old;
  end if;

  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['students','payments','attendance','tests','test_marks','batches','profiles','user_permissions']
  loop
    execute format(
      'drop trigger if exists trg_audit_%1$s on public.%1$s; create trigger trg_audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.write_audit_log();',
      t
    );
  end loop;
end $$;
