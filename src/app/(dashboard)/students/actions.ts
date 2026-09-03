"use server";
import type { ZodError } from "zod";

import { createClient } from "@/lib/supabase/server";
import { studentSchema, paymentSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export interface ActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

// ---------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------

export async function createStudentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = studentSchema.safeParse({
    ...raw,
    batch_id: raw.batch_id || null,
  });

  if (!parsed.success) {
    return { fieldErrors: flattenZodErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("students")
    .insert({
      ...parsed.data,
      student_phone: parsed.data.student_phone || null,
      father_phone: parsed.data.father_phone || null,
      mother_phone: parsed.data.mother_phone || null,
      primary_parent_phone: parsed.data.primary_parent_phone || null,
      created_by: userRes.user?.id,
      updated_by: userRes.user?.id,
    })
    .select("id")
    .single();

  if (error) {
    return { error: friendlyDbError(error.message) };
  }

  revalidatePath("/students");
  revalidatePath("/dashboard");
  redirect(`/students/${data.id}`);
}

export async function updateStudentAction(
  studentId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = studentSchema.safeParse({
    ...raw,
    batch_id: raw.batch_id || null,
  });

  if (!parsed.success) {
    return { fieldErrors: flattenZodErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("students")
    .update({
      ...parsed.data,
      student_phone: parsed.data.student_phone || null,
      father_phone: parsed.data.father_phone || null,
      mother_phone: parsed.data.mother_phone || null,
      primary_parent_phone: parsed.data.primary_parent_phone || null,
      updated_by: userRes.user?.id,
    })
    .eq("id", studentId);

  if (error) {
    return { error: friendlyDbError(error.message) };
  }

  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  redirect(`/students/${studentId}`);
}

/** Soft-delete only — see spec section 24 ("do not permanently delete
    critical financial history without admin authorization"). */
export async function deactivateStudentAction(studentId: string) {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("students")
    .update({ is_active: false, deleted_at: new Date().toISOString(), updated_by: userRes.user?.id })
    .eq("id", studentId);

  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  return { error: error ? friendlyDbError(error.message) : undefined };
}

export async function reactivateStudentAction(studentId: string) {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("students")
    .update({ is_active: true, deleted_at: null, updated_by: userRes.user?.id })
    .eq("id", studentId);

  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
  return { error: error ? friendlyDbError(error.message) : undefined };
}

/** Admin-only hard delete, blocked by the DB (ON DELETE RESTRICT) if the
    student has any payments/attendance/marks — which is the point. */
export async function hardDeleteStudentAction(studentId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("students").delete().eq("id", studentId);
  revalidatePath("/students");
  return {
    error: error
      ? "This student has payment, attendance or test history and can't be permanently deleted. Deactivate them instead."
      : undefined,
  };
}

// ---------------------------------------------------------------------
// Payments / installments
// ---------------------------------------------------------------------

export async function addPaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = paymentSchema.safeParse(raw);

  if (!parsed.success) {
    return { fieldErrors: flattenZodErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();

  // Guard against accidental overpayment unless explicitly overridden
  // (spec section 9: "validate payments against payable fees unless
  // the Admin intentionally overrides it").
  if (!parsed.data.override_pending_check) {
    const { data: financials } = await supabase
      .from("student_financials")
      .select("pending_fee")
      .eq("student_id", parsed.data.student_id)
      .single();

    if (financials && parsed.data.amount > Number(financials.pending_fee) && Number(financials.pending_fee) > 0) {
      return {
        error: `This payment (${parsed.data.amount}) is more than the pending amount (${financials.pending_fee}). Check the amount, or use "Record anyway" to override.`,
      };
    }
  }

  const { error } = await supabase.from("payments").insert({
    student_id: parsed.data.student_id,
    payment_date: parsed.data.payment_date,
    amount: parsed.data.amount,
    payment_method: parsed.data.payment_method,
    reference_number: parsed.data.reference_number || null,
    notes: parsed.data.notes || null,
    created_by: userRes.user?.id,
    updated_by: userRes.user?.id,
  });

  if (error) {
    return { error: friendlyDbError(error.message) };
  }

  revalidatePath(`/students/${parsed.data.student_id}`);
  revalidatePath("/fees");
  revalidatePath("/dashboard");
  return {};
}

export async function voidPaymentAction(paymentId: string, studentId: string, reason: string) {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("payments")
    .update({
      is_voided: true,
      voided_reason: reason || null,
      voided_by: userRes.user?.id,
      voided_at: new Date().toISOString(),
      updated_by: userRes.user?.id,
    })
    .eq("id", paymentId);

  revalidatePath(`/students/${studentId}`);
  revalidatePath("/fees");
  revalidatePath("/dashboard");
  return { error: error ? friendlyDbError(error.message) : undefined };
}

// ---------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------

function flattenZodErrors(error: ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

function friendlyDbError(message: string): string {
  if (message.includes("duplicate key") && message.includes("student_code")) {
    return "That student ID is already in use.";
  }
  if (message.includes("duplicate key") && message.includes("installment_number")) {
    return "Couldn't add this installment — please try again.";
  }
  if (message.includes("row-level security") || message.includes("RLS")) {
    return "You don't have permission to do that.";
  }
  if (message.includes("violates foreign key constraint")) {
    return "This record is linked to other data and can't be changed that way.";
  }
  return "Something went wrong saving your changes. Please try again.";
}
