# PRP — Release 3 (Month 3): The Core Learning Loop

> **Status:** Draft, not yet elaborated. Split from the [master PRP](../PRP.md).
> **Architecture:** [arch.md](../../architecture/arch.md)
> **Depends on:** [Release 2](../release-2/PRP.md) (auth, RBAC, dashboard shell)

## Objective

Onboard students and build the main reason people use the app: tutors assign work, students submit files, and tutors give feedback.

> **Note:** In this release, assignments go to individual students or to a global roster. This is a stepping stone before communities arrive in Release 4.

## Scope

### Student Access
- Student registration and login.
- Student Dashboard showing upcoming tasks and recent scores. All styling comes from the global design tokens.

### Assignment Allocation
- Tutors create assignments with a title, description, due date and file attachments.
- Assignments appear on the dashboards of the students they are assigned to.

### Submission & Storage
- Students upload one or more files (PDF, JPG, DOCX) as a submission.
- Files are stored securely in **Supabase Storage** (the architecture picks this over AWS S3 or Firebase Storage).

### Marking & Visibility
- Tutors see a list of submissions, enter a score and write text feedback.
- Status moves **Submitted → Marked → Returned**, and the student's dashboard updates straight away (Supabase Realtime is a candidate).

## Architecture Mapping

| Concern | Component |
|---|---|
| Assignment / submission data | Postgres with RLS (students see only their own) |
| File uploads | Supabase Storage (private buckets, signed URLs) |
| Live status updates | Supabase Realtime (candidate) |

## To Elaborate
- Data model: `assignments`, `assignment_recipients`, `submissions`, `submission_files`, `feedback`
- File size and type limits, virus scanning approach
- Minors' data handling (students are school-age), including parental consent at registration
- Design so that Release 4 can attach assignments to communities without a painful migration
