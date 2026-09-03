"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateSettingsAction, type SettingsActionState } from "@/app/(dashboard)/settings/actions";
import type { AppSettings } from "@/types/database";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" loading={pending}>{pending ? "Saving…" : "Save settings"}</Button>;
}

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const [state, formAction] = useActionState<SettingsActionState, FormData>(updateSettingsAction, {});
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      toast.success("Settings saved");
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const err = (f: string) => state.fieldErrors?.[f];

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="flex items-start gap-2 rounded-md bg-[var(--danger-bg)] text-[var(--danger)] text-sm px-3 py-2.5">
          <AlertCircle className="size-4 shrink-0 mt-0.5" /><span>{state.error}</span>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Coaching name</Label>
          <Input name="coaching_name" defaultValue={settings.coaching_name} required />
          {err("coaching_name") && <p className="text-xs text-[var(--danger)]">{err("coaching_name")}</p>}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Logo URL (optional)</Label>
          <Input name="logo_url" defaultValue={settings.logo_url ?? ""} placeholder="https://…" />
        </div>
        <div className="space-y-1.5">
          <Label>Contact email</Label>
          <Input type="email" name="contact_email" defaultValue={settings.contact_email} />
        </div>
        <div className="space-y-1.5">
          <Label>Contact phone</Label>
          <Input name="contact_phone" defaultValue={settings.contact_phone} />
        </div>
        <div className="space-y-1.5">
          <Label>Academic session</Label>
          <Input name="academic_session" defaultValue={settings.academic_session} placeholder="2026-27" required />
        </div>
        <div className="space-y-1.5">
          <Label>Currency code</Label>
          <Input name="currency" defaultValue={settings.currency} required />
        </div>
        <div className="space-y-1.5">
          <Label>Fee overdue after (days)</Label>
          <Input type="number" min={1} name="fee_overdue_days" defaultValue={settings.fee_overdue_days} required />
          <p className="text-xs text-muted-foreground">Students with a pending balance are marked &quot;Overdue&quot; after this many days since their last payment.</p>
        </div>
      </div>
      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
