"use server";

import { createClient } from "@/lib/supabase/server";
import { bulkAttendanceSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";

export interface SaveAttendanceResult {
  error?: string;
  success?: boolean;
}

export async function saveAttendanceAction(input: unknown): Promise<SaveAttendanceResult> {
  const parsed = bulkAttendanceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Something looks wrong with this attendance sheet. Please refresh and try again." };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();

  const rows = parsed.data.entries.map((e) => ({
    student_id: e.student_id,
    batch_id: parsed.data.batch_id,
    attendance_date: parsed.data.attendance_date,
    status: e.status,
    created_by: userRes.user?.id,
    updated_by: userRes.user?.id,
  }));

  // Upsert via a SECURITY INVOKER RPC (see 0004_rpc_functions.sql) so a
  // re-save on the same day updates existing records — spec section 11
  // ("allow authorized users to edit attendance later") — without
  // clobbering created_by/created_at on rows that already existed. RLS
  // still applies in full because the function runs as the caller.
  const { error } = await supabase.rpc("upsert_attendance", { rows });

  if (error) {
    return { error: "Couldn't save attendance. You may not have permission for this batch." };
  }

  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  return { success: true };
}
