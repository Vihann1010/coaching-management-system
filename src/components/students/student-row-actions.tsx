"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Eye, Pencil, UserX, UserCheck, Wallet } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deactivateStudentAction, reactivateStudentAction } from "@/app/(dashboard)/students/actions";

export function StudentRowActions({
  studentId,
  studentName,
  isActive,
  canEdit,
}: {
  studentId: string;
  studentName: string;
  isActive: boolean;
  canEdit: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleToggleActive() {
    startTransition(async () => {
      const action = isActive ? deactivateStudentAction : reactivateStudentAction;
      const result = await action(studentId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(isActive ? `${studentName} marked inactive` : `${studentName} reactivated`);
        setConfirmOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Actions for {studentName}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/students/${studentId}`}><Eye /> View profile</Link>
          </DropdownMenuItem>
          {canEdit && (
            <DropdownMenuItem asChild>
              <Link href={`/students/${studentId}/edit`}><Pencil /> Edit details</Link>
            </DropdownMenuItem>
          )}
          {canEdit && (
            <DropdownMenuItem asChild>
              <Link href={`/students/${studentId}?tab=fees&addPayment=1`}><Wallet /> Record payment</Link>
            </DropdownMenuItem>
          )}
          {canEdit && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive={isActive} onSelect={() => setConfirmOpen(true)}>
                {isActive ? <UserX /> : <UserCheck />}
                {isActive ? "Mark inactive" : "Reactivate"}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={isActive ? `Mark ${studentName} inactive?` : `Reactivate ${studentName}?`}
        description={
          isActive
            ? "This hides them from active lists but keeps all their fee, attendance and test history. You can reactivate them anytime."
            : "This will show them again in active lists."
        }
        confirmLabel={isActive ? "Mark inactive" : "Reactivate"}
        destructive={isActive}
        loading={isPending}
        onConfirm={handleToggleActive}
      />
    </>
  );
}
