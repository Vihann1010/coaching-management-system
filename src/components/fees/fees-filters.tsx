"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { Batch } from "@/types/database";

const ALL = "__all__";

export function FeesFilters({ batches }: { batches: Pick<Batch, "id" | "name" | "code">[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === ALL) params.delete(key); else params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasFilters = ["from", "to", "batch", "method"].some((k) => searchParams.get(k));

  return (
    <div className="flex flex-wrap items-end gap-3 mb-4">
      <div className="space-y-1.5">
        <Label>From</Label>
        <Input type="date" className="w-40" value={searchParams.get("from") ?? ""} onChange={(e) => setParam("from", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>To</Label>
        <Input type="date" className="w-40" value={searchParams.get("to") ?? ""} onChange={(e) => setParam("to", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Batch</Label>
        <Select value={searchParams.get("batch") ?? ALL} onValueChange={(v) => setParam("batch", v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All batches" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All batches</SelectItem>
            {batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Method</Label>
        <Select value={searchParams.get("method") ?? ALL} onValueChange={(v) => setParam("method", v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All methods" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All methods</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="upi">UPI</SelectItem>
            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
            <SelectItem value="card">Card</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
          <X className="size-3.5" /> Clear
        </Button>
      )}
    </div>
  );
}
