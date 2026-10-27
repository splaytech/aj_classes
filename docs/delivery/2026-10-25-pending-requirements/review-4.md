APPROVED

# Review 4: Manager stage (04-plan.md)

> **Reviewer gate, stage 4 of /deliver** · 25 Oct 2026 · branch `feature/pending-requirements`
> **Round 2 (final):** I re-checked findings 1-7 in §2, §5 (T2.0-T2.5), §6 and the touched lines
> in T1.3, T3.1, T3.2, T3.4 and T3.8. I also searched the whole doc for stale task references
> after the renumbering. I didn't reopen anything that was already settled.

## Round 2

All seven round 1 findings are fixed, and the renumbering left no stale references. Two nits
remain; neither blocks. The stage is approved.

| # | Finding | Status | Evidence |
|---|---|---|---|
| 1 | T2.1 recreated `assignment_view` before its table existed | **Fixed** | 04:346-352: T2.1 is now steps 1-3 only, and the family functions are untouched. 04:353-363: T2.2 is steps 4-11 in order, and the `family_portal.test.sql` regression check moved there. 04:364-372: the web slice (now T2.3) runs after it, says it needs T2.2, and checks that the existing student and parent pages still load. Steps 1-3 don't reference the step 4 table, so T2.1 can pass on its own |
| 2 | Release merged `develop` HEAD instead of the deployed commit | **Fixed** | 04:148-161, rule 5: deploy and merge to `main` the same SHA via `release/<item>`; never merge `develop` HEAD. The release steps in §6.1 (443-448), §6.2 (464-470) and §6.3 (487-495) all cut `release/<item>` at the named SHA. Risk 6.3 #7 and DoD 6 were updated to match. The SHA command (`git log --merges -1 … develop`) is correct, because `/test-and-ship` merges with `--no-ff` (`.claude/commands/test-and-ship.md:46`), so there is always a merge commit |
| 3 | Timestamp check had no action; the swap wasn't covered | **Fixed** | 04:135-143, rule 3 and T2.0 (342-345): explains the UTC stamp, gives the `ls … \| tail -2` check, then `git mv` to one minute after the newest file and `pnpm db:reset`, and repeats the check at release. Swap: 04:116-120, and T3.1 (259-262) creates item 3's file with `migration new` and absorbs T2.11. T2.11 (408) says it's skipped under the swap |
| 4 | `database.types.ts` not regenerated after the table and RPCs | **Fixed** | T2.2 lists #17 and runs `pnpm db:types` (355, 363) |
| 5 | `getAssignment` cited as file #13 | **Fixed** | T2.5 now says `#12 assignments.service.ts` (381-382) |
| 6 | `[TBC: B17]` marker; B17 missing from item 3's release gate | **Fixed** | T3.8 (318-320) and T2.12 (410-411): the marker is docs-only, never a literal or a TODO in the constant. §6.3 preconditions (487-488) name Q7 (B17) |
| 7 | Three AC test legs had no task | **Fixed** | AC-1.7: new co-located `lib/use-public-posts.test.ts` with `renderHook` (193-197). AC-3.2's `admin_email_problems` assertion is now in T3.2 (271-272). AC-3.4's browser leg is in T3.4 Visible (295-297) |

**Renumbering check.** Every T2.x reference outside the task list points at the right task after
the swap:
- 6.2 risks #2 and #3 now say T2.2;
- the intro says T2.0, and T2.3 cites T2.2;
- T2.11, T2.13, T2.14 and T2.15 are referenced correctly in §2, §6.2 and §8.

The T1.x and T3.x references are unchanged and still correct. The task counts (12 / 11 / 16) still
match.

### Nits (don't block)

R2-1. The quote in Q1 (04:46-47) still asks "merge `develop` into `main`?". The parenthetical at
51-53 corrects it. Saurabh reads the quote first, so make it say "merge item 1's release commit
(`release/news`) into `main`" before this goes into the close-out message.

R2-2. Under the swap, T3.1's `migration new` (260) has the same UTC-ordering risk as rule 3, now
against item 2's file. Add "then the rule 3 `ls … | tail -2` check" to that line. It applies only
under the swap.

### Next

The stage is approved. The Developer can start item 1 (T1.1). The Manager can fold in the two
nits whenever this file is next touched. Nothing here needs Saurabh.


