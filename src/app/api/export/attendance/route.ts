import { createClient } from "@/lib/supabase/server";
import { buildWorkbookBuffer, excelResponse, timestampedFilename, type ExcelColumn } from "@/lib/excel-export";
import { getSessionContext, requireModuleAccess } from "@/lib/session";
import { unwrapEmbed } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Row {
  attendance_date: string; full_name: string; student_code: string; batch_name: string | null; status: string;
}

export async function GET(request: Request) {
  const ctx = await getSessionContext();
  requireModuleAccess(ctx, "attendance", "view");

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const batch = searchParams.get("batch");

  const supabase = await createClient();

  let query = supabase
    .from("attendance")
    .select("attendance_date, status, student:students(full_name, student_code), batch:batches(name)")
    .order("attendance_date", { ascending: false })
    .limit(20000);

  if (from) query = query.gte("attendance_date", from);
  if (to) query = query.lte("attendance_date", to);
  if (batch) query = query.eq("batch_id", batch);

  const { data, error } = await query;
  if (error) return new Response("Failed to load attendance", { status: 500 });

  const rows: Row[] = (data ?? []).map((a) => {
    const student = unwrapEmbed(a.student);
    const batch = unwrapEmbed(a.batch);
    return {
      attendance_date: a.attendance_date,
      full_name: student?.full_name ?? "—",
      student_code: student?.student_code ?? "—",
      batch_name: batch?.name ?? null,
      status: a.status === "present" ? "Present" : "Absent",
    };
  });

  const columns: ExcelColumn<Row>[] = [
    { header: "Date", key: "attendance_date", value: (r) => r.attendance_date, width: 14 },
    { header: "Student Name", key: "full_name", value: (r) => r.full_name, width: 24 },
    { header: "Student ID", key: "student_code", value: (r) => r.student_code, width: 14 },
    { header: "Batch", key: "batch_name", value: (r) => r.batch_name ?? "—", width: 18 },
    { header: "Status", key: "status", value: (r) => r.status, width: 12 },
  ];

  const buffer = await buildWorkbookBuffer("Attendance", columns, rows);
  return excelResponse(buffer, timestampedFilename("attendance"));
}
