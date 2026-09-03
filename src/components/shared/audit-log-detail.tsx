"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import type { AuditLog } from "@/types/database";

export function AuditLogDetail({ log }: { log: AuditLog }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}><Eye className="size-3.5" /> View</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle className="capitalize">{log.action} — {log.entity.replace("_", " ")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-muted-foreground text-xs mb-1">When</p><p>{formatDateTime(log.created_at)}</p></div>
              <div><p className="text-muted-foreground text-xs mb-1">Who</p><p>{log.actor_name ?? "System"} {log.actor_role && `(${log.actor_role})`}</p></div>
            </div>
            {log.previous_value && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">Previous value</p>
                <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto max-h-64">{JSON.stringify(log.previous_value, null, 2)}</pre>
              </div>
            )}
            {log.new_value && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">New value</p>
                <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto max-h-64">{JSON.stringify(log.new_value, null, 2)}</pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
