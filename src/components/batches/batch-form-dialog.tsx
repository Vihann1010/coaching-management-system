"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, AlertCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { createBatchAction, updateBatchAction, type BatchActionState } from "@/app/(dashboard)/batches/actions";
import type { Batch } from "@/types/database";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{pending ? "Saving…" : label}</Button>;
}

export function BatchFormDialog({ batch }: { batch?: Batch }) {
  const [open, setOpen] = useState(false);
  const action = batch ? updateBatchAction.bind(null, batch.id) : createBatchAction;
  const [state, formAction] = useActionState<BatchActionState, FormData>(action, {});
  const router = useRouter();

  // This effect syncs local UI state (closing the dialog) to the
  // *result* of a Server Action returned via useActionState, which only
  // changes after a real user submission -- not on every render -- so
  // it isn't the render-time derived-state anti-pattern this rule
  // targets.
  useEffect(() => {
    if (state.success) {
      toast.success(batch ? "Batch updated" : "Batch created");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const err = (f: string) => state.fieldErrors?.[f];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {batch ? (
          <Button variant="ghost" size="icon" className="size-8"><Pencil className="size-3.5" /></Button>
        ) : (
          <Button><Plus /> Add batch</Button>
        )}
      </DialogTrigger>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{batch ? "Edit batch" : "Add batch"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state.error && (
            <div className="flex items-start gap-2 rounded-md bg-[var(--danger-bg)] text-[var(--danger)] text-sm px-3 py-2.5">
              <AlertCircle className="size-4 shrink-0 mt-0.5" /><span>{state.error}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Batch name</Label>
            <Input name="name" defaultValue={batch?.name} placeholder="e.g. Batch A — Physics Foundation" required />
            {err("name") && <p className="text-xs text-[var(--danger)]">{err("name")}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Batch code</Label>
            <Input name="code" defaultValue={batch?.code} placeholder="e.g. BATCH-A" required />
            {err("code") && <p className="text-xs text-[var(--danger)]">{err("code")}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea name="description" defaultValue={batch?.description ?? ""} rows={2} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="is_active">Active</Label>
            <Switch id="is_active" name="is_active" defaultChecked={batch?.is_active ?? true} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton label={batch ? "Save changes" : "Create batch"} />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
