# 01b — Requirement: build-queue items 4–9

> **Stage:** 1 of /deliver (Product Owner) · **Date:** 26 Oct 2026 · **Branch:** `feature/staff-phone-privacy` (cut from `develop` at `fb738ea`)
> **Input:** [01-requirement.md](01-requirement.md) §1 inventory and §2.1 build queue,
> [04-plan.md](04-plan.md) §1.1 (order 4 → 5(+9) → 6 → 7 → 8) and §1.2 (Q1–Q20),
> [02-architecture.md](02-architecture.md) cross-item notes, ADR [0004](../../decisions/0004-email-outbox-cron-worker.md).
> **Next stage:** Architect, per item (see each item's "For the Architect" line).

Same conventions as 01 §3: stories, numbered ACs (`AC-<item>.<n>`), v1 vs deferred, and
`[ASSUMPTION]` lines for anything I decided without asking. Items 1–3 are built; item 1 and
item 3 are on `develop`, and item 2 is held, unmerged, on `feature/homework-file-uploads`.

Common to every item (not repeated in each AC list):
- All text comes from `src/constants/*`, and `pnpm lint` passes (R1 F8).
- Public pages load no MUI and no `supabase-js` (AC-1.12 / AC-2.16 still hold).
- Staging and prod share one Supabase project. No test touches the hosted database, and no
  test email goes to a real family (AC-3.11).
- Every production release (merge to `main`) and every hosted migration or function deploy is
  Saurabh's step.

---

## Item 4 — Staff phone on the profile page, plus a Privacy Policy update

**Covers:** INV-04, INV-05 (and the R1-07 cross-reference).

**Problem.** Staff (tutors and admins) must give an Australian phone number when they set up
their account (`invite-onboarding.md` "Fields"). After that, nobody can change it: the
**My profile** page (`routes/portal/profile.tsx`) has no phone field, and `phone` isn't in the
`authenticated` update grant (migration `20261023100000`, line 320). A tutor who changes number
leaves admins with a wrong one. The Privacy Policy also never says we keep staff phone numbers:
the portal section (`PRIVACY.sections`, heading "Student and parent portal accounts",
`content.constants.ts`) covers students and parents only.

**Stories**
- **P1.** As a tutor or admin, I can see and change my phone number on My profile, so AJ Classes
  can always reach me.
- **P2.** As an admin, I can correct a staff member's phone number from their staff page, as I can
  already correct their name and bio (R2a US18).
- **P3.** As anyone reading the Privacy Policy, I can see that AJ Classes keeps staff phone
  numbers, why, and who can see them.

**Acceptance criteria**
- AC-4.1 **Field on My profile.** For a signed-in, active tutor or admin, My profile shows a
  phone field:
  - its label is the setup form's label, `'Phone number'` (`JOIN_PAGE.labels.phone`,
    `portal.constants.ts`);
  - it's pre-filled with the stored number in the portal's display format (`formatPhone`,
    `lib/format.ts`);
  - its hint is new, e.g. "So AJ Classes can reach you about your classes. Only AJ Classes
    admins can see it; it's never shown on the website." `[ASSUMPTION]` It needs to say this
    because `PROFILE_PAGE.intro` says the profile is "how you appear to AJ Classes, and later on
    the website".
- AC-4.2 **Accepted formats.** These formats are accepted, and the number is stored as `+61…`:
  - mobile `04xx xxx xxx`;
  - landline `(0X) XXXX XXXX` (area codes 2, 3, 7, 8);
  - `+61 …`.

  Spaces, brackets and hyphens are ignored. This is the same rule as setup:
  `isValidAustralianPhone` in `lib/validation.ts` and `private.normalise_au_phone`. After a save,
  a reload shows the new number.
- AC-4.3 **Invalid input.** A number that isn't Australian, has too few or too many digits, or
  contains letters is refused with an inline message, and nothing is saved. The server refuses the
  same values when the browser check is bypassed (tested through the API).
- AC-4.4 **Empty.** Staff can't clear a phone number that's already saved: a blank field is
  refused with an inline message. `[ASSUMPTION]` An account that has no phone yet (staff who
  joined before invite onboarding) can still save its other profile fields with the phone left
  blank. It isn't forced to add a number to fix a typo in its bio.
- AC-4.5 **Save behaviour** is unchanged:
  - one **Save profile** button for the whole form;
  - the existing success confirmation;
  - the header name refreshes.

  A phone error doesn't throw away the other fields' edits.
- AC-4.6 **Admin correction.** An active admin who has passed two-step, on Admin → Staff →
  person, can change that person's phone with the same field and rules (AC-4.2–4.4).
  - The change shows straight away in the Admin → Staff list's Phone column, and as the person's
    tap-to-call number.
  - It's recorded in Admin → Activity as an admin profile edit with the field name only
    (`phone`), never the number. This is the existing rule for `profile_edited_by_admin`.
- AC-4.7 **Permissions.** Each of these is tested through the API:
  - A tutor can change only their own phone.
  - A tutor can't read or change another person's phone.
  - Students and parents can't set a phone on their own profile or anyone else's. Setup refuses it
    today, and so does this path.
  - Deactivated and still-invited accounts can't change any phone.
  - `status`, `terms_accepted_at` and `password_set_at` stay impossible to write directly.
