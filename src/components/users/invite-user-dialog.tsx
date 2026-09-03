"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, AlertCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { inviteUserAction, type UserActionState } from "@/app/(dashboard)/users/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{pending ? "Sending invite…" : "Send invite"}</Button>;
}

export function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<UserActionState, FormData>(inviteUserAction, {});
  const router = useRouter();

  // This effect syncs local UI state (closing the dialog) to the
  // *result* of a Server Action returned via useActionState, which only
  // changes after a real user submission -- not on every render.
  useEffect(() => {
    if (state.success) {
      toast.success("Invite sent");
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
        <Button><UserPlus /> Add team member</Button>
      </DialogTrigger>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
          <DialogDescription>They&apos;ll get an email with a link to set their password and sign in.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {state.error && (
            <div className="flex items-start gap-2 rounded-md bg-[var(--danger-bg)] text-[var(--danger)] text-sm px-3 py-2.5">
              <AlertCircle className="size-4 shrink-0 mt-0.5" /><span>{state.error}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input name="full_name" required />
            {err("full_name") && <p className="text-xs text-[var(--danger)]">{err("full_name")}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" name="email" required />
            {err("email") && <p className="text-xs text-[var(--danger)]">{err("email")}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Phone (optional)</Label>
            <Input name="phone" />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select name="role" defaultValue="staff">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin / Owner</SelectItem>
                <SelectItem value="accountant">Accountant</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
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
