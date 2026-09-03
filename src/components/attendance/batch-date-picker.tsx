"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Batch } from "@/types/database";

export function BatchDatePicker({ batches }: { batches: Pick<Batch, "id" | "name" | "code">[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-4 mb-6">
      <div className="space-y-1.5">
        <Label>Batch</Label>
        <Select value={searchParams.get("batch") ?? ""} onValueChange={(v) => setParam("batch", v)}>
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
          value={searchParams.get("date") ?? new Date().toISOString().slice(0, 10)}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setParam("date", e.target.value)}
        />
      </div>
    </div>
  );
}
