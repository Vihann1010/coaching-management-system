import { PhoneCall } from "lucide-react";
import { getSessionContext, requireModuleAccess } from "@/lib/session";
import { canEdit } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BatchDatePicker } from "@/components/attendance/batch-date-picker";
import { AttendanceForm } from "@/components/attendance/attendance-form";
import { telHref } from "@/lib/utils";
import { Layers, Download } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string; date?: string }>;
}) {
  const ctx = await getSessionContext();
  requireModuleAccess(ctx, "attendance", "view");
  const canMark = canEdit(
    { profile: ctx.profile, staffPermissions: ctx.staffPermissions, teacherBatchIds: ctx.teacherBatchIds },
    "attendance"
  );

  const { batch: batchParam, date: dateParam } = await searchParams;
  // Local-timezone "today" (YYYY-MM-DD). toISOString() would give the UTC
  // date, which is the previous day for UTC+5:30 users between midnight
  // and 5:30 AM — making today's attendance impossible to mark.
  const today = new Date().toLocaleDateString("en-CA");
  const attendanceDate = dateParam ?? today;

  const supabase = await createClient();

  let batchesQuery = supabase.from("batches").select("id, name, code").eq("is_active", true).order("name");
  if (ctx.profile.role === "teacher") {
    batchesQuery = batchesQuery.in("id", ctx.teacherBatchIds.length ? ctx.teacherBatchIds : ["00000000-0000-0000-0000-000000000000"]);
  }
  const { data: batches } = await batchesQuery;

  const batchId = batchParam ?? batches?.[0]?.id;

  if (!batches || batches.length === 0) {
    return (
      <div>
        <PageHeader title="Attendance" description="Mark daily attendance batch-by-batch." />
        <EmptyState icon={Layers} title="No batches assigned" description="Ask your admin to assign you to a batch, or create one from Batches." />
      </div>
    );
  }

  const [{ data: students }, { data: existingAttendance }, { data: absentToday }] = await Promise.all([
    batchId
      ? supabase
          .from("students")
          .select("id, full_name, student_code, primary_parent_phone, father_name")
          .eq("batch_id", batchId)
          .eq("is_active", true)
          .order("full_name")
      : Promise.resolve({ data: [] }),
    batchId
      ? supabase.from("attendance").select("student_id, status").eq("batch_id", batchId).eq("attendance_date", attendanceDate)
      : Promise.resolve({ data: [] }),
    supabase
      .from("attendance")
      .select("student:students(full_name, primary_parent_phone), batch:batches(name)")
      .eq("attendance_date", attendanceDate)
      .eq("status", "absent")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const existingMap = Object.fromEntries((existingAttendance ?? []).map((a) => [a.student_id, a.status]));

  const absentList = (absentToday ?? []) as unknown as Array<{
    student: { full_name: string; primary_parent_phone: string | null } | null;
    batch: { name: string } | null;
  }>;

  return (
    <div>
      <PageHeader
        title="Attendance"
        description={canMark ? "Select a batch and date, then mark each student Present or Absent." : "Viewing attendance records."}
        actions={
          <Button variant="outline" asChild>
            <a href={`/api/export/attendance?batch=${batchId ?? ""}&from=${attendanceDate}&to=${attendanceDate}`}><Download /> Export Excel</a>
          </Button>
        }
      />

      <BatchDatePicker batches={batches} today={today} selectedBatchId={batchId} />

      {!batchId || !students ? (
        <EmptyState icon={Layers} title="Select a batch to begin" />
      ) : canMark ? (
        <AttendanceForm
          key={`${batchId}-${attendanceDate}`}
          batchId={batchId}
          attendanceDate={attendanceDate}
          students={students}
          existing={existingMap as Record<string, "present" | "absent">}
        />
      ) : (
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {students.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <span className="font-medium">{s.full_name}</span>
                <span className="text-sm text-muted-foreground">
                  {existingMap[s.id] === "present" ? "Present" : existingMap[s.id] === "absent" ? "Absent" : "Not marked"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Absent today ({attendanceDate})</CardTitle>
        </CardHeader>
        <CardContent>
          {absentList.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No absences recorded for this date yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {absentList.map((row, i) => (
                <li key={i} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{row.student?.full_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{row.batch?.name}</p>
                  </div>
                  {row.student?.primary_parent_phone && (
                    <a
                      href={telHref(row.student.primary_parent_phone)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                    >
                      <PhoneCall className="size-3.5" /> Call parent
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
