# 02 — Architecture: build-queue items 1–3

> **Stage:** 2 of /deliver (Architect) · **Date:** 25 Oct 2026 · **Branch:** `feature/pending-requirements`
> **Input:** [01-requirement.md](01-requirement.md) (approved) and [review-1.md](review-1.md) round 2 findings 1–3.
> **Next stage:** Solution Designer (detailed contracts, migrations, component list).
> **ADRs added:** [`docs/decisions/`](../../decisions/) 0001–0004 (Proposed until this stage is approved).
> **Revision:** round 2, after [review-2.md](review-2.md) (blocking 1–2 and minors 3–7 fixed).

## Decisions for Saurabh

Only two items meet the pause rule (money). Nothing here changes auth, adds a vendor, or locks in
a data model. The schema changes are one boolean column with a default, three new tables and one private
bucket; all can be migrated forward.

| # | Decision | Recommendation | Can the build proceed locally without his answer? |
|---|---|---|---|
| 1 | **Supabase Pro before item 2 goes live** (already B3, ≈ A$38.75/mo). Uploaded photos of students' work are new family data; Free has no backups and 1 GB of storage | Approve before the first real family uploads anything. Build and test on local Supabase meanwhile | **Yes.** It gates release only |
| 2 | **Resend stays on Free (100/day, 3,000/month), shared with sign-in emails.** Item 3 caps its own sends at **70 in any rolling 24 hours** (counted as `sent_at > now() - 24 h`). That leaves ≥ 30 for invites and resets whether Resend counts a UTC day or a rolling 24 hours. Emails over the cap wait and go out as the window frees up. Resend Pro (≈ A$31/mo) only if that backlog actually shows up | No spend now. Revisit if the admin **Emails** page regularly shows **Waiting** rows with the reason "Daily limit". The page lists **Failed** rows and **Waiting** rows: held by the cap, or unsent after ~2 hours for any reason, including "Not attempted" when the cron job or Vault secret is missing | **Yes.** The cap is a constant |

**Release steps for Saurabh (not decisions, listed so nothing is a surprise):**
- Item 1: B1 as written (posts migration on hosted, ≥ 1 post, merge to `main`, hosted curl).
- Item 2: hosted migration deploy; deploy the new `assignment-files` edge function; B17 wording.
- Item 3: hosted migration deploy (enables `pg_cron` and `pg_net`); deploy the `notifications`
  function; set function secrets `RESEND_API_KEY` (already in `supabase/scripts/deploy.sh`, just
  not passed to functions today), `NOTIFY_WORKER_SECRET`, `SITE_URL=https://ajclasses.com.au`; put
  the same worker secret and the project URL in Supabase Vault. `deploy.sh` can do all of this;
  the Developer extends it. Optional: a separate Resend API key for notifications so it can be
  rotated without touching sign-in email.

**Considered and deliberately not flagged:** the file hand-in flag (ADR-0002) is a boolean with a
default and a backfill-free migration. The storage path layout (ADR-0003) could be changed later
with a copy script while data is small. Enabling `pg_cron`/`pg_net` is a dashboard-reversible
extension, not a vendor. Emails on by default is a Spam Act call already routed to Security
(01-requirement assumption 13).

---

## Item 1 — News page works on the hosted site, linked only when there's news

**Architecture impact: some.** A new pattern on public pages: a small live read from Supabase
through plain `fetch`. Same pattern as `services/leads.client.ts`, which already posts to
Supabase from the home page. No backend change. ADR-0001.

### Chosen approach

1. **Pre-render `/posts` as a shell.** Add `ROUTES.posts` to the `prerender` list in
   `apps/web/react-router.config.ts`. The build then writes `build/client/posts/index.html`,
   served by Vercel exactly like `/privacy` today. **No rewrite is added** to `vercel.json` or
   `serve.railway.json`, so the two behave the same by construction (AC-1.2). Unknown paths
   (`/posts/x`, `/postsx`) fall through to the existing `404.html` (AC-1.5). The global headers
   apply; the portal CSP/`no-store` rules don't match `/posts` (AC-1.4).
2. **Drop `clientLoader` from `routes/posts.tsx`.** Load the list in the component after mount
   (a small hook calling the service), with three states: loading, list/empty, error. Reason: with
   `ssr: false`, a route with a `clientLoader` pre-renders its `HydrateFallback`, not the page. A
   plain component pre-renders the real layout, `h1`, intro, title, description and canonical
   (AC-1.3), and shows a loading line until data arrives. Empty and error get separate constants
   (AC-1.6, AC-1.7).
