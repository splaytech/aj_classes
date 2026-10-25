CHANGES_REQUESTED

# Review 1 — items 4–9 requirement (01b)

Reviewed `01b-requirement-items-4-9.md` at `a8bbdbc`. Checked against:
- 01 §1–§3, 04-plan §1.1–§1.2, and 02-architecture's cross-item notes;
- R1 PRP F6.3 and the r3b review (F8, F28);
- `vercel.json`, `serve.railway.json`, `ci.yml`, `.env.production` and `profile.tsx`;
- the staff, onboarding, family and item 3 migrations;
- ADR 0004.

**What already passes:**
- **Coverage:** every claimed ID is covered (INV-04/05, R1-07, R2-11, R2-09, R1-20, R3-06 F8/F28, and the rest of R5-02/04). R5-03 is named as blocked, and R1-14 is dropped with a reason.
- **AC counts:** they match (10/10/13/17/17).
- **Questions:** Q1–Q20 are not re-asked, and the cross-references are correct.
- **Deferred scope:** it is named for each item.
- **Code claims:** they hold.
  - `phone` is not in the update grant (`20261006004522`:427).
  - Profiles are visible only to their owner and admins.
  - Results don't cascade from `enrolments`.
  - `email_outbox_once` gives AC-8.3/8.8 their "at most once".
- **Item 9:** the drop is sound.

## Blocking

1. **CSP ACs need the hosted DB or can't pass** (AC-5.1, AC-5.3, AC-5.4, AC-6.6, common section).
   - **Problem:** the public CSP hard-codes `https://unzjnxctkyahtmrkinyr.supabase.co` in `vercel.json`. The local production gate builds with `VITE_SUPABASE_URL=http://127.0.0.1:55321` (TSR-item-1 line 2, N-02, N-18).
   - **What breaks:** under that header, CSP blocks the News check (and `leads`, if not mocked). AC-5.3's "zero violations" then fails, and Lighthouse Best Practices drops.
   - **Why it can't simply be rebuilt:** passing as written means building with the committed `.env.production`, which points at prod.
     - The News and `/posts` checks would read the shared prod DB.
     - "Web3Forms and `leads` *may* be mocked" would allow a real hosted enquiry, which also writes to Zoho.
     - Item 6's Lighthouse job would query prod on every PR.
     - Both break 01b's own common rule and the never-touch-production posture.
   - **Fix:**
     - (a) Add a common AC to items 5 and 6: no local, gate or CI run sends any request to `unzjnxctkyahtmrkinyr`. Prove it with item 1's N-02/N-18-style checks: no hosted ref in the built JS, and 0 `supabase.co` requests.
     - (b) In AC-5.3, change "may be mocked" to "must be mocked, or pointed at local".
     - (c) Add this constraint to item 5's and item 6's "For the Architect" lines: the local mirror and CI enforce the same policy, with the local Supabase origin in place of the hosted one. Two possible ways:
       - substitute the origin in the mirror, and check that the committed `vercel.json`/`serve.railway.json` carry the hosted host;
       - build Lighthouse with no Supabase config (item 1's N-25).
     - (d) AC-6.3: the workflow file has no CSP, so change "finds nothing outside the CSP" to "finds nothing".

## Non-blocking

2. **Q22's premise is false.** `splaytech/aj_classes` is PUBLIC, and GitHub-hosted runners are free for public repos. Drop Q22 and replace it with a note under item 6. Q21 stays.
3. **AC-4.6 and assumption 2: the audit is not free.** `private.audit_admin_profile_edit()` lists fields explicitly, without `phone` (`20261006004522`:237–267). Say that the trigger must add `phone`. Add a pgTAP test that `details.fields` contains `'phone'` and no digits.
4. **AC-4.9 conflicts with the B17 convention.** The approval marker lives in the docs, never in code (04-plan T3.8/T2.12; KINET `no-todo-without-ticket`).
   - Track the approval as Q7/B17 in the docs, with no comment in `PRIVACY`.
   - The sentence should say "kept up to date by them or an admin", since AC-4.6 lets admins change the phone.
5. **AC-4.7 needs a carve-out for onboarding.** `complete_onboarding()` legitimately writes the phone for invited accounts. Add "through the profile path; onboarding is unchanged".
6. **AC-5.4: Vercel Analytics can't be verified on the local mirror.** Item 1's TSR stubbed `/_vercel/insights/script.js`. Move this check to item 5's live release check (`curl -sI …/_vercel/insights/script.js`), and allow the stub locally.
7. **AC-5.9: F6.3.1 needs the drop note too.** Also annotate F6.3.1 in `release-1/PRP.md` ("All the tags above are present … on production").
8. **AC-7.1 ignores Back to draft.** Say whether the switch becomes editable again after a permitted unpublish (presumably yes).
9. **Items 7 and 8 depend on item 2.** File hand-in exists only in held item 2.
   - Make AC-7.2, AC-8.1 and AC-8.5 conditional, like AC-7.15 ("once item 2 is on `develop`").
   - Add item 2 to item 8's Dependencies.
10. **AC-8.3 leaves republishing open.** Because of the unique constraint, a republished assignment never notifies anyone. If that is intended, say so; if not, allow a re-queue when the earlier row is `skipped`.
11. **AC-8.14 edits an accepted ADR.** Let the Architect choose between an addendum section and a new ADR.
12. **AC-8.1 wording.** Say "one email per recipient per enrolled student".

**Result:** criteria 1, 3, 5, 6 and 7 pass, apart from finding 2. Criteria 2 and 4 fail only on finding 1, so the doc is approvable once that is fixed.
