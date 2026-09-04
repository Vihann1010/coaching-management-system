"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SearchInput } from "@/components/shared/search-input";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { Batch } from "@/types/database";

const ALL = "__all__";

export function StudentsFilters({ batches }: { batches: Pick<Batch, "id" | "name" | "code">[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === ALL) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasFilters = ["search", "batch", "feeStatus", "attendance", "status"].some((k) => searchParams.get(k));

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <SearchInput
        value={searchParams.get("search") ?? ""}
        onChange={(v) => setParam("search", v)}
        placeholder="Search name, parent, phone, ID…"
        className="w-full sm:w-72"
      />

      <Select value={searchParams.get("batch") ?? ALL} onValueChange={(v) => setParam("batch", v)}>
        <SelectTrigger className="w-40"><SelectValue placeholder="All batches" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All batches</SelectItem>
          {batches.map((b) => (
            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={searchParams.get("feeStatus") ?? ALL} onValueChange={(v) => setParam("feeStatus", v)}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Fee status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any fee status</SelectItem>
          <SelectItem value="paid">Paid</SelectItem>
          <SelectItem value="partial">Partially Paid</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="overdue">Overdue</SelectItem>
        </SelectContent>
      </Select>

      <Select value={searchParams.get("status") ?? "active"} onValueChange={(v) => setParam("status", v)}>
        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="active">Active only</SelectItem>
          <SelectItem value="inactive">Inactive only</SelectItem>
          <SelectItem value={ALL}>All students</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
          <X className="size-3.5" /> Clear filters
        </Button>
      )}
    </div>
  );
}