3. **One public service, plain `fetch`, no `supabase-js`:**
   `src/services/public-posts.client.ts` with:
   - `hasPublishedPosts(): Promise<boolean>`:
     `GET {url}/rest/v1/posts?select=id&limit=1` with header `apikey: <publishable key>` (no
     `Authorization` header: the `sb_publishable_` key is not a JWT). Any error, non-200, timeout
     (`AbortSignal.timeout`, 5 s) or unconfigured Supabase → `false`. The promise is memoised per
     page load, so header and footer share one request.
   - `listPublicPosts(): Promise<Result<Post[]>>`: the same endpoint with the post columns,
     `order=created_at.desc`, the existing 200-row cap. `/posts` uses this, so **the public news
     page no longer loads `supabase-js` either** (stricter than AC-1.12 requires, same code size).
   - The admin page keeps `posts.service.ts` (supabase-js, signed-in writes) unchanged.
4. **Links.** A `useHasNews()` hook (in `lib/`) calls `hasPublishedPosts()` in an effect. The
   pre-rendered HTML never contains the link; it's added only when the check returns `true`.
   - **Header:** a `News` item appended as the last entry of the section links (desktop bar and
     the phone menu share the list), `aria-current="page"` on `/posts`. Label from constants.
     `NAV.links` entries are keyed by `sectionId` (`Header.tsx:75-77`) and link to home-page
     anchors, so News is a separate constant (`NAV.newsLink: { label, href }`) rendered as one
     extra `<li>` after the mapped list, not a fake `sectionId`.
   - **AC-1.8 count:** with News there are 6 section links. **Sign in and Register Interest are
     actions** (`.actions`, `Header.tsx:109-120`), not nav items, so "≤ 6 nav items plus the CTA"
     holds. The Tester counts `.links > li` only.
   - **Footer:** a `News` link in the bottom `legal` row, beside Resources.
5. **Sitemap (AC-1.11):** `routes/sitemap.ts` includes `/posts` only when `APP_CONFIG.supabase.url`
   is set at build time.

### Layout shift (AC-1.8, CLS < 0.1)

- The desktop nav is right-aligned (`.bar` is `space-between`, logo left, nav right). Appending
  `News` moves the five existing links left by its width (≈ 70 px). Nothing below the header
  moves: the bar has a fixed `min-height`.
- Worst case at 1024 × 600: impact fraction ≈ (630 × 44) / (1024 × 600) ≈ 0.045, distance
  fraction ≈ 70 / 1024 ≈ 0.07, **score ≈ 0.003**. At 1280 × 720 ≈ 0.002. That's about 30× under
  the 0.1 budget, and it happens once per page load.
- Phone menu: closed at load, so no shift. Footer: below the fold on every public page.
- **Fallback if the Tester measures otherwise:** put `News` first in the row instead. With a
  right-aligned row, a new first item moves nothing.
- Rejected: reserving an invisible slot. It leaves a gap when there's no news and puts a
  `/posts` link in the HTML of every page even when the page is empty.

### Alternatives considered

| Option | Why not |
|---|---|
| Rewrite `/posts` → `/__spa-fallback` in `vercel.json` (and `serve.railway.json`) | The fallback HTML is the portal shell: no title, description, canonical or `h1` without JavaScript (fails AC-1.3). In `serve.railway.json` the header rule is keyed on `__spa-fallback.html`, so `/posts` would get the portal CSP, `noindex` and `no-store` (fails AC-1.4) |
| Bake posts into HTML at build time | Needs a rebuild per post; breaks N3 |
| Keep `supabase-js` for the link check | Loads ~50 KB of JS on every public page; fails AC-1.12 |

### Railway

`docs/budget.md` lists Vercel only and `docs/architecture/arch.md` §3 calls the Railway files a
leftover. Railway is **not a live host**. The chosen approach needs no change to either
config, so `serve.railway.json` stays in step for free. Removing the Railway leftovers is a
separate clean-up (Later bucket), not part of this item.

### Risks

1. **The desktop bar may not fit on one row at 1024 px** with a sixth link (the CSS comment says
   1024 px was already chosen as the point where everything fits). Mitigation: Developer measures
   first. If it overflows, reduce `.links` gap from `--space-4` to `--space-3` between 1024 and
   1279 px only. Don't move the breakpoint.
2. **Public-page CSP (item 5).** When item 5 adds a CSP to public pages, `connect-src` must include
   `https://unzjnxctkyahtmrkinyr.supabase.co`, or the check fails silently and the links never
   show. It already must for `leads.client.ts`. Add this line to item 5's ACs.
3. **Privacy.** Every public page now makes a request to Supabase from the visitor's browser
   (IP address, user agent). Add one sentence to the Privacy Policy in the B17 batch (review-1
   finding 2).
4. **Free-tier pause.** If the hosted project pauses, the links hide (correct per AC-1.7), and
   `/posts` shows the error line. Public traffic now hits the REST API, which, as a side effect,
   makes pausing less likely.

### Cost impact (`docs/budget.md`)

**None.** One ~1 KB request per public page view, all within Supabase Free egress (5 GB).
10,000 views a month ≈ 10 MB. Vercel serves one more static file.

---

## Item 2 — Homework file uploads

