CHANGES_REQUESTED

# Review 3: 03-design.md (round 1)

The §2 migration was run as written on the local DB in a rolled-back transaction, and it behaves as designed: grants, `security definer` with `search_path=""`, the single-use claim and release, `rate_limited` on the 11th claim, and the guarded `invited_at` copy. The trigger copy is byte-identical apart from the guarded line. The lock order can't deadlock. The `_shared/email` move is behaviour-neutral. The per-action ordering is right (a re-send deletes and writes nothing). Dropping `account_role` from `user_metadata` is safe. The error mapping is right. The web house rules are met (the ErrorBoundary is inherited from `portal-root.tsx`).

## Blocking

1. **§4.3 step 6 can delete a real account (the same flaw is in 02 §4 and ADR-0010 decision 4).** With `type: 'recovery'` GoTrue never creates a user, so a mismatched `user.id` is always an existing account. Sequence: a redeem claims; the admin cancels, then re-invites the same e-mail at once; `generateLink` returns the fresh account (`recovery`, created < 60 s ago); the stray-user rule deletes the admin's legitimate invite. Fix: on `recovery`, never delete; on a mismatch, refuse with `mismatch`, release and log. Delete only when the user differs **and** `verificationType !== 'recovery'` **and** it was created < 60 s ago. Update the §8.2 unit list to match.

## Non-blocking

2. AC 36/37/39: accept the manual email-off run, but first spike S4: set the local `profiles.email` to a value Mailpit rejects, call `resend-invite`, expect `email_failed`, check the previous link still redeems and `invited_at`/`invite_resent` are unchanged, then restore. If Mailpit accepts anything, keep the manual run and record the AC 37 wording in the TSR.
3. §8.1 restart step: correct. Add (a) `docker inspect supabase_edge_runtime_aj_classes --format '{{range .Mounts}}{{.Source}}{{end}}'` shows `aj_classes-invites`; (b) warn the `aj_classes-hiring` owner first.
4. pgTAP traps: #4 compare `proconfig` with `array['search_path=""']`; #9–#14 use a distinct `client_ip_hash` per group so the 11th call doesn't trip the rate limit; #3 follow `enquiries.test.sql` for table selects.
5. AC 17 fixture: set a password with `auth.admin.updateUserById` (local only) before checking password sign-in.
6. §2 note 2: a refused call never wrote an attempt row (the insert is after the check); fix the comment.
7. §4.3 logging: add `mismatch` and `stray_user_removed` to `console.warn` (no ids).

## Round 2

APPROVED

All 7 findings are fixed, and 02, 03 and ADR-0010 now agree. A `recovery` reply for another user refuses with `mismatch`, releases and never deletes; a delete needs a non-recovery type, a different user, and an account under 60 s old. The §8.2 identity table covers each case. S4 is sound (`profiles.email` has no check constraint, and the redeem reads the Auth e-mail). The restart warning and mount check, the pgTAP traps, the AC 17 password fixture, the migration note and the warn-level logging are all in.

Nit (fixed in place by the team lead): §10 risk 6 now says the manual fallback is accepted subject to the Product Owner signing off the AC 37 wording in the TSR.
