APPROVED

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

## Re-check (round 2)

**Scope.** Commits `dfcd372..154a664`. The local DB trigger contains `insufficient_aal`. `staff_phone.test.sql` passes **53/53**.

| # | Status | Evidence |
|---|---|---|
| S1 | **Fixed** | See the verification below |
| S2 | Open, non-blocking | Unchanged by design (AC-4.6). Less urgent now that the runbook no longer trusts the profile phone |
| S3 | **Fixed** (pending B17/Q7) | The suggested sentence appears word for word in `content.constants.ts`, and `privacy.test.tsx` checks it |
| S4 | Open, non-blocking | Unchanged |

### S1 verification

**The rule.** After normalising, and after the second "unchanged" return, the change is refused with `insufficient_aal` when all of these hold:
- `new.role='admin'`
- `auth.uid() is not null`
- `old.status <> 'invited'`
- `aal` is distinct from `aal2`

This covers any change to an admin row, which is stricter than asked.

**Probes** (all rolled back):
- a1 at aal1 changing their own phone: `insufficient_aal`.
- A JWT with no `aal` claim: `insufficient_aal`.
- a3 at aal1 changing a1's phone: 0 rows.
- At aal2: succeeds.
- At aal1, a bio save that resends the same number in display format: saves.

**Exemption (i): no user signed in (null uid).**
- A null-uid `authenticated` caller can update 0 rows, because both RLS branches need a uid.
- `complete_onboarding` returns `not_invited`.
- anon gets `42501`.
- A token with no `sub` needs the JWT secret to mint.
- No security-definer writer sets `phone` apart from `complete_onboarding`, which keys on `auth.uid()`.
- So only superuser and service role can reach it.

**Exemption (ii): `invited` status.**
- An invited admin's direct PATCH updates 0 rows, because `my_active_role` needs `active`.
- An active admin calling `complete_onboarding` again gets `not_invited`.
- No path sets a row back to `invited`.
- So it is reachable only through `complete_onboarding`, once.

**Web:** `insufficient_aal → needsTwoStep` is in the own-key table.

**Runbooks:** both say to call a number held outside the portal.

**E-60 (`staff-client.ts`):** this is a browser-side request filter, not an access control; RLS and `is_admin()` still decide. It adds no data flow and no dependency. No finding.

**New findings:** none.

### Residual risks (round 2)

1. An admin at aal1 can still edit their own non-identity fields. This predates item 4 and is low impact.
2. A tutor can change their own phone at aal1. Accepted, because no procedure uses the profile phone. Any future phone-based check must call a number held outside the portal.
3. A tutor promoted to admin keeps the number they set. The runbook rule covers this.
4. Statement logging, if it is ever turned up, could capture values.
5. The migration was edited in place before merge. Any later change must be a new migration.
6. At release: confirm on hosted that the migration is applied, and run the production-build grep.
