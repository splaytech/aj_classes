APPROVED

# Review 1: Product Owner stage (01-requirement.md)

> **Reviewer gate, stage 1 of /deliver** · 25 Oct 2026 · branch `feature/pending-requirements`
> **Artifact:** `docs/delivery/2026-10-25-pending-requirements/01-requirement.md` (revised, 593 lines)

## Round 2

The revision fixes all 4 blocking and all 6 minor findings from round 1. I re-checked each one
against the doc and the code. The revision didn't break anything that blocks the next stage.
The new minor points below are mostly hand-offs for the Architect to pick up in stage 2, not
reasons to send this stage back.

### Round 1 findings, re-checked

| # | Round 1 finding | Status | Evidence in the revised doc / code |
|---|---|---|---|
| 1 | News link contradicted R1.1 F4 and R1 F2.1 | **Fixed** | Lines 251-266 follow the R1.1 hide-when-empty rule and F2.1 (no "coming soon"). The "News" label is tagged `[ASSUMPTION]` with a reason (line 256). AC-1.6, AC-1.9 and AC-1.10 hide the links when there are zero posts or on error, and replace the "Check back soon" text |
| 2 | "Needs Saurabh?" column hid owner gates | **Fixed** | Item 2's release gate is B3 plus the B17 wording review (line 180). Item 3's gate is the Resend function secret (line 181). Item 4 gets B17. Browser image compression is in AC-2.4, and AC-2.5 sizes it against the 1 GB Free storage |
| 3 | Item 2 didn't fit the paper-homework rules | **Fixed** | Paper homework stays staff-only (lines 354-356, assumption 12). Students upload only to online work and the new file hand-in type. AC-2.7 is a single visibility rule by status ("whoever set it"). AC-2.8 covers staff setting the status first |
| 4 | R2-04 wrongly marked Done | **Fixed** | Now Blocked (owner) under B5 (line 77) |
| 5 | AC-1.1 couldn't be checked by the team | **Fixed** | AC-1.1 is now a local production-build gate. The hosted curl moves to B1 (lines 200-204) |
| 6 | Item 3 AC not measurable; empty cases missing | **Fixed** | AC-3.2 lists the no-recipient cases and says none counts as a failure. AC-3.8 is measurable: fields listed, admin only, with an empty state |
| 7 | Assumptions not marked | **Fixed** | Spam Act (AC-3.6, assumption 13), the label (11), the paper rule (12) and Railway (14) are all tagged |
| 8 | Completeness gaps | **Fixed** | R2-18 now includes the R2a manual list. New rows R2-19 and R2-20 (I verified the R2-20 evidence against `go-live.md:107-108`) and R1-22. R1-20 and R1-14 now carry the launch-checklist items |
| 9 | Live `/posts` state overstated | **Fixed** | Lines 67 and 179 and assumption 4 now say the 404 would happen "once `develop` is released as it is" |
| 10 | Privacy gap counted twice | **Fixed** | R1-07 is Done and points to INV-05 and OD-03 (line 44) |

**Counts:** I re-tallied the inventory tables and got Done 31, Partial 5, Pending 11, Blocked 24
and Out of scope 2, total 73. This matches lines 158-165.

**Other claims I verified:**
- `max_mark between 1 and 1000` (`20261007061232_classes_timetable_assignments.sql:77`).
- The avatar re-encode precedent (`r2a/stories.md` US13 AC1, `lib/photo.ts`).
- `budget.md` names Vercel as the only web host (assumption 14).
- The unpublish rule: unpublishing is blocked once any result is past `not_submitted`
  (`student_parent_portal.sql:366-369`), so AC-2.3's side effect is accurate.

### New findings

1. **[minor] File hand-in needs a database change; the doc implies it doesn't.**
   - Today "online" means "has questions": `private.is_online_assignment`
     (`supabase/migrations/20261007090320_student_parent_portal.sql:492-503`, design D6).
   - So a question-less file hand-in would be treated as **paper**. Students can't submit it:
     `submit` raises when the assignment isn't online (`20261007090321_family_functions.sql:476`).
     `in_progress` is refused for non-online work (`student_parent_portal.sql`, in
     `check_assignment_result`). Staff could set Submitted or Marked on it.
   - So AC-2.8's "The database **already** refuses a staff change to Submitted or Marked" holds
     for file hand-in only after the type is classed as online.
   - The danger: an Architect who reads that literally may plan no change to D6. The opposite
     danger is a naive "no questions = online" fix, which would turn every existing paper
     homework into online work.
   - Fix (one line in item 2): the type is **explicit**. Existing question-less assignments stay
     paper. `is_online_assignment`/D6 and the student submit function must recognise file
     hand-in. AC-2.9's single overall mark uses `max_mark` through `assignment_total_marks`.
     This can be carried into stage 2 rather than re-gating stage 1.

2. **[minor] The hide-when-empty News check adds a Supabase request to every public page.**
   AC-1.12 rightly forbids `supabase-js` and MUI. That leaves a plain `fetch` to the
   PostgREST endpoint, which must live in `src/services/` per the repo rule
   (`react/http-calls-via-service-layer-only`). Two knock-ons to name for the Architect and
   Security:
   - **Item 5:** a public-page CSP must allow `connect-src` to the Supabase host, or the check
     fails silently and the links never show. Add a line to item 5 or to AC-1.12.
   - **Privacy:** every visitor's browser now contacts Supabase from every public page, not only
     `/posts` and the portal. The PRIVACY portal paragraph (`content.constants.ts:397`) ties
     Supabase to portal data. Fold one sentence into the B17 wording review that is already
     batched with items 2 and 4.

3. **[minor] AC-1.8 assumes the link's appearance can avoid layout shift.** A nav item that
   appears after load in a pre-rendered header may push the CTA. The AC is measurable
   (CLS < 0.1), which is enough for stage 1. Flagging it so the Architect chooses the approach
   (reserved slot, or placing the link where it can't shift anything) instead of finding out in
   test.

### Ranking

The ranking is unchanged and defensible. The release gates are now explicit on items 1-4. No
build-queue item needs Saurabh before or during the build; owner-only work is confined to
B1-B18. Mobile scope is correct.

**Next:** proceed to the Architect stage, carrying findings 1-3 above into its brief.
