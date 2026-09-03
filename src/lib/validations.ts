import { z } from "zod";

const phoneSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || /^(?:\+91|0)?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, "")), {
    message: "Enter a valid 10-digit Indian phone number",
  })
  .optional()
  .or(z.literal(""));

export const studentSchema = z
  .object({
    full_name: z.string().trim().min(2, "Student name is required"),
    father_name: z.string().trim().optional().or(z.literal("")),
    mother_name: z.string().trim().optional().or(z.literal("")),
    primary_parent_relation: z.enum(["Father", "Mother", "Guardian"]).default("Father"),
    student_phone: phoneSchema,
    father_phone: phoneSchema,
    mother_phone: phoneSchema,
    primary_parent_phone: phoneSchema,
    address: z.string().trim().optional().or(z.literal("")),
    batch_id: z.string().uuid().nullable(),
    admission_date: z.string().min(1, "Admission date is required"),
    original_fee: z.coerce.number().min(0, "Fee cannot be negative"),
    discount: z.coerce.number().min(0, "Discount cannot be negative"),
    final_fee: z.coerce.number().min(0, "Final fee cannot be negative"),
    notes: z.string().trim().optional().or(z.literal("")),
  })
  .refine((data) => data.discount <= data.original_fee || data.original_fee === 0, {
    message: "Discount cannot exceed the original fee",
    path: ["discount"],
  });

export type StudentFormValues = z.infer<typeof studentSchema>;

export const paymentSchema = z.object({
  student_id: z.string().uuid(),
  payment_date: z.string().min(1, "Payment date is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  payment_method: z.enum(["cash", "upi", "bank_transfer", "card", "other"]),
  reference_number: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
  override_pending_check: z.boolean().optional(),
});

export type PaymentFormValues = z.infer<typeof paymentSchema>;

export const batchSchema = z.object({
  name: z.string().trim().min(2, "Batch name is required"),
  code: z
    .string()
    .trim()
    .min(2, "Batch code is required")
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers and hyphens only"),
  description: z.string().trim().optional().or(z.literal("")),
  is_active: z.boolean().default(true),
});

export type BatchFormValues = z.infer<typeof batchSchema>;

export const testSchema = z.object({
  name: z.string().trim().min(2, "Test name is required"),
  topic: z.string().trim().optional().or(z.literal("")),
  test_date: z.string().min(1, "Test date is required"),
  batch_id: z.string().uuid("Select a batch"),
  max_marks: z.coerce.number().positive("Maximum marks must be greater than 0"),
  description: z.string().trim().optional().or(z.literal("")),
});

export type TestFormValues = z.infer<typeof testSchema>;

export const markEntrySchema = z.object({
  student_id: z.string().uuid(),
  marks_obtained: z.coerce.number().nullable(),
  is_absent: z.boolean().default(false),
});

export const bulkMarksSchema = z.object({
  test_id: z.string().uuid(),
  entries: z.array(markEntrySchema),
});

export const attendanceEntrySchema = z.object({
  student_id: z.string().uuid(),
  status: z.enum(["present", "absent"]),
});

export const bulkAttendanceSchema = z.object({
  batch_id: z.string().uuid(),
  attendance_date: z.string().min(1),
  entries: z.array(attendanceEntrySchema).min(1, "No students to mark"),
});

export const inviteUserSchema = z.object({
  full_name: z.string().trim().min(2, "Name is required"),
  email: z.string().trim().email("Enter a valid email"),
  role: z.enum(["admin", "accountant", "teacher", "staff"]),
  phone: phoneSchema,
});

export type InviteUserFormValues = z.infer<typeof inviteUserSchema>;

export const settingsSchema = z.object({
  coaching_name: z.string().trim().min(2, "Coaching name is required"),
  contact_email: z.string().trim().email().optional().or(z.literal("")),
  contact_phone: phoneSchema,
  academic_session: z.string().trim().min(2),
  currency: z.string().trim().min(1),
  fee_overdue_days: z.coerce.number().int().positive(),
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;