**Architecture impact: some (the largest of the three).** New private storage bucket, a file
metadata table, an explicit assignment flag, changes to the student submit rules, and one new
edge function. ADR-0002 (type model) and ADR-0003 (storage).

### 2.1 Assignment type model (review-1 finding 1)

**Decision: add `assignments.is_file_handin boolean not null default false`.** The three kinds
are then mutually exclusive and explicit enough:

| Kind | Rule |
|---|---|
| File hand-in | `is_file_handin = true`, never has questions |
| Online | has ≥ 1 question (unchanged, D6) |
| Paper | neither (unchanged) |

- **Existing rows** get `false`, so every question-less assignment stays paper. No backfill.
- `private.is_online_assignment(a)` becomes "`is_file_handin` **or** has questions". The SQL
  rules built on it follow automatically: `check_assignment_result` (no staff Submitted/Marked,
  no `in_progress` on paper), `student_submit`'s `not_online` guard. **The web app does not
  follow automatically**: it decides paper vs online itself from the question count (see "Web
  app" below).
- **Guards (triggers):**
  - Adding a question to a file hand-in is refused (`file_handin_has_no_questions`).
  - `is_file_handin` can be set at insert, or changed while the assignment is a draft. Turning it
    on is refused if the draft has questions. Once published it's locked (AC-2.2), using the same
    trigger style as `check_assignment_status`.
- **`student_submit` changes** (`20261007090321_family_functions.sql:463`):
  - A file hand-in needs ≥ 1 registered file (`no_files`).
  - Today, with no written questions, the work "comes straight back" (auto-return). A file
    hand-in has no questions, so **without a change it would auto-return on submit**. A file
    hand-in must stay `submitted` until staff return it.
- **Marks:** `assignment_total_marks` already falls back to `max_mark` when there are no
  questions, so AC-2.9's single overall mark needs no change. Staff write `mark` and `feedback`
  on `assignment_results` (already granted). `mark_too_high` and `no_marks` already apply.
  **AC-2.9 clarification:** a file hand-in with **no** `max_mark` takes feedback only, no mark,
  exactly like paper today (`no_marks`, `student_parent_portal.sql:563-565`). The marking UI
  hides the mark field when `totalMarks` is null.
- **Families (required; plan it in the migration now):**
  - `private.assignments_for_student` gains an `is_file_handin boolean` column. A `returns
    table` signature can't be changed with `create or replace`, so the migration **drops and
    recreates** it together with the two SQL wrappers that repeat its column list,
    `public.student_assignments()` and `public.parent_child_assignments(uuid)`. It then
    re-applies the `revoke`/`grant execute` lines from
    `20261007090321_family_functions.sql:786-830`.
  - `private.assignment_view`'s JSON gains `isFileHandin` (a jsonb key; the signature is
    unchanged). It reads `assignments_for_student` with `s.*`, so it is recreated in the same
    migration.
  - Regenerate `services/database.types.ts`.
- **Staff:** `ASSIGNMENT_COLUMNS` in `services/assignments.service.ts:23` selects
  `is_file_handin`. The staff `Assignment` type (`services/types.ts:273`) and the family
  assignment type (`services/types.ts:392`, mapped in `services/family-data.ts:66`) gain
  `isFileHandin`.
- **Grants:** add `is_file_handin` to the `insert (...)` and `update (...)` column grants on
  `assignments`.

**Web app: one helper replaces the scattered question-count checks.** Add
`assignmentKind({ isFileHandin, questionCount }): 'file_handin' | 'online' | 'paper'` in
`lib/assignments.ts`, unit-tested in the existing `assignments.test.ts`. Add
`acceptsStudentWork(kind)` too, for "online or file hand-in". These call sites switch to it:

| Call site | Today | With the helper |
|---|---|---|
| `routes/portal/assignment-detail.tsx:75` | `isOnline = questionCount > 0` | Uses the kind. A file hand-in shows the submissions table, not the paper marks table (the DB would refuse its Submitted/Marked with `invalid_status`) |
| `routes/portal/assignment-detail.tsx:179` | Question editor when online or a draft | Hidden for a file hand-in (the new trigger refuses every add) |
| `routes/portal/assignment-detail.tsx:240` (`StudentWork`) | Online → `SubmissionsTable`, else the paper table | `acceptsStudentWork(kind)` → `SubmissionsTable` |
| `components/portal/AssignmentDialog.tsx:43` | `isOnline` from `questionCount` | Uses the kind. Adds the File hand-in choice on a new draft, locked once published |
| `routes/portal/student-home.tsx:127`, `:132` | `questionCount === 0` → "Paper" | Uses the kind. A file hand-in gets its own label and is actionable |
| `routes/portal/student-home.tsx:153-156` | Answered-count chip | Shown for online only |
| `routes/portal/student-assignment.tsx:55-56`, `:96`, `:118` | `questions.length > 0`; paper note | Kind from `view.isFileHandin`. Upload and Submit controls for file hand-in and online; the paper note for paper only |
| `routes/portal/parent-child-assignment.tsx:90` | `questions.length > 0` | Uses the kind. File list for file hand-in and online |

