import Link from "next/link";
import {
  Users, UserCheck, Layers, CalendarCheck, CalendarX, Wallet, AlertCircle,
  ClipboardList, UserPlus, Wallet as WalletIcon, CheckSquare, FilePlus,
  TrendingUp, ArrowRight,
} from "lucide-react";
import { getSessionContext } from "@/lib/session";
import { canView } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const permCtx = { profile: ctx.profile, staffPermissions: ctx.staffPermissions, teacherBatchIds: ctx.teacherBatchIds };
  const showStudents = canView(permCtx, "students");
  const showFees = canView(permCtx, "fees");
  const showAttendance = canView(permCtx, "attendance");
  const showTests = canView(permCtx, "tests");

  const today = new Date().toISOString().slice(0, 10);

  const [
    studentsCountRes,
    activeStudentsCountRes,
    batchesCountRes,
    attendanceTodayRes,
    absentTodayRes,
    paymentsRes,
    financialsRes,
    recentTestsRes,
  ] = await Promise.all([
    showStudents ? supabase.from("students").select("id", { count: "exact", head: true }) : null,
    showStudents
      ? supabase.from("students").select("id", { count: "exact", head: true }).eq("is_active", true)
      : null,
    supabase.from("batches").select("id", { count: "exact", head: true }).eq("is_active", true),
    showAttendance
      ? supabase.from("attendance").select("status").eq("attendance_date", today)
      : null,
    showAttendance
      ? supabase
          .from("attendance")
          .select("student:students(full_name), batch:batches(name)")
          .eq("attendance_date", today)
          .eq("status", "absent")
          .limit(8)
      : null,
    showFees ? supabase.from("payments").select("amount").eq("is_voided", false) : null,
    showFees ? supabase.from("student_financials").select("pending_fee") : null,
    showTests
      ? supabase
          .from("tests")
          .select("id, name, topic, test_date, batch:batches(name)")
          .order("test_date", { ascending: false })
          .limit(5)
      : null,
  ]);

  const totalStudents = studentsCountRes?.count ?? 0;
  const activeStudents = activeStudentsCountRes?.count ?? 0;
  const totalBatches = batchesCountRes?.count ?? 0;

  const attendanceRows = attendanceTodayRes?.data ?? [];
  const presentToday = attendanceRows.filter((r) => r.status === "present").length;
  const absentToday = attendanceRows.filter((r) => r.status === "absent").length;

  const totalCollected = (paymentsRes?.data ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPending = (financialsRes?.data ?? []).reduce((sum, f) => sum + Number(f.pending_fee), 0);

  const absentList = (absentTodayRes?.data ?? []) as unknown as Array<{
    student: { full_name: string } | null;
    batch: { name: string } | null;
  }>;

  const recentTests = (recentTestsRes?.data ?? []) as unknown as Array<{
    id: string;
    name: string;
    topic: string | null;
    test_date: string;
    batch: { name: string } | null;
  }>;

  const quickActions = [
    showStudents && { label: "Add Student", href: "/students/new", icon: UserPlus },
    showFees && { label: "Record Payment", href: "/fees", icon: WalletIcon },
    showAttendance && { label: "Take Attendance", href: "/attendance", icon: CheckSquare },
    showTests && { label: "Create Test", href: "/tests", icon: FilePlus },
    showFees && { label: "View Pending Fees", href: "/reports?report=pending-fees", icon: AlertCircle },
    { label: "Reports", href: "/reports", icon: TrendingUp },
  ].filter(Boolean) as Array<{ label: string; href: string; icon: typeof UserPlus }>;

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${ctx.profile.full_name.split(" ")[0]}`}
        description="Here's what's happening at your coaching today."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {showStudents && (
          <>
            <StatCard label="Total Students" value={totalStudents} icon={Users} accent="brand" />
            <StatCard label="Active Students" value={activeStudents} icon={UserCheck} accent="success" />
          </>
        )}
        <StatCard label="Total Batches" value={totalBatches} icon={Layers} accent="info" />
        {showAttendance && (
          <>
            <StatCard label="Present Today" value={presentToday} icon={CalendarCheck} accent="success" />
            <StatCard label="Absent Today" value={absentToday} icon={CalendarX} accent="danger" />
          </>
        )}
        {showFees && (
          <>
            <StatCard
              label="Fees Collected"
              value={formatCurrency(totalCollected)}
              icon={Wallet}
              accent="success"
              hint="All-time, excluding voided payments"
            />
            <StatCard
              label="Fees Pending"
              value={formatCurrency(totalPending)}
              icon={AlertCircle}
              accent="warning"
            />
          </>
        )}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border p-4 text-center hover:border-[var(--brand-300,var(--brand-500))] hover:bg-[var(--brand-50)] transition-colors"
            >
              <action.icon className="size-5 text-[var(--brand-600)]" />
              <span className="text-xs font-medium leading-tight">{action.label}</span>
            </Link>
          ))}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {showAttendance && (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Absent today</CardTitle>
              <Link href="/attendance" className="text-xs font-medium text-primary flex items-center gap-1 hover:underline">
                Take attendance <ArrowRight className="size-3" />
              </Link>
            </CardHeader>
            <CardContent className="pt-0">
              {absentList.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No absences recorded yet today.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {absentList.map((row, i) => (
                    <li key={i} className="py-2.5 flex items-center justify-between text-sm">
                      <span className="font-medium">{row.student?.full_name ?? "—"}</span>
                      <span className="text-muted-foreground text-xs">{row.batch?.name ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {showTests && (
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Recent tests</CardTitle>
              <Link href="/tests" className="text-xs font-medium text-primary flex items-center gap-1 hover:underline">
                <ClipboardList className="size-3" /> View all
              </Link>
            </CardHeader>
            <CardContent className="pt-0">
              {recentTests.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No tests created yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {recentTests.map((t) => (
                    <li key={t.id} className="py-2.5 flex items-center justify-between text-sm">
                      <div>
                        <Link href={`/tests/${t.id}`} className="font-medium hover:text-primary">
                          {t.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{t.batch?.name} • {t.topic ?? "—"}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDate(t.test_date)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {!showStudents && !showFees && !showAttendance && !showTests && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            You don&apos;t have access to any modules yet. Ask your admin to grant permissions from Settings → Users.
            <div className="mt-4">
              <Button asChild variant="outline" size="sm">
                <Link href="/settings">Go to Settings</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
