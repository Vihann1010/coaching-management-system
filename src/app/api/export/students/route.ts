import { createClient } from "@/lib/supabase/server";
import { getAppSettings } from "@/lib/settings";
import { computeFeeStatus } from "@/lib/calculations";
import { buildWorkbookBuffer, excelResponse, timestampedFilename, type ExcelColumn } from "@/lib/excel-export";
import { getSessionContext, requireModuleAccess } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Row {
  student_code: string; full_name: string; father_name: string | null; mother_name: string | null;
  student_phone: string | null; primary_parent_phone: string | null; batch_name: string | null;
  admission_date: string; final_fee: number; total_paid: number; pending_fee: number; fee_status: string;
}

export async function GET(request: Request) {
  const ctx = await getSessionContext();
  requireModuleAccess(ctx, "students", "view");

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const batch = searchParams.get("batch") ?? "";
  const feeStatusFilter = searchParams.get("feeStatus") ?? "";
  const status = searchParams.get("status") ?? "active";

  const supabase = await createClient();
  const settings = await getAppSettings();

  let query = supabase
    .from("students")
    .select("id, student_code, full_name, father_name, mother_name, student_phone, primary_parent_phone, admission_date, final_fee, is_active, batch:batches(name)")
    .order("full_name")
    .limit(5000);

  if (status === "active") query = query.eq("is_active", true);
  if (status === "inactive") query = query.eq("is_active", false);
  if (batch) query = query.eq("batch_id", batch);
  if (search) {
    const esc = search.replace(/[%_]/g, "");
    query = query.or(
      `full_name.ilike.%${esc}%,father_name.ilike.%${esc}%,mother_name.ilike.%${esc}%,student_phone.ilike.%${esc}%,primary_parent_phone.ilike.%${esc}%,student_code.ilike.%${esc}%`
    );
  }

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
    const feeStatus = computeFeeStatus({
      finalFee: s.final_fee, totalPaid, lastPaymentDate: fin?.last_payment_date ?? null,
      admissionDate: s.admission_date, overdueDays: settings.fee_overdue_days,
    });
    return {
      student_code: s.student_code, full_name: s.full_name, father_name: s.father_name, mother_name: s.mother_name,
      student_phone: s.student_phone, primary_parent_phone: s.primary_parent_phone,
      batch_name: (s.batch as unknown as { name: string } | null)?.name ?? null,
      admission_date: s.admission_date, final_fee: Number(s.final_fee), total_paid: Number(totalPaid),
      pending_fee: Number(pendingFee), fee_status: feeStatus,
    };
  });

  if (feeStatusFilter) rows = rows.filter((r) => r.fee_status === feeStatusFilter);

  const columns: ExcelColumn<Row>[] = [
    { header: "Student ID", key: "student_code", value: (r) => r.student_code, width: 14 },
    { header: "Student Name", key: "full_name", value: (r) => r.full_name, width: 24 },
    { header: "Father's Name", key: "father_name", value: (r) => r.father_name ?? "", width: 20 },
    { header: "Mother's Name", key: "mother_name", value: (r) => r.mother_name ?? "", width: 20 },
    { header: "Student Phone", key: "student_phone", value: (r) => r.student_phone ?? "", width: 16 },
    { header: "Parent Phone", key: "primary_parent_phone", value: (r) => r.primary_parent_phone ?? "", width: 16 },
    { header: "Batch", key: "batch_name", value: (r) => r.batch_name ?? "Unassigned", width: 18 },
    { header: "Admission Date", key: "admission_date", value: (r) => r.admission_date, width: 16 },
    { header: "Final Fees", key: "final_fee", value: (r) => r.final_fee, width: 14, format: '"₹"#,##0' },
    { header: "Total Paid", key: "total_paid", value: (r) => r.total_paid, width: 14, format: '"₹"#,##0' },
    { header: "Pending Fees", key: "pending_fee", value: (r) => r.pending_fee, width: 14, format: '"₹"#,##0' },
    { header: "Fee Status", key: "fee_status", value: (r) => r.fee_status, width: 16 },
  ];

  const buffer = await buildWorkbookBuffer("Students", columns, rows);
  return excelResponse(buffer, timestampedFilename("students"));
}
