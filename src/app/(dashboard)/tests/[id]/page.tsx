import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trophy, TrendingDown, TrendingUp, Users, Download } from "lucide-react";
import { getSessionContext, requireModuleAccess } from "@/lib/session";
import { canEdit } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { MarksEntryForm } from "@/components/tests/marks-entry-form";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getSessionContext();
  requireModuleAccess(ctx, "tests", "view");
  const canEnterMarks = canEdit(
    { profile: ctx.profile, staffPermissions: ctx.staffPermissions, teacherBatchIds: ctx.teacherBatchIds },
    "tests"
  );

  const supabase = await createClient();

  const { data: test } = await supabase
    .from("tests")
    .select("*, batch:batches(id, name, code)")
    .eq("id", id)
    .single();

  if (!test) notFound();

  const [{ data: students }, { data: marks }, { data: stats }] = await Promise.all([
    supabase.from("students").select("id, full_name, student_code").eq("batch_id", test.batch_id).eq("is_active", true).order("full_name"),
    supabase.from("test_marks").select("student_id, marks_obtained, is_absent").eq("test_id", id),
    supabase.from("test_stats").select("*").eq("test_id", id).maybeSingle(),
  ]);

  const existing = Object.fromEntries(
    (marks ?? []).map((m) => [m.student_id, { marks_obtained: m.marks_obtained !== null ? Number(m.marks_obtained) : null, is_absent: m.is_absent }])
  );

  return (
    <div>
      <Link href="/tests" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="size-3.5" /> Back to tests
      </Link>

      <PageHeader
        title={test.name}
        description={`${test.batch?.name ?? "—"} • ${test.topic ?? "No topic"} • ${formatDate(test.test_date)} • Max marks: ${test.max_marks}`}
        actions={
          <Button variant="outline" asChild>
            <a href={`/api/export/tests?testId=${id}`}><Download /> Export Excel</a>
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Appeared" value={stats?.appeared_count ?? 0} icon={Users} accent="brand" hint={stats?.absent_count ? `${stats.absent_count} absent` : undefined} />
        <StatCard label="Average" value={stats?.average_percentage !== null && stats?.average_percentage !== undefined ? `${stats.average_percentage}%` : "—"} icon={TrendingUp} accent="info" />
        <StatCard label="Highest" value={stats?.highest_marks ?? "—"} icon={Trophy} accent="success" />
        <StatCard label="Lowest" value={stats?.lowest_marks ?? "—"} icon={TrendingDown} accent="warning" />
      </div>

      <MarksEntryForm testId={id} maxMarks={Number(test.max_marks)} students={students ?? []} existing={existing} readOnly={!canEnterMarks} />

      {!canEnterMarks && (
        <p className="text-xs text-muted-foreground mt-4">You have view-only access to marks for this test.</p>
      )}
    </div>
  );
}
