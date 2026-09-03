import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil, Phone, ArrowLeft } from "lucide-react";
import { getSessionContext, requireModuleAccess } from "@/lib/session";
import { canView, canEdit } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getAppSettings } from "@/lib/settings";
import { computeFeeStatus, computeAttendancePercentage } from "@/lib/calculations";
import { Button } from "@/components/ui/button";
import { ActiveStatusBadge } from "@/components/shared/status-badge";
import { StudentProfileTabs } from "@/components/students/student-profile-tabs";
import { formatDate, initials, telHref } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { PaymentMethod } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function StudentProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; addPayment?: string }>;
}) {
  const { id } = await params;
  const { tab, addPayment } = await searchParams;
  const ctx = await getSessionContext();
  requireModuleAccess(ctx, "students", "view");

  const permCtx = { profile: ctx.profile, staffPermissions: ctx.staffPermissions, teacherBatchIds: ctx.teacherBatchIds };
  const showFees = canView(permCtx, "fees");
  const canEditFees = canEdit(permCtx, "fees");
  const canEditStudents = canEdit(permCtx, "students");
  const showAttendance = canView(permCtx, "attendance");
  const showTests = canView(permCtx, "tests");

  const supabase = await createClient();
  const settings = await getAppSettings();

  const { data: student } = await supabase
    .from("students")
    .select("*, batch:batches(id, name, code)")
    .eq("id", id)
    .single();

  if (!student) notFound();

  const [
    financialsRes,
    paymentsRes,
    attendanceRes,
    attendanceSummaryRes,
    marksRes,
  ] = await Promise.all([
    showFees ? supabase.from("student_financials").select("*").eq("student_id", id).maybeSingle() : Promise.resolve({ data: null }),
    showFees
      ? supabase
          .from("payments")
          .select("id, installment_number, payment_date, amount, payment_method, reference_number, notes, is_voided, voided_reason, created_by_profile:profiles!payments_created_by_fkey(full_name)")
          .eq("student_id", id)
          .order("installment_number", { ascending: false })
      : Promise.resolve({ data: [] }),
    showAttendance
      ? supabase.from("attendance").select("id, attendance_date, status").eq("student_id", id).order("attendance_date", { ascending: false }).limit(365)
      : Promise.resolve({ data: [] }),
    showAttendance ? supabase.from("student_attendance_summary").select("*").eq("student_id", id).maybeSingle() : Promise.resolve({ data: null }),
    showTests
      ? supabase
          .from("test_marks")
          .select("marks_obtained, is_absent, test:tests(id, name, topic, test_date, max_marks, batch:batches(name))")
          .eq("student_id", id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const financials = financialsRes.data ?? { final_fee: student.final_fee, total_paid: 0, pending_fee: student.final_fee, last_payment_date: null };
  const feeStatus = computeFeeStatus({
    finalFee: student.final_fee,
    totalPaid: financials.total_paid,
    lastPaymentDate: financials.last_payment_date,
    admissionDate: student.admission_date,
    overdueDays: settings.fee_overdue_days,
  });

  const payments = ((paymentsRes.data ?? []) as unknown as Array<{
    id: string; installment_number: number; payment_date: string; amount: number;
    payment_method: PaymentMethod; reference_number: string | null; notes: string | null;
    is_voided: boolean; voided_reason: string | null; created_by_profile: { full_name: string } | null;
  }>).map((p) => ({
    id: p.id, installment_number: p.installment_number, payment_date: p.payment_date, amount: Number(p.amount),
    payment_method: p.payment_method, reference_number: p.reference_number, notes: p.notes,
    is_voided: p.is_voided, voided_reason: p.voided_reason, created_by_name: p.created_by_profile?.full_name ?? null,
  }));

  const attendanceRows = (attendanceRes.data ?? []) as Array<{ id: string; attendance_date: string; status: "present" | "absent" }>;
  const attSummary = attendanceSummaryRes.data;
  const attendanceSummary = {
    total: attSummary?.total_classes ?? 0,
    present: attSummary?.present_count ?? 0,
    absent: attSummary?.absent_count ?? 0,
    percentage: attSummary?.attendance_percentage ?? computeAttendancePercentage(0, 0),
  };

  const testMarks = ((marksRes.data ?? []) as unknown as Array<{
    marks_obtained: number | null; is_absent: boolean;
    test: { id: string; name: string; topic: string | null; test_date: string; max_marks: number; batch: { name: string } | null } | null;
  }>)
    .filter((m) => m.test)
    .map((m) => ({
      test_id: m.test!.id, test_name: m.test!.name, topic: m.test!.topic, test_date: m.test!.test_date,
      max_marks: Number(m.test!.max_marks), marks_obtained: m.marks_obtained !== null ? Number(m.marks_obtained) : null,
      is_absent: m.is_absent, batch_name: m.test!.batch?.name ?? null,
    }));

  return (
    <div>
      <Link href="/students" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="size-3.5" /> Back to students
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback className="text-lg">{initials(student.full_name)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-[family-name:var(--font-display)] text-xl font-bold">{student.full_name}</h1>
              <ActiveStatusBadge isActive={student.is_active} />
            </div>
            <div className="flex items-center gap-3 flex-wrap text-sm text-muted-foreground mt-1">
              <span className="tabular-nums">{student.student_code}</span>
              <span>•</span>
              <span>{student.batch?.name ?? "Unassigned"}</span>
              <span>•</span>
              <span>Admitted {formatDate(student.admission_date)}</span>
              {student.primary_parent_phone && (
                <>
                  <span>•</span>
                  <a href={telHref(student.primary_parent_phone)} className="inline-flex items-center gap-1 hover:text-primary">
                    <Phone className="size-3" /> {student.primary_parent_phone}
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
        {canEditStudents && (
          <Button variant="outline" asChild>
            <Link href={`/students/${id}/edit`}><Pencil /> Edit</Link>
          </Button>
        )}
      </div>

      <StudentProfileTabs
        studentId={id}
        defaultTab={tab ?? "overview"}
        showFees={showFees}
        canEditFees={canEditFees}
        showAttendance={showAttendance}
        showTests={showTests}
        overview={{
          fatherName: student.father_name, motherName: student.mother_name,
          primaryRelation: student.primary_parent_relation, studentPhone: student.student_phone,
          fatherPhone: student.father_phone, motherPhone: student.mother_phone,
          primaryParentPhone: student.primary_parent_phone, address: student.address, notes: student.notes,
        }}
        financials={{
          originalFee: Number(student.original_fee), discount: Number(student.discount),
          finalFee: Number(student.final_fee), totalPaid: Number(financials.total_paid), pendingFee: Number(financials.pending_fee),
        }}
        feeStatus={feeStatus}
        payments={payments}
        attendanceRows={attendanceRows}
        attendanceSummary={attendanceSummary}
        testMarks={testMarks}
        autoOpenPayment={addPayment === "1"}
      />
    </div>
  );
}
