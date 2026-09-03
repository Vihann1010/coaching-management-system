"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const ALL = "__all__";

export function AuditLogFilters({ entities }: { entities: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL) params.delete(key); else params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <Select value={searchParams.get("entity") ?? ALL} onValueChange={(v) => setParam("entity", v)}>
        <SelectTrigger className="w-44"><SelectValue placeholder="All entities" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All entities</SelectItem>
          {entities.map((e) => <SelectItem key={e} value={e} className="capitalize">{e.replace("_", " ")}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={searchParams.get("action") ?? ALL} onValueChange={(v) => setParam("action", v)}>
        <SelectTrigger className="w-40"><SelectValue placeholder="All actions" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All actions</SelectItem>
          <SelectItem value="created">Created</SelectItem>
          <SelectItem value="updated">Updated</SelectItem>
          <SelectItem value="deleted">Deleted</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
