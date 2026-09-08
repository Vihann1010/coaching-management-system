import { revalidatePath } from "next/cache";
import { computeFeeStatus } from "@/lib/calculations";
import { getAppSettings } from "@/lib/settings";
import { unwrapEmbed } from "@/lib/utils";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * TOOL SAFETY MODEL: the read tools are plain SELECTs. The write tools
 * (record_fee_payment, mark_attendance, set_test_mark) can change data,
 * but they are guarded by three independent layers:
 *
 * 1. Reachability — only admins can call askAssistantAction at all.
 * 2. Confirm gate — a write tool refuses to mutate unless the model passes
 *    confirm: true, and the system prompt forbids setting it before the
 *    admin has explicitly agreed to the exact details in conversation. An
 *    unconfirmed call returns the full details with requires_confirmation
 *    so the model asks instead of writing.
 * 3. RLS — every query runs through the normal authenticated Supabase
 *    client (never the service-role key), so Row Level Security still
 *    decides what the person asking may read or write.
 *
 * Writes reuse the same audited paths the manual screens use: the
 * payments insert carries created_by/updated_by, and attendance/marks go
 * through the upsert_attendance / upsert_test_marks RPCs, which preserve
 * created_by on re-saves (see 0004_rpc_functions.sql).
 */

const MAX_ROWS = 25;

export interface ToolDefinition {
  name: string;
  description: string;
  /** Plain JSON Schema for the tool's input object. */
  schema: {
    type: "object";
    properties: Record<string, { type: string; description?: string; enum?: string[] }>;
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
  // -------------------------------------------------------------------
  // WRITE TOOLS — see the safety model comment at the top of this file.
  // Descriptions hard-require conversational confirmation: the model may
  // only pass confirm: true after the admin explicitly agreed to the
  // exact details, and the implementations refuse to write without it.
  // -------------------------------------------------------------------
  {
    name: "record_fee_payment",
    description:
      "Record a fee payment for a student (the same as the Add Payment form). Never pass confirm:true unless the admin has already explicitly agreed in this conversation to these exact details: student, amount, method and date. If any of those are missing or unclear, ask one short question at a time first (method defaults to cash, date defaults to today). If the tool returns requires_confirmation, present the details and wait for a clear yes. If it flags an overpayment, tell the admin the pending amount and ask whether to record it anyway.",
    schema: {
      type: "object",
      properties: {
        student_name_or_id: { type: "string", description: "Student's name (partial ok) or STU-#### ID" },
        amount: { type: "number", description: "Payment amount in rupees, e.g. 5000" },
        payment_method: { type: "string", enum: ["cash", "upi", "bank_transfer", "card", "other"], description: "Defaults to cash" },
        payment_date: { type: "string", description: "YYYY-MM-DD. Defaults to today." },
        reference_number: { type: "string", description: "Optional UPI/transaction reference" },
        notes: { type: "string", description: "Optional note" },
        confirm: { type: "boolean", description: "Set true ONLY after the admin explicitly confirmed these exact details" },
      },
      required: ["student_name_or_id", "amount"],
    },
  },
  {
    name: "mark_attendance",
    description:
      "Mark ONE student present or absent for a date (the same as the attendance register). Never pass confirm:true unless the admin has explicitly agreed to marking this student with this status on this date. When the admin mentions a student was absent or present, resolve the student, state plainly what you will mark, and wait for a yes.",
    schema: {
      type: "object",
      properties: {
        student_name_or_id: { type: "string", description: "Student's name (partial ok) or STU-#### ID" },
        status: { type: "string", enum: ["present", "absent"], description: "The status to mark" },
        attendance_date: { type: "string", description: "YYYY-MM-DD. Defaults to today." },
        confirm: { type: "boolean", description: "Set true ONLY after the admin explicitly confirmed" },
      },
      required: ["student_name_or_id", "status"],
    },
  },
  {
    name: "set_test_mark",
    description:
      "Save or update one student's marks on a test (the same as marks entry). Never pass confirm:true unless the admin has explicitly agreed to these exact details: student, test, and the marks (or that they were absent). If several tests share a name, the tool returns a list — ask which one.",
    schema: {
      type: "object",
      properties: {
        student_name_or_id: { type: "string", description: "Student's name (partial ok) or STU-#### ID" },
        test_name: { type: "string", description: "Test name (partial ok)" },
        marks_obtained: { type: "number", description: "Marks scored. Omit if is_absent." },
        is_absent: { type: "boolean", description: "Set true if the student was absent for the test" },
        confirm: { type: "boolean", description: "Set true ONLY after the admin explicitly confirmed" },
      },
      required: ["student_name_or_id", "test_name"],
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
    case "record_fee_payment":
      return recordFeePayment(supabase, input);
    case "mark_attendance":
      return markAttendance(supabase, input);
    case "set_test_mark":
      return setTestMark(supabase, input);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ---------------------------------------------------------------------
// WRITE TOOLS — shared helpers
// ---------------------------------------------------------------------

/** YYYY-MM-DD in the server's local timezone (the deployment runs IST). */
function localToday(): string {
  return new Date().toLocaleDateString("en-CA");
}

/** Accepts YYYY-MM-DD, "today", "yesterday", DD/MM/YYYY (Indian style) or
 *  anything Date can parse; returns YYYY-MM-DD, or null if unusable. */
function normalizeDateInput(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const v = value.trim().toLowerCase().replace(/\./g, "/");
  if (v === "today") return localToday();
  if (v === "yesterday") {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString("en-CA");
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const dmy = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const a = Number(dmy[1]);
    const b = Number(dmy[2]);
    // Default to Indian DD/MM; if the second number can't be a month,
    // interpret the pair as MM/DD instead.
    const [day, month] = b > 12 ? [b, a] : [a, b];
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${dmy[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const parsed = new Date(v);
  if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleDateString("en-CA");
  return null;
}

const CONFIRM_NEXT_STEP =
  "Do NOT write yet. Present these exact details to the admin in plain words and ask them to confirm. Only call this tool again with confirm:true after they clearly agree.";

/** The confirm gate: every write called without confirm:true returns the
 *  full details back instead of mutating, so the model asks first. */
function needsConfirmation(details: Record<string, unknown>) {
  return { requires_confirmation: true, ...details, next_step: CONFIRM_NEXT_STEP };
}

/** Looks up the one student a write refers to, or returns an
 *  error/disambiguation payload the model can read aloud. */
async function resolveStudentForWrite(supabase: SupabaseServerClient, nameOrId: string) {
  const esc = nameOrId.replace(/[%_]/g, "");
  if (!esc.trim()) return { error: "Provide the student's name or STU-#### ID." } as const;
  const { data: matches } = await supabase
    .from("students")
    .select("id, student_code, full_name, batch_id, final_fee, batch:batches(name)")
    .or(`full_name.ilike.%${esc}%,student_code.ilike.%${esc}%`)
    .limit(5);
  if (!matches || matches.length === 0) {
    return { error: `No student found matching "${nameOrId}".` } as const;
  }
  if (matches.length > 1) {
    return {
      ambiguous: true,
      matches: matches.map((s) => ({
        student_code: s.student_code,
        full_name: s.full_name,
        batch: (s.batch as unknown as { name: string } | null)?.name ?? "Unassigned",
      })),
      note: "Several students matched — ask the admin which one before writing anything.",
    } as const;
  }
  return { student: matches[0] } as const;
}

// ---------------------------------------------------------------------

async function recordFeePayment(supabase: SupabaseServerClient, input: Record<string, unknown>) {
  const nameOrId = String(input.student_name_or_id ?? "");
  const amount = Number(input.amount);
  const method = String(input.payment_method ?? "cash");
  const reference = input.reference_number ? String(input.reference_number) : null;
  const notes = input.notes ? String(input.notes) : null;
  const paymentDate = normalizeDateInput(input.payment_date) ?? localToday();
  const confirmed = input.confirm === true;

  if (!nameOrId.trim()) return { error: "Whose fees are these? Give the student's name or ID." };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "The amount looks invalid — it must be a positive number." };
  }
  const allowedMethods = ["cash", "upi", "bank_transfer", "card", "other"];
  if (!allowedMethods.includes(method)) {
    return { error: `Unsupported payment method "${method}". Use one of: ${allowedMethods.join(", ")}.` };
  }

  const lookup = await resolveStudentForWrite(supabase, nameOrId);
  if ("error" in lookup || "ambiguous" in lookup) return lookup;
  const student = lookup.student;

  const { data: financials } = await supabase
    .from("student_financials")
    .select("pending_fee")
    .eq("student_id", student.id)
    .maybeSingle();
  const pending = Number(financials?.pending_fee ?? student.final_fee ?? 0);

  if (!confirmed) {
    return needsConfirmation({
      action: "record_fee_payment",
      student: `${student.full_name} (${student.student_code})`,
      amount,
      payment_method: method,
      payment_date: paymentDate,
      current_pending_fee: pending,
      ...(reference ? { reference_number: reference } : {}),
      ...(notes ? { notes } : {}),
      warning:
        pending > 0 && amount > pending
          ? "This amount is MORE than the pending fee — point that out to the admin and note that overpayments can only be recorded from the Payments screen."
          : undefined,
    });
  }

  // Deliberately refuse overpayments: spec section 9 allows an override
  // only as an explicit admin action in the UI — the assistant never
  // overrides on the admin's half-said behalf.
  if (pending > 0 && amount > pending) {
    return {
      error: "Not saved — the amount is more than the pending fee. Overpayments can only be recorded from the student's Payments screen with an explicit override.",
      pending_fee: pending,
    };
  }

  const { data: userRes } = await supabase.auth.getUser();
  const { error } = await supabase.from("payments").insert({
    student_id: student.id,
    payment_date: paymentDate,
    amount,
    payment_method: method,
    reference_number: reference,
    notes,
    created_by: userRes.user?.id,
    updated_by: userRes.user?.id,
  });
  if (error) return { error: "The payment could not be saved. Please try again or use the Fees screen." };

  revalidatePath(`/students/${student.id}`);
  revalidatePath("/fees");
  revalidatePath("/dashboard");

  return {
    success: true,
    recorded: {
      student: `${student.full_name} (${student.student_code})`,
      amount,
      payment_method: method,
      payment_date: paymentDate,
      pending_fee_before: pending,
      pending_fee_after: Math.max(pending - amount, 0),
    },
  };
}

async function markAttendance(supabase: SupabaseServerClient, input: Record<string, unknown>) {
  const nameOrId = String(input.student_name_or_id ?? "");
  const status = String(input.status ?? "");
  const attendanceDate = normalizeDateInput(input.attendance_date) ?? localToday();
  const confirmed = input.confirm === true;

  if (status !== "present" && status !== "absent") {
    return { error: 'Status must be "present" or "absent".' };
  }
  const lookup = await resolveStudentForWrite(supabase, nameOrId);
  if ("error" in lookup || "ambiguous" in lookup) return lookup;
  const student = lookup.student;
  if (!student.batch_id) {
    return { error: `${student.full_name} has no batch assigned, so attendance can't be marked.` };
  }

  if (!confirmed) {
    return needsConfirmation({
      action: "mark_attendance",
      student: `${student.full_name} (${student.student_code})`,
      status,
      attendance_date: attendanceDate,
    });
  }

  const { data: userRes } = await supabase.auth.getUser();
  const { error } = await supabase.rpc("upsert_attendance", {
    rows: [
      {
        student_id: student.id,
        batch_id: student.batch_id,
        attendance_date: attendanceDate,
        status,
        created_by: userRes.user?.id,
        updated_by: userRes.user?.id,
      },
    ],
  });
  if (error) return { error: "Attendance could not be saved. Please try again or use the Attendance screen." };

  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  revalidatePath("/reports");

  return {
    success: true,
    recorded: {
      student: `${student.full_name} (${student.student_code})`,
      status,
      attendance_date: attendanceDate,
    },
  };
}

async function setTestMark(supabase: SupabaseServerClient, input: Record<string, unknown>) {
  const nameOrId = String(input.student_name_or_id ?? "");
  const testName = String(input.test_name ?? "").trim();
  const isAbsent = input.is_absent === true;
  const hasMarks = input.marks_obtained !== undefined && input.marks_obtained !== null && input.marks_obtained !== "";
  const marks = Number(input.marks_obtained);
  const confirmed = input.confirm === true;

  if (!testName) return { error: "Which test is this for?" };
  if (!isAbsent && !hasMarks) {
    return { error: "Give the marks, or set is_absent to true if the student missed the test." };
  }
  if (hasMarks && (!Number.isFinite(marks) || marks < 0)) {
    return { error: "Marks must be a number of 0 or more." };
  }

  // Resolve the test — several tests can share a name, so surface dates.
  const escTest = testName.replace(/[%_]/g, "");
  const { data: tests } = await supabase
    .from("tests")
    .select("id, name, test_date, max_marks, batch:batches(name)")
    .ilike("name", `%${escTest}%`)
    .order("test_date", { ascending: false })
    .limit(5);
  if (!tests || tests.length === 0) {
    return { error: `No test found matching "${testName}".` };
  }
  if (tests.length > 1) {
    return {
      ambiguous: true,
      matches: tests.map((t) => ({
        test: t.name,
        date: t.test_date,
        max_marks: t.max_marks,
        batch: (t.batch as unknown as { name: string } | null)?.name ?? "Unassigned",
      })),
      note: "Several tests share this name — ask the admin which one (mentioning the date helps).",
    };
  }
  const test = tests[0];
  if (hasMarks && marks > Number(test.max_marks)) {
    return { error: `Marks can't exceed the test maximum (${test.max_marks}).` };
  }

  const lookup = await resolveStudentForWrite(supabase, nameOrId);
  if ("error" in lookup || "ambiguous" in lookup) return lookup;
  const student = lookup.student;

  if (!confirmed) {
    return needsConfirmation({
      action: "set_test_mark",
      student: `${student.full_name} (${student.student_code})`,
      test: `${test.name} on ${test.test_date} (out of ${test.max_marks})`,
      ...(isAbsent ? { marked_as: "absent" } : { marks_obtained: marks }),
    });
  }

  const { data: userRes } = await supabase.auth.getUser();
  const { error } = await supabase.rpc("upsert_test_marks", {
    rows: [
      {
        test_id: test.id,
        student_id: student.id,
        marks_obtained: isAbsent ? null : marks,
        is_absent: isAbsent,
        created_by: userRes.user?.id,
        updated_by: userRes.user?.id,
      },
    ],
  });
  if (error) return { error: "The marks could not be saved. Please try again or use the Tests screen." };

  revalidatePath("/tests");
  revalidatePath(`/students/${student.id}`);
  revalidatePath("/reports");
  revalidatePath("/dashboard");

  return {
    success: true,
    recorded: {
      student: `${student.full_name} (${student.student_code})`,
      test: `${test.name} (${test.test_date})`,
      ...(isAbsent ? { marked_as: "absent" } : { marks_obtained: marks, max_marks: test.max_marks }),
    },
  };
}

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
  const attendanceDate = date || new Date().toLocaleDateString("en-CA");
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
