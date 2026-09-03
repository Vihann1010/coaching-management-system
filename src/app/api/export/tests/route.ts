import { createClient } from "@/lib/supabase/server";
import { computeMarkPercentage } from "@/lib/calculations";
import { buildWorkbookBuffer, excelResponse, timestampedFilename, type ExcelColumn } from "@/lib/excel-export";
import { getSessionContext, requireModuleAccess } from "@/lib/session";
import { unwrapEmbed } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Row {
  test_name: string; topic: string | null; test_date: string; batch_name: string | null;
  max_marks: number; full_name: string; marks_obtained: number | null; percentage: number | null; status: string;
}

export async function GET(request: Request) {
  const ctx = await getSessionContext();
  requireModuleAccess(ctx, "tests", "view");

  const { searchParams } = new URL(request.url);
  const testId = searchParams.get("testId");
  const batch = searchParams.get("batch");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const supabase = await createClient();

  let testsQuery = supabase.from("tests").select("id, name, topic, test_date, max_marks, batch:batches(name)");
  if (testId) testsQuery = testsQuery.eq("id", testId);
  if (batch) testsQuery = testsQuery.eq("batch_id", batch);
  if (from) testsQuery = testsQuery.gte("test_date", from);
  if (to) testsQuery = testsQuery.lte("test_date", to);

  const { data: tests, error: testsError } = await testsQuery;
  if (testsError) return new Response("Failed to load tests", { status: 500 });

  const testIds = (tests ?? []).map((t) => t.id);
  const { data: marks, error: marksError } = testIds.length
    ? await supabase
        .from("test_marks")
        .select("test_id, marks_obtained, is_absent, student:students(full_name, student_code)")
        .in("test_id", testIds)
    : { data: [], error: null };
  if (marksError) return new Response("Failed to load marks", { status: 500 });

  const testMap = new Map((tests ?? []).map((t) => [t.id, { ...t, batch: unwrapEmbed(t.batch) }]));
  const rows: Row[] = (marks ?? []).map((m) => {
    const t = testMap.get(m.test_id)!;
    const student = unwrapEmbed(m.student);
    const marksObtained = m.marks_obtained !== null ? Number(m.marks_obtained) : null;
    return {
      test_name: t.name, topic: t.topic, test_date: t.test_date, batch_name: t.batch?.name ?? null,
      max_marks: Number(t.max_marks), full_name: student?.full_name ?? "—",
      marks_obtained: marksObtained, status: m.is_absent ? "Absent" : "Present",
      percentage: m.is_absent || marksObtained === null ? null : computeMarkPercentage(marksObtained, Number(t.max_marks)),
    };
  });

  const columns: ExcelColumn<Row>[] = [
    { header: "Test Name", key: "test_name", value: (r) => r.test_name, width: 22 },
    { header: "Topic", key: "topic", value: (r) => r.topic ?? "", width: 20 },
    { header: "Date", key: "test_date", value: (r) => r.test_date, width: 14 },
    { header: "Batch", key: "batch_name", value: (r) => r.batch_name ?? "—", width: 16 },
    { header: "Max Marks", key: "max_marks", value: (r) => r.max_marks, width: 12 },
    { header: "Student Name", key: "full_name", value: (r) => r.full_name, width: 24 },
    { header: "Status", key: "status", value: (r) => r.status, width: 10 },
    { header: "Marks Obtained", key: "marks_obtained", value: (r) => r.marks_obtained ?? "", width: 14 },
    { header: "Percentage", key: "percentage", value: (r) => r.percentage ?? "", width: 12, format: "0.00\"%\"" },
  ];

  const buffer = await buildWorkbookBuffer("Test Results", columns, rows);
  return excelResponse(buffer, timestampedFilename("test-results"));
}
