"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { FilePlus, AlertCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { createTestAction, type TestActionState } from "@/app/(dashboard)/tests/actions";
import type { Batch } from "@/types/database";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{pending ? "Creating…" : "Create test"}</Button>;
}

export function CreateTestDialog({ batches }: { batches: Pick<Batch, "id" | "name" | "code">[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<TestActionState, FormData>(createTestAction, {});
  const err = (f: string) => state.fieldErrors?.[f];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><FilePlus /> Create test</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create a test</DialogTitle></DialogHeader>
        <form action={formAction} className="space-y-4">
          {state.error && (
            <div className="flex items-start gap-2 rounded-md bg-[var(--danger-bg)] text-[var(--danger)] text-sm px-3 py-2.5">
              <AlertCircle className="size-4 shrink-0 mt-0.5" /><span>{state.error}</span>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Test name</Label>
              <Input name="name" placeholder="e.g. Kinematics Test" required />
              {err("name") && <p className="text-xs text-[var(--danger)]">{err("name")}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Topic</Label>
              <Input name="topic" placeholder="e.g. Physics — Kinematics" />
            </div>
            <div className="space-y-1.5">
              <Label>Batch</Label>
              <Select name="batch_id" required>
                <SelectTrigger><SelectValue placeholder="Select a batch" /></SelectTrigger>
                <SelectContent>
                  {batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {err("batch_id") && <p className="text-xs text-[var(--danger)]">{err("batch_id")}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Test date</Label>
              <Input type="date" name="test_date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Maximum marks</Label>
              <Input type="number" step="0.5" min="1" name="max_marks" placeholder="e.g. 50" required />
              {err("max_marks") && <p className="text-xs text-[var(--danger)]">{err("max_marks")}</p>}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Description / notes (optional)</Label>
              <Textarea name="description" rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
