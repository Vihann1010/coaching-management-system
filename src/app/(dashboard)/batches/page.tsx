import Link from "next/link";
import { Layers, Users } from "lucide-react";
import { getSessionContext, requireModuleAccess } from "@/lib/session";
import { canEdit } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ActiveStatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { BatchFormDialog } from "@/components/batches/batch-form-dialog";
import { BatchDeleteButton } from "@/components/batches/batch-delete-button";

export const dynamic = "force-dynamic";

export default async function BatchesPage() {
  const ctx = await getSessionContext();
  requireModuleAccess(ctx, "batches", "view");
  const canManage = canEdit(
    { profile: ctx.profile, staffPermissions: ctx.staffPermissions, teacherBatchIds: ctx.teacherBatchIds },
    "batches"
  );

  const supabase = await createClient();
  const [{ data: batches }, { data: studentCounts }] = await Promise.all([
    supabase.from("batches").select("*").order("name"),
    supabase.from("students").select("batch_id").eq("is_active", true),
  ]);

  const countByBatch = new Map<string, number>();
  for (const s of studentCounts ?? []) {
    if (s.batch_id) countByBatch.set(s.batch_id, (countByBatch.get(s.batch_id) ?? 0) + 1);
  }

  return (
    <div>
      <PageHeader
        title="Batches"
        description={`${batches?.length ?? 0} batch${(batches?.length ?? 0) === 1 ? "" : "es"}`}
        actions={canManage ? <BatchFormDialog /> : undefined}
      />

      {!batches || batches.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No batches yet"
          description="Create your first batch to start assigning students."
          action={canManage ? <BatchFormDialog /> : undefined}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {batches.map((b) => (
            <Card key={b.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-[family-name:var(--font-display)] font-bold truncate">{b.name}</h3>
                    <p className="text-xs text-muted-foreground tabular-nums">{b.code}</p>
                  </div>
                  <ActiveStatusBadge isActive={b.is_active} />
                </div>
                {b.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{b.description}</p>}
                <div className="flex items-center justify-between mt-4">
                  <Link
                    href={`/students?batch=${b.id}`}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <Users className="size-3.5" /> {countByBatch.get(b.id) ?? 0} students
                  </Link>
                  {canManage && (
                    <div className="flex gap-1">
                      <BatchFormDialog batch={b} />
                      <BatchDeleteButton batchId={b.id} batchName={b.name} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