- AC-4.8 **Not exposed anywhere new.** The phone appears only on My profile, on the admin staff
  pages, and in `admin_list_staff()`. It isn't in any public page, sitemap, JSON-LD or
  family-facing RPC. A grep of the production build's public HTML finds no staff number.
- AC-4.9 **Privacy Policy.** `/privacy` gets one new sentence saying:
  - we keep a phone number for each tutor and staff member, given at account setup and kept up
    to date by them;
  - we use it to contact them about classes;
  - only AJ Classes admins can see it;
  - it's never published.

  `[ASSUMPTION]` The section heading "Student and parent portal accounts" becomes "Portal
  accounts", since it now covers staff too. `PRIVACY.lastUpdated` is updated to the release month.
  The new wording carries a code comment saying it's a draft for Saurabh to approve with B17.
- AC-4.10 **Phone and themes.**
  - The field works at 360 px wide and opens the phone keypad (`type="tel"` or an equivalent).
  - The field and its error state are legible in the portal's light and dark appearance.
  - The admin staff page is checked at 360 px in both appearances too.

**v1 scope:** a phone field on My profile and on the admin staff edit form, the same validation as
setup, and one Privacy sentence.
**Deferred (Later bucket):**
- SMS or WhatsApp verification of a changed number;
- a phone for students or parents;
- a "last changed" date;
- showing staff phones to tutors of the same class.

**Dependencies:**
- None in code.
- **Merge conflict to expect:** held item 2 also edits the `PRIVACY` portal text. Whichever
  merges second rebases and keeps both sentences.
- Its wording joins items 2's and 3's in the one B17 review (Q7).

**Release gate (owner):**
- B17: Saurabh approves the Privacy wording (Q7, batched).
- A hosted migration deploy, if the Architect's approach adds one. It almost certainly does,
  because `phone` isn't writable today.

**For the Architect:** choose how the write is allowed. Two options:
- a column grant on `phone`, plus a normalising and validating trigger;
- an own-profile RPC like `complete_onboarding()`.

Either way, keep AC-4.6's audit entry free of the number. This is likely a one-paragraph "low
impact" note.

---

## Item 5 — Content security policy on public pages

**Covers:** R2-11. **Includes item 9's decision** (dropped; see item 9) as one docs AC.

**Problem.** Only `/portal/:path*` sends a `Content-Security-Policy` (`apps/web/vercel.json`).
Public pages carry most of the traffic, take form input and load live data, yet they send none. A
CSP limits what an injected script could load or send.

**What public pages legitimately reach today** (from `src/`):
- the site itself;
- the Supabase host `unzjnxctkyahtmrkinyr.supabase.co` (the `leads` function through
  `leads.client.ts`, and the News check and `/posts` through `public-posts.client.ts`;
  02 cross-item notes);
- `api.web3forms.com` (enquiry form);
- `app.convertkit.com` (footer subscribe, hidden until `VITE_KIT_FORM_ID` is set: B5);
- Vercel Web Analytics on the same origin (`/_vercel/insights/*`).

Everything else (WhatsApp, Facebook, ACER, VCAA, vic.gov.au, Zoho Invoice) is a plain link,
which a CSP doesn't restrict.

**Stories**
- **C1.** As a parent using the site, the pages behave exactly as before, and an injected script
  couldn't load code from, or send my details to, a host AJ Classes doesn't use.
- **C2.** As the owner, a new third-party script can't be added to the site by accident without
  the policy being changed on purpose.

