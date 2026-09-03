# Coaching Management System

A production-grade, multi-user web application for running a coaching institute's day-to-day
operations: students, fees & installments, attendance, tests & marks, batches, reports, and
Excel exports — with role-based access control enforced at the database level, not just the UI.

Built with **Next.js 16 (App Router) + TypeScript + Tailwind CSS + Supabase (Postgres, Auth, Row
Level Security, Realtime)**.

---

## 1. What's actually in this repo

This is real, working application code — not a mockup. Every button is wired to a real Server
Action or query; there are no placeholder screens. That said, an honest inventory matters more
than a sales pitch, so **section 13 below (Production Readiness Checklist) tells you exactly
what's fully built, what's partial, and what's a documented gap.** Read that before going live.

What I could **not** do from this environment: create your Supabase/Vercel accounts, click
through their onboarding, or deploy this for you — I have no network access to supabase.com or
vercel.com, and obviously no access to your accounts. Everything below is written so you (or
anyone on your team) can do those steps in about 20-30 minutes.

---

## 2. Using it on your phone and desktop, fully synced

This is one responsive web app, not two separate apps — the same code and the same live
database serve whichever device opens it. There's nothing extra to build or install.

- **Data is never local.** Everything lives in your Supabase Postgres database in the cloud.
  A phone in the classroom and a desktop in the office are just two windows onto the same data.
- **Realtime sync is already built in** (`0005_realtime.sql` +
  `src/components/shared/realtime-revalidator.tsx`). If a teacher marks attendance on their
  phone, the owner's dashboard on a desktop across town updates within about a second — nobody
  has to refresh.
- **Every staff member logs in with their own account**, and Row Level Security decides what
  they can see/do based on their role — same rules whether they're on a phone or a laptop.
- **The layout adapts to screen size**: the sidebar becomes a swipe-out drawer on phones, forms
  stack into a single column, and dense tables (like the students list) scroll sideways with a
  swipe rather than squeezing columns unreadably small.
- **"Add to Home Screen" gives it a real app icon.** Once deployed (section 12), open the site
  in Safari on iPhone or Chrome on Android:
  - **iPhone (Safari)**: tap the Share icon → **Add to Home Screen**.
  - **Android (Chrome)**: tap the ⋮ menu → **Add to Home Screen** / **Install app**.

  It'll then open full-screen with your logo as the icon, like a normal app — no App Store or
  Play Store listing needed, and no separate app to keep updated (a new deploy updates
  everyone automatically).

**The one thing that makes "from anywhere, anytime" literally true: it needs to be deployed to a
real URL** (section 12), not just run on your own laptop via `npm run dev`. Running it locally
only makes it reachable from that one laptop, on that one network. Deploying it to Vercel (free,
~10 minutes, no code changes needed) gives it a public `https://` address any phone or desktop
with internet access can reach.

## 3. Project structure

```
coaching-cms/
├── supabase/
│   └── migrations/            # Run these, in order, in the Supabase SQL editor
│       ├── 0001_initial_schema.sql    # Tables, enums, indexes, triggers, views
│       ├── 0002_rls_policies.sql      # Row Level Security — the real permission boundary
│       ├── 0003_audit_triggers.sql    # Audit log triggers on every business table
│       ├── 0004_rpc_functions.sql     # Bulk-upsert helpers for attendance/marks entry
│       └── 0005_realtime.sql          # Enables multi-device live sync
├── scripts/
│   └── seed.ts                 # Demo data generator (npm run seed)
├── src/
│   ├── app/
│   │   ├── login/               # Auth
│   │   ├── (dashboard)/         # Everything behind login, with the sidebar shell
│   │   │   ├── dashboard/
│   │   │   ├── students/        # List, profile (tabs), new/edit forms
│   │   │   ├── fees/            # Payment ledger
│   │   │   ├── attendance/      # Batch+date marking, absentee follow-up
│   │   │   ├── tests/           # Test creation, marks entry, analytics
│   │   │   ├── batches/
│   │   │   ├── reports/         # Fee/Attendance/Test reports
│   │   │   ├── users/           # Admin: invite, roles, permissions
│   │   │   ├── audit-logs/      # Admin: full change history
│   │   │   └── settings/        # Admin: branding & config
│   │   └── api/export/          # Excel (.xlsx) generation endpoints
│   ├── components/
│   │   ├── ui/                  # Hand-built accessible primitives (Radix-based)
│   │   ├── layout/               # Sidebar, header, shell
│   │   └── <module>/             # Feature-specific components
│   ├── lib/
│   │   ├── supabase/             # Browser / server / middleware / admin clients
│   │   ├── calculations.ts       # Fee, attendance %, marks % — pure & unit-tested
│   │   ├── permissions.ts        # UI-level role/permission checks (mirrors RLS)
│   │   ├── session.ts            # Server-side "who is this, what can they do"
│   │   ├── validations.ts        # Zod schemas shared by forms and Server Actions
│   │   └── excel-export.ts       # Server-only .xlsx builder (ExcelJS)
│   └── types/database.ts         # Hand-written types mirroring the schema
├── .env.example
└── package.json
```

---

## 4. Database schema (summary)

Full detail is in `supabase/migrations/0001_initial_schema.sql`, which is the source of truth.
Summary:

| Table | Purpose |
|---|---|
| `profiles` | One row per login, with `role` (admin/accountant/teacher/staff) |
| `batches` | Class groups; not hard-coded to 4, admin can add more |
| `teacher_batches` | Which batches a teacher is assigned to |
| `user_permissions` | Per-module view/edit grants for the `staff` role |
| `students` | Identity, parent info, batch, admission, fee fields |
| `payments` | Installments — append-only, voidable, never hard-deleted |
| `attendance` | One row per student per date, `present`/`absent` only |
| `tests` / `test_marks` | Tests per batch, marks per student, validated against max marks |
| `audit_logs` | Append-only change log, written by DB triggers, admin-only read |
| `app_settings` | Coaching name, logo, currency, academic session, fee-overdue window |

**Views** (`student_financials`, `student_attendance_summary`, `test_stats`) centralize the
fee/attendance/percentage math in one place so the app never computes it two different ways. They
use `security_invoker = true`, which is required — without it, a Postgres view runs with the
*view owner's* privileges and would silently bypass Row Level Security.

**Key constraints:** `UNIQUE(student_id, attendance_date)` and `UNIQUE(test_id, student_id)`
prevent duplicate attendance/marks at the database level, not just in the UI. A trigger rejects
`marks_obtained > max_marks` even if a request bypasses the frontend entirely.

---

## 5. Environment variables

Copy `.env.example` to `.env.local` and fill in these four values:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=
```

The first three come from your Supabase project (**Project Settings → API**). The first two are
safe to expose in the browser — Row Level Security is what actually protects your data. **The
service role key bypasses RLS entirely.** It's used only in `lib/supabase/server.ts`'s
`createAdminClient()` (for inviting users) and in `scripts/seed.ts`. Never import it into a
Client Component, never commit it.

`NEXT_PUBLIC_SITE_URL` is just the URL your app runs at (`http://localhost:3000` locally, your
real domain in production) — used to build the link inside invite-team-member emails. See
section 8 for the matching Supabase Auth setting you need once you deploy.

---

## 6. Local setup

```bash
# 1. Install dependencies
npm install

# 2. Create a free Supabase project at supabase.com, then in the SQL Editor
#    run each file in supabase/migrations/ IN ORDER (0001 -> 0005).

# 3. Copy env vars
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY from Supabase -> Project Settings -> API

# 4. (Optional but recommended) seed demo data
npm run seed
# prints 4 demo logins (admin/accountant/teacher/staff), all using
# password: CoachingDemo@123

# 5. Run it
npm run dev
# open http://localhost:3000
```

Run the test suite any time with `npm test` (business-logic unit tests — fee math, attendance %,
marks %, the exact worked examples from the spec).

---

## 7. Creating your first real admin user (no seed data)

If you don't want demo data, create your own admin account directly:

1. In the Supabase dashboard: **Authentication → Users → Add user**. Set an email and password,
   and tick **Auto Confirm User**.
2. In the **SQL Editor**, promote them to admin (the sign-up trigger defaults everyone to `staff`):
   ```sql
   update public.profiles set role = 'admin' where email = 'you@yourcoaching.com';
   ```
3. Sign in at `/login` with that email/password.

---

## 8. Adding teachers, accountants, and staff

As an admin, go to **Users → Add team member**. Enter their name, email, and role, and click
**Send invite** — Supabase emails them a link to set their own password and sign in. (This uses
Supabase's built-in email provider, which works out of the box for low volume; for production
volume, configure a custom SMTP provider under **Project Settings → Auth → SMTP Settings**.)

**Required one-time setup after you deploy** (not needed for local dev): that invite email
contains a link back to your app, built from `NEXT_PUBLIC_SITE_URL` (section 5). Supabase will
only allow redirecting to URLs you've explicitly allow-listed — set both of these in
**Supabase Dashboard → Authentication → URL Configuration**:
- **Site URL**: your production URL (e.g. `https://your-app.netlify.app`)
- **Redirect URLs**: add `https://your-app.netlify.app/**` (the `/**` wildcard covers `/login`
  and any future auth callback routes)

If you skip this, invite links will point at `localhost` (or get rejected by Supabase) and your
teammates won't be able to use them.

- **Teacher**: after inviting, click the user's settings icon and assign which batches they teach.
  They'll only see students, attendance, and tests for those batches — enforced by RLS, not just
  hidden in the UI.
- **Staff**: click their settings icon to grant per-module view/edit permissions (Students, Fees,
  Attendance, Tests, Batches, Reports). Nothing is granted by default.
- **Accountant**: gets Students (view) and Fees (view + edit) automatically — no extra
  configuration needed.

---

## 9. Configuring batches

**Batches** in the sidebar → **Add batch**. Name and a short code (e.g. `BATCH-A`) are required.
Batches are never hard-coded to a fixed count — add as many as you need. Deactivate a batch (via
the same dialog) instead of deleting it once it has students; the database will refuse to delete a
batch that has students, tests, or attendance history attached, by design (`ON DELETE RESTRICT`).

---

## 10. Importing students

**Not yet built as a bulk CSV/Excel importer** — see the checklist below. Today, students are
added one at a time via **Students → Add student**, which takes seconds per student and includes
the same validation a bulk import would need (phone format, fee math, required fields).

If you have an existing spreadsheet of 500 students and need a real bulk-import path before this
ships, the fastest route is: export your sheet to CSV, and have a developer run a short one-off
script against `scripts/seed.ts` as a template (swap the demo data generation for `Papa.parse()`
over your CSV, keep the validation and insert logic). This is a well-scoped follow-up — see
section 13.

---

## 11. Exporting Excel reports

Every major screen (Students, Fees, Attendance, Test detail, Reports) has an **Export Excel**
button in the top-right that respects whatever filters are currently applied (batch, date range,
fee status, etc.) and downloads a real `.xlsx` file — built server-side with ExcelJS, not the
unmaintained `xlsx` package (see security note below).

---

## 12. Deploying to production

**Important first: one database, any hosting platform.** No matter which option below you pick,
your Supabase project (database, auth, storage) stays exactly the same — you're only choosing
where the Next.js *app itself* runs. Netlify, Vercel, and Firebase App Hosting are three
alternatives to each other, not steps you chain together — pick one.

### Option A — Vercel (simplest, made by the Next.js team)

1. **Push this repo to GitHub** (or GitLab/Bitbucket).
2. Import it at vercel.com/new, add the four environment variables from section 5 under
   **Settings → Environment Variables** (for `NEXT_PUBLIC_SITE_URL`, use the `https://...vercel.app`
   URL Vercel assigns you, or your custom domain), and deploy. Free tier is enough for this scale.
3. **Custom domain (optional)**: Vercel → Settings → Domains.

### Option B — Netlify

Also fully supported for Next.js App Router (Server Components, Server Actions, Route
Handlers) via Netlify's official adapter — `netlify.toml` in this repo already activates it.

1. Push this repo to GitHub (or GitLab/Bitbucket).
2. At app.netlify.com, **Add new site → Import an existing project**, pick the repo. Netlify
   reads `netlify.toml` automatically — you shouldn't need to touch the build settings.
3. Before the first deploy, go to **Site configuration → Environment variables** and add the
   four values from section 5 (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_SITE_URL` set to the `https://...netlify.app`
   URL Netlify assigns you).
4. Click **Deploy site**. Free tier is enough for this scale.
5. **Custom domain (optional)**: Site configuration → Domain management (update
   `NEXT_PUBLIC_SITE_URL` to match if you add one, and redeploy).

### Option C — Firebase App Hosting

Firebase's *classic* "Hosting" product only serves static files and can't run this app (Server
Actions and dynamic pages need a real server). The product you want is **Firebase App Hosting**
— a newer product that runs Next.js as a proper Node.js server on Cloud Run. `apphosting.yaml`
in this repo is already set up for it.

**Cost note before you pick this one:** App Hosting requires upgrading your Firebase project to
the pay-as-you-go **Blaze plan** (a card on file) even though a low-traffic app like this one is
likely to stay within the free monthly quota. Vercel and Netlify's free tiers don't require this.

1. Push this repo to GitHub.
2. In the [Firebase console](https://console.firebase.google.com), create a project (or use an
   existing one) and upgrade it to the **Blaze plan** (Project settings → Usage and billing).
3. **Hosting & Serverless → App Hosting → Get started**, and connect it to your GitHub repo —
   Firebase auto-detects Next.js from `apphosting.yaml`.
4. Store your four env vars as secrets (Firebase CLI, run once per secret):
   ```bash
   firebase apphosting:secrets:set NEXT_PUBLIC_SUPABASE_URL
   firebase apphosting:secrets:set NEXT_PUBLIC_SUPABASE_ANON_KEY
   firebase apphosting:secrets:set SUPABASE_SERVICE_ROLE_KEY
   firebase apphosting:secrets:set NEXT_PUBLIC_SITE_URL
   ```
   then grant your backend access to each (replace `<backend-id>` with the name you gave your
   App Hosting backend):
   ```bash
   firebase apphosting:secrets:grantaccess NEXT_PUBLIC_SUPABASE_URL --backend=<backend-id>
   firebase apphosting:secrets:grantaccess NEXT_PUBLIC_SUPABASE_ANON_KEY --backend=<backend-id>
   firebase apphosting:secrets:grantaccess SUPABASE_SERVICE_ROLE_KEY --backend=<backend-id>
   ```
5. Push to your connected branch — App Hosting builds and deploys automatically from there on.

### After deploying (any option)

- **Supabase**: your migrations are already applied from local setup (section 6) — nothing
  further needed unless you're promoting from a staging project, in which case re-run
  `supabase/migrations/*.sql` in order against the production project.
- **Your logo**: already included at `public/logo.png` — the actual coaching logo you provided,
  sampled to match the brand green (`#00923F`) used throughout the sidebar, buttons, badges, and
  Excel export headers. To swap it later, just replace `public/logo.png` (or add `public/logo.svg`,
  which takes priority if present) and redeploy.
- **Production security checklist** before go-live: see section 13.

---

## 13. Production Readiness Checklist

### Fully implemented and tested
- Email/password authentication via Supabase Auth, with route protection in middleware
- Role-based access control for admin / accountant / teacher / staff, **enforced by Postgres Row
  Level Security** (not just hidden UI) — verified by reading through every policy in
  `0002_rls_policies.sql`
- Full student CRUD, soft-delete (never hard-deletes a student with history), auto-generated
  `STU-0001`-style IDs
- Fee engine: original fee, discount, admin-overridable final fee, installment tracking, pending
  fee that's mathematically guaranteed to never go negative, Paid/Partial/Pending/Overdue status
- Payment voiding (never silently deletes financial history) with a reason and full audit trail
- Attendance: batch+date marking, one-click Present/Absent, mark-all shortcuts, confirm-before-save,
  duplicate prevention at the DB level, absent-today panel with `tel:` call-parent links
- Tests & marks: creation, bulk marks entry with live validation against max marks, per-test
  analytics (highest/lowest/average/appeared/absent)
- Batches: full CRUD, delete-guarded by existing data
- Reports: Fee Collection, Pending Fees, Attendance, Test Performance — all filterable and
  exportable
- Excel export (ExcelJS, not the vulnerable `xlsx` package) on Students, Fees, Payments,
  Attendance, and Tests, respecting active filters
- Audit logs: every create/update/delete on students, payments, attendance, tests, test_marks,
  batches, profiles, and permissions — written by a database trigger, so it can't be bypassed by
  a buggy or malicious client, admin-read-only
- User management: invite by email, role assignment, teacher-to-batch assignment, staff
  per-module permissions
- Settings: coaching name, contact info, academic session, currency, fee-overdue window — no
  hard-coded coaching name anywhere in the UI
- Multi-device realtime sync via Supabase Realtime (spec section 23) — a change on one device
  refreshes the relevant screen on another within about a second, still gated by RLS
- Responsive layout (mobile drawer nav, sticky table headers, horizontal scroll on dense tables),
  installable as a home-screen app on iOS/Android via `manifest.webmanifest`, with touch targets
  sized for one-handed use on the highest-frequency mobile action (marking attendance)
- Accessibility foundations: Radix primitives throughout (keyboard nav, focus trapping in
  dialogs, ARIA labels on icon-only buttons and custom controls), visible focus rings,
  `prefers-reduced-motion` respected, status never conveyed by color alone (every badge has an
  icon + text label)
- Business-logic unit tests (`npm test`) covering the exact worked examples from the spec: fee
  calculation, attendance percentage, marks percentage, fee-status classification — 19/19 passing
- Clean `next build`, `tsc --noEmit`, and `eslint` — all zero errors as of this delivery
- Uses Next.js 16's current `proxy.ts` file convention for the auth guard (not the deprecated
  `middleware.ts` name, which some 16.x patch versions silently stop reading — this matters for
  every hosting platform, not just one)
- Deployable to Vercel, Netlify, or Firebase App Hosting without code changes — `netlify.toml`
  and `apphosting.yaml` are both already in the repo

### Partially implemented — works, with a known limitation
- **Global search**: the header search box searches student name/parent name/phone/ID (reusing
  the Students list filters), but isn't a live-dropdown omnisearch across batches/other entities.
- **Test performance "rankings"**: per-test highest/lowest/average is shown; a full leaderboard
  view and per-student score-over-time chart are not built (the `recharts` library is already
  installed for this — it's a UI-only follow-up, not a data-model change).
- **Column-level permission on `students`**: RLS is row-level, not column-level. An accountant or
  teacher who can see a student row can technically see fee columns too, since all app roles share
  Postgres's single `authenticated` role in Supabase's default auth model. I mitigated this at the
  application layer — teacher-facing queries explicitly select only non-financial columns — but
  this is a convention, not a hard database guarantee. A stronger fix (documented, not built) is a
  `SECURITY DEFINER` RPC that returns only role-appropriate columns.
- **Fee/discount editing by "authorized accountant"**: per the spec, accountants can edit final
  fees; this isn't restricted to a *subset* of accountants — any accountant role can edit any
  student's fees. Add a `user_permissions`-style finer grant if you need per-accountant limits.

### Not implemented — documented gaps, not silent omissions
- **Bulk student import via CSV/Excel** (spec section 27). See section 10 above for the interim
  path and a concrete suggestion for building this properly.
- **Bulk multi-select batch reassignment** for existing students (assigning one student's batch
  works today via Edit; bulk reassignment of many students at once does not exist yet).
- Automated CI (e.g. GitHub Actions running `npm test`/`npm run build` on every push) is not set
  up — the test suite exists and passes locally, but nothing runs it automatically yet.
- No automated accessibility audit (e.g. axe DevTools) has been run — the foundations are in
  place (see above), but a full WCAG pass is recommended before go-live if that's a hard
  requirement for you.
- Database backup cadence depends entirely on your Supabase plan (free tier: daily backups, short
  retention; paid tiers: point-in-time recovery). This app doesn't add its own backup layer beyond
  that, other than the append-only audit log and soft-deletes.

### A note on scale
Student search/filtering fetches up to ~2,000 matching rows and paginates/filters in memory,
which is fast and simple at your stated scale (500-1,000+ students) and deliberately avoids
over-engineering a fully server-side-paginated fee-status filter for a scale you don't have yet.
If you grow well past that, the natural next step is pushing fee-status filtering into a SQL
`WHERE` clause (it would need a computed column or a slightly heavier query) — flagged here so
it's a known, deliberate tradeoff rather than a surprise.
#   c o a c h i n g - m a n a g e m e n t - s y s t e m  
 