import { Suspense } from "react";
import { getSessionContext, requireModuleAccess } from "@/lib/session";
import { canEdit } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import TestsTable from "./tests-table";

export const dynamic = "force-dynamic";

export default async function TestsPage() {
  const ctx = await getSessionContext();
  requireModuleAccess(ctx, "tests", "view");
  const canCreate = canEdit(
    { profile: ctx.profile, staffPermissions: ctx.staffPermissions, teacherBatchIds: ctx.teacherBatchIds },
    "tests"
  );

  return (
    <div>
      <PageHeader
        title="Tests"
        description="Tests and class performance."
      />
      <Suspense fallback={<TestsTableSkeleton />}>
        <TestsTable ctx={ctx} canCreate={canCreate} />
      </Suspense>
    </div>
  );
}

function TestsTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Skeleton className="h-12 w-full rounded-none" />
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}