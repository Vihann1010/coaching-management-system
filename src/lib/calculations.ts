import type { FeeStatus } from "@/types/database";

/**
 * Core business calculations for the coaching management system.
 * These are pure functions on purpose: they mirror the logic already
 * enforced in the database (see student_financials / student_attendance_summary
 * / test_stats views in supabase/migrations/0001_initial_schema.sql) so the
 * UI can compute the same numbers optimistically, and so we have exactly
 * one place to unit-test the math from spec section 39.
 */

// ---------------------------------------------------------------------
// Fees
// ---------------------------------------------------------------------

/** Suggested final payable fee = original fee − discount (never negative). */
export function computeSuggestedFinalFee(originalFee: number, discount: number): number {
  return Math.max(0, round2(originalFee - discount));
}

/** Pending fee is never allowed to go negative (spec section 9). */
export function computePendingFee(finalFee: number, totalPaid: number): number {
  return Math.max(0, round2(finalFee - totalPaid));
}

/** Sum of all non-voided payment amounts. */
export function computeTotalPaid(payments: Array<{ amount: number; is_voided?: boolean }>): number {
  return round2(payments.filter((p) => !p.is_voided).reduce((sum, p) => sum + p.amount, 0));
}

export function computePaymentPercentage(finalFee: number, totalPaid: number): number {
  if (finalFee <= 0) return totalPaid > 0 ? 100 : 0;
  return round2(Math.min(100, (totalPaid / finalFee) * 100));
}

export interface FeeStatusInput {
  finalFee: number;
  totalPaid: number;
  lastPaymentDate: string | null;
  admissionDate: string;
  today?: Date;
  overdueDays?: number;
}

/**
 * Determines the Paid / Partially Paid / Pending / Overdue label
 * (spec section 30). "Overdue" = money is still owed AND it has been
 * more than `overdueDays` since the last payment (or since admission,
 * if nothing has ever been paid). The threshold is configurable via
 * app_settings.fee_overdue_days (default 30).
 */
export function computeFeeStatus({
  finalFee,
  totalPaid,
  lastPaymentDate,
  admissionDate,
  today = new Date(),
  overdueDays = 30,
}: FeeStatusInput): FeeStatus {
  const pending = computePendingFee(finalFee, totalPaid);

  if (pending <= 0) return "paid";

  const referenceDate = lastPaymentDate ?? admissionDate;
  const daysSinceReference = diffInDays(today, new Date(referenceDate));

  if (daysSinceReference > overdueDays) return "overdue";
  if (totalPaid > 0) return "partial";
  return "pending";
}

// ---------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------

export function computeAttendancePercentage(present: number, absent: number): number {
  const total = present + absent;
  if (total === 0) return 0;
  return round2((present / total) * 100);
}

// ---------------------------------------------------------------------
// Tests / marks
// ---------------------------------------------------------------------

export function computeMarkPercentage(marksObtained: number, maxMarks: number): number {
  if (maxMarks <= 0) return 0;
  return round2((marksObtained / maxMarks) * 100);
}

export interface MarksValidationResult {
  valid: boolean;
  error?: string;
}

export function validateMarks(marksObtained: number, maxMarks: number): MarksValidationResult {
  if (Number.isNaN(marksObtained)) {
    return { valid: false, error: "Enter a number" };
  }
  if (marksObtained < 0) {
    return { valid: false, error: "Marks cannot be negative" };
  }
  if (marksObtained > maxMarks) {
    return { valid: false, error: `Marks cannot exceed maximum marks (${maxMarks})` };
  }
  return { valid: true };
}

export function computeTestAggregates(
  marks: Array<{ marks_obtained: number | null; is_absent: boolean }>,
  maxMarks: number
) {
  const appeared = marks.filter((m) => !m.is_absent && m.marks_obtained !== null);
  const absentCount = marks.filter((m) => m.is_absent).length;
  const values = appeared.map((m) => m.marks_obtained as number);

  const highest = values.length ? Math.max(...values) : null;
  const lowest = values.length ? Math.min(...values) : null;
  const average = values.length ? round2(values.reduce((a, b) => a + b, 0) / values.length) : null;
  const averagePercentage =
    average !== null && maxMarks > 0 ? round2((average / maxMarks) * 100) : null;

  return {
    appearedCount: appeared.length,
    absentCount,
    highest,
    lowest,
    average,
    averagePercentage,
  };
}

// ---------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function diffInDays(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((a.getTime() - b.getTime()) / msPerDay);
}
