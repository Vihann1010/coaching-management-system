"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { validateMarks, computeMarkPercentage } from "@/lib/calculations";
import { saveMarksAction } from "@/app/(dashboard)/tests/actions";

export interface MarksStudentRow {
  id: string;
  full_name: string;
  student_code: string;
}

interface MarkEntry {
  marks: string;
  isAbsent: boolean;
}

export function MarksEntryForm({
  testId,
  maxMarks,
  students,
  existing,
  readOnly = false,
}: {
  testId: string;
  maxMarks: number;
  students: MarksStudentRow[];
  existing: Record<string, { marks_obtained: number | null; is_absent: boolean }>;
  readOnly?: boolean;
}) {
  const [entries, setEntries] = useState<Record<string, MarkEntry>>(() =>
    Object.fromEntries(
      students.map((s) => {
        const e = existing[s.id];
        return [s.id, { marks: e?.marks_obtained != null ? String(e.marks_obtained) : "", isAbsent: e?.is_absent ?? false }];
      })
    )
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function update(studentId: string, patch: Partial<MarkEntry>) {
    setEntries((prev) => ({ ...prev, [studentId]: { ...prev[studentId], ...patch } }));
  }

  const errors = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [id, e] of Object.entries(entries)) {
      if (e.isAbsent || e.marks === "") continue;
      const result = validateMarks(Number(e.marks), maxMarks);
      if (!result.valid) out[id] = result.error!;
    }
    return out;
  }, [entries, maxMarks]);

  const hasErrors = Object.keys(errors).length > 0;
  const filledCount = Object.values(entries).filter((e) => e.isAbsent || e.marks !== "").length;

  function handleSave() {
    if (hasErrors) {
      toast.error("Fix the highlighted marks before saving.");
      return;
    }
    startTransition(async () => {
      const payload = {
        test_id: testId,
        entries: Object.entries(entries)
          .filter(([, e]) => e.isAbsent || e.marks !== "")
          .map(([student_id, e]) => ({
            student_id,
            marks_obtained: e.isAbsent ? null : Number(e.marks),
            is_absent: e.isAbsent,
          })),
      };
      const result = await saveMarksAction(payload);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Marks saved for ${payload.entries.length} student${payload.entries.length === 1 ? "" : "s"}`);
        router.refresh();
      }
    });
  }

  if (students.length === 0) {
    return <EmptyState icon={Users} title="No students in this batch" />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">{filledCount} of {students.length} entered</p>
        {!readOnly && (
          <Button onClick={handleSave} loading={isPending} disabled={hasErrors}>
            <Save /> Save marks
          </Button>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead className="w-32">Marks obtained</TableHead>
            <TableHead className="w-28">Absent</TableHead>
            <TableHead className="text-right w-24">%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((s) => {
            const e = entries[s.id];
            const pct = !e.isAbsent && e.marks !== "" && !errors[s.id] ? computeMarkPercentage(Number(e.marks), maxMarks) : null;
            return (
              <TableRow key={s.id}>
                <TableCell>
                  <p className="font-medium">{s.full_name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">{s.student_code}</p>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.5"
                    min={0}
                    max={maxMarks}
                    value={e.marks}
                    disabled={e.isAbsent || readOnly}
                    onChange={(ev) => update(s.id, { marks: ev.target.value })}
                    className={errors[s.id] ? "border-[var(--danger)] focus-visible:ring-[var(--danger)]" : ""}
                    aria-label={`Marks for ${s.full_name}`}
                    aria-invalid={!!errors[s.id]}
                  />
                  {errors[s.id] && <p className="text-xs text-[var(--danger)] mt-1">{errors[s.id]}</p>}
                </TableCell>
                <TableCell>
                  <Checkbox
                    checked={e.isAbsent}
                    disabled={readOnly}
                    onCheckedChange={(checked) => update(s.id, { isAbsent: checked === true, marks: checked === true ? "" : e.marks })}
                    aria-label={`Mark ${s.full_name} absent`}
                  />
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm font-medium">
                  {e.isAbsent ? "—" : pct !== null ? `${pct}%` : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
