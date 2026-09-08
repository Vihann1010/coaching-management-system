import Link from "next/link";
import { Suspense } from "react";
import { Download, Search } from "lucide-react";
import { getSessionContext, requireModuleAccess } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import FeesTable from "./fees-table";

export const dynamic = "force-dynamic";

export default async function FeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await getSessionContext();
  requireModuleAccess(ctx, "fees", "view");

  const params = await searchParams;

  const exportParams = new URLSearchParams();
  for (const key of ["from", "to", "batch", "method"]) {
    if (params[key]) exportParams.set(key, params[key]!);
  }

  return (
    <div>
      <PageHeader
        title="Fees"
        description="Payment ledger across all students."
        actions={
          <>
            <Button variant="outline" asChild>
              <a href={`/api/export/payments?${exportParams.toString()}`}><Download /> Export Excel</a>
            </Button>
            <Button asChild>
              <Link href="/students?feeStatus=pending"><Search /> Find student to record payment</Link>
            </Button>
          </>
        }
      />
      <Suspense fallback={<FeesTableSkeleton />}>
        <FeesTable params={params} />
      </Suspense>
    </div>
  );
}

function FeesTableSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-10 w-full max-w-xl" />
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Skeleton className="h-12 w-full rounded-none" />
        <div className="space-y-3 p-4">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}