"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteBatchAction } from "@/app/(dashboard)/batches/actions";

export function BatchDeleteButton({ batchId, batchName }: { batchId: string; batchName: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteBatchAction(batchId);
      if (result.error) {
        toast.error(result.error);
        setOpen(false);
      } else {
        toast.success(`${batchName} deleted`);
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button variant="ghost" size="icon" className="size-8 text-[var(--danger)] hover:bg-[var(--danger-bg)]" onClick={() => setOpen(true)}>
        <Trash2 className="size-3.5" />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${batchName}?`}
        description="This only works if the batch has no students, tests or attendance history. Otherwise, mark it inactive instead."
        confirmLabel="Delete batch"
        destructive
        loading={isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
