import { Suspense } from "react";
import { getSessionContext } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardOverview from "./dashboard-overview";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await getSessionContext();

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${ctx.profile.full_name.split(" ")[0]}`}
        description="Here's what's happening at your coaching today."
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardOverview ctx={ctx} />
      </Suspense>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-20 w-full max-w-2xl rounded-lg" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  );
}