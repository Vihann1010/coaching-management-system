"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Batch } from "@/types/database";

export function BatchDatePicker({
  batches,
  today,
  selectedBatchId,
}: {
  batches: Pick<Batch, "id" | "name" | "code">[];
  today: string;
  /** The batch the server page actually resolved (first batch when the
   *  URL has none) so the Select reflects it instead of a placeholder. */
  selectedBatchId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    // Clearing the date input sends "" — remove the param so the page
    // falls back to today, instead of querying a blank date.
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-4 mb-6">
      <div className="space-y-1.5">
        <Label>Batch</Label>
        <Select
          value={searchParams.get("batch") ?? selectedBatchId ?? ""}
          onValueChange={(v) => setParam("batch", v)}
        >
          <SelectTrigger className="w-56"><SelectValue placeholder="Select a batch" /></SelectTrigger>
          <SelectContent>
            {batches.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Date</Label>
        <Input
          type="date"
          className="w-44"
          value={searchParams.get("date") ?? today}
          max={today}
          onChange={(e) => setParam("date", e.target.value)}
        />
      </div>
    </div>
  );
}
