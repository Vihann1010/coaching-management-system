import { computeFeeStatus } from "@/lib/calculations";
import { getAppSettings } from "@/lib/settings";
import { unwrapEmbed } from "@/lib/utils";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * IMPORTANT SAFETY BOUNDARY: every tool below is a read-only SELECT.
 * There is deliberately no "update attendance", "add payment", etc. tool
 * here — the assistant can look things up, but it can never change data,
 * no matter how it's asked. This is enforced by what functions exist,
 * not by asking the model nicely in a prompt.
 *
 * Every query also goes through the normal authenticated Supabase
 * client (the same one every other page uses), NOT the service-role
 * admin client — so Row Level Security still decides what the person
 * asking is allowed to see. Today only admins can reach this feature at
 * all (see the assistant page's requireModuleAccess check), but this
 * design means the same tools stay safe if that's ever loosened to
 * other roles later.
 *
 * Tool schemas are defined once, in plain JSON Schema
 * (ASSISTANT_TOOL_DEFINITIONS), and each AI provider adapter
 * (lib/ai/providers/*) converts them into whatever shape that
 * provider's SDK expects. This keeps the two providers from drifting
 * out of sync with each other.
 */

const MAX_ROWS = 25;

export interface ToolDefinition {
  name: string;
  description: string;
  /** Plain JSON Schema for the tool's input object. */
  schema: {
    type: "object";
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

export const ASSISTANT_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "search_students",
    description:
      "Search for students by name, parent name, phone number, or student ID. Returns a short list of matches with their batch and fee status. Use this first when a question names a student, to find their exact record before calling other tools.",
    schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Name, phone number, or student ID to search for" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_student_details",
    description:
      "Get full details for one specific student: contact info, batch, fees (final fee, paid, pending, status), attendance percentage, and recent test marks. If the name matches more than one student, returns a short list to disambiguate instead.",
    schema: {
      type: "object",
      properties: {
        student_name_or_id: { type: "string", description: "Student's full name or their STU-#### ID" },
      },
      required: ["student_name_or_id"],
    },
  },
  {
    name: "get_attendance_summary",
    description:
      "Get attendance counts (present/absent) for a specific date, optionally filtered to one batch. Defaults to today if no date is given. Also lists the names of absent students (up to 25).",
    schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date in YYYY-MM-DD format. Defaults to today if omitted." },
        batch_name: { type: "string", description: "Batch name or code to filter to, e.g. 'Batch A'. Omit for all batches." },
      },
    },
  },
  {
    name: "get_fee_summary",
    description:
      "Get an overall fee picture: total collected, total pending, and how many students are Paid / Partially Paid / Pending / Overdue. Optionally scoped to one batch.",
    schema: {
      type: "object",
      properties: {
        batch_name: { type: "string", description: "Batch name or code to filter to. Omit for all batches." },
      },
    },
  },
  {
    name: "get_pending_fees_list",
    description: "List students with outstanding (pending) fees, highest pending amount first.",
    schema: {
      type: "object",
      properties: {
        batch_name: { type: "string", description: "Batch name or code to filter to. Omit for all batches." },
        limit: { type: "number", description: "Max number of students to return. Defaults to 25." },
      },
    },
  },
  {
    name: "get_test_marks",
    description:
      "Get test marks. Provide student_name to see one student's marks across all their tests, or test_name to see everyone's marks on a specific test (class performance).",
    schema: {
      type: "object",
      properties: {
        student_name: { type: "string", description: "A student's full name (partial match ok)" },
        test_name: { type: "string", description: "A test's name (partial match ok)" },
      },
    },
  },
  {
    name: "get_batches",
    description: "List all batches with their code, active status, and how many active students are in each.",
    schema: { type: "object", properties: {} },
  },
  {
    name: "list_recent_payments",
    description: "List the most recent fee payments across the institute, optionally filtered to one batch.",
    schema: {
      type: "object",
      properties: {
        days: { type: "number", description: "How many days back to look. Defaults to 7." },
        batch_name: { type: "string", description: "Batch name or code to filter to. Omit for all batches." },
      },
    },
  },
];

