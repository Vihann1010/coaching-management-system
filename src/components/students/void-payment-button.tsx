"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { voidPaymentAction } from "@/app/(dashboard)/students/actions";

export function VoidPaymentButton({ paymentId, studentId }: { paymentId: string; studentId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleVoid() {
    startTransition(async () => {
      const result = await voidPaymentAction(paymentId, studentId, reason);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Payment voided");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="text-[var(--danger)] hover:bg-[var(--danger-bg)]" onClick={() => setOpen(true)}>
        <Ban className="size-3.5" /> Void
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Void this payment?</DialogTitle>
            <DialogDescription>
              The transaction stays in the record for audit purposes but no longer counts toward fees paid.
              This can&apos;t be undone from here — an admin can review it in Audit Logs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Reason (recommended)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. entered against the wrong student" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
            <Button variant="destructive" onClick={handleVoid} loading={isPending}>Void payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
