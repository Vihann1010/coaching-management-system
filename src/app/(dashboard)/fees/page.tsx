import Link from "next/link";
import { Wallet, AlertCircle, Download, Search } from "lucide-react";
import { getSessionContext, requireModuleAccess } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { FeesFilters } from "@/components/fees/fees-filters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { formatCurrency, formatDate, unwrapEmbed } from "@/lib/utils";
import type { PaymentMethod } from "@/types/database";

export const dynamic = "force-dynamic";

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash", upi: "UPI", bank_transfer: "Bank Transfer", card: "Card", other: "Other",
};

export default async function FeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await getSessionContext();
  requireModuleAccess(ctx, "fees", "view");

  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: batches }, { data: financials }] = await Promise.all([
    supabase.from("batches").select("id, name, code").order("name"),
    supabase.from("student_financials").select("pending_fee"),
  ]);

  let query = supabase
    .from("payments")
    .select("id, payment_date, amount, payment_method, reference_number, is_voided, student:students!inner(id, full_name, student_code, batch_id, batch:batches(name))")
    .order("payment_date", { ascending: false })
    .limit(500);

  if (params.from) query = query.gte("payment_date", params.from);
  if (params.to) query = query.lte("payment_date", params.to);
  if (params.batch) query = query.eq("student.batch_id", params.batch);
  if (params.method) query = query.eq("payment_method", params.method as PaymentMethod);

  const { data: paymentsRaw } = await query;
  const payments = (paymentsRaw ?? []).map((p) => {
    const student = unwrapEmbed(p.student);
    const batch = student ? unwrapEmbed(student.batch) : null;
    return { ...p, student, batch };
  });

  const nonVoided = payments.filter((p) => !p.is_voided);
  const totalInView = nonVoided.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPendingOverall = (financials ?? []).reduce((sum, f) => sum + Number(f.pending_fee), 0);

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

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Collected (in view)" value={formatCurrency(totalInView)} icon={Wallet} accent="success" />
        <StatCard label="Payments (in view)" value={nonVoided.length} icon={Wallet} accent="brand" />
        <StatCard label="Total Pending (all time)" value={formatCurrency(totalPendingOverall)} icon={AlertCircle} accent="warning" />
      </div>

      <FeesFilters batches={batches ?? []} />

      {payments.length === 0 ? (
        <EmptyState icon={Wallet} title="No payments found" description="Try widening your filters, or record a payment from a student's profile." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id} className={p.is_voided ? "opacity-50" : ""}>
                <TableCell className="text-sm">{formatDate(p.payment_date)}</TableCell>
                <TableCell>
                  <Link href={`/students/${p.student?.id}?tab=payments`} className="font-medium hover:text-primary">
                    {p.student?.full_name}
                  </Link>
                  <div className="text-xs text-muted-foreground tabular-nums">{p.student?.student_code}</div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.batch?.name ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{formatCurrency(p.amount)}</TableCell>
                <TableCell><Badge variant="brand">{METHOD_LABEL[p.payment_method as PaymentMethod]}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.reference_number || "—"}</TableCell>
                <TableCell>{p.is_voided ? <Badge variant="danger">Voided</Badge> : <Badge variant="success">Recorded</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