export async function runAssistantTool(
  supabase: SupabaseServerClient,
  name: string,
  input: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "search_students":
      return searchStudents(supabase, String(input.query ?? ""));
    case "get_student_details":
      return getStudentDetails(supabase, String(input.student_name_or_id ?? ""));
    case "get_attendance_summary":
      return getAttendanceSummary(supabase, input.date as string | undefined, input.batch_name as string | undefined);
    case "get_fee_summary":
      return getFeeSummary(supabase, input.batch_name as string | undefined);
    case "get_pending_fees_list":
      return getPendingFeesList(supabase, input.batch_name as string | undefined, input.limit as number | undefined);
    case "get_test_marks":
      return getTestMarks(supabase, input.student_name as string | undefined, input.test_name as string | undefined);
    case "get_batches":
      return getBatches(supabase);
    case "list_recent_payments":
      return listRecentPayments(supabase, input.days as number | undefined, input.batch_name as string | undefined);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ---------------------------------------------------------------------

async function resolveBatchId(supabase: SupabaseServerClient, batchName?: string) {
  if (!batchName) return { batchId: undefined, error: undefined };
  const { data } = await supabase
    .from("batches")
    .select("id, name")
    .ilike("name", `%${batchName}%`)
    .limit(1)
    .maybeSingle();
  if (!data) return { batchId: undefined, error: `No batch found matching "${batchName}".` };
  return { batchId: data.id as string, error: undefined };
}

async function searchStudents(supabase: SupabaseServerClient, query: string) {
  if (!query.trim()) return { error: "Provide a name, phone number, or student ID to search for." };
  const esc = query.replace(/[%_]/g, "");
  const { data, error } = await supabase
    .from("students")
    .select("id, student_code, full_name, student_phone, primary_parent_phone, is_active, batch:batches(name)")
    .or(`full_name.ilike.%${esc}%,student_phone.ilike.%${esc}%,primary_parent_phone.ilike.%${esc}%,student_code.ilike.%${esc}%`)
    .limit(MAX_ROWS);
  if (error) return { error: "Search failed." };
  return {
    count: data.length,
    students: data.map((s) => ({
      id: s.id,
      student_code: s.student_code,
      full_name: s.full_name,
      batch: (s.batch as unknown as { name: string } | null)?.name ?? "Unassigned",
      is_active: s.is_active,
    })),
  };
}

async function getStudentDetails(supabase: SupabaseServerClient, nameOrId: string) {
  if (!nameOrId.trim()) return { error: "Provide a student name or ID." };
  const esc = nameOrId.replace(/[%_]/g, "");
  const { data: matches } = await supabase
    .from("students")
    .select("*, batch:batches(name)")
    .or(`full_name.ilike.%${esc}%,student_code.ilike.%${esc}%`)
    .limit(5);

  if (!matches || matches.length === 0) return { error: `No student found matching "${nameOrId}".` };
  if (matches.length > 1) {
    return {
      ambiguous: true,
      matches: matches.map((s) => ({ student_code: s.student_code, full_name: s.full_name })),
      note: "More than one student matched — ask which one, or search again with the full name or student ID.",
    };
  }

  const student = matches[0];
  const settings = await getAppSettings();
  const [{ data: financials }, { data: attendance }, { data: marks }] = await Promise.all([
    supabase.from("student_financials").select("*").eq("student_id", student.id).maybeSingle(),
    supabase.from("student_attendance_summary").select("*").eq("student_id", student.id).maybeSingle(),
    supabase
      .from("test_marks")
      .select("marks_obtained, is_absent, test:tests(name, max_marks, test_date)")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const totalPaid = financials?.total_paid ?? 0;
  const pendingFee = financials?.pending_fee ?? student.final_fee;

  return {
    student_code: student.student_code,
    full_name: student.full_name,
    batch: (student.batch as unknown as { name: string } | null)?.name ?? "Unassigned",
    is_active: student.is_active,
    student_phone: student.student_phone,
    primary_parent_phone: student.primary_parent_phone,
    fees: {
      final_fee: student.final_fee,
      total_paid: totalPaid,
      pending_fee: pendingFee,
      status: computeFeeStatus({
        finalFee: student.final_fee,
        totalPaid,
        lastPaymentDate: financials?.last_payment_date ?? null,
        admissionDate: student.admission_date,
        overdueDays: settings.fee_overdue_days,
      }),
    },
    attendance_percentage: attendance?.attendance_percentage ?? null,
    recent_test_marks: (marks ?? []).map((m) => {
      const t = m.test as unknown as { name: string; max_marks: number; test_date: string } | null;
      return {
        test: t?.name,
        date: t?.test_date,
        marks_obtained: m.is_absent ? "absent" : m.marks_obtained,
        max_marks: t?.max_marks,
      };
    }),
  };
}

async function getAttendanceSummary(supabase: SupabaseServerClient, date?: string, batchName?: string) {
  const attendanceDate = date || new Date().toISOString().slice(0, 10);
  const { batchId, error } = await resolveBatchId(supabase, batchName);
  if (error) return { error };

  let query = supabase.from("attendance").select("status, student:students(full_name), batch:batches(name)").eq("attendance_date", attendanceDate);
  if (batchId) query = query.eq("batch_id", batchId);

  const { data, error: qError } = await query;
  if (qError) return { error: "Couldn't load attendance." };

  const present = data.filter((r) => r.status === "present");
  const absent = data.filter((r) => r.status === "absent");

  return {
    date: attendanceDate,
    batch: batchName ?? "all batches",
    present_count: present.length,
    absent_count: absent.length,
    total_marked: data.length,
    absent_students: absent.slice(0, MAX_ROWS).map((r) => (r.student as unknown as { full_name: string } | null)?.full_name),
  };
}

async function getFeeSummary(supabase: SupabaseServerClient, batchName?: string) {
  const { batchId, error } = await resolveBatchId(supabase, batchName);
  if (error) return { error };

  let studentsQuery = supabase.from("students").select("id, final_fee, admission_date").eq("is_active", true);
  if (batchId) studentsQuery = studentsQuery.eq("batch_id", batchId);
  const { data: students } = await studentsQuery;
  const studentIds = (students ?? []).map((s) => s.id);

  const { data: financials } = studentIds.length
    ? await supabase.from("student_financials").select("*").in("student_id", studentIds)
    : { data: [] };
  const finMap = new Map((financials ?? []).map((f) => [f.student_id, f]));
  const settings = await getAppSettings();

  let totalCollected = 0;
  let totalPending = 0;
  const statusCounts = { paid: 0, partial: 0, pending: 0, overdue: 0 };

  for (const s of students ?? []) {
    const fin = finMap.get(s.id);
    const totalPaid = fin?.total_paid ?? 0;
    const pending = fin?.pending_fee ?? s.final_fee;
    totalCollected += totalPaid;
    totalPending += pending;
    const status = computeFeeStatus({
      finalFee: s.final_fee, totalPaid, lastPaymentDate: fin?.last_payment_date ?? null,
      admissionDate: s.admission_date, overdueDays: settings.fee_overdue_days,
    });
    statusCounts[status]++;
  }

  return {
    batch: batchName ?? "all batches",
    student_count: students?.length ?? 0,
    total_collected: Math.round(totalCollected),
    total_pending: Math.round(totalPending),
    status_counts: statusCounts,
  };
}

async function getPendingFeesList(supabase: SupabaseServerClient, batchName?: string, limit?: number) {
  const { batchId, error } = await resolveBatchId(supabase, batchName);
  if (error) return { error };

  let query = supabase.from("students").select("id, full_name, student_code, batch:batches(name)").eq("is_active", true);
  if (batchId) query = query.eq("batch_id", batchId);
  const { data: students } = await query;
  const studentIds = (students ?? []).map((s) => s.id);

  const { data: financials } = studentIds.length
    ? await supabase.from("student_financials").select("*").in("student_id", studentIds)
    : { data: [] };
  const finMap = new Map((financials ?? []).map((f) => [f.student_id, f]));

  const rows = (students ?? [])
    .map((s) => ({
      full_name: s.full_name,
      student_code: s.student_code,
      batch: (s.batch as unknown as { name: string } | null)?.name ?? "Unassigned",
      pending: finMap.get(s.id)?.pending_fee ?? 0,
    }))
    .filter((s) => s.pending > 0)
    .sort((a, b) => b.pending - a.pending)
    .slice(0, Math.min(limit ?? MAX_ROWS, 50));

  return { count: rows.length, students: rows };
}

async function getTestMarks(supabase: SupabaseServerClient, studentName?: string, testName?: string) {
  if (!studentName && !testName) {
    return { error: "Provide either a student name or a test name." };
  }

  if (studentName) {
    const esc = studentName.replace(/[%_]/g, "");
    const { data: student } = await supabase.from("students").select("id, full_name").ilike("full_name", `%${esc}%`).limit(1).maybeSingle();
    if (!student) return { error: `No student found matching "${studentName}".` };

    const { data: marks } = await supabase
      .from("test_marks")
      .select("marks_obtained, is_absent, test:tests(name, max_marks, test_date, topic)")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS);

    return {
      student: student.full_name,
      marks: (marks ?? []).map((m) => {
        const t = m.test as unknown as { name: string; max_marks: number; test_date: string; topic: string | null } | null;
        return {
          test: t?.name, topic: t?.topic, date: t?.test_date,
          marks_obtained: m.is_absent ? "absent" : m.marks_obtained, max_marks: t?.max_marks,
        };
      }),
    };
  }

  const esc = testName!.replace(/[%_]/g, "");
  const { data: test } = await supabase.from("tests").select("id, name, max_marks, batch:batches(name)").ilike("name", `%${esc}%`).limit(1).maybeSingle();
  if (!test) return { error: `No test found matching "${testName}".` };

  const { data: stats } = await supabase.from("test_stats").select("*").eq("test_id", test.id).maybeSingle();
  const { data: marks } = await supabase
    .from("test_marks")
    .select("marks_obtained, is_absent, student:students(full_name)")
    .eq("test_id", test.id)
    .order("marks_obtained", { ascending: false })
    .limit(MAX_ROWS);

  return {
    test: test.name,
    batch: (test.batch as unknown as { name: string } | null)?.name,
    max_marks: test.max_marks,
    stats,
    student_marks: (marks ?? []).map((m) => ({
      student: (m.student as unknown as { full_name: string } | null)?.full_name,
      marks_obtained: m.is_absent ? "absent" : m.marks_obtained,
    })),
  };
}

async function getBatches(supabase: SupabaseServerClient) {
  const { data: batches } = await supabase.from("batches").select("id, name, code, is_active").order("name");
  const { data: students } = await supabase.from("students").select("batch_id").eq("is_active", true);
  const counts = new Map<string, number>();
  for (const s of students ?? []) {
    if (s.batch_id) counts.set(s.batch_id, (counts.get(s.batch_id) ?? 0) + 1);
  }
  return {
    batches: (batches ?? []).map((b) => ({
      name: b.name, code: b.code, is_active: b.is_active, active_student_count: counts.get(b.id) ?? 0,
    })),
  };
}

async function listRecentPayments(supabase: SupabaseServerClient, days?: number, batchName?: string) {
  const { batchId, error } = await resolveBatchId(supabase, batchName);
  if (error) return { error };

  const since = new Date();
  since.setDate(since.getDate() - (days ?? 7));

  let query = supabase
    .from("payments")
    .select("payment_date, amount, payment_method, is_voided, student:students!inner(full_name, batch_id, batch:batches(name))")
    .gte("payment_date", since.toISOString().slice(0, 10))
    .eq("is_voided", false)
    .order("payment_date", { ascending: false })
    .limit(MAX_ROWS);
  if (batchId) query = query.eq("student.batch_id", batchId);

  const { data, error: qError } = await query;
  if (qError) return { error: "Couldn't load payments." };

  return {
    since: since.toISOString().slice(0, 10),
    batch: batchName ?? "all batches",
    count: data.length,
    payments: data.map((p) => {
      const student = unwrapEmbed(p.student);
      const batch = student ? unwrapEmbed(student.batch) : null;
      return { date: p.payment_date, student: student?.full_name, batch: batch?.name, amount: p.amount, method: p.payment_method };
    }),
  };
}
