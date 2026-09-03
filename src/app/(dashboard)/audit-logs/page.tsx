import { History } from "lucide-react";
import { getSessionContext, requireModuleAccess } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { AuditLogFilters } from "@/components/shared/audit-log-filters";
import { AuditLogDetail } from "@/components/shared/audit-log-detail";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ACTION_VARIANT: Record<string, "success" | "info" | "danger"> = {
  created: "success", updated: "info", deleted: "danger",
};

const ENTITIES = ["students", "payments", "attendance", "tests", "test_marks", "batches", "profiles", "user_permissions"];

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; action?: string }>;
}) {
  const ctx = await getSessionContext();
  requireModuleAccess(ctx, "audit_logs", "view"); // admin-only

  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (params.entity) query = query.eq("entity", params.entity);
  if (params.action) query = query.eq("action", params.action);

  const { data: logs } = await query;

  return (
    <div>
      <PageHeader title="Audit Logs" description="Every create, update and delete across the system, with who and when." />

      <AuditLogFilters entities={ENTITIES} />

      {!logs || logs.length === 0 ? (
        <EmptyState icon={History} title="No matching activity" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDateTime(log.created_at)}</TableCell>
                <TableCell>
                  <p className="text-sm font-medium">{log.actor_name ?? "System"}</p>
                  {log.actor_role && <p className="text-xs text-muted-foreground capitalize">{log.actor_role}</p>}
                </TableCell>
                <TableCell><Badge variant={ACTION_VARIANT[log.action] ?? "neutral"} className="capitalize">{log.action}</Badge></TableCell>
                <TableCell className="text-sm capitalize">{log.entity.replace("_", " ")}</TableCell>
                <TableCell><AuditLogDetail log={log} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