**Acceptance criteria**
- AC-5.1 **Every public HTML response has an enforcing CSP.** In the local production gate (as in
  AC-1.1: production build served with `vercel.json`'s rules), these pages return a
  `Content-Security-Policy` header:
  - `/`, `/privacy`, `/resources`, every guide, every programme page including `/programmes/vce`;
  - `/posts`, `/subscribed`;
  - the 404 page (for example `/nope`).

  It's an enforcing header, not `-Report-Only`.
- AC-5.2 **Minimum directives.** The public policy contains at least:
  - `default-src 'self'`
  - `object-src 'none'`
  - `base-uri 'self'`
  - `frame-ancestors 'none'`
  - `form-action 'self'`, plus the Kit host only if the subscribe form posts there
  - `connect-src 'self' https://unzjnxctkyahtmrkinyr.supabase.co https://api.web3forms.com`,
    plus the Kit host

  No wildcard host (`*`, `https:`) appears in any directive. How `script-src` and `style-src`
  handle the pre-rendered inline scripts and styles (hashes, nonces or `'unsafe-inline'`) is the
  Architect's call, and it's written down with the reason.
- AC-5.3 **Zero violations.** No CSP violation appears in the browser console on each page in
  AC-5.1, at 360 px and at 1280 px, during each of these:
  - page load and hydration;
  - opening the phone menu;
  - the News link check, with posts and without;
  - opening `/posts`, with a list and empty;
  - submitting the enquiry form. Web3Forms and `leads` may be mocked at the network layer, which
    still exercises the CSP;
  - a subscribe attempt with a placeholder `VITE_KIT_FORM_ID` in a local build. The request may
    fail; it must not be CSP-blocked.

  The TSR records the browser and the result per page.
- AC-5.4 **Nothing that works today breaks** (local production gate):
  - JSON-LD is still in the HTML, and the Rich Results check in item 6 still passes.
  - Images, fonts, the favicon, the manifest and the OG image still load.
  - The WhatsApp button still opens `wa.me`.
  - Vercel Analytics still loads in production mode (same origin).
  - The environment marker still shows on non-production builds.
- AC-5.5 **Portal unchanged.**
  - Every `/portal/*` response still carries exactly the protection it has today: either one CSP
    header equal to the current portal policy, or an effective policy proven to be no looser and
    no stricter.
  - Sign-in still works, including the Turnstile challenge (`challenges.cloudflare.com`).
  - Avatars and work files still load and download.
  - `X-Robots-Tag` and `Cache-Control: no-store` still apply.
  - `[ASSUMPTION]` Vercel sends every matching header, so two CSP headers on a portal page would
    both be enforced. The Architect confirms that the public and portal rules don't stack in a way
    that breaks the portal.
- AC-5.6 **Other headers kept.** HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY` and
  `Referrer-Policy` are unchanged on every response.
- AC-5.7 **Railway kept in step.** `serve.railway.json` sends the same public CSP (01 assumption
  14), even though Railway isn't a live host.
- AC-5.8 **Invalid states.**
  - A test page or fixture that loads a script from an unlisted host is blocked, and the block
    shows in the console. This proves the policy is enforcing, not decorative.
  - An inline `onclick` attribute doesn't run, unless the chosen `script-src` permits it on
    purpose (state which).
- AC-5.9 **Item 9 closed.** In `docs/requirements/release-1/PRP.md` F6.3, the `hreflang` and
  `geo.*` sample tags are marked "dropped (26 Oct 2026, pending-requirements item 9)", with a
  link to this doc. The launch-checklist line "every F6.3 tag present" then reads as met by the
  remaining tags. No code change.
- AC-5.10 **Documented.** `docs/architecture/arch.md` lists the public CSP's allowed hosts, and
  says that adding a third-party service means updating `vercel.json` and `serve.railway.json`.

**v1 scope:** one enforcing CSP for public pages, covering today's hosts; the portal policy kept;
the docs line for item 9.
**Deferred (Later bucket):**
- violation reporting (`report-to`). It needs a reporting endpoint, which waits for Sentry (B14);
- `upgrade-insecure-requests` and Trusted Types;
- tightening the portal's `'unsafe-inline'`.

**Dependencies:**
- Item 1 (the News check's `connect-src`) is on `develop`.
- If item 2 merges first, AC-5.5 also covers its signed-URL downloads.
- None blocking.

**Release gate (owner):** none beyond the normal production release. **Release check** (team,
read-only curl on the live site after Saurabh merges): `curl -sI https://ajclasses.com.au/` and
one programme page show the CSP header.

**For the Architect:** decide the `script-src` approach for the pre-rendered inline scripts, and
check that the public and portal rules don't stack on `/portal/*` (AC-5.5).

---

## Item 6 — CI quality gates: E2E smoke, Lighthouse budget, structured data

**Covers:** R2-09 (Lighthouse CI and Playwright, the missing half), R1-20 (Lighthouse ≥ 90 on
mobile, SEO 100, Rich Results with no errors).

**Problem.** `.github/workflows/ci.yml` runs format, lint, typecheck, unit tests, the build and
pgTAP. Three checks run only by hand, and only when someone remembers:
- The Playwright suite lives in a **separate, local-only repo**, `~/dev/work/aj_classes-e2e`. It
  has 5 specs, and `git remote -v` shows no remote.
- No Lighthouse score has ever been recorded, against R1's targets.
- No Rich Results check has been recorded.

So a change that breaks the enquiry form, sign-in, or the home page's structured data can merge
green. Items 7 and 8 should land behind these gates.

**Stories**
- **Q1.** As the team, a pull request that breaks a core journey (home page, enquiry, staff
  sign-in, admin post → `/posts`) fails CI before it can merge.
- **Q2.** As the owner, the site's Lighthouse scores and structured data are checked on every pull
  request against R1's published targets, so "fast and findable" stays true.

**Minimum useful scope (my decision).** These are the three gates. Nothing broader is in v1.
1. **E2E smoke:** the journeys a customer or staff member would notice first, all against a fresh
   local Supabase in CI:
   - the home page and Our Approach;
   - Register Interest;
   - staff sign-in with two-step;
   - an admin publishing a post that then shows on `/posts`.

   These are 4 of the 5 existing specs. `[ASSUMPTION]` Invite onboarding (the 5th, which needs
   Mailpit and the auth email path) runs in the smoke if it fits the time limit in AC-6.4.
   Otherwise it stays manual and is named in "Not covered".
2. **Lighthouse budget:** R1's own numbers, on mobile, for a small fixed page set.
3. **Structured data:** an offline check of the JSON-LD in the pre-rendered HTML. Google's Rich
   Results Test has no API, so it stays a recorded manual check on the live URL.

**Acceptance criteria**
- AC-6.1 **Runs on every pull request** and on every push to `develop` and `main`, like the
  existing jobs.
  - Each gate is its own named job ("E2E smoke", "Lighthouse", "Structured data"), so a failure
    says which gate failed.
  - Any failure fails the workflow.
- AC-6.2 **E2E smoke content.** The job runs the 4 journeys above, plus the 5th if it fits:
  - against a fresh local Supabase started by the Supabase CLI, with every migration and
    `seed.sql`;
  - with Web3Forms mocked, as the spec does today;
  - with the suite's dual-surface rule kept: each spec asserts both the UI and the database row.
- AC-6.3 **E2E safety.**
  - The workflow uses only the Supabase CLI's local demo keys and the seeded local admin. It has
    **no secret, URL or key for the hosted project**; a grep of the workflow file for
    `unzjnxctkyahtmrkinyr` finds nothing outside the CSP.
  - No step writes an `.env*` file into git, and no committed file gains a secret.
  - `VITE_LEAD_CAPTURE=on` is passed as a job environment variable, not committed.
- AC-6.4 **Time limit.**
  - The E2E job finishes in ≤ 15 minutes; Lighthouse and structured data in ≤ 10 minutes each.
  - The whole workflow's wall time, with jobs in parallel, stays ≤ 20 minutes.
  - The TSR records the actual times from 3 runs.
- AC-6.5 **E2E failure output.** A failing spec uploads the Playwright HTML report and traces as a
  workflow artifact, kept ≤ 7 days, so the failure can be opened without re-running it locally.
- AC-6.6 **Lighthouse pages and budget.** The job runs Lighthouse with mobile emulation on a
  production build (`VITE_APP_ENV=production`) served locally with `vercel.json`'s headers.
  - Pages: `/`, `/programmes/vce`, one other programme page, `/resources`, one guide, `/privacy`.
  - The median of 3 runs per page must reach:
    - Performance ≥ 90;
    - Accessibility ≥ 90;
    - Best Practices ≥ 90;
    - **SEO = 100** (R1 §1.1, F6.5.6).
- AC-6.7 **Thresholds are never lowered to pass.**
  - If a page misses a target on the first run, the Developer fixes it in this item if the fix is
    small.
  - Otherwise the gap is written up in the TSR and `review-*`, with the score, and comes back to
    the PO for a scope call before merge.
  - The thresholds live in one committed config file.
- AC-6.8 **JS size.** The Lighthouse job also reports the total JS transferred per page (R1 PRP:
  ≤ 100 KB gzipped).
  - `[ASSUMPTION]` If the first baseline is within budget, the budget becomes a gate.
  - If it isn't, v1 records the baseline in the TSR, and the size gate goes to the Later bucket
    with the MUI chunk split, rather than blocking item 6.
- AC-6.9 **Structured data check.** A script reads every pre-rendered HTML file in `build/client`
  and, per page, checks:
  - every `application/ld+json` block parses as JSON;
  - each page carries the types it should, taken from what `lib/seo.ts` emits today (the
    Designer lists them per page):
    - home: `EducationalOrganization` + `LocalBusiness`, `WebSite`, `FAQPage`;
    - programme pages: `Course` + `BreadcrumbList`;
    - guides: `Article` + `BreadcrumbList`;
  - Google's required properties for those types are present and non-empty. Examples: `Course`
    has `name`, `description` and `provider`; each `ListItem` has `position`, `name` and `item`;
    each `Question` has `acceptedAnswer.text`;
  - every URL in the JSON-LD is absolute and starts `https://ajclasses.com.au`;
  - there's **no** `Review` or `AggregateRating` (R1 F6.4.3).
- AC-6.10 **Structured data, invalid states.** The check fails, naming the file and the problem,
  when a fixture has:
  - broken JSON;
  - a missing required property;
  - a relative or non-production URL;
  - a `Review` block.

  Each case has a unit test.
- AC-6.11 **Rich Results (manual, recorded).**
  - After the next production release, the team runs Google's Rich Results Test and the Schema
    Markup Validator on the live `/`, `/programmes/vce` and one guide.
  - The TSR records "Organization / LocalBusiness detected, no errors" (R1 F6 checklist), with the
    date. These are public tools, so no owner account is needed.
- AC-6.12 **Docs.** `README.md`, or `docs/testing/`, says how to run each gate locally, with the
  same commands CI uses. The E2E repo's README "Preconditions" is updated, or superseded,
  accordingly.
- AC-6.13 **New dev dependencies** (for example a Lighthouse CI package) are dev-only and listed,
  with a one-line reason each, in the PR description (dependency-approval rule).

**v1 scope:** three CI jobs (E2E smoke, Lighthouse budget, structured data); a recorded manual
Rich Results run; local run docs.
**Deferred (Later bucket):**
- running the full E2E suite, including future specs for items 2, 3, 7 and 8, on every PR. v1 is a
  smoke; new specs can join it if they fit AC-6.4;
- Lighthouse on portal pages;
- visual regression;
- E2E against the hosted staging site (it sits behind Vercel's login, and one database serves
  prod);
- making the checks *required* in GitHub branch protection (owner step, below);
- a JS size gate, if AC-6.8 records a gap.

**Dependencies:**
- None blocking.
- Lands **before** items 7 and 8, so they ship behind the gates.
- If item 5 lands first, Lighthouse and E2E run with the CSP in place, which is better.

**Release gate (owner):** none to merge. Optional, after merge: Saurabh turns on "required status
checks" for `develop` and `main` in GitHub settings (an account action).

**For the Architect (must decide, flagged):** how CI gets the E2E specs. The E2E repo has no
GitHub remote, so CI can't check it out today. Options:
- (a) Move or copy the smoke specs into this repo, for example under `e2e/`. This needs no owner
  action, but changes the "separate repo by design" rule in the E2E README.
- (b) Push the E2E repo to a new private GitHub repo and check it out in CI with a read-only
  deploy key.
- (c) A git submodule. Like (b), it needs a remote.

(b) and (c) need Saurabh to create the repo and the key (Q21). `[ASSUMPTION]` Recommend (a)
unless the Architect finds a reason not to, so Q21 never becomes blocking. The Architect also
decides:
- whether E2E runs against the dev server on port 5173 (the suite's CORS and auth allow-lists
  assume it) or the production build;
- the Actions minutes estimate (Q22).

---

## Item 7 — Fair results: "hold results" switch, and returned work stays visible after leaving a class

**Covers:** R3-06, which is two accepted R3b gaps from `release-3/r3b/review.md`:
- **F28:** "All-MCQ instant results let students share answers before others finish."
- **F8:** "A student removed from a class loses sight of that class's assignments, including
  returned marks." This was accepted for R3b, because visibility followed enrolment.

**Problem.**
- **F28:** An all-multiple-choice quiz is returned the moment a student submits (R3b D8;
  `student_submit`). The first finisher can share the correct options with the rest of the class.
  The current workaround is adding a dummy written question.
- **F8:** Every family read goes through `private.assignments_for_student`, which joins
  `enrolments` and requires `classes.is_active`. Removing a student from a class (deleting their
  `enrolments` row), or archiving the class at the end of term, hides that student's returned
  marks and feedback from the student and their parents. Parents lose the history they rely on.

**New visibility rule (replaces R3b F8, "visibility follows enrolment").** A student (active
account and active roster row, as today), and each of their active linked parents, can see a
**published** assignment when **either** of these is true:
- **(a)** the student is currently enrolled in its class and the class is active. This is
  unchanged, and the hiding rules by status (R3b §4) apply as today.
- **(b)** the student's result for that assignment has status **Returned**, whether or not they're
  still enrolled and whether or not the class is still active. They see it **read-only**, exactly
  as a returned assignment looks today: marks, comments, answers, correct options, explanations,
  and (once item 2 is merged) the tutor's attachments and the student's own handed-in files.

Anything that meets neither is hidden, as today. That covers unpublished drafts, and any
not-started, in-progress or submitted-but-not-returned work in a class the student has left.
`[ASSUMPTION]` Archived classes are included in (b). Term-end archiving is the most common way a
family would lose its history, and it's the same one-condition rule. The rule changes nothing
for staff, the timetable, or who can submit.

**Stories**
- **H1.** As a tutor, I can tick "Hold results until I return them" on a multiple-choice quiz, so
  no student sees marks or correct answers until I return the work.
- **H2.** As a student, after submitting a held quiz, I see that it's handed in and waiting. I see
  my marks and the answers only when my tutor returns it.
- **H3.** As a student or parent, marked and returned work stays in my list after I leave a class,
  or the class ends, so I keep my record of marks and feedback.

**Acceptance criteria — hold results (F28)**
- AC-7.1 **The switch.** On a draft assignment that has at least one question, the tutor of the
  class, or an admin, sees a checkbox, "Hold results until I return them".
  - It's off by default, which keeps today's behaviour.
  - It saves with the draft.
  - Once the assignment is published it's locked and shown read-only, like the questions (R3b F9).
  - The server refuses a change after publishing (tested through the API).
  - `[ASSUMPTION]` It's shown for any assignment with questions. It only changes anything when
    every question is multiple choice, because a written question already holds results. The
    hint says so.
- AC-7.2 **Not offered elsewhere.** Paper homework and file hand-in assignments don't show the
  switch. Neither ever auto-returns (ADR-0002). The server refuses setting it on them.
- AC-7.3 **Submit with hold on.**
  - The student's multiple-choice answers are auto-marked and stored as today.
  - The status becomes **Submitted**, not Returned.
  - The student and parents see the family label for submitted work, `'Waiting for marking'`
    (`family.constants.ts`).
  - Neither sees a mark, correct option or explanation before return. This is the existing R3b
    "before return" hiding (pgTAP).
- AC-7.4 **Tutor return.**
  - The tutor sees each held submission with its auto-marks, and can add an overall comment and
    per-question feedback.
  - **Return** works straight away, because there are no written answers to mark.
  - Returning shows everything as an ordinary return does.
  - It counts as a **staff** return, so `marked_by` is set and item 3's "work returned" email is
    queued, subject to the off switch. Auto-returns still send no email.
- AC-7.5 **Hold off is unchanged.** An all-MCQ quiz with the switch off still returns on submit,
  and still sends no email. This is a regression test.
- AC-7.6 **Permissions.**
  - Only staff who can manage the assignment can set the switch.
  - A student can't read a held quiz's marks or correct options through any RPC before return.
  - A parent can't either.
- AC-7.7 **Phone and themes.** The checkbox and its hint read correctly at 360 px, in the portal's
  light and dark appearance.

**Acceptance criteria — returned work stays visible (F8 replaced)**
- AC-7.8 **Removed from a class.** A student removed from a class still sees each returned
  assignment from it in their assignment list and on its page, read-only (rule (b)). So does each
  linked parent, on the child's page and the child-assignment page.
- AC-7.9 **Class archived.** The same holds when the class is archived instead (`is_active =
  false`).
- AC-7.10 **What stays hidden.** After removal or archiving:
  - Not-started, in-progress and submitted-but-not-returned work from that class is hidden from
    the student and parents.
  - So is that class's timetable.
  - Drafts stay hidden.

  Each case has a pgTAP test.
- AC-7.11 **Read-only.** On a past-class assignment, the student can't save, submit, upload or
  remove anything. The server refuses each one (tested through the API). The page shows no
  editing controls.
- AC-7.12 **Labelled.**
  - In the list and on the page, a past-class assignment shows a short tag from constants, e.g.
    "Past class". `[ASSUMPTION]` It doesn't move to a separate section.
  - With the "Marked and returned" list empty, the existing empty text (`'Nothing returned yet.'`)
    still applies.
- AC-7.13 **Boundaries unchanged.** Each of these is tested:
  - Another student, or the parent of another child, never sees the work.
  - A deactivated student, or a parent whose link was removed, sees nothing (existing rule).
  - Deleting the student's roster row or the assignment still deletes the result, so nothing
    shows.
  - Re-enrolling the student shows everything by rule (a) as before.
- AC-7.14 **Email links keep working.** A "work returned" email's **View feedback** link (AC-3.4)
  still opens the page after the student has left the class.
- AC-7.15 **Files (once item 2 is on `develop`).** Rule (b) covers the tutor's attachments and
  the student's handed-in files for returned work, replacing AC-2.14's "stored but hidden until
  item 7". If item 2 is still held when item 7 is built, this AC moves to item 2's re-test (T2.15).
- AC-7.16 **Phone and themes.** The "Past class" tag and the read-only page work at 360 px, in
  light and dark.
- AC-7.17 **Docs.** `r3b/review.md` F8 and F28 are marked resolved, with a link here.
  `r3b/design.md` §4's student and parent rows state rule (b).

**v1 scope:** the hold switch for assignments with questions, and rule (b) for returned work after
removal or archiving.
**Deferred (Later bucket):**
- a "Return all submitted" bulk action for held quizzes (v1 returns one student at a time, as
  today);
- turning hold off after publishing to release results;
- making hold the default;
- letting a tutor return work for a student who has already left the class;
- showing a left student's non-returned work;
- a "past classes" section or filter.

**Dependencies:**
- Item 3 (on `develop`): held returns send its email.
- Item 2 (held): AC-7.15. Its migration redefines `assignments_for_student`, so the Architect
  sequences the two migrations.
- Item 6 first, so this ships behind the gates.

**Release gate (owner):** hosted migration deploy only.

**For the Architect:** where the hold flag lives, and how rule (b) is applied in
`assignments_for_student` / `assignment_view`. Item 2 drops and recreates the same builders
(ADR-0002), so order the migrations.

---

## Item 8 — More alerts: "new assignment" and "due tomorrow" emails

**Covers:** R5-02 (the "new assignment posted" and "due date approaching" triggers) and R5-04
(the rest of the web preference centre). R5-03, "join request approved", stays blocked on R4
(B12).

**Problem.** Item 3 tells families when work comes back. They still don't hear when work is set,
or when it's about to be due. That's when a nudge changes behaviour. Item 3 built the machinery:
- the `email_outbox` table;
- the `pg_cron` worker;
- the cap of 70 per rolling 24 hours;
- `notification_settings`;
- the admin Emails page.

All of it is reusable as-is (02 cross-item notes, ADR-0004).

**Stories**
- **A1.** As a parent or student, I get an email when a tutor publishes new work for the class, so
  I know it exists.
- **A2.** As a parent or student, I get an email the day before online work is due if it hasn't
  been handed in yet, so it isn't missed.
- **A3.** As a parent or student, I can turn each of these off (and on again) separately on
  Account → Notifications, next to the "work returned" switch.

**Acceptance criteria — "new assignment"**
- AC-8.1 **Trigger.** When an assignment of any kind (paper, online or file hand-in) is published,
  one email is queued for each student enrolled in the class at that moment. Each email goes to:
  - the student, if they have an **active** account and their switch is on;
  - each **active** linked parent whose switch is on.

  These are the same recipients as AC-3.1.
- AC-8.2 **Content.** The email gives:
  - the child's first name;
  - the assignment title and class name;
  - the due date, if one is set, in Australian format, e.g. "Thursday 30 October";
  - a **View assignment** button, to the student's assignment page or the parent's
    child-assignment page. A signed-out person goes through sign-in and back (AC-3.4).

  **No instructions text, questions or attachment names** are included, for the same reason as
  AC-3.3.
- AC-8.3 **At most once.** Each person gets at most one "new assignment" email per student per
  assignment. Unpublishing and publishing again sends nothing new. If the assignment goes back to
  draft before the email is sent, the email is skipped, and that isn't a failure.
- AC-8.4 **No email for later joiners.** A student enrolled after the assignment was published
  gets no "new assignment" email for it. `[ASSUMPTION]` That's deferred; they still see the work
  in the portal (R3b FT2).

**Acceptance criteria — "due tomorrow"**
- AC-8.5 **Who and when.** Once a day, in the afternoon of the day before an assignment's due date
  (Melbourne time; `[ASSUMPTION]` 3:00 pm Australia/Melbourne, after school), one reminder is
  queued per enrolled student whose work isn't handed in. The assignment must be:
  - published;
  - **online or file hand-in**;
  - due tomorrow.

  "Not handed in" means status Not started or In progress. Recipients follow AC-8.1, using the
  "due tomorrow" switch.
- AC-8.6 **Not sent** (none of these is a failure) when:
  - the assignment has no due date;
  - it's paper homework (`[ASSUMPTION]` students don't hand paper work in through the portal, so
    "not handed in" can't be known; deferred);
  - the student has submitted, or the work is returned, by the time the email is sent (re-checked
    at send time);
  - the assignment was published on or after the day before it's due. The "new assignment" email
    covers it.
- AC-8.7 **Never late.** A reminder still unsent at midnight Melbourne time at the start of the
  due date is never sent. This could happen because of the daily cap or an outage.
  - It shows on the admin Emails page as **Failed**, with a new reason, e.g. "Too late to send".
  - `[ASSUMPTION]` Showing it there makes cap pressure visible.
- AC-8.8 **At most one reminder** per person per student per assignment, even if the due date is
  changed later.
- AC-8.9 **Content.** The reminder gives:
  - the child's first name;
  - the assignment title and class name;
  - "is due tomorrow (<weekday date>)";
  - a **View assignment** button (AC-8.2).

  No marks, answers or instructions are included.

**Acceptance criteria — shared**
- AC-8.10 **Switches.** Account → Notifications (`ACCOUNT_PAGE.notifications`,
  `portal.constants.ts`) gains two switches next to the existing `'Email me when work is marked
  and returned'`:
  - "Email me when new work is set";
  - "Email me the day before work is due".

  The rules are the same as AC-3.6:
  - shown to students and parents only;
  - on by default (`[ASSUMPTION — Security to confirm]`: service messages, as for item 3);
  - saving shows the existing confirmation;
  - the choice survives sign-out.

  Each switch controls only its own email. Every email links to this page.
- AC-8.11 **No-recipient cases** behave as AC-3.2:
  - a roster-only student;
  - an invited student;
  - no active parent;
  - every switch off.

  In each case the publish (or the daily run) succeeds, no email is sent, and nothing is recorded
  as a failure. Tutors, admins, other families and deactivated accounts get nothing.
- AC-8.12 **Never blocks the tutor.** Publishing succeeds, and the tutor sees no error, when
  sending fails or the cap is reached (AC-3.7).
- AC-8.13 **Admin Emails page.**
  - The page gains a **Type** column: "Work returned", "New assignment" or "Due tomorrow".
  - It lists the new kinds' Failed and Waiting rows under the existing rules (AC-3.8, ADR-0004),
    with no email body or address.
  - The empty state stays `'No failed or waiting emails'`.
  - At 360 px the table stays usable (scrolls or stacks), in light and dark.
- AC-8.14 **Shared cap.** All three kinds count towards the one app cap of **70 per rolling 24
  hours**. Overflow waits; it isn't lost. A "due tomorrow" row that would go out after its
  deadline follows AC-8.7. The Architect decides whether "work returned" or "due tomorrow" rows go
  first when the cap is tight. That's recorded in ADR-0004's consequences.
- AC-8.15 **Permissions.**
  - A person reads and changes only their own switches (pgTAP).
  - Nobody can queue an email for an assignment they can't publish.
  - Families can't see the outbox.
- AC-8.16 **Branding and test data.**
  - The same template style, sender domain and constants rule as AC-3.9.
  - Locally, emails go to Mailpit.
  - The release check uses only the seeded fake family with Saurabh's own addresses (AC-3.11).
- AC-8.17 **Phone and themes.** The Notifications section (three switches) works at 360 px in
  light and dark. Both new emails read correctly at a 360 px wide viewport in Mailpit's preview.

**v1 scope:**
- the two triggers, for students and parents;
- one switch each;
- the Type column on the admin Emails page;
- the "never late" rule.

**Deferred (Later bucket):**
- reminders for paper homework;
- emails for students enrolled after publishing;
- a configurable reminder time, or more than one reminder;
- a daily digest (the fallback if Waiting rows show up, 02 Decision 2);
- tutor-side alerts ("3 students haven't submitted");
- SMS;
- push (mobile, out of scope).

**Dependencies:**
- Item 3 (on `develop`): its outbox, worker, cap, settings table and admin page are reused
  unchanged.
- Item 7: held returns are staff returns and already email, so there's no extra work.
- Item 6 first, so this ships behind the gates.

**Release gate (owner):**
- A hosted migration deploy, adding the new kinds, the publish trigger and the daily cron job.
- A function deploy, if the template set lives in the worker.
- Saurabh watches the admin Emails page for "Daily limit" rows in the first fortnight. If they
  recur, 02 Decision 2's Resend Pro question comes back to him; it isn't asked now.

**For the Architect:** a short note against ADR-0004 is enough. It needs to cover:
- the new `kind` values;
- the publish trigger;
- the daily cron query and its Melbourne-time schedule;
- the "too late" expiry;
- the queue order under the cap (AC-8.14);
- a re-check of the volume estimate, because publishes add roughly one more email per family per
  assignment, and reminders less than that.

---

## Item 9 — `hreflang` / `geo.*` head tags: **dropped**

**Covers:** R1-14, the part that was never built. The rest of F6.3 is present.

**Decision: drop.** I'm dropping this rather than deferring it:
- **`geo.*` does nothing for search.** Google has said it ignores `geo.region` and
  `geo.placename`. AJ Classes's local signals come from the JSON-LD `areaServed`/address, the NAP
  in the footer, and the Google Business Profile (B18), all of which exist or are owner actions.
- **`hreflang` only helps a site with alternate language or region versions.** This site has one
  English (Australia) version. `<html lang>` and `og:locale` (`en_AU`) already say so.
- **The R1 sample would make things worse.** It points both `hreflang` tags at the home page. Put
  in the shared head, that would tell Google every inner page is an alternate of `/`.
- **It isn't needed for R1's checks.** Lighthouse SEO and the Rich Results Test don't check
  either tag.

Building it adds tags to maintain and a way to get it wrong, for no measurable benefit. It's
**not** folded into item 5's code. The only work is AC-5.9, which marks the two lines dropped in
the R1 PRP so the launch-checklist line "every F6.3 tag present" is honest. If AJ Classes ever
adds a second language or region site, `hreflang` comes back as part of that work.

Not part of this item: the Search Console verification meta. It may be done by DNS TXT (B18,
Q20).

---

## Recommended build order and slicing

One branch per item, each cut from a freshly pulled `develop`, merged to `develop` through
`/test-and-ship`, and released by Saurabh.

| Order | Item | Branch | Slice notes |
|---|---|---|---|
| 1 | 4: Staff phone + Privacy | `feature/staff-phone-privacy` (this branch) | Small. One migration (likely), one field, one sentence. Its wording joins B17 |
| 2 | 5: Public CSP (+ item 9 docs line) | `feature/public-csp` | Headers and docs only, no migration. Easiest to verify before item 6's Lighthouse runs against it |
| 3 | 6: CI quality gates | `feature/ci-quality-gates` | Workflow, scripts and specs. Depends on the Architect's E2E wiring call; if that needs Q21, start with Lighthouse and structured data and add E2E when the answer comes |
| 4 | 7: Fair results | `feature/fair-results` | One migration. Can go out as two PRs on the same branch (7a hold switch, 7b rule (b)) if review gets heavy. Sequence its migration against held item 2's |
| 5 | 8: More alerts | `feature/more-email-alerts` | One migration and worker kinds. Last, so it reuses item 3 after it has shipped, and sits behind item 6's gates |
| — | 9: `hreflang`/`geo.*` | — | Dropped. Its docs line rides with item 5 (AC-5.9) |

**AC counts:** item 4: 10 · item 5: 10 · item 6: 13 · item 7: 17 · item 8: 17 · item 9: 0
(dropped).

---

## New questions for Saurabh (continue from Q20)

Both are **conditional**. Neither blocks anything unless the Architect's choice triggers it.

21. **[Item 6, only if the Architect picks option (b) or (c)]** "The E2E tests live in a local-only
    repo (`aj_classes-e2e`), with no GitHub copy. For CI to run them, can you create a private
    GitHub repo for it, push it, and add a read-only deploy key as an Actions secret on
    `splaytech/aj_classes`?" The default, option (a), moves the smoke specs into the main repo and
    doesn't need this.
22. **[Item 6, only if the Architect's estimate exceeds the free allowance]** "The new CI checks
    add about N minutes per push or pull request. That's about M minutes a month against GitHub's
    free allowance for private repos. OK to go over (paid minutes), or should the E2E and
    Lighthouse jobs run only on pull requests and on `develop`?"

Existing questions that items 4–9 lean on (not re-asked):
- **Q7 (B17):** the Privacy wording, now including item 4's sentence.
- **Q14 (B9):** public tutor profiles. Item 4 keeps phones off the website either way.
- **Q9 (B14):** Sentry, the prerequisite for item 5's deferred CSP reporting.
- **Q20 (B18):** Search Console verification.

---

## Assumptions (items 4–9)

1. `[ASSUMPTION]` Staff can't clear a saved phone number. Accounts without one yet can still save
   their other profile fields (AC-4.4).
2. `[ASSUMPTION]` Admins can correct a staff phone, audited by field name only (AC-4.6). This
   comes for free from the shared profile form, and matches R2a US18.
3. `[ASSUMPTION]` The Privacy heading becomes "Portal accounts" (AC-4.9).
4. `[ASSUMPTION]` Vercel enforces every matching CSP header. The Architect confirms the portal
   isn't double-restricted (AC-5.5).
5. `[ASSUMPTION]` The E2E smoke is 4 journeys, plus invite onboarding if time allows. The
   recommended wiring moves the specs into this repo (item 6).
6. `[ASSUMPTION]` A JS size budget gates only if the baseline already meets it (AC-6.8).
7. `[ASSUMPTION]` Hold results is off by default, shown on any assignment with questions, and
   locked on publish (AC-7.1).
8. `[ASSUMPTION]` Rule (b) covers archived classes as well as removal (item 7).
9. `[ASSUMPTION]` There's no bulk return in v1 (item 7 deferred).
10. `[ASSUMPTION]` "Due tomorrow" goes out at 3:00 pm Melbourne the day before, for online and
    file hand-in work only. It's never sent on or after the due date (AC-8.5–8.7).
11. `[ASSUMPTION — Security to confirm]` The new alerts are service messages, on by default with
    an off switch each (AC-8.10), as for item 3.
12. `[ASSUMPTION]` There's no "new assignment" email for students enrolled after publishing
    (AC-8.4).

## Change log

| Date | Change | Why |
|---|---|---|
| 26 Oct 2026 | First version: items 4–9 elaborated; item 9 dropped | /deliver stage 1 for the rest of the build queue (04-plan §1.1) |
