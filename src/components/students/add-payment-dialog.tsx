"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { AlertCircle, Plus } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { addPaymentAction, type ActionState } from "@/app/(dashboard)/students/actions";
import { formatCurrency } from "@/lib/utils";

function SubmitButton({ overridable }: { overridable: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} name="submitMode" value={overridable ? "override" : "normal"}>
      {overridable ? "Record anyway" : "Record payment"}
    </Button>
  );
}

export function AddPaymentDialog({
  studentId,
  pendingFee,
  defaultOpen = false,
}: {
  studentId: string;
  pendingFee: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [state, formAction] = useActionState<ActionState, FormData>(addPaymentAction, {});
  const [override, setOverride] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);

  // This effect syncs local UI state to the *result* of a Server Action
  // returned via useActionState, which only changes after a real user
  // submission -- not on every render.
  useEffect(() => {
    if (!formSubmitted) return;
    if (state.error?.includes("more than the pending amount")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOverride(true);
      return;
    }
    if (!state.error && !state.fieldErrors) {
      toast.success("Payment recorded");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const err = (field: string) => state.fieldErrors?.[field];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus /> Add payment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>
            Pending balance: <span className="font-medium text-foreground">{formatCurrency(pendingFee)}</span>
          </DialogDescription>
        </DialogHeader>

        <form
          action={formAction}
          onSubmit={() => setFormSubmitted(true)}
          className="space-y-4"
        >
          <input type="hidden" name="student_id" value={studentId} />
          {override && <input type="hidden" name="override_pending_check" value="true" />}

          {state.error && (
            <div className="flex items-start gap-2 rounded-md bg-[var(--warning-bg)] text-[var(--warning)] text-sm px-3 py-2.5">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{state.error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input type="number" step="0.01" min="0.01" name="amount" required autoFocus />
              {err("amount") && <p className="text-xs text-[var(--danger)]">{err("amount")}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Payment date</Label>
              <Input type="date" name="payment_date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Payment method</Label>
            <Select name="payment_method" defaultValue="cash">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Reference / transaction number (optional)</Label>
            <Input name="reference_number" placeholder="UPI ref, cheque no., etc." />
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea name="notes" rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton overridable={override} />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
