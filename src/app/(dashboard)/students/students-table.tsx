import Link from "next/link";
import { UserPlus, Users as UsersIcon, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAppSettings } from "@/lib/settings";
import { computeFeeStatus } from "@/lib/calculations";
import { EmptyState } from "@/components/shared/empty-state";
import { FeeStatusBadge } from "@/components/shared/status-badge";
import { StudentsFilters } from "@/components/students/students-filters";
import { StudentRowActions } from "@/components/students/student-row-actions";
import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { formatCurrency, formatDate, telHref, unwrapEmbed } from "@/lib/utils";
import type { FeeStatus } from "@/types/database";

const PAGE_SIZE = 20;

export default async function StudentsTable({
  params,
  canEditStudents,
}: {
  params: Record<string, string | undefined>;
  canEditStudents: boolean;
}) {
  const supabase = await createClient();

  const search = params.search?.trim() ?? "";
  const batchFilter = params.batch ?? "";
  const feeStatusFilter = (params.feeStatus ?? "") as FeeStatus | "";
  const statusFilter = params.status ?? "active";
  const page = Math.max(1, Number(params.page) || 1);

  const [settings, { data: batches }, studentsQuery] = await Promise.all([
    getAppSettings(),
    supabase.from("batches").select("id, name, code").order("name"),
    (async () => {
      let query = supabase
        .from("students")
        .select("id, student_code, full_name, father_name, student_phone, primary_parent_phone, batch_id, admission_date, is_active, final_fee, batch:batches(id, name, code)")
        .order("full_name");

      if (statusFilter === "active") query = query.eq("is_active", true);
      if (statusFilter === "inactive") query = query.eq("is_active", false);
      if (batchFilter) query = query.eq("batch_id", batchFilter);
      if (search) {
        const esc = search.replace(/[%_]/g, "");
        query = query.or(
          `full_name.ilike.%${esc}%,father_name.ilike.%${esc}%,mother_name.ilike.%${esc}%,student_phone.ilike.%${esc}%,primary_parent_phone.ilike.%${esc}%,student_code.ilike.%${esc}%`
        );
      }
      return query.limit(2000);
    })(),
  ]);

  const students = (studentsQuery?.data ?? []).map((s) => ({
    ...s,
    batch: unwrapEmbed(s.batch),
  }));
  const studentIds = students.map((s) => s.id);

  const [{ data: financials }, { data: attendance }] = await Promise.all([
    studentIds.length
      ? supabase.from("student_financials").select("*").in("student_id", studentIds)
      : Promise.resolve({ data: [] }),
    studentIds.length
      ? supabase.from("student_attendance_summary").select("*").in("student_id", studentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const finMap = new Map((financials ?? []).map((f) => [f.student_id, f]));
  const attMap = new Map((attendance ?? []).map((a) => [a.student_id, a]));

 let enriched = students.map((s) => {
    const fin = finMap.get(s.id);
    const att = attMap.get(s.id);
    const totalPaid = fin?.total_paid ?? 0;
    const pendingFee = fin?.pending_fee ?? s.final_fee;
    const feeStatus = computeFeeStatus({
      finalFee: s.final_fee,
      totalPaid,
      lastPaymentDate: fin?.last_payment_date ?? null,
      admissionDate: s.admission_date,
      overdueDays: settings.fee_overdue_days,
    });
    return {
      ...s,
      totalPaid,
      pendingFee,
      feeStatus,
      attendancePercentage: att?.attendance_percentage ?? null,
    };
  });

 if (feeStatusFilter) {
    enriched = enriched.filter((s) => s.feeStatus === feeStatusFilter);
  }

  const total = enriched.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageStudents = enriched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportParams = new URLSearchParams();
 if (search) exportParams.set("search", search);
 if (batchFilter) exportParams.set("batch", batchFilter);
 if (feeStatusFilter) exportParams.set("feeStatus", feeStatusFilter);
 if (statusFilter) exportParams.set("status", statusFilter);

 return (
    <>
      <p className="text-sm text-muted-foreground mb-4">
        {total} student{total === 1 ? "" : "s"} {statusFilter === "active" ? "active" : statusFilter === "inactive" ? "inactive" : ""}
      </p>

      <StudentsFilters batches={batches ?? []} />

      {pageStudents.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="No students found"
          description="Try adjusting your search or filters, or add a new student to get started."
          action={canEditStudents && (
            <Button asChild size="sm"><Link href="/students/new"><UserPlus /> Add student</Link></Button>
          )}
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Admission</TableHead>
                <TableHead className="text-right">Final Fee</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageStudents.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link href={`/students/${s.id}`} className="font-medium hover:text-primary">
                      {s.full_name}
                    </Link>
                    <div className="text-xs text-muted-foreground tabular-nums">{s.student_code}</div>
                  </TableCell>
                  <TableCell>
                    {s.batch ? <span className="text-sm">{s.batch.name}</span> : <span className="text-muted-foreground text-sm">Unassigned</span>}
                  </TableCell>
                  <TableCell>
                    {s.primary_parent_phone || s.student_phone ? (
                      <a href={telHref(s.primary_parent_phone || s.student_phone)} className="text-sm inline-flex items-center gap-1 hover:text-primary">
                        <Phone className="size-3" /> {s.primary_parent_phone || s.student_phone}
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(s.admission_date)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{formatCurrency(s.final_fee)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm text-[var(--success)]">{formatCurrency(s.totalPaid)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-medium">{formatCurrency(s.pendingFee)}</TableCell>
                  <TableCell><FeeStatusBadge status={s.feeStatus} /></TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {s.attendancePercentage !== null ? `${s.attendancePercentage}%` : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <StudentRowActions
                      studentId={s.id}
                      studentName={s.full_name}
                      isActive={s.is_active}
                      canEdit={canEditStudents}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
                  {page > 1 ? (
                    <Link href={buildPageLink(params, page - 1)}>Previous</Link>
                  ) : <span>Previous</span>}
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} asChild={page < totalPages}>
                  {page < totalPages ? (
                    <Link href={buildPageLink(params, page + 1)}>Next</Link>
                  ) : <span>Next</span>}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

function buildPageLink(params: Record<string, string | undefined>, page: number) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && k !== "page") sp.set(k, v);
  }
  sp.set("page", String(page));
  return `/students?${sp.toString()}`;
}