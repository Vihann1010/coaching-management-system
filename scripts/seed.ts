/**
 * Demo data seed script.
 *
 * Creates one login per role, 4 batches, ~40 students, sample payments,
 * two weeks of attendance, and a couple of tests with marks — enough to
 * click around and see every screen with real-looking data.
 *
 * DEMO DATA ONLY. Run this once against a *fresh* Supabase project
 * (right after applying the migrations), not against a database that
 * already has real student records — it will mix demo rows in with them.
 *
 * Usage:
 *   1. Fill in .env.local (see .env.example) with your Supabase project
 *      URL and SERVICE ROLE key (Project Settings -> API in Supabase).
 *   2. npm run seed
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_PASSWORD = "CoachingDemo@123";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Krishna", "Ishaan", "Rohan",
  "Ananya", "Diya", "Saanvi", "Aadhya", "Kiara", "Myra", "Anika", "Navya", "Riya", "Ira",
  "Kabir", "Dev", "Yash", "Aryan", "Karan", "Meera", "Priya", "Nisha", "Tara", "Sneha",
];
const LAST_NAMES = ["Sharma", "Verma", "Gupta", "Singh", "Kumar", "Patel", "Reddy", "Iyer", "Nair", "Mehta", "Joshi", "Rao", "Chauhan", "Malhotra", "Bansal"];
const TOPICS = ["Physics — Kinematics", "Chemistry — Mole Concept", "Maths — Quadratic Equations", "Biology — Cell Structure", "Physics — Laws of Motion", "Maths — Trigonometry"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

async function createDemoUser(email: string, fullName: string, role: string) {
  const { data: existing } = await admin.auth.admin.listUsers();
  const already = existing?.users.find((u) => u.email === email);
  if (already) {
    console.log(`  • ${role}: ${email} already exists, reusing.`);
    return already.id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });
  if (error) throw new Error(`Creating ${email}: ${error.message}`);
  console.log(`  • ${role}: ${email}`);
  return data.user!.id;
}

async function main() {
  console.log("Seeding demo data...\n");

  console.log("Creating demo users:");
  const adminId = await createDemoUser("admin@demo.coaching", "Anjali Owner", "admin");
  const accountantId = await createDemoUser("accountant@demo.coaching", "Rakesh Accountant", "accountant");
  const teacherId = await createDemoUser("teacher@demo.coaching", "Sunita Teacher", "teacher");
  const staffId = await createDemoUser("staff@demo.coaching", "Vikram Staff", "staff");

  // Give staff view+edit on the modules most relevant to a front-desk role.
  await admin.from("user_permissions").upsert(
    [
      { profile_id: staffId, module: "students", can_view: true, can_edit: true },
      { profile_id: staffId, module: "attendance", can_view: true, can_edit: true },
      { profile_id: staffId, module: "reports", can_view: true, can_edit: false },
    ],
    { onConflict: "profile_id,module" }
  );

  console.log("\nCreating batches:");
  const batchDefs = [
    { name: "Batch A — Foundation (9th-10th)", code: "BATCH-A", description: "Foundation batch for classes 9 and 10" },
    { name: "Batch B — JEE Main (11th)", code: "BATCH-B", description: "JEE Main preparation, class 11" },
    { name: "Batch C — JEE Advanced (12th)", code: "BATCH-C", description: "JEE Advanced preparation, class 12" },
    { name: "Batch D — NEET (12th)", code: "BATCH-D", description: "NEET preparation, class 12" },
  ];
  const batches: { id: string; name: string; code: string }[] = [];
  for (const b of batchDefs) {
    const { data: existing } = await admin.from("batches").select("id, name, code").eq("code", b.code).maybeSingle();
    if (existing) {
      batches.push(existing);
      console.log(`  • ${b.name} (existing)`);
      continue;
    }
    const { data, error } = await admin
      .from("batches")
      .insert({ ...b, created_by: adminId, updated_by: adminId })
      .select("id, name, code")
      .single();
    if (error) throw new Error(`Creating batch ${b.name}: ${error.message}`);
    batches.push(data);
    console.log(`  • ${b.name}`);
  }

  // Teacher teaches batches A and B.
  await admin.from("teacher_batches").upsert(
    [
      { profile_id: teacherId, batch_id: batches[0].id },
      { profile_id: teacherId, batch_id: batches[1].id },
    ],
    { onConflict: "profile_id,batch_id" }
  );

  console.log("\nCreating ~40 demo students:");
  const studentIds: { id: string; batchId: string }[] = [];
  for (let i = 0; i < 40; i++) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const fatherFirst = pick(FIRST_NAMES);
    const motherFirst = pick(FIRST_NAMES);
    const batch = batches[i % batches.length];
    const originalFee = pick([40000, 50000, 60000, 75000]);
    const discount = pick([0, 0, 2000, 5000, 10000]);
    const finalFee = originalFee - discount;
    const admissionDate = isoDaysAgo(randomInt(30, 200));

    const { data, error } = await admin
      .from("students")
      .insert({
        full_name: `${firstName} ${lastName}`,
        father_name: `${fatherFirst} ${lastName}`,
        mother_name: `${motherFirst} ${lastName}`,
        primary_parent_relation: "Father",
        student_phone: `9${randomInt(100000000, 999999999)}`,
        father_phone: `9${randomInt(100000000, 999999999)}`,
        primary_parent_phone: `9${randomInt(100000000, 999999999)}`,
        batch_id: batch.id,
        admission_date: admissionDate,
        original_fee: originalFee,
        discount,
        final_fee: finalFee,
        created_by: adminId,
        updated_by: adminId,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Creating student ${firstName}: ${error.message}`);
    studentIds.push({ id: data.id, batchId: batch.id });
  }
  console.log(`  • ${studentIds.length} students created`);

  console.log("\nRecording sample payments:");
  let paymentCount = 0;
  for (const s of studentIds) {
    // Roughly: 25% fully paid, 40% partially paid, 20% nothing paid, 15% overdue-ish (old, partial)
    const roll = Math.random();
    const { data: student } = await admin.from("students").select("final_fee").eq("id", s.id).single();
    const finalFee = Number(student!.final_fee);

    const installments: { amount: number; daysAgo: number; method: string }[] = [];
    if (roll < 0.25) {
      installments.push({ amount: finalFee, daysAgo: randomInt(5, 60), method: pick(["cash", "upi", "bank_transfer"]) });
    } else if (roll < 0.65) {
      const first = Math.round(finalFee * 0.5);
      installments.push({ amount: first, daysAgo: randomInt(20, 90), method: pick(["cash", "upi"]) });
      if (Math.random() > 0.5) {
        installments.push({ amount: Math.round(finalFee * 0.2), daysAgo: randomInt(1, 19), method: pick(["upi", "card"]) });
      }
    } else if (roll < 0.85) {
      installments.push({ amount: Math.round(finalFee * 0.3), daysAgo: randomInt(45, 120), method: "cash" });
    }
    // else: nothing paid yet (pending)

    for (let i = 0; i < installments.length; i++) {
      const inst = installments[i];
      const { error } = await admin.from("payments").insert({
        student_id: s.id,
        payment_date: isoDaysAgo(inst.daysAgo),
        amount: inst.amount,
        payment_method: inst.method,
        created_by: accountantId,
        updated_by: accountantId,
      });
      if (!error) paymentCount++;
    }
  }
  console.log(`  • ${paymentCount} payments recorded`);

  console.log("\nRecording two weeks of attendance:");
  let attendanceCount = 0;
  for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
    const date = new Date();
    date.setDate(date.getDate() - dayOffset);
    if (date.getDay() === 0) continue; // skip Sundays
    const dateStr = date.toISOString().slice(0, 10);

    for (const s of studentIds) {
      const status = Math.random() > 0.12 ? "present" : "absent";
      const { error } = await admin.from("attendance").insert({
        student_id: s.id,
        batch_id: s.batchId,
        attendance_date: dateStr,
        status,
        created_by: teacherId,
        updated_by: teacherId,
      });
      if (!error) attendanceCount++;
    }
  }
  console.log(`  • ${attendanceCount} attendance records created`);

  console.log("\nCreating sample tests and marks:");
  let testCount = 0;
  let markCount = 0;
  for (const batch of batches) {
    const batchStudents = studentIds.filter((s) => s.batchId === batch.id);
    for (let t = 0; t < 2; t++) {
      const maxMarks = pick([25, 50, 100]);
      const { data: test, error: testError } = await admin
        .from("tests")
        .insert({
          name: `${pick(["Unit Test", "Weekly Test", "Monthly Test"])} ${t + 1}`,
          topic: pick(TOPICS),
          test_date: isoDaysAgo(randomInt(1, 45)),
          batch_id: batch.id,
          max_marks: maxMarks,
          created_by: teacherId,
          updated_by: teacherId,
        })
        .select("id")
        .single();
      if (testError) throw new Error(`Creating test: ${testError.message}`);
      testCount++;

      for (const s of batchStudents) {
        const absent = Math.random() < 0.08;
        const marks = absent ? null : Math.round(maxMarks * (0.4 + Math.random() * 0.6));
        const { error } = await admin.from("test_marks").insert({
          test_id: test.id,
          student_id: s.id,
          marks_obtained: marks,
          is_absent: absent,
          created_by: teacherId,
          updated_by: teacherId,
        });
        if (!error) markCount++;
      }
    }
  }
  console.log(`  • ${testCount} tests, ${markCount} mark entries`);

  console.log("\n✅ Done seeding.\n");
  console.log("Demo logins (all use the same password):");
  console.log(`  Password: ${DEMO_PASSWORD}\n`);
  console.log("  admin@demo.coaching       — full access");
  console.log("  accountant@demo.coaching  — students & fees");
  console.log("  teacher@demo.coaching     — Batch A & B, attendance & tests");
  console.log("  staff@demo.coaching       — students & attendance (view+edit), reports (view)\n");
  console.log("⚠️  Change or remove these accounts before using this system in production.");
}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err.message);
  process.exit(1);
});
