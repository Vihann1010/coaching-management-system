import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { getSessionContext, requireModuleAccess } from "@/lib/session";
import { canEdit } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CreateTestDialog } from "@/components/tests/create-test-dialog";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { formatDate, unwrapEmbed } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TestsPage() {
  const ctx = await getSessionContext();
  requireModuleAccess(ctx, "tests", "view");
  const canCreate = canEdit(
    { profile: ctx.profile, staffPermissions: ctx.staffPermissions, teacherBatchIds: ctx.teacherBatchIds },
    "tests"
  );

  const supabase = await createClient();

  let batchesQuery = supabase.from("batches").select("id, name, code").eq("is_active", true).order("name");
  if (ctx.profile.role === "teacher") {
    batchesQuery = batchesQuery.in("id", ctx.teacherBatchIds.length ? ctx.teacherBatchIds : ["00000000-0000-0000-0000-000000000000"]);
  }
  const { data: batches } = await batchesQuery;

  const { data: tests } = await supabase
    .from("tests")
    .select("id, name, topic, test_date, max_marks, batch:batches(name)")
    .order("test_date", { ascending: false });

  const testIds = (tests ?? []).map((t) => t.id);
  const { data: stats } = testIds.length
    ? await supabase.from("test_stats").select("*").in("test_id", testIds)
    : { data: [] };
  const statsMap = new Map((stats ?? []).map((s) => [s.test_id, s]));

  return (
    <div>
      <PageHeader
        title="Tests"
        description={`${tests?.length ?? 0} test${(tests?.length ?? 0) === 1 ? "" : "s"}`}
        actions={canCreate ? <CreateTestDialog batches={batches ?? []} /> : undefined}
      />

      {!tests || tests.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No tests yet"
          description="Create a test to start recording marks."
          action={canCreate ? <CreateTestDialog batches={batches ?? []} /> : undefined}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Test</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Max Marks</TableHead>
              <TableHead className="text-right">Appeared</TableHead>
              <TableHead className="text-right">Average</TableHead>
              <TableHead className="text-right">Highest</TableHead>
              <TableHead className="text-right">Lowest</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tests.map((t) => {
              const s = statsMap.get(t.id);
              return (
                <TableRow key={t.id}>
                  <TableCell>
                    <Link href={`/tests/${t.id}`} className="font-medium hover:text-primary">{t.name}</Link>
                    <div className="text-xs text-muted-foreground">{t.topic || "—"}</div>
                  </TableCell>
                  <TableCell className="text-sm">{unwrapEmbed(t.batch)?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(t.test_date)}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.max_marks}</TableCell>
                  <TableCell className="text-right tabular-nums">{s?.appeared_count ?? 0}{s?.absent_count ? ` (${s.absent_count} absent)` : ""}</TableCell>
                  <TableCell className="text-right tabular-nums">{s?.average_percentage !== null && s?.average_percentage !== undefined ? `${s.average_percentage}%` : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{s?.highest_marks ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{s?.lowest_marks ?? "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