`SolveForm.tsx:56` and `QuestionList.tsx` count questions for their own display and stay as
they are. A grep of `src` on 25 Oct found no other `questionCount` or `questions.length`
checks.

Why not an enum `kind` ('paper' | 'online' | 'file_handin'): it would duplicate what the
questions already say about online work. Every existing create/edit flow would have to set it,
and a trigger would have to keep it consistent with the questions. It's more churn for the same
outcome. The flag can be folded into an enum later in one migration if a fourth kind appears.

### 2.2 Storage layout

**One private bucket, `assignment-files`:** `public = false`, `file_size_limit = 10 MB`,
`allowed_mime_types` = PDF, DOCX
(`application/vnd.openxmlformats-officedocument.wordprocessingml.document`), JPEG, PNG and WebP.
No SVG or HTML.

```
assignment-files/
  {assignment_id}/attachments/{file_id}.{ext}                  tutor/admin attachments
  {assignment_id}/submissions/{student_id}/{file_id}.{ext}     a student's hand-in files
```

**Metadata table `public.assignment_files`** (the source of truth for what exists and who can
see it):
- `id`, `assignment_id` (cascade), `student_id` (null = tutor attachment);
- `storage_path` (unique), `file_name` (1–200 chars, shown as text), `byte_size`, `mime_type`;
- `uploaded_by`, `created_at`;
- FK `(assignment_id, student_id)` → `assignment_results` with cascade, for student files.

Families have no table access (R3b D4); every write goes through security-definer RPCs.

**Upload flow (upload, then register):**

```
browser                         Storage (RLS on storage.objects)        Postgres RPC
  │ 1. check type/size/count      │                                       │
  │    compress images            │                                       │
  │ 2. upload path (upsert:false) ─▶ INSERT policy: right folder,          │
  │                               │  caller may hand in / manage,         │
  │                               │  bucket caps 10 MB + MIME             │
  │ 3. register(path, name) ─────────────────────────────────────────────▶ reads storage.objects
  │                               │                                       │ (real size, MIME, owner)
  │                               │                                       │ checks: ≤ 5 files,
  │                               │                                       │ images ≤ 2 MB, ≤ 20 MB
  │                               │                                       │ total, status not
  │                               │                                       │ submitted → inserts row,
  │                               │                                       │ not started → in progress
  │ 4. on refusal: remove object ─▶ DELETE policy: own unregistered obj   │
```

- Registering after upload lets the server check the **real size** that Storage recorded and
  the **declared MIME type**. Storage stores the `Content-Type` the browser sent; it doesn't
  sniff the bytes. That's how AC-2.4's server-side refusals work when the browser checks are
  bypassed: totals over 20 MB, and files over 2 MB that are **declared as images**. The real
  type is not verified (see Risk 3).
- An upload that is never registered (tab closed mid-way) is an **orphan**. Only its uploader
  can read or delete it, and no one else ever sees it in a list.
- **Objects per folder are capped at upload time.** The INSERT policy function refuses a new
  object when the folder already holds **5 or more objects in `storage.objects`, registered or
  not**. That applies to a student's `{assignment}/submissions/{student}/` folder and to an
  assignment's `attachments/` folder.
  - With the 10 MB bucket cap, a student who bypasses the browser can store at most 50 MB per
    assignment.
  - The student's own file list also shows their unregistered objects, with Remove, so a stuck
    orphan can't silently use up the fifth slot.
- A sweep of orphans older than a day goes to the Later bucket.
- RPCs: `staff_register_attachment`, `staff_remove_attachment`, `student_register_file`,
  `student_remove_file`; read lists `student_assignment_files`, `parent_child_assignment_files`.
- **Staff read `assignment_files` through RLS, with the AC-2.7 rule in the policy:**
  - attachment rows (`student_id is null`): anyone who can manage the assignment;
  - student rows: only when that student's result status is `submitted` or `returned`.

  So a tutor never sees a row for draft work, which matches the storage SELECT rule. Both
  policies call one `private.can_read_assignment_file(...)`, so the rule lives in one place.

**Storage policies (on `storage.objects`, `bucket_id = 'assignment-files'`), each a call to one
`private.*` security-definer function so the rule lives in SQL once:**

| Action | Attachments folder | Submissions folder |
|---|---|---|
| INSERT | `can_manage_assignment(folder[1])`, and < 5 objects in the folder | `folder[3] = my_student_id()`; the assignment is visible to them and is online or file hand-in; status not started / in progress; and < 5 objects in the folder |
| SELECT (signed URL) | staff of the assignment; enrolled students and their parents once published | AC-2.7: owner while not started / in progress; owner, class tutors, admins and linked parents once submitted or returned. Unregistered: uploader only |
| DELETE | `can_manage_assignment` | uploader, only while not started / in progress |
| UPDATE | none | none (no replace; AC-2.7 lock) |

Deactivated and invited accounts fail `my_student_id()`, `is_my_child()` and
`is_active_staff()`, so they get nothing (AC-2.11). Removal from a class fails
`assignment_visible_to`, so the files stay stored but hidden (AC-2.14, R3b F8).

**Signed URLs: 60 seconds, created on click of Download, with the `download` option.** The link
is never in the page, so it can't go stale, be shared from page source or sit in history. The
`download` option sets `Content-Disposition: attachment` with the file name (AC-2.12). Files are
served from `*.supabase.co`, never our origin, so a hostile file can't run as our site.

**Deleting an assignment (AC-2.14):** the DB cascade removes the metadata rows, but SQL can't
delete Storage objects (Supabase blocks direct deletes from `storage.objects`, and a row deleted
that way would leave the bytes behind). Also, nobody may delete a submitted student file
(AC-2.7). **Decision: a small edge function `assignment-files`** with one action,
`delete-assignment`, following the `account-admin` pattern:
1. With the caller's own client, confirm the caller can manage the assignment (RLS).
2. With the service client, list every object under the `{assignment_id}/` prefix in Storage,
   not just the metadata rows, so unregistered orphans are caught too.
3. With the caller's client, delete the assignment (RLS and triggers still apply).
4. With the service client, remove those objects, retrying once. A remaining failure is logged
   with a reason code. The objects are invisible (no metadata row) but still stored.

`assignments.service.ts` calls the function instead of the direct delete. If someone bypasses
it, or step 4 fails twice, the result is invisible stored bytes, not a data leak. These may be
photos of students' work, so they must not stay forever. The **Later-bucket sweep** covers two
cases, using the same service-key list-and-remove code as step 4:
- unregistered orphans older than a day;
- any object whose `{assignment_id}/` folder has no `assignments` row.

### 2.3 Client-side image compression

`lib/photo.ts` **partly fits**. Its `preparePhoto` crops to a square for avatars, which is wrong
for worked answers. Reuse its structure and its `canvasToBlob` helper:
- Add a pure, unit-tested `fitWithin(width, height, maxLongEdge)` next to `squareCrop`.
- Add `prepareWorkPhoto(file)`: `createImageBitmap` (applies EXIF orientation), draw at
  ≤ 2000 px on the long edge, encode **JPEG only** (quality ≈ 0.8), which strips location data.
  JPEG, not WebP, because tutors and parents download and open these files.
- Limits live in a typed constant, e.g. `WORK_FILE_LIMITS` in `src/constants/`; the migration's
  checks must match it (same convention as `PHOTO_LIMITS`).
- If the browser can't decode the image (HEIC in Chrome), return `null` and show the "can't use
  this photo" message (AC-2.15). On iPhone, Safari decodes HEIC, and the file picker usually
  hands over JPEG.
- File input: `accept` lists the allowed types and `capture` is **not** set, so phones offer both
  the camera and the photo library (AC-2.15).

### Alternatives considered

| Option | Why not |
|---|---|
| No metadata table; rely on `storage.objects` and path policies only | Storage RLS on insert can't see the file size, so there's no server-side 2 MB image cap or 20 MB total. Listing and counting from the web app would need Storage list calls per folder, and the tutor's file count per student would be N calls |
| Register first, then upload | Size is declared by the browser, so it's unverifiable. It also leaves "registered but missing" rows when uploads fail, which users would see |
| Two buckets (attachments, submissions) | Policies split by folder just as clearly; one bucket keeps a single size/MIME config |
| Long-lived signed URLs (hours) rendered in the page | Leak through copy, share and history. Breaks the "links expire" intent of AC-2.11 |
| Public bucket like `avatars` | Student work must never have a public URL (AC-2.11) |
| Assignment delete through a DB outbox drained by a cron worker | Would tie item 2 to item 3's worker. A synchronous function is simpler and ships with item 2 |

### Risks

1. **Auto-return bug if missed:** see the `student_submit` change. pgTAP test: submitting a file
   hand-in leaves status `submitted`.
2. **Storage `owner` column naming.** Newer Storage uses `owner_id` (text); older uses `owner`
   (uuid). Developer checks the local CLI version (2.120.0) and uses the current column.
3. **MIME spoofing.** The bucket's MIME check and the register RPC both see only the declared
   `Content-Type`. Mitigated by
   download-only serving from another origin, and re-encoding of images in the normal path.
   Virus scanning is deferred (01 assumption). Security to review.
4. **Storage on Free:** 1 GB ≈ a few hundred submissions (AC-2.5). This is why release waits for
   Decision 1.
5. **One database for staging and prod:** uploads made while testing on staging land in the real
   bucket. Test with a seeded fake class only, and delete through the function afterwards.

