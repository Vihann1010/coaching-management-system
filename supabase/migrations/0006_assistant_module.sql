-- =====================================================================
-- 0006_assistant_module.sql
-- Registers "assistant" (the AI data-lookup chatbot) as a known
-- permission module, for consistency with users/settings/audit_logs.
-- It's admin-only in the application layer (see lib/permissions.ts),
-- exactly like those three, so this is a forward-compatibility/
-- consistency change rather than something that grants new access.
-- =====================================================================

alter table public.user_permissions drop constraint if exists user_permissions_module_check;

alter table public.user_permissions add constraint user_permissions_module_check
  check (module in
    ('students','fees','attendance','tests','batches','reports','users','settings','audit_logs','assistant'));
