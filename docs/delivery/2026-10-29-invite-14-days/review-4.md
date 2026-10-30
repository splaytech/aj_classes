APPROVED

# Review 4: 04-plan.md (round 1)

Read against 01 (AC 1–41), 02, ADR-0010 and 03 (approved), with claims checked read-only against the repo and the local stack. The slices are thin, ordered and each has a check. Splitting S4 into T1.4 (can Mailpit refuse a send) and T5.5 (automated, once a new-format link exists) is sound. The invite e2e being red from T4 to T8 is a contained gap (`test:functions` stays green, because `test-account-admin.mjs` changes in T4.3). The mount check's substring match is right (Docker prints `/host_mnt/...`). There is one owner for state-changing commands, with the handover in `05-dev-notes.md`. The definition of done is complete, AC 1–41 are all traced, and the release order is right (the Resend check and quiet hour come first; the `curl` shape refusal proves `verify_jwt = false`, the origin rule and the deployed code).

## Non-blocking (fixed in place by the Manager)

1. Lines 6 and 13: mark 03 approved and drop the round-2 caveat.
2. AC 37 manual fallback: the Product Owner signs off the wording in the TSR (T1.4, risk 4).
3. AC 14's first proof is `test-invite-redeem.mjs` (T5.5), not T4.
4. Add Verify lines to T5.1 and T5.2.
5. Release step 2.1: `supabase link` before `db push --dry-run`, which needs the DB password.
6. T0.3: accept any cwd under `aj_classes-invites`.
