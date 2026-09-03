"use client";

import { useState } from "react";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { FeeStatusBadge, AttendanceStatusBadge } from "@/components/shared/status-badge";
import { AddPaymentDialog } from "./add-payment-dialog";
import { VoidPaymentButton } from "./void-payment-button";
import { formatCurrency, formatDate, formatDateTime, telHref } from "@/lib/utils";
import { computeMarkPercentage } from "@/lib/calculations";
import { Wallet, CalendarCheck, ClipboardList, Phone, User } from "lucide-react";
import type { FeeStatus, PaymentMethod } from "@/types/database";

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash", upi: "UPI", bank_transfer: "Bank Transfer", card: "Card", other: "Other",
};

export interface ProfilePayment {
  id: string; installment_number: number; payment_date: string; amount: number;
  payment_method: PaymentMethod; reference_number: string | null; notes: string | null;
  is_voided: boolean; voided_reason: string | null; created_by_name: string | null;
}
export interface ProfileAttendanceRow { id: string; attendance_date: string; status: "present" | "absent"; }
export interface ProfileTestMark {
  test_id: string; test_name: string; topic: string | null; test_date: string;
  max_marks: number; marks_obtained: number | null; is_absent: boolean; batch_name: string | null;
}

export function StudentProfileTabs({
  studentId,
  defaultTab,
  showFees,
  canEditFees,
  showAttendance,
  showTests,
  overview,
  financials,
  feeStatus,
  payments,
  attendanceRows,
  attendanceSummary,
  testMarks,
  autoOpenPayment,
}: {
  studentId: string;
  defaultTab: string;
  showFees: boolean;
  canEditFees: boolean;
  showAttendance: boolean;
  showTests: boolean;
  overview: {
    fatherName: string | null; motherName: string | null; primaryRelation: string | null;
    studentPhone: string | null; fatherPhone: string | null; motherPhone: string | null; primaryParentPhone: string | null;
    address: string | null; notes: string | null;
  };
  financials: { originalFee: number; discount: number; finalFee: number; totalPaid: number; pendingFee: number };
  feeStatus: FeeStatus;
  payments: ProfilePayment[];
  attendanceRows: ProfileAttendanceRow[];
  attendanceSummary: { total: number; present: number; absent: number; percentage: number };
  testMarks: ProfileTestMark[];
  autoOpenPayment?: boolean;
}) {
  const [tab, setTab] = useState(defaultTab);

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        {showFees && <TabsTrigger value="fees">Fees</TabsTrigger>}
        {showFees && <TabsTrigger value="payments">Payment History</TabsTrigger>}
        {showAttendance && <TabsTrigger value="attendance">Attendance</TabsTrigger>}
        {showTests && <TabsTrigger value="tests">Tests</TabsTrigger>}
      </TabsList>

      <TabsContent value="overview">
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><User className="size-4" /> Parent information</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Father's name" value={overview.fatherName} />
              <Row label="Mother's name" value={overview.motherName} />
              <Row label="Primary guardian" value={overview.primaryRelation} />
              <Row label="Primary parent phone" value={overview.primaryParentPhone} tel />
              <Row label="Father's phone" value={overview.fatherPhone} tel />
              <Row label="Mother's phone" value={overview.motherPhone} tel />
              <Row label="Student phone" value={overview.studentPhone} tel />
              <Row label="Address" value={overview.address} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{overview.notes || "No notes yet."}</p>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {showFees && (
        <TabsContent value="fees">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            <MiniStat label="Original Fee" value={formatCurrency(financials.originalFee)} />
            <MiniStat label="Discount" value={formatCurrency(financials.discount)} />
            <MiniStat label="Final Payable" value={formatCurrency(financials.finalFee)} highlight />
            <MiniStat label="Total Paid" value={formatCurrency(financials.totalPaid)} tone="success" />
            <MiniStat label="Pending" value={formatCurrency(financials.pendingFee)} tone="warning" />
          </div>
          <div className="flex items-center justify-between mb-2">
            <FeeStatusBadge status={feeStatus} />
            {canEditFees && <AddPaymentDialog studentId={studentId} pendingFee={financials.pendingFee} defaultOpen={autoOpenPayment} />}
          </div>
        </TabsContent>
      )}

      {showFees && (
        <TabsContent value="payments">
          <div className="flex justify-end mb-3">
            {canEditFees && <AddPaymentDialog studentId={studentId} pendingFee={financials.pendingFee} />}
          </div>
          {payments.length === 0 ? (
            <EmptyState icon={Wallet} title="No payments recorded yet" description="Payments you record will show up here as a permanent history." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Added by</TableHead>
                  <TableHead>Notes</TableHead>
                  {canEditFees && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id} className={p.is_voided ? "opacity-50" : ""}>
                    <TableCell className="tabular-nums">{p.installment_number}</TableCell>
                    <TableCell className="text-sm">{formatDate(p.payment_date)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatCurrency(p.amount)}</TableCell>
                    <TableCell><Badge variant="brand">{PAYMENT_METHOD_LABEL[p.payment_method]}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.reference_number || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.created_by_name || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate" title={p.notes ?? undefined}>
                      {p.is_voided ? `Voided: ${p.voided_reason || "no reason given"}` : (p.notes || "—")}
                    </TableCell>
                    {canEditFees && (
                      <TableCell>
                        {!p.is_voided && <VoidPaymentButton paymentId={p.id} studentId={studentId} />}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      )}

      {showAttendance && (
        <TabsContent value="attendance">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <MiniStat label="Total Classes" value={attendanceSummary.total} />
            <MiniStat label="Present" value={attendanceSummary.present} tone="success" />
            <MiniStat label="Absent" value={attendanceSummary.absent} tone="danger" />
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Attendance: <span className="font-medium text-foreground tabular-nums">{attendanceSummary.percentage}%</span>
          </p>
          {attendanceRows.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="No attendance recorded yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {attendanceRows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm">{formatDate(a.attendance_date)}</TableCell>
                    <TableCell><AttendanceStatusBadge status={a.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      )}

      {showTests && (
        <TabsContent value="tests">
          {testMarks.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No tests recorded yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test</TableHead>
                  <TableHead>Topic</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead className="text-right">Max Marks</TableHead>
                  <TableHead className="text-right">Marks Obtained</TableHead>
                  <TableHead className="text-right">Percentage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {testMarks.map((t) => (
                  <TableRow key={t.test_id}>
                    <TableCell>
                      <Link href={`/tests/${t.test_id}`} className="font-medium hover:text-primary">{t.test_name}</Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.topic || "—"}</TableCell>
                    <TableCell className="text-sm">{formatDate(t.test_date)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.batch_name || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.max_marks}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.is_absent ? <Badge variant="neutral">Absent</Badge> : t.marks_obtained ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {t.is_absent || t.marks_obtained === null ? "—" : `${computeMarkPercentage(t.marks_obtained, t.max_marks)}%`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      )}
    </Tabs>
  );
}

function Row({ label, value, tel = false }: { label: string; value: string | null; tel?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1 border-b border-border/60 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      {value && tel ? (
        <a href={telHref(value)} className="font-medium inline-flex items-center gap-1 hover:text-primary">
          <Phone className="size-3" /> {value}
        </a>
      ) : (
        <span className="font-medium text-right">{value || "—"}</span>
      )}
    </div>
  );
}

function MiniStat({
  label, value, tone, highlight,
}: { label: string; value: string | number; tone?: "success" | "warning" | "danger"; highlight?: boolean }) {
  const color = tone === "success" ? "var(--success)" : tone === "warning" ? "var(--warning)" : tone === "danger" ? "var(--danger)" : undefined;
  return (
    <Card className={highlight ? "border-[var(--brand-300,var(--brand-500))]" : undefined}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="tabular-nums text-lg font-bold mt-1" style={color ? { color } : undefined}>{value}</p>
      </CardContent>
    </Card>
  );
}
