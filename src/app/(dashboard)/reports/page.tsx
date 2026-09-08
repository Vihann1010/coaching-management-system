import Link from "next/link";
import { Suspense } from "react";
import { Download, TrendingUp, Wallet, AlertCircle, ClipboardList } from "lucide-react";
import { getSessionContext, requireModuleAccess } from "@/lib/session";
import { canView } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency, formatDate, cn, unwrapEmbed } from "@/lib/utils";
import type { PaymentMethod } from "@/types/database";

export const dynamic = "force-dynamic";

const REPORTS = [
  { key: "fee-collection", label: "Fee Collection", module: "fees" as const },
  { key: "pending-fees", label: "Pending Fees", module: "fees" as const },
  { key: "attendance", label: "Attendance", module: "attendance" as const },
  { key: "test-performance", label: "Test Performance", module: "tests" as const },
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await getSessionContext();
  requireModuleAccess(ctx, "reports", "view");
  const permCtx = { profile: ctx.profile, staffPermissions: ctx.staffPermissions, teacherBatchIds: ctx.teacherBatchIds };

  const params = await searchParams;
  const availableReports = REPORTS.filter((r) => canView(permCtx, r.module));
  const active = availableReports.find((r) => r.key === params.report)?.key ?? availableReports[0]?.key;

  return (
    <div>
      <PageHeader title="Reports" description="Fee, attendance and performance reports, all exportable to Excel." />

      {availableReports.length === 0 ? (
        <EmptyState icon={TrendingUp} title="No reports available" description="Ask your admin for access to Fees, Attendance or Tests." />
      ) : (
        <>
          <div className="flex flex-wrap gap-1 mb-6 border-b border-border">
            {availableReports.map((r) => (
              <Link
                key={r.key}
                href={`/reports?report=${r.key}`}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                  active === r.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {r.label}
              </Link>
            ))}
          </div>

          <Suspense fallback={<ReportsSkeleton />}>
            {active === "fee-collection" && <FeeCollectionReport />}
            {active === "pending-fees" && <PendingFeesReport />}
            {active === "attendance" && <AttendanceReport params={params} />}
            {active === "test-performance" && <TestPerformanceReport />}
          </Suspense>
        </>
      )}
    </div>
  );
}

