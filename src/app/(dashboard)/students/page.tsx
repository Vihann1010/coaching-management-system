import Link from "next/link";
import { Suspense } from "react";
import { UserPlus, Download } from "lucide-react";
import { getSessionContext, requireModuleAccess } from "@/lib/session";
import { canEdit } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import StudentsTable from "./students-table";

export const dynamic = "force-dynamic";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await getSessionContext();
  requireModuleAccess(ctx, "students", "view");
  const canEditStudents = canEdit(
    { profile: ctx.profile, staffPermissions: ctx.staffPermissions, teacherBatchIds: ctx.teacherBatchIds },
    "students"
  );

  const params = await searchParams;

  const exportParams = new URLSearchParams();
  if (params.search) exportParams.set("search", params.search);
  if (params.batch) exportParams.set("batch", params.batch);
  if (params.feeStatus) exportParams.set("feeStatus", params.feeStatus);
  if (params.status) exportParams.set("status", params.status);

  return (
    <div>
      <PageHeader
        title="Students"
        description="Search, filter and manage your student roster."
        actions={
          <>
            <Button variant="outline" asChild>
              <a href={`/api/export/students?${exportParams.toString()}`}>
                <Download /> Export Excel
              </a>
            </Button>
            {canEditStudents && (
              <Button asChild>
                <Link href="/students/new"><UserPlus /> Add student</Link>
              </Button>
            )}
          </>
        }
      />
      <Suspense fallback={<StudentsTableSkeleton />}>
        <StudentsTable params={params} canEditStudents={canEditStudents} />
      </Suspense>
    </div>
  );
}

function StudentsTableSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-10 w-full max-w-xl" />
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Skeleton className="h-12 w-full rounded-none" />
        <div className="space-y-3 p-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}