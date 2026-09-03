"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { saveAttendanceAction } from "@/app/(dashboard)/attendance/actions";
import type { AttendanceStatus } from "@/types/database";

export interface AttendanceStudentRow {
  id: string;
  full_name: string;
  student_code: string;
  primary_parent_phone: string | null;
  father_name: string | null;
}

export function AttendanceForm({
  batchId,
  attendanceDate,
  students,
  existing,
}: {
  batchId: string;
  attendanceDate: string;
  students: AttendanceStudentRow[];
  existing: Record<string, AttendanceStatus>;
}) {
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(() => ({ ...existing }));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const presentCount = useMemo(
    () => Object.values(statuses).filter((s) => s === "present").length,
    [statuses]
  );
  const absentCount = useMemo(
    () => Object.values(statuses).filter((s) => s === "absent").length,
    [statuses]
  );
  const unmarkedCount = students.length - presentCount - absentCount;

  function setStatus(studentId: string, status: AttendanceStatus) {
    setStatuses((prev) => ({ ...prev, [studentId]: status }));
  }

  function markAll(status: AttendanceStatus) {
    setStatuses(Object.fromEntries(students.map((s) => [s.id, status])));
  }

  function handleSave() {
    startTransition(async () => {
      const entries = students
        .filter((s) => statuses[s.id])
        .map((s) => ({ student_id: s.id, status: statuses[s.id] }));

      const result = await saveAttendanceAction({
        batch_id: batchId,
        attendance_date: attendanceDate,
        entries,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Attendance saved for ${entries.length} student${entries.length === 1 ? "" : "s"}`);
        setConfirmOpen(false);
        router.refresh();
      }
    });
  }

  if (students.length === 0) {
    return <EmptyState icon={Users} title="No students in this batch" description="Assign students to this batch first." />;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => markAll("present")}>
            <Check className="text-[var(--success)]" /> Mark all Present
          </Button>
          <Button variant="outline" size="sm" onClick={() => markAll("absent")}>
            <X className="text-[var(--danger)]" /> Mark all Absent
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="text-[var(--success)] font-medium">{presentCount} present</span>
          {" · "}
          <span className="text-[var(--danger)] font-medium">{absentCount} absent</span>
          {unmarkedCount > 0 && <> · <span className="font-medium">{unmarkedCount} unmarked</span></>}
        </p>
      </div>

      <Card>
        <CardContent className="p-0 divide-y divide-border">
          {students.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{s.full_name}</p>
                <p className="text-xs text-muted-foreground tabular-nums">{s.student_code}</p>
              </div>
              <div className="flex gap-1.5 shrink-0" role="radiogroup" aria-label={`Attendance for ${s.full_name}`}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={statuses[s.id] === "present"}
                  onClick={() => setStatus(s.id, "present")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-3.5 py-2.5 min-h-11 text-sm font-medium cursor-pointer transition-colors active:scale-95",
                    statuses[s.id] === "present"
                      ? "bg-[var(--success-bg)] border-[var(--success)] text-[var(--success)]"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Check className="size-3.5" /> Present
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={statuses[s.id] === "absent"}
                  onClick={() => setStatus(s.id, "absent")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-3.5 py-2.5 min-h-11 text-sm font-medium cursor-pointer transition-colors active:scale-95",
                    statuses[s.id] === "absent"
                      ? "bg-[var(--danger-bg)] border-[var(--danger)] text-[var(--danger)]"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <X className="size-3.5" /> Absent
                </button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end mt-4">
        <Button size="lg" onClick={() => setConfirmOpen(true)} disabled={presentCount + absentCount === 0}>
          Save attendance
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Save today's attendance?"
        description={
          <>
            You&apos;re about to save <strong>{presentCount} present</strong> and <strong>{absentCount} absent</strong>
            {unmarkedCount > 0 && <> ({unmarkedCount} student{unmarkedCount === 1 ? "" : "s"} left unmarked won&apos;t be saved)</>}.
          </>
        }
        confirmLabel="Save attendance"
        loading={isPending}
        onConfirm={handleSave}
      />
    </div>
  );
}