## Round 1

> **Reviewer gate, stage 4 of /deliver** · 25 Oct 2026 · branch `feature/pending-requirements`
> Checked against 01, 02, 03 and reviews 1-3, plus the repo (`supabase/migrations`,
> `supabase/tests/database`, `supabase/scripts/deploy.sh`, `package.json`, `.github/workflows/ci.yml`, git history).

The plan is thorough. File coverage is complete, the ship order is sound, and the question list
is accurate. Two findings block it. T2.1 can't pass its own regression gate (1). The release steps
merge `develop` into `main` instead of the commit that was deployed, which can break production (2).
Both are small edits to 04.

### Blocking

1. **[blocking] T2.1 recreates `assignment_view` before the table it reads exists, so
   `family_portal.test.sql` goes red.** 04:313-319.
   - T2.1 takes migration steps 1-3 and **11** and leaves step 4 (the `assignment_files` table)
     for T2.3. Step 11's new `assignment_view` body reads `public.assignment_files` in its
     `attachments`, `files` and `unfinishedUploads` keys (03:786-805).
   - `assignment_view` is `language plpgsql` (`20261007090321_family_functions.sql:206-209`).
     Postgres doesn't check table names in a plpgsql body when the function is created, so the
     migration applies cleanly. The error comes later, on every call: `relation
     "public.assignment_files" does not exist`.
   - `family_portal.test.sql` calls `student_assignment` / `parent_child_assignment` 15 times.
     Both wrappers go through `assignment_view` (`family_functions.sql:381, 608`). T2.1's own
     "Regression: family_portal.test.sql stays green" therefore fails. Every student and parent
     assignment page also errors through T2.2, so T2.2's browser checks can't run either.
   - The plan's note "step 10 `student_submit` needs the step 4 table" uses the right reasoning,
     but applies it to step 10 and not to step 11.
   - **Fix (smallest):** T2.1 = steps 1-3 (+ their step 12 grants). Move step 11 into T2.3, after
     steps 4-10, and move the family-functions regression line there too. Then build T2.3 before
     T2.2 (renumber them), because T2.2's `family-data.ts` `is_file_handin` mapping and the
     student-home "Upload your work" check need step 11. (The other option is to put steps 4-6
     in T2.1 as well. That works, but it makes T2.1 a much bigger slice.)

2. **[blocking] Every release says "merge `develop` → `main`", not "merge the commit you just
   deployed".** 04:139-141, 405-407, 426-427, 447-449.
   - Rule 5 correctly says `deploy.sh` should run from item 1's merge commit if item 3 has merged
     first. But item 1's release step 3 then merges `develop` (HEAD) into `main`.
   - **What breaks:** item 3 merges to `develop` before Saurabh does B1 (likely, since B1 waits on
     him), and he follows rule 5's option (b). Then:
     - item 3's web code goes to production through Vercel's `main` build;
     - the hosted DB has no `notification_settings` / `admin_email_problems`;
     - the Account page for every student and parent fails to load. That's risk 6.3 #7, which the
       plan names but only guards for item 3's own release.
   - The same gap is in item 3's step 3 (once items 4+ are on `develop`), and in item 2's step 3
     ("From `develop`", with no commit named).
   - **Fix:**
     - Extend rule 5: "Deploy and merge to `main` the **same commit**." For example, open the
       `main` PR from a `release/*` branch cut at that SHA, or run `git merge <sha>`.
     - Write the SHA into each item's release steps (§6.1 step 3, §6.2 steps 3-4, §6.3 steps 2-3).
     - Name the SHA in the item's close-out message.

### Minor

3. **[minor] The migration-timestamp check says what to check but not what to do if it fails,
   and the 1 → 2 → 3 swap isn't covered.** 04:113-115, 130-134, 311-312.
   - `supabase migration new` stamps the file with the current UTC time. `20261025110000` is
     25 Oct, 22:00 AEDT. If items 1 and 3 ship today and T2.0 runs before then, the new file sorts
     *before* item 3's file. T2.0 then only "checks".
   - Fix: add "if not, rename it to a timestamp after the newest migration on `develop`".
   - Under the swap (B3 approved early), item 2's generated file would be newer than item 3's
     fixed `20261025110000`. Item 3's `db push` would then be refused. Also, T2.11 would have no
     `email_outbox.test.sql` to add to.
   - Fix: say that under the swap, item 3's file gets a newer timestamp too, and T2.11 moves into
     item 3 (T3.1).