### Cost impact

- **Build/test:** none (local Supabase).
- **Release:** needs Supabase Pro (Decision 1): **+A$38.75/mo**, Scenario B in `budget.md` §3.3,
  already planned. Pro includes 100 GB of storage and 250 GB of egress, far above the expected
  use (100 students × 40 submissions × 5 MB ≈ 20 GB a year at the worst case).
- Edge function calls: one per assignment deletion. Negligible.

---

## Item 3 — "Work returned" email, with an off switch

**Architecture impact: some.** First app-sent email, the first scheduled job (`pg_cron`), and
first use of `pg_net`. **No existing email-sending code:** `supabase/functions/` has only
`leads` and `account-admin` (Zoho, invites). Resend is used only as auth SMTP
(`supabase/config.toml` `[remotes.production.auth.email.smtp]`). ADR-0004.

### Chosen approach: outbox table + `pg_cron` + edge function worker

```
staff return (any path: paper marks page, online submission page)
   │  UPDATE/INSERT assignment_results … status = 'returned'
   ▼
AFTER trigger (same transaction)                      notification_settings
   └─ when status becomes 'returned' AND marked_by is not null (staff return)
      inserts one row per eligible recipient ──── reads ──▶ (switch on, default on)
      into public.email_outbox  ON CONFLICT DO NOTHING
                       │
pg_cron, every 5 minutes: one SQL function, private.kick_email_worker()
   a. reclaim: 'sending' rows claimed > 10 min ago → back to 'pending' (attempt stays counted)
   b. no 'pending' row, or ≥ 70 sent in the last 24 h → stop, no HTTP call
   c. otherwise net.http_post(worker URL, secret from Vault)
                       ▼
edge function `notifications` (service role)
   1. claim up to (70 − sent in last 24 h) pending rows, oldest first
      (FOR UPDATE SKIP LOCKED → 'sending', claimed_at = now(), attempts + 1)
   2. re-check: account still active, switch still on (else 'skipped')
   3. look up email, child's first name, assignment title, class name
   4. render template → send (Resend HTTP API hosted; Mailpit locally)
   5. 'sent' | back to 'pending' (network/5xx, attempts < 3) | 'failed' + reason code

pg_cron, daily: delete from cron.job_run_details where end_time < now() - interval '7 days'
```

- **Atomic with the return:** the row is written in the tutor's own transaction. If the return
  rolls back, so does the email. If Resend is down, the return still succeeds and the tutor sees
  nothing (AC-3.7).
- **Covers every return path:** paper results are set in `assignments.service.ts`, online in
  `submissions.service.ts`. Both write `assignment_results`, so one trigger catches both, plus
  any future path.
- **Recipients at insert time (AC-3.1, AC-3.2):** the student's profile if active, and each
  linked parent (`student_guardians`) whose profile is active, minus anyone whose switch is off.
  No recipients means no rows, so nothing is a failure.
- **Staff returns only.** `check_assignment_result` sets `marked_by` to null on the automatic
  return of all-MCQ quizzes, so those send nothing. This matches AC-3.1's "when staff return".
  A student who just submitted doesn't need an email about it. If the PO wants parents told about
  auto-returned quizzes too, it's a one-condition change.
- **At most once (AC-3.5):** unique `(kind, assignment_id, student_id, recipient_id)`. A second
  return hits `on conflict do nothing`.
- **`email_outbox` columns:** `id`, `kind` ('work_returned'), `assignment_id`, `student_id`,
  `recipient_id` (profile), `recipient_role` ('student' | 'parent'), `status` ('pending' |
  'sending' | 'sent' | 'failed' | 'skipped'), `attempts`, `reason`, `created_at`, `claimed_at`,
  `sent_at`. **No email address and no body is stored**; the address is read at send time.
- **Rolling cap:** "sent in the last 24 hours" means
  `count(*) where status = 'sent' and sent_at > now() - interval '24 hours'`. Both the cron kick
  and the worker's claim size use it.
  - A rolling window stays under Resend's limit whether Resend counts a UTC day or a rolling
    24 hours.
  - A Melbourne-day count would not: 70 sent late on one Melbourne day plus 70 early the next is
    140 inside one UTC day.
- **Stuck rows:** a worker that crashes or times out after claiming leaves rows in `sending`. The
  cron kick returns any `sending` row with `claimed_at` older than 10 minutes to `pending`. Its
  attempt stays counted, so a row that keeps crashing the worker ends as `failed` after 3 tries.
- **Admin Emails list (AC-3.8, extended):** admin-only RPC `admin_email_problems()`, newest
  first. Each row shows time, recipient role, assignment title, a **state** and a **reason**:
  - **Failed:** `status = 'failed'`. The reason comes from the stored code, e.g. "Rejected by
    email service", "Recipient address missing", "Gave up after 3 tries".
  - **Waiting:** `pending` or `sending`, and created more than ~2 hours ago. The reason is
    computed:
    - "Daily limit" when the rolling cap is currently reached;
    - "Retrying" when `attempts > 0`;
    - otherwise **"Not attempted"**. That's what a missing cron job or Vault secret after deploy
      looks like.

  The empty state is "No failed or waiting emails". It replaces AC-3.8's "No failed emails";
  the PO's wording follows. Tutors, students and parents are refused (pgTAP). No direct table
  grants to `authenticated`.
- **Reason codes only:** `reason` holds a short code from a fixed list (`rejected`,
  `rate_limited`, `server_error`, `network`, `no_address`, `max_attempts`, `config_missing`). It
  never holds Resend's raw error text, which can echo the address. The function logs the HTTP
  status only.
- **Off switch (AC-3.6, AC-3.10):** new table `notification_settings` (`profile_id` PK,
  `work_returned boolean not null default true`, `updated_at`). A missing row means on. Own-row
  RLS only, plus column grants. Item 8 adds columns to this table. It's a separate table because
  family accounts can't write `profiles` (R3b D3).
- **Worker auth:** `verify_jwt = false` plus a shared secret header (`NOTIFY_WORKER_SECRET`),
  compared in constant time. If the secret is unset or empty, the worker refuses every request
  and sends nothing. The cron job reads the URL and secret from **Supabase Vault**, never from
  the migration. Locally, `seed.sql` puts local-only values in Vault.
- **Transport:** one `sendEmail()` with two small senders picked by `EMAIL_TRANSPORT`:
  - `resend`: `POST https://api.resend.com/emails` with plain `fetch`, no SDK, no new dependency.
  - `mailpit`: Mailpit's HTTP send API on the local stack (AC-3.9). Review-2 confirmed it exists
    on the local Mailpit v1.31.3 (`POST /api/v1/send`), so no fake server is needed.

  **No default transport.** If `EMAIL_TRANSPORT` is unset or isn't one of the two values, the
  worker sends nothing. The claimed rows go back to `pending` with reason `config_missing` and
  then show as Waiting.
- **Secret hygiene in `deploy.sh`:** `supabase secrets set` copies `[edge_runtime.secrets]` from
  `config.toml` to the hosted project (`config.toml:407-412`). So `deploy.sh` must:
  - `require NOTIFY_WORKER_SECRET`, and refuse the committed local value;
  - set `EMAIL_TRANSPORT=resend` and `SITE_URL` explicitly on the hosted project;
  - unset any Mailpit URL (`MAILPIT_URL`) there, by adding it to the existing `local_only` list
    next to the Zoho fakes.
- **Template:** HTML and text versions in the function, styled like `supabase/templates/*.html`.
  Wording in a typed constants module inside the function folder, because the edge runtime can't
  import `apps/web/src/constants`. Links use `SITE_URL` (always production; one database serves
  both). Every email links to Account → Notifications.

### Alternatives considered

| Option | Why not |
|---|---|
| Web client calls an edge function after returning | Lost if the tab closes between the two calls. Two return paths to remember. The function would have to re-check that the caller may return this work. Not atomic |
| DB trigger + `pg_net` straight to the function on each return | `pg_net` is fire-and-forget. If the call fails (cold start, deploy, function down), nothing records it (responses sit in `net._http_response` for 6 hours). That breaks AC-3.8. Also no cap and no retry |
| Supabase Database Webhook | The same as above under the hood (a `pg_net` trigger), plus config in the dashboard that drifts between local and hosted |
| `pg_net` from SQL straight to Resend | HTML templating in PL/pgSQL, the Resend key in Vault, async responses to reconcile. Hard to read and test |
| Outbox + cron (chosen) | Durable, atomic, retryable, cap-aware. Reused as-is by item 8 ("new assignment" via trigger, "due tomorrow" via a second cron query) |

### Volume vs Resend Free (100/day, 3,000/month, shared with sign-in email)

- One return emails 1 student + ≈ 1.5 parents ≈ **2.5 emails**.
- A tutor returning a class of 8 ≈ 20 emails; a heavy marking evening of 4 classes ≈ 80. That's
  **over** what's safe on a day that also has invites or resets.
- A rough month for 60 students, 3 returns each a week ≈ 60 × 3 × 4.3 × 2.5 ≈ **1,900** of 3,000.
  It fits, with less headroom than the daily cap.
- Hence the **app cap of 70 in any rolling 24 hours**.
  - Overflow stays `pending` and goes out in order as earlier sends age out of the window.
  - It isn't a failure. After ~2 hours it shows as Waiting ("Daily limit") on the admin page.
  - Sign-in emails always keep ≥ 30 in any 24 hours.
  - If Waiting rows show up regularly, see Decision 2 (a digest, or Resend Pro).
- Latency: up to 5 minutes from return to send. That's enough for "your work has been marked".

### Risks

