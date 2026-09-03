import { getSessionContext, requireModuleAccess } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { StudentForm } from "@/components/students/student-form";
import { createStudentAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewStudentPage() {
  const ctx = await getSessionContext();
  requireModuleAccess(ctx, "students", "edit");

  const supabase = await createClient();
  const { data: batches } = await supabase
    .from("batches")
    .select("id, name, code")
    .eq("is_active", true)
    .order("name");

  return (
    <div className="max-w-3xl">
      <PageHeader title="Add student" description="Create a new student record." />
      <StudentForm batches={batches ?? []} action={createStudentAction} submitLabel="Add student" />
    </div>
  );
}