4. **[minor] T2.3 doesn't regenerate `database.types.ts`.** 04:328-334.
   - T2.3 adds the table and the 5 RPCs, but `pnpm db:types` runs only in T2.1.
   - T2.5's `assignment-files.service.ts` calls those RPCs, so `pnpm typecheck` fails on stale
     types.
   - Fix: add `pnpm db:types` to T2.3's Run line (file #17).

5. **[minor] T2.5 says "#13 `getAssignment` files".** 04:343. `getAssignment` is in
   `assignments.service.ts`, which is #12. #13 is `submissions.service.ts`, used in T2.7.

6. **[minor] Item 3's Privacy sentence and its B17 gate.** 04:289, 444.
   - Make clear that `[TBC: B17]` is a doc marker. The constant must hold only the 03 §3.8
     sentence, with no literal "[TBC…]" and no unticketed TODO (KINET `no-todo-without-ticket`).
   - §1.1 lists B17 as a gate for item 3, but §6.3's release-steps header says only "Q2; B1 done
     first or together". Add "Q7 (B17) wording approved" there, as §6.2 does for item 2.

7. **[minor] Three AC test legs have no task.**
   - **AC-3.4 browser leg:** open the Mailpit link signed out → sign in → land on the page
     (03:1912). Add it to T3.4's Visible line.
   - **AC-3.2 "`admin_email_problems` stays empty"** (03:1910): T3.1 can't assert this, because
     the function arrives in T3.2 (step 8). Add that assertion in T3.2.
   - **AC-1.7 "`use-public-posts` maps `fail('network')` to error"** (03:1293): no task names a
     test. `posts.test.tsx` mocks the hook, so it can't cover this. Add a small hook test in T1.3,
     or a `posts.test.tsx` case that mocks `listPublicPosts` instead.

### Checked and correct

- **Coverage.**
  - Item 1: all 21 rows are in T1.1-T1.9, plus the conditional `Header.module.css` in T1.5.
  - Item 2: all 48 rows are in T2.1-T2.12.
  - Item 3: all 31 rows are in T3.1-T3.8.
  - Every other AC (1.1-1.15, 2.1-2.16, 3.1-3.11, carry-over 3, claim-time skip, cap/reclaim)
    has its test named in a task or in T1.10/T2.13.
  - Nothing contradicts 03. Review-3's update-then-insert (T3.5), `alter_job` pause, and R3-1
    handler ordering (T3.4) are carried.
- **Slices.**
  - Item 1 and item 3 tasks each leave typecheck/build green. T3.2's cron kick hitting a
    not-yet-built function (until T3.4) is harmless locally.
  - Item 2 is fine apart from finding 1.
- **Branches.**
  - `feature/pending-requirements` is based on `develop` @ `425fec1`.
  - Holding item 2 off `develop` is the right fix for `db push` applying every migration
    (`deploy.sh:84`).
  - CI (`ci.yml`) runs only against a local `supabase db start`, so pushing a branch never
    touches hosted. Q4 names the Vercel preview correctly.
- **Questions.** B1-B18 match 01 §2.2 in number and wording. Q2 and Q4 are new and correct.
  "19 commits" matches `origin/main..develop`. None of the 20 blocks the build: Q1's wording is a
  one-line edit if it changes.
- **Definition of done.** Every line can be checked: ticks, named test files, the full-check
  command, review/security/TSR files, and docs per item. The "done (held)" / "done (released)"
  split for item 2 is clear.
- **Deviations from 03.**
  - Release order 1 → 3 → 2 follows 03 §0.1's own expectation.
  - T2.11 is sound in that order (see 3 for the swap).
  - The item 1 privacy assertion adds a test without changing behaviour.
  - Putting step 10 in T2.3 is right. Putting step 11 in T2.1 is not (finding 1).
  - Re-running the full gate from step 0 at T2.15 is the right call for a stale branch.

### Next

The Manager fixes 1 and 2 and folds in 3-7. All of these are edits to 04 only. A short round 2
on §2, §5 (T2.0-T2.5) and §6 is enough. Nothing here needs Saurabh.
