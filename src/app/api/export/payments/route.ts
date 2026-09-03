import { createClient } from "@/lib/supabase/server";
import { buildWorkbookBuffer, excelResponse, timestampedFilename, type ExcelColumn } from "@/lib/excel-export";
import { getSessionContext, requireModuleAccess } from "@/lib/session";
import { unwrapEmbed } from "@/lib/utils";
import type { PaymentMethod } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Row {
  payment_date: string; full_name: string; student_code: string; batch_name: string | null;
  amount: number; payment_method: PaymentMethod; reference_number: string | null; status: string;
}

export async function GET(request: Request) {
  const ctx = await getSessionContext();
  requireModuleAccess(ctx, "fees", "view");

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const batch = searchParams.get("batch");
  const method = searchParams.get("method");

  const supabase = await createClient();

  let query = supabase
    .from("payments")
    .select("payment_date, amount, payment_method, reference_number, is_voided, student:students!inner(full_name, student_code, batch_id, batch:batches(name))")
    .order("payment_date", { ascending: false })
    .limit(10000);

  if (from) query = query.gte("payment_date", from);
  if (to) query = query.lte("payment_date", to);
  if (batch) query = query.eq("student.batch_id", batch);
  if (method) query = query.eq("payment_method", method as PaymentMethod);

  const { data, error } = await query;
  if (error) return new Response("Failed to load payments", { status: 500 });

  const rows: Row[] = (data ?? []).map((p) => {
    const student = unwrapEmbed(p.student);
    const batch = student ? unwrapEmbed(student.batch) : null;
    return {
      payment_date: p.payment_date,
      full_name: student?.full_name ?? "—",
      student_code: student?.student_code ?? "—",
      batch_name: batch?.name ?? null,
      amount: Number(p.amount),
      payment_method: p.payment_method,
      reference_number: p.reference_number,
      status: p.is_voided ? "Voided" : "Recorded",
    };
  });

  const columns: ExcelColumn<Row>[] = [
    { header: "Date", key: "payment_date", value: (r) => r.payment_date, width: 14 },
    { header: "Student Name", key: "full_name", value: (r) => r.full_name, width: 24 },
    { header: "Student ID", key: "student_code", value: (r) => r.student_code, width: 14 },
    { header: "Batch", key: "batch_name", value: (r) => r.batch_name ?? "Unassigned", width: 18 },
    { header: "Amount", key: "amount", value: (r) => r.amount, width: 14, format: '"₹"#,##0' },
    { header: "Method", key: "payment_method", value: (r) => r.payment_method, width: 16 },
    { header: "Reference", key: "reference_number", value: (r) => r.reference_number ?? "", width: 20 },
    { header: "Status", key: "status", value: (r) => r.status, width: 12 },
  ];

  const buffer = await buildWorkbookBuffer("Payments", columns, rows);
  return excelResponse(buffer, timestampedFilename("payments"));
}
