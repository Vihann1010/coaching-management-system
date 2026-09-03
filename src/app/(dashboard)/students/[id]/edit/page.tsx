import { notFound } from "next/navigation";
import { getSessionContext, requireModuleAccess } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { StudentForm } from "@/components/students/student-form";
import { updateStudentAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getSessionContext();
  requireModuleAccess(ctx, "students", "edit");

  const supabase = await createClient();
  const [{ data: student }, { data: batches }] = await Promise.all([
    supabase.from("students").select("*").eq("id", id).single(),
    supabase.from("batches").select("id, name, code").eq("is_active", true).order("name"),
  ]);

  if (!student) notFound();

  const boundAction = updateStudentAction.bind(null, id);

  return (
    <div className="max-w-3xl">
      <PageHeader title={`Edit ${student.full_name}`} description={student.student_code} />
      <StudentForm batches={batches ?? []} student={student} action={boundAction} submitLabel="Save changes" />
    </div>
  );
}
