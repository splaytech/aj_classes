CHANGES_REQUESTED

# Security review — item 4

> **Stage:** 6b (Security) · **Date:** 26 Oct 2026 · **Branch:** `feature/staff-phone-privacy`
> **Scope:** `git diff develop...HEAD -- . ':!docs/delivery'`, item 4 code only.
> **Method:** code reading, plus probes against the **local** stack only. Every probe ran in `begin … rollback`. The hosted project, `.env*` and `supabase/.env.deploy` were not touched.

**Verdict:** one blocking finding (S1). The rest are non-blocking.

## Checked and held up

| Area | Evidence |
|---|---|
| A tutor changes another staff member's phone | 0 rows changed (probe); pgTAP also covers it |
| A tutor reads other staff phones | sees only their own row |
| A family member sets a phone | The policy needs `is_active_staff()`, so 0 rows. An admin setting a family member's phone gets `invalid_input` |
| A deactivated or invited account | `my_active_role()` needs an active status, so the update fails. `complete_onboarding()` is unaffected |
| An admin without two-step (aal1) changes someone else's phone | 0 rows (`is_admin()` needs aal2) |
| Column grant | `authenticated` UPDATE covers exactly `avatar_path, bio, full_name, phone, qualifications, subjects`. `role`/`status` give 42501 |
| `role` used to get past the trigger | `role` isn't granted; `admin_set_role` refuses non-staff roles |
| `security definer` trigger | `search_path=""` and every name is qualified. No dynamic SQL; an injection-shaped value gives `invalid_phone`. Execute is revoked |
| `normalise_au_phone` called directly | permission denied for `authenticated` |
| Error-detail leak | none: RLS hides the row, and the error keys are fixed |
| Audit | `{"fields":["phone"]}`, with no digits |
| Read exposure | anon gets 42501. No realtime and no view. `admin_list_staff()` is admin-only. The family functions never select `phone` |
| Web | the phone goes in the PATCH body, not the URL. No console or analytics calls. The `tel:` value is constrained by the database |
| pgTAP | `staff_phone.test.sql`: 47/47 |
| Dependencies and secrets | no new dependencies, and nothing found in the diff |

## Findings

1. **S1: an admin at aal1 can change their own phone (blocking).**
   - **Where:** `check_profile_phone()`, plus the own-row update policy, which has no aal check.
   - **Exploit:** an attacker who has only an admin's password gets an aal1 session. They PATCH their own phone with no audit row, then ask for a factor reset. The break-glass runbook (`r2a/design.md:643`) confirms identity "by phone", so the call goes to the attacker's number.
   - **Fix:**
     - (a) In `check_profile_phone()`, after the "unchanged" early return: `if new.role = 'admin' and (select auth.jwt() ->> 'aal') is distinct from 'aal2' then raise exception 'insufficient_aal'`. Check that onboarding stays green, or skip the check when `old.status = 'invited'`.
     - (b) pgTAP: a1 at aal1 changing their own phone throws `insufficient_aal`; at aal2 it succeeds.
     - (c) Break-glass runbook: confirm identity using a number held outside the portal, never the profile phone.
2. **S2: staff changes to their own phone leave no trace (non-blocking, product decision, Later).** A field-names-only `profile_edited` row, or a "phone changed <date>" line on the staff page.
3. **S3: the Privacy wording is slightly broad (non-blocking, owner wording B17/Q7).**
   - Some staff add their number later rather than at setup.
   - Staff can see their own number, not only admins.
   - **Suggested:** "…a phone number, given at account setup or added later on My profile, and kept up to date by them or an admin. We use it to contact them about classes; only they and AJ Classes admins can see it, and it is never published."
4. **S4: there's no in-app way to remove a leaver's phone (non-blocking, retention, Later).** Decide a retention rule, for example clearing it on deactivation. Until then, document the manual removal in the runbook.

## Residual risks

1. The pre-existing aal1 admin own-row edit of non-identity fields has low impact.
2. Statement logging, if ever turned up, could capture values (they are bound parameters by default).
3. Hosted checks at release: the migration is applied, and the production-build grep runs there.
