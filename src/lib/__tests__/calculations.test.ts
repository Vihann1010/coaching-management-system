import { describe, it, expect } from "vitest";
import {
  computeSuggestedFinalFee,
  computePendingFee,
  computeTotalPaid,
  computePaymentPercentage,
  computeFeeStatus,
  computeAttendancePercentage,
  computeMarkPercentage,
  validateMarks,
  computeTestAggregates,
} from "../calculations";

describe("fees", () => {
  it("computes suggested final fee as original minus discount (spec example)", () => {
    // Final Fee = 60,000, Discount = 10,000 -> Expected Final Payable = 50,000
    expect(computeSuggestedFinalFee(60000, 10000)).toBe(50000);
  });

  it("computes total paid and pending fee across installments (spec example)", () => {
    const finalFee = computeSuggestedFinalFee(60000, 10000); // 50,000
    const totalPaid = computeTotalPaid([{ amount: 15000 }, { amount: 10000 }]);
    expect(totalPaid).toBe(25000);
    expect(computePendingFee(finalFee, totalPaid)).toBe(25000);
  });

  it("never returns a negative pending fee, even if overpaid", () => {
    expect(computePendingFee(50000, 65000)).toBe(0);
  });

  it("ignores voided payments when summing total paid", () => {
    const total = computeTotalPaid([
      { amount: 10000, is_voided: false },
      { amount: 5000, is_voided: true },
    ]);
    expect(total).toBe(10000);
  });

  it("matches the worked example from the spec: 50,000 fee, 35,000 paid across 3 installments", () => {
    const finalFee = 50000;
    const totalPaid = computeTotalPaid([
      { amount: 10000 }, // cash
      { amount: 15000 }, // UPI
      { amount: 10000 }, // bank transfer
    ]);
    expect(totalPaid).toBe(35000);
    expect(computePendingFee(finalFee, totalPaid)).toBe(15000);
  });

  it("computes payment percentage", () => {
    expect(computePaymentPercentage(50000, 25000)).toBe(50);
    expect(computePaymentPercentage(0, 100)).toBe(100);
    expect(computePaymentPercentage(0, 0)).toBe(0);
  });

  it("marks a student as paid once pending is zero", () => {
    const status = computeFeeStatus({
      finalFee: 50000,
      totalPaid: 50000,
      lastPaymentDate: "2026-08-01",
      admissionDate: "2026-01-01",
      today: new Date("2026-08-10"),
    });
    expect(status).toBe("paid");
  });

  it("marks a student as pending when nothing has been paid yet and within the grace window", () => {
    const status = computeFeeStatus({
      finalFee: 50000,
      totalPaid: 0,
      lastPaymentDate: null,
      admissionDate: "2026-08-01",
      today: new Date("2026-08-10"),
    });
    expect(status).toBe("pending");
  });

  it("marks a student as partially paid when some but not all fees are paid, within the grace window", () => {
    const status = computeFeeStatus({
      finalFee: 50000,
      totalPaid: 20000,
      lastPaymentDate: "2026-08-05",
      admissionDate: "2026-01-01",
      today: new Date("2026-08-10"),
    });
    expect(status).toBe("partial");
  });

  it("marks a student as overdue once past the configured grace window with dues remaining", () => {
    const status = computeFeeStatus({
      finalFee: 50000,
      totalPaid: 20000,
      lastPaymentDate: "2026-06-01",
      admissionDate: "2026-01-01",
      today: new Date("2026-08-10"),
      overdueDays: 30,
    });
    expect(status).toBe("overdue");
  });
});

describe("attendance", () => {
  it("matches the worked example from the spec: 20 classes, 17 present, 3 absent -> 85%", () => {
    expect(computeAttendancePercentage(17, 3)).toBe(85);
  });

  it("returns 0 when there are no recorded classes", () => {
    expect(computeAttendancePercentage(0, 0)).toBe(0);
  });

  it("returns 100 when a student has never been absent", () => {
    expect(computeAttendancePercentage(12, 0)).toBe(100);
  });
});

describe("tests / marks", () => {
  it("matches the worked example from the spec: 42/50 -> 84%", () => {
    expect(computeMarkPercentage(42, 50)).toBe(84);
  });

  it("rejects negative marks", () => {
    expect(validateMarks(-1, 50).valid).toBe(false);
  });

  it("rejects marks above the maximum", () => {
    const result = validateMarks(55, 50);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/exceed/i);
  });

  it("accepts marks within range, including the boundaries", () => {
    expect(validateMarks(0, 50).valid).toBe(true);
    expect(validateMarks(50, 50).valid).toBe(true);
    expect(validateMarks(25, 50).valid).toBe(true);
  });

  it("computes highest / lowest / average / average percentage, excluding absentees", () => {
    const marks = [
      { marks_obtained: 45, is_absent: false },
      { marks_obtained: 30, is_absent: false },
      { marks_obtained: null, is_absent: true },
      { marks_obtained: 40, is_absent: false },
    ];
    const stats = computeTestAggregates(marks, 50);
    expect(stats.appearedCount).toBe(3);
    expect(stats.absentCount).toBe(1);
    expect(stats.highest).toBe(45);
    expect(stats.lowest).toBe(30);
    expect(stats.average).toBe(38.33);
    expect(stats.averagePercentage).toBe(76.66);
  });

  it("handles a test where everyone was absent without dividing by zero", () => {
    const stats = computeTestAggregates(
      [{ marks_obtained: null, is_absent: true }],
      50
    );
    expect(stats.appearedCount).toBe(0);
    expect(stats.average).toBeNull();
    expect(stats.averagePercentage).toBeNull();
  });
});
