"use server";
import type { ZodError } from "zod";

import { createClient } from "@/lib/supabase/server";
import { batchSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";

export interface BatchActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

export async function createBatchAction(_prev: BatchActionState, formData: FormData): Promise<BatchActionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = batchSchema.safeParse({ ...raw, is_active: raw.is_active === "on" || raw.is_active === "true" });
  if (!parsed.success) return { fieldErrors: flatten(parsed.error) };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();

  const { error } = await supabase.from("batches").insert({
    ...parsed.data,
    created_by: userRes.user?.id,
    updated_by: userRes.user?.id,
  });

  if (error) {
    return { error: error.message.includes("duplicate key") ? "That batch code is already in use." : "Couldn't create the batch." };
  }
  revalidatePath("/batches");
  return { success: true };
}

export async function updateBatchAction(
  batchId: string,
  _prev: BatchActionState,
  formData: FormData
): Promise<BatchActionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = batchSchema.safeParse({ ...raw, is_active: raw.is_active === "on" || raw.is_active === "true" });
  if (!parsed.success) return { fieldErrors: flatten(parsed.error) };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("batches")
    .update({ ...parsed.data, updated_by: userRes.user?.id })
    .eq("id", batchId);

  if (error) {
    return { error: error.message.includes("duplicate key") ? "That batch code is already in use." : "Couldn't update the batch." };
  }
  revalidatePath("/batches");
  return { success: true };
}

export async function deleteBatchAction(batchId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("batches").delete().eq("id", batchId);
  revalidatePath("/batches");
  return {
    error: error ? "This batch has students, tests or attendance linked to it. Deactivate it instead of deleting." : undefined,
  };
}

function flatten(error: ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
