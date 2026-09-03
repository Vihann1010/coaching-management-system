"use server";
import type { ZodError } from "zod";

import { createClient } from "@/lib/supabase/server";
import { testSchema, bulkMarksSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export interface TestActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createTestAction(_prev: TestActionState, formData: FormData): Promise<TestActionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = testSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: flatten(parsed.error) };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("tests")
    .insert({ ...parsed.data, created_by: userRes.user?.id, updated_by: userRes.user?.id })
    .select("id")
    .single();

  if (error) return { error: "Couldn't create the test. Check you're assigned to this batch." };

  revalidatePath("/tests");
  revalidatePath("/dashboard");
  redirect(`/tests/${data.id}`);
}

export async function deleteTestAction(testId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("tests").delete().eq("id", testId);
  revalidatePath("/tests");
  return { error: error ? "Couldn't delete this test." : undefined };
}

export interface SaveMarksResult {
  error?: string;
  success?: boolean;
}

export async function saveMarksAction(input: unknown): Promise<SaveMarksResult> {
  const parsed = bulkMarksSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Something looks wrong with these marks. Please refresh and try again." };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();

  const rows = parsed.data.entries.map((e) => ({
    test_id: parsed.data.test_id,
    student_id: e.student_id,
    marks_obtained: e.is_absent ? null : e.marks_obtained,
    is_absent: e.is_absent,
    created_by: userRes.user?.id,
    updated_by: userRes.user?.id,
  }));

  const { error } = await supabase.rpc("upsert_test_marks", { rows });

  if (error) {
    if (error.message.includes("exceed")) {
      return { error: "One or more marks exceed the maximum marks for this test." };
    }
    return { error: "Couldn't save marks. You may not have permission for this batch." };
  }

  revalidatePath(`/tests/${parsed.data.test_id}`);
  revalidatePath("/reports");
  return { success: true };
}

function flatten(error: ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