1. **Shared quota.** A bug that loops sends could block sign-in email for the day. Mitigated by
   the unique key (no duplicates by construction), the app cap, and `attempts ≤ 3`.
2. **One database for staging and prod.** Any return made through staging emails real families.
   The worker can't tell the two apart. AC-3.11's seeded fake family with Saurabh's addresses is
   the only safe test, and staff must know that staging is live data.
3. **Vault and cron on hosted** need the release steps above. If the Vault secret is missing, the
   cron call is refused (401). Rows stay pending and nothing is lost. After ~2 hours they show as
   Waiting / "Not attempted" on the admin page, so the mistake is visible. The Tester checks that
   a pending row drains after deploy.
4. **Free-tier pause.** While the project is paused, cron doesn't run. Rows wait and send on
   resume. Acceptable.
5. **Deliverability.** The domain is verified (R2-05). The `From:` must be on `ajclasses.com.au`.
   A `List-Unsubscribe` header is not required at this volume; it's a later nicety.

### Cost impact

**None at current volume.**
- Resend stays on Free.
- Edge Function calls: at most one per 5 minutes, and only when rows are pending and the cap
  allows. That's ≤ 8,640 a month, well under the free 500k.
- `pg_cron` and `pg_net` are free extensions.
- `cron.job_run_details` grows by about 290 rows a day. The daily job trims it to 7 days, so it
  stays at a few thousand rows on the 500 MB database. Upgrade trigger
already in `budget.md` §5 (more than 100/day → Resend Pro ≈ A$31/mo), now with the app cap in
front of it.

---

## Cross-item notes

- **Item 5 (public CSP):** `connect-src 'self' https://unzjnxctkyahtmrkinyr.supabase.co` is
  required on public pages for item 1 (and already for `leads.client.ts`). Add this to item 5's
  ACs when it is elaborated.
- **Item 8** reuses item 3's outbox, worker, cap and `notification_settings` unchanged. Only new
  `kind` values, a trigger on publish, a daily cron query and new columns are needed.
- **Constants rule:** web text in `src/constants/*`. The two limit sets (`WORK_FILE_LIMITS`, the
  email cap) are mirrored in SQL/function code with a "must match" comment, as `PHOTO_LIMITS` and
  the posts limits do today.
- **Docs to update when built:**
  - `docs/architecture/arch.md`: §4 Storage (new bucket), §4 Edge Functions (`assignment-files`,
    `notifications`), §7 Resend (app email), and the diagram.
  - `docs/budget.md` §2 Resend row: now also the "work returned" email, with an app cap of 70
    per rolling 24 hours.
  - The `apps/web/src/routes.ts:19` comment. It says `/posts` is "client-rendered … never
    pre-rendered"; it should say "pre-rendered shell, posts load live".
  - The R3b design D6 line (`r3b/design.md:34`): file hand-in is the third kind.
  - ADR statuses: Proposed → Accepted once this stage is approved.

## Decisions recorded (for `_knowledge/decisions.md`)

- **DEC-PR-1 (ADR-0001):** `/posts` is pre-rendered as a shell with no rewrite. Public pages read
  live data only through plain `fetch` in `src/services/*.client.ts`, never `supabase-js`. The
  News link is client-revealed, appended last in the header links and in the footer legal row.
- **DEC-PR-2 (ADR-0002):** `assignments.is_file_handin boolean not null default false`.
  `is_online_assignment` = flag or questions. A file hand-in can't have questions, never
  auto-returns, and the flag is locked on publish. The flag reaches the web app through
  `assignments_for_student` (drop-and-recreate, with its two wrappers), `assignment_view` and
  the staff select. One `assignmentKind()` helper in `lib/assignments.ts` replaces every
  `questionCount > 0` test.
- **DEC-PR-3 (ADR-0003):** One private bucket `assignment-files` with an
  `{assignment}/attachments|submissions/{student}` layout. The `assignment_files` metadata table
  is the source of truth. The flow is upload, then register (the server checks the real size and
  the declared MIME). At most 5 objects per folder at upload.
  Signed URLs last 60 s, are created on click and force download. Assignment deletion goes
  through the `assignment-files` edge function (delete by prefix, retry once, Later sweep). Image compression is `prepareWorkPhoto` in
  `lib/photo.ts`: ≤ 2000 px, JPEG.
- **DEC-PR-4 (ADR-0004):** App email uses `email_outbox`, filled by a trigger. `pg_cron` runs
  every 5 minutes: it reclaims stuck rows and skips the call when nothing is due or the cap is
  reached. It calls the `notifications` edge function, which sends through Resend's HTTP API
  (Mailpit locally).
  - Staff returns only, at most once per recipient, student and assignment.
  - App cap: 70 per rolling 24 hours.
  - Admins see Failed and Waiting rows, with reason codes.
  - Opt-out lives in `notification_settings`, default on.
  - No default transport and no default secret.
