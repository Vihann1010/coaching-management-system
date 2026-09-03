import { createClient } from "@/lib/supabase/server";
import { getAppSettings } from "@/lib/settings";
import { computeFeeStatus } from "@/lib/calculations";
import { buildWorkbookBuffer, excelResponse, timestampedFilename, type ExcelColumn } from "@/lib/excel-export";
import { getSessionContext, requireModuleAccess } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Row {
  full_name: string; student_code: string; batch_name: string | null;
  final_fee: number; total_paid: number; pending_fee: number; fee_status: string; last_payment_date: string | null;
}

export async function GET(request: Request) {
  const ctx = await getSessionContext();
  requireModuleAccess(ctx, "fees", "view");

  const { searchParams } = new URL(request.url);
  const batch = searchParams.get("batch") ?? "";
  const onlyPending = searchParams.get("onlyPending") === "1";
  const sort = searchParams.get("sort") ?? ""; // "pending_desc" | "pending_asc" | "name"

  const supabase = await createClient();
  const settings = await getAppSettings();

  let query = supabase
    .from("students")
    .select("id, full_name, student_code, admission_date, final_fee, batch:batches(name)")
    .eq("is_active", true)
    .order("full_name")
    .limit(5000);

  if (batch) query = query.eq("batch_id", batch);

  const { data: students, error } = await query;
  if (error) return new Response("Failed to load students", { status: 500 });

  const studentIds = (students ?? []).map((s) => s.id);
  const { data: financials } = studentIds.length
    ? await supabase.from("student_financials").select("*").in("student_id", studentIds)
    : { data: [] };
  const finMap = new Map((financials ?? []).map((f) => [f.student_id, f]));

  let rows: Row[] = (students ?? []).map((s) => {
    const fin = finMap.get(s.id);
    const totalPaid = fin?.total_paid ?? 0;
    const pendingFee = fin?.pending_fee ?? s.final_fee;
    return {
      full_name: s.full_name, student_code: s.student_code,
      batch_name: (s.batch as unknown as { name: string } | null)?.name ?? null,
      final_fee: Number(s.final_fee), total_paid: Number(totalPaid), pending_fee: Number(pendingFee),
      fee_status: computeFeeStatus({
        finalFee: s.final_fee, totalPaid, lastPaymentDate: fin?.last_payment_date ?? null,
        admissionDate: s.admission_date, overdueDays: settings.fee_overdue_days,
      }),
      last_payment_date: fin?.last_payment_date ?? null,
    };
  });

  if (onlyPending) rows = rows.filter((r) => r.pending_fee > 0);
  if (sort === "pending_desc") rows.sort((a, b) => b.pending_fee - a.pending_fee);
  if (sort === "pending_asc") rows.sort((a, b) => a.pending_fee - b.pending_fee);

  const columns: ExcelColumn<Row>[] = [
    { header: "Student Name", key: "full_name", value: (r) => r.full_name, width: 24 },
    { header: "Student ID", key: "student_code", value: (r) => r.student_code, width: 14 },
    { header: "Batch", key: "batch_name", value: (r) => r.batch_name ?? "Unassigned", width: 18 },
    { header: "Final Fees", key: "final_fee", value: (r) => r.final_fee, width: 14, format: '"₹"#,##0' },
    { header: "Total Paid", key: "total_paid", value: (r) => r.total_paid, width: 14, format: '"₹"#,##0' },
    { header: "Pending", key: "pending_fee", value: (r) => r.pending_fee, width: 14, format: '"₹"#,##0' },
    { header: "Fee Status", key: "fee_status", value: (r) => r.fee_status, width: 16 },
    { header: "Last Payment", key: "last_payment_date", value: (r) => r.last_payment_date ?? "", width: 16 },
  ];

  const buffer = await buildWorkbookBuffer(onlyPending ? "Pending Fees" : "Fee Collection", columns, rows);
  return excelResponse(buffer, timestampedFilename(onlyPending ? "pending-fees" : "fee-collection"));
}
