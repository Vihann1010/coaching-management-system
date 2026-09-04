// Hand-written types mirroring supabase/migrations/0001_initial_schema.sql.
// If you change the schema, update this file to match (or generate it with
// `supabase gen types typescript` once your project is linked).

export type UserRole = "admin" | "accountant" | "teacher" | "staff";
export type PaymentMethod = "cash" | "upi" | "bank_transfer" | "card" | "other";
export type AttendanceStatus = "present" | "absent";
export type PermissionModule =
  | "students"
  | "fees"
  | "attendance"
  | "tests"
  | "batches"
  | "reports"
  | "users"
  | "settings"
  | "audit_logs"
  | "assistant";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Batch {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  student_count?: number; // populated by an aggregate query, not a DB column
}

export interface TeacherBatch {
  id: string;
  profile_id: string;
  batch_id: string;
  created_at: string;
}

export interface UserPermission {
  id: string;
  profile_id: string;
  module: PermissionModule;
  can_view: boolean;
  can_edit: boolean;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  student_code: string;
  full_name: string;
  father_name: string | null;
  mother_name: string | null;
  primary_parent_relation: string | null;
  student_phone: string | null;
  father_phone: string | null;
  mother_phone: string | null;
  primary_parent_phone: string | null;
  address: string | null;
  batch_id: string | null;
  admission_date: string;
  original_fee: number;
  discount: number;
  final_fee: number;
  is_active: boolean;
  deleted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  // joined/derived (optional, present when the query selects for them)
  batch?: Pick<Batch, "id" | "name" | "code"> | null;
  financials?: StudentFinancials;
  attendance_summary?: StudentAttendanceSummary;
}

export interface Payment {
  id: string;
  student_id: string;
  installment_number: number;
  payment_date: string;
  amount: number;
  payment_method: PaymentMethod;
  reference_number: string | null;
  notes: string | null;
  is_voided: boolean;
  voided_reason: string | null;
  voided_by: string | null;
  voided_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  created_by_profile?: Pick<Profile, "id" | "full_name"> | null;
}

export interface Attendance {
  id: string;
  student_id: string;
  batch_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface Test {
  id: string;
  name: string;
  topic: string | null;
  test_date: string;
  batch_id: string;
  max_marks: number;
  description: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  batch?: Pick<Batch, "id" | "name" | "code"> | null;
}

export interface TestMark {
  id: string;
  test_id: string;
  student_id: string;
  marks_obtained: number | null;
  is_absent: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

export interface AppSettings {
  coaching_name: string;
  logo_url: string | null;
  contact_email: string;
  contact_phone: string;
  academic_session: string;
  currency: string;
  fee_overdue_days: number;
}

// ---- Views ----

export interface StudentFinancials {
  student_id: string;
  final_fee: number;
  total_paid: number;
  pending_fee: number;
  last_payment_date: string | null;
}

export interface StudentAttendanceSummary {
  student_id: string;
  total_classes: number;
  present_count: number;
  absent_count: number;
  attendance_percentage: number;
}

export interface TestStats {
  test_id: string;
  name: string;
  batch_id: string;
  max_marks: number;
  appeared_count: number;
  absent_count: number;
  highest_marks: number | null;
  lowest_marks: number | null;
  average_marks: number | null;
  average_percentage: number | null;
}

export type FeeStatus = "paid" | "partial" | "pending" | "overdue";
