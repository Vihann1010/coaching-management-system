"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { computeSuggestedFinalFee } from "@/lib/calculations";
import type { ActionState } from "@/app/(dashboard)/students/actions";
import type { Batch, Student } from "@/types/database";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function StudentForm({
  batches,
  student,
  action,
  submitLabel,
}: {
  batches: Pick<Batch, "id" | "name" | "code">[];
  student?: Student;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const [originalFee, setOriginalFee] = useState(student?.original_fee ?? 0);
  const [discount, setDiscount] = useState(student?.discount ?? 0);
  // Final fee is a derived value (original − discount) unless the user
  // has explicitly overridden it — computed directly during render
  // rather than synced via an effect, so editing an existing student
  // whose final_fee already differs from the suggested amount (a
  // special-case override) isn't silently clobbered on mount.
  const suggestedFinalFee = computeSuggestedFinalFee(originalFee, discount);
  const [finalFeeOverride, setFinalFeeOverride] = useState<number | null>(
    student && student.final_fee !== computeSuggestedFinalFee(student.original_fee, student.discount)
      ? student.final_fee
      : null
  );
  const finalFee = finalFeeOverride ?? suggestedFinalFee;

  const err = (field: string) => state.fieldErrors?.[field];

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <div className="flex items-start gap-2 rounded-md bg-[var(--danger-bg)] text-[var(--danger)] text-sm px-3 py-2.5">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{state.error}</span>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Student &amp; parent information</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <Field label="Student full name" error={err("full_name")} required>
            <Input name="full_name" defaultValue={student?.full_name} required />
          </Field>
          <Field label="Batch">
            <Select name="batch_id" defaultValue={student?.batch_id ?? undefined}>
              <SelectTrigger><SelectValue placeholder="Select a batch" /></SelectTrigger>
              <SelectContent>
                {batches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Father's name">
            <Input name="father_name" defaultValue={student?.father_name ?? ""} />
          </Field>
          <Field label="Mother's name">
            <Input name="mother_name" defaultValue={student?.mother_name ?? ""} />
          </Field>

          <Field label="Primary parent / guardian">
            <Select name="primary_parent_relation" defaultValue={student?.primary_parent_relation ?? "Father"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Father">Father</SelectItem>
                <SelectItem value="Mother">Mother</SelectItem>
                <SelectItem value="Guardian">Guardian</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Admission date" error={err("admission_date")} required>
            <Input
              type="date"
              name="admission_date"
              defaultValue={student?.admission_date ?? new Date().toISOString().slice(0, 10)}
              required
            />
          </Field>

          <Field label="Student phone" error={err("student_phone")}>
            <Input name="student_phone" defaultValue={student?.student_phone ?? ""} placeholder="98765 43210" />
          </Field>
          <Field label="Primary parent phone" error={err("primary_parent_phone")}>
            <Input name="primary_parent_phone" defaultValue={student?.primary_parent_phone ?? ""} placeholder="98765 43210" />
          </Field>

          <Field label="Father's phone" error={err("father_phone")}>
            <Input name="father_phone" defaultValue={student?.father_phone ?? ""} />
          </Field>
          <Field label="Mother's phone" error={err("mother_phone")}>
            <Input name="mother_phone" defaultValue={student?.mother_phone ?? ""} />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Address">
              <Textarea name="address" defaultValue={student?.address ?? ""} rows={2} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fees</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-4">
          <Field label="Original fee (₹)" error={err("original_fee")}>
            <Input
              type="number" step="0.01" min="0" name="original_fee"
              value={originalFee}
              onChange={(e) => setOriginalFee(Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Discount (₹)" error={err("discount")}>
            <Input
              type="number" step="0.01" min="0" name="discount"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value) || 0)}
            />
          </Field>
          <Field
            label="Final payable fee (₹)"
            error={err("final_fee")}
            hint="Auto-suggested as Original − Discount. Edit directly for special cases."
          >
            <Input
              type="number" step="0.01" min="0" name="final_fee"
              value={finalFee}
              onChange={(e) => setFinalFeeOverride(Number(e.target.value) || 0)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
        <CardContent>
          <Textarea name="notes" defaultValue={student?.notes ?? ""} rows={3} placeholder="Internal notes (not shown to the student/parent)" />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label} {required && <span className="text-[var(--danger)]">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}