async function FeeCollectionReport() {
  const supabase = await createClient();
  const [{ data: payments }, { data: financials }] = await Promise.all([
    supabase.from("payments").select("amount, payment_method, payment_date").eq("is_voided", false),
    supabase.from("student_financials").select("total_paid, pending_fee"),
  ]);

  const totalCollected = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const totalPending = (financials ?? []).reduce((s, f) => s + Number(f.pending_fee), 0);

  const byMethod = new Map<PaymentMethod, number>();
  for (const p of payments ?? []) {
    byMethod.set(p.payment_method as PaymentMethod, (byMethod.get(p.payment_method as PaymentMethod) ?? 0) + Number(p.amount));
  }

  const thisMonth = new Date().toISOString().slice(0, 7);
  const collectedThisMonth = (payments ?? [])
    .filter((p) => p.payment_date.startsWith(thisMonth))
    .reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button variant="outline" asChild><a href="/api/export/fees"><Download /> Export Excel</a></Button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Collected" value={formatCurrency(totalCollected)} icon={Wallet} accent="success" />
        <StatCard label="Total Pending" value={formatCurrency(totalPending)} icon={AlertCircle} accent="warning" />
        <StatCard label="Collected This Month" value={formatCurrency(collectedThisMonth)} icon={TrendingUp} accent="brand" />
        <StatCard label="Total Transactions" value={payments?.length ?? 0} icon={Wallet} accent="info" />
      </div>
      <Card>
        <CardHeader><CardTitle>Collection by payment method</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {[...byMethod.entries()].sort((a, b) => b[1] - a[1]).map(([method, amount]) => (
                <TableRow key={method}>
                  <TableCell className="capitalize">{method.replace("_", " ")}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatCurrency(amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

async function PendingFeesReport() {
  const supabase = await createClient();
  const { data: students } = await supabase
    .from("students")
    .select("id, full_name, student_code, batch:batches(name)")
    .eq("is_active", true)
    .order("full_name");

  const studentIds = (students ?? []).map((s) => s.id);
  const { data: financials } = studentIds.length
    ? await supabase.from("student_financials").select("*").in("student_id", studentIds)
    : { data: [] };
  const finMap = new Map((financials ?? []).map((f) => [f.student_id, f]));

  const rows = (students ?? [])
    .map((s) => ({ ...s, pending: finMap.get(s.id)?.pending_fee ?? 0 }))
    .filter((s) => s.pending > 0)
    .sort((a, b) => b.pending - a.pending);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{rows.length} student{rows.length === 1 ? "" : "s"} with pending fees, sorted by highest</p>
        <Button variant="outline" asChild><a href="/api/export/fees?onlyPending=1&sort=pending_desc"><Download /> Export Excel</a></Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={AlertCircle} title="No pending fees" description="Every active student is fully paid up." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow><TableHead>Student</TableHead><TableHead>Batch</TableHead><TableHead className="text-right">Pending</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <Link href={`/students/${s.id}`} className="font-medium hover:text-primary">{s.full_name}</Link>
                  <div className="text-xs text-muted-foreground tabular-nums">{s.student_code}</div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{unwrapEmbed(s.batch)?.name ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums font-medium text-[var(--danger)]">{formatCurrency(s.pending)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

async function AttendanceReport({ params }: { params: Record<string, string | undefined> }) {
  const supabase = await createClient();
  const { data: batches } = await supabase.from("batches").select("id, name").eq("is_active", true).order("name");

  // This is an async Server Component executed fresh per request (route
  // is `force-dynamic`), not a client render; there's no hydration to
  // desync since the date range is computed once on the server.
  // eslint-disable-next-line react-hooks/purity
  const from = params.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-CA");
  const to = params.to ?? new Date().toLocaleDateString("en-CA");

  const { data: rows } = await supabase
    .from("attendance")
    .select("status, batch:batches(id, name)")
    .gte("attendance_date", from)
    .lte("attendance_date", to);

  const byBatch = new Map<string, { name: string; present: number; absent: number }>();
  for (const r of rows ?? []) {
    const batch = unwrapEmbed(r.batch);
    const key = batch?.id ?? "unknown";
    const entry = byBatch.get(key) ?? { name: batch?.name ?? "Unknown", present: 0, absent: 0 };
    if (r.status === "present") entry.present++; else entry.absent++;
    byBatch.set(key, entry);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{formatDate(from)} to {formatDate(to)} across {batches?.length ?? 0} batches</p>
        <Button variant="outline" asChild><a href={`/api/export/attendance?from=${from}&to=${to}`}><Download /> Export Excel</a></Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow><TableHead>Batch</TableHead><TableHead className="text-right">Present</TableHead><TableHead className="text-right">Absent</TableHead><TableHead className="text-right">Attendance %</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {[...byBatch.values()].map((b) => {
            const total = b.present + b.absent;
            const pct = total ? Math.round((b.present / total) * 10000) / 100 : 0;
            return (
              <TableRow key={b.name}>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell className="text-right tabular-nums text-[var(--success)]">{b.present}</TableCell>
                <TableCell className="text-right tabular-nums text-[var(--danger)]">{b.absent}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{pct}%</TableCell>
              </TableRow>
            );
          })}
          {byBatch.size === 0 && (
            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No attendance recorded in this range.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

async function TestPerformanceReport() {
  const supabase = await createClient();
  const { data: tests } = await supabase
    .from("tests")
    .select("id, name, test_date, batch:batches(name)")
    .order("test_date", { ascending: false })
    .limit(50);

  const testIds = (tests ?? []).map((t) => t.id);
  const { data: stats } = testIds.length
    ? await supabase.from("test_stats").select("*").in("test_id", testIds)
    : { data: [] };
  const statsMap = new Map((stats ?? []).map((s) => [s.test_id, s]));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">Most recent {tests?.length ?? 0} tests</p>
        <Button variant="outline" asChild><a href="/api/export/tests"><Download /> Export Excel</a></Button>
      </div>
      {!tests || tests.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No tests yet" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow><TableHead>Test</TableHead><TableHead>Batch</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Average</TableHead><TableHead className="text-right">Highest</TableHead><TableHead className="text-right">Lowest</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {tests.map((t) => {
              const s = statsMap.get(t.id);
              return (
                <TableRow key={t.id}>
                  <TableCell><Link href={`/tests/${t.id}`} className="font-medium hover:text-primary">{t.name}</Link></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{unwrapEmbed(t.batch)?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(t.test_date)}</TableCell>
                  <TableCell className="text-right tabular-nums">{s?.average_percentage ?? "—"}{s?.average_percentage != null ? "%" : ""}</TableCell>
                  <TableCell className="text-right tabular-nums">{s?.highest_marks ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{s?.lowest_marks ?? "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Skeleton className="h-12 w-full rounded-none" />
        <div className="space-y-3 p-4">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}