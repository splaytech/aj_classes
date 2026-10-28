# 03b — Solution design: build-queue items 4–8

> **Stage:** 3 of /deliver (Solution Designer) · **Date:** 26 Oct 2026 · **Branch:** `feature/staff-phone-privacy` (from `develop` at `fb738ea`)
> **Input:** [01b-requirement-items-4-9.md](01b-requirement-items-4-9.md) (approved, with
> [review-1b](review-1b-items-4-9.md) round 2's 90-day note applied here),
> [02b-architecture-items-4-8.md](02b-architecture-items-4-8.md) and ADRs
> [0005](../../decisions/0005-public-csp-static-headers.md)–[0008](../../decisions/0008-scheduled-and-multi-kind-email.md)
> (all Accepted, [review-2b](review-2b-items-4-8.md)); [03-design.md](03-design.md) for style;
> [04-plan.md](04-plan.md) §1.1; the code on `develop` at `fb738ea`; held item 2 read from
> `feature/homework-file-uploads` (not checked out); `~/dev/work/aj_classes-e2e` (read only).
> **Next stage:** Manager (build plan / todo per item), then Developer, one branch per item.

Each part below is meant to be built without coming back with questions. It names every file,
every SQL object with its signature, errors and grants, every service signature, the UI states
with their constants keys, and how each AC is tested on a laptop and in CI. Parts are in build
order: 4, 5, 6, 7, 8.

---

## 0. Read me first

### 0.1 Build order, migrations and dependencies

| Order | Item | Branch | Migration | Function deploy | Depends on |
|---|---|---|---|---|---|
| 1 | 4 Staff phone + Privacy | `feature/staff-phone-privacy` | `20261026100000_staff_phone_edit.sql` | none | nothing |
| 2 | 5 Public CSP (+ item 9 docs) | `feature/public-csp` | none | none | nothing (item 1 is on `develop`) |
| 3 | 6 CI quality gates | `feature/ci-quality-gates` | none | none | item 5's mirror script (§5.4). Built after 5 |
| 4 | 7 Fair results | `feature/fair-results` | `20261027100000_fair_results.sql` | none | item 3 (on `develop`) |
| 5 | 8 More alerts | `feature/more-email-alerts` | `20261028100000_more_email_alerts.sql` | `notifications` | items 3 and 7 |

- **Migration names.** The timestamps above keep the order 4 < 7 < 8 and are later than the
  newest file on `develop` (`20261025110100`). If a branch is cut later than its name's date,
  the Developer may rename the file to a fresh `supabase migration new` timestamp, as long as it
  stays later than everything on `develop` and the order 4 < 7 < 8 holds.
- **Held item 2** stays held. Nothing here depends on it. Its rebase (T2.15) has a carry list in
  §9: it is the one place that names every function and test that item 2 must rebuild on top of
  items 4, 7 and 8 (ADR-0007 decision 4).
- **Item 6 depends on item 5** only for `apps/web/scripts/serve-mirror.ts` and
  `check-hosted-ref.ts`. If item 6 is ever built first, it adds those two files exactly as §5.4
  specifies, and item 5 then only adds the headers.

### 0.2 Repo rules every file below follows

As 03 §0.2 (services-only HTTP, all words from `apps/web/src/constants/*`, no `style={{…}}`, MUI
`sx` in the portal and CSS modules on public pages, stable `key`s, ErrorBoundary on new routes,
no `console.log`, SQL `set search_path = ''`, explicit revokes and grants, RLS on new tables).
Additions for this batch:

- **No new route.** Items 4–8 add no page, so no new ErrorBoundary is needed. Portal pages keep
  inheriting `portal-root.tsx`'s.
- **Node scripts are typed TypeScript in `apps/web/scripts/`.** `apps/web/tsconfig.json` already
  includes `scripts`, so they are typechecked and linted by the `web` job. They run with
  `node scripts/<name>.ts` (Node 24 strips the types, as `test-notifications.mjs` already relies
  on). Rules: `import type` for types only, no `enum`, no `namespace`, relative imports with the
  `.ts` extension, JSON read with `fs` (not `import … with`). Each CLI is a thin file over a
  pure module, so Vitest tests the module without side effects. CLIs write with
  `process.stdout.write` / `console.error`, never `console.log`.
- **TODOs** only as `TODO [ticket]`. None are planned.
- **Shared SQL functions are rebuilt from their current body.** Every `create or replace` or
  drop-and-recreate below names the file and lines its body is copied from, on `develop` at
  `fb738ea`. The Developer copies that body and applies only the listed change. If a later
  migration on `develop` has replaced the same function by build time, copy that one instead
  (ADR-0007 decision 4). `grep -n "function <schema>.<name>" supabase/migrations/*.sql | tail -1`
  finds the current one.

### 0.3 No hosted requests (01b common rule, AC-5.11, AC-6.14)

1. **Database, function and E2E tests run against the local stack only** (`pnpm db:start`), as
   03 §0.3.
2. **Every build used for a gate overrides the committed `.env.production`** with shell or job
   variables, never a committed file:

   ```bash
   # Local-Supabase gate build (item 4's AC-4.8 grep, item 5's sweep). Separate exports, because
   # zsh doesn't word-split an unquoted variable (03 §1.6).
   export VITE_SUPABASE_URL=http://127.0.0.1:55321
   export VITE_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY from pnpm db:status>
   export VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA   # Cloudflare's public always-pass test key
   VITE_APP_ENV=production pnpm build

   # No-Supabase gate build (item 6's Lighthouse and structured-data jobs; item 1's N-25)
   VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_LEAD_CAPTURE= VITE_APP_ENV=production pnpm build
   ```

3. **Every gate build is checked before it is served:** `pnpm --filter web check:hosted-ref
   build/client` (§5.4) must print `0 files` and exit 0 (the N-02 method, now a committed tool).
   `serve-mirror.ts` runs the same check itself and refuses to serve on a hit.
4. **Browsers count `supabase.co` requests and expect 0** (the N-18 method): DevTools Network
   filter in manual sweeps, the E2E block-and-count fixture (§6.4) and the Lighthouse
   `network-requests` check (§6.6) in CI.
5. No test sends a real enquiry, a real Kit subscription or a real email: Web3Forms, Kit and
   `leads` are mocked or blocked in the browser; email goes to Mailpit.

### 0.4 Carry-overs from the reviews: where each is resolved

| Source | Point | Resolved in |
|---|---|---|
| review-1b round 2 | AC-8.3 and AC-8.8 hold "within the 90-day outbox retention, as AC-3.5" | §8.10 test wording for AC-8.3 and AC-8.8; §8.12 known limit |
| review-2b 1 | Deploy order: migration, then function | §8.2 step 8 (`supported_kinds`), §8.11 release steps |
| review-2b 2 | Own-hand-in branch uses `assignment_readable_by` | §9 (item 2 carry list) |
| review-2b 3 | No false Failed rows for "new assignment" | §8.2 step 5 (`deadline <= now()` queues nothing); §14 PO confirmation |
| review-2b 4 | Hourly cron with the Melbourne-hour-15 guard | §8.2 step 6; DST tests in §8.10 |
| review-2b 5 | Full gate-build env override | §0.3 point 2 |
| review-2b 6 | Lighthouse fails on any `supabase.co` URL | §6.6 `lighthouse-report.ts` |
| review-2b 8 | `nullif(trim(...))` and `security definer` phone trigger | §4.2 step 2 |
| review-2b 9 | `migration list` check when item 2 is rebased | §9 step 1 |

---

## Item 4 — Staff phone on My profile, plus the Privacy update

02b item 4 (column grant plus a validating trigger; no ADR). One migration, no function deploy,
no new dependency.

### 4.1 Files to touch (16)

| # | Path | New / changed | Responsibility |
|---|---|---|---|
| 1 | `supabase/migrations/20261026100000_staff_phone_edit.sql` | New | §4.2 |
| 2 | `supabase/tests/database/staff_phone.test.sql` | New | §4.7 (pgTAP) |
| 3 | `apps/web/src/services/profile.service.ts` | Changed | `PROFILE_COLUMNS` and `ProfileRow` gain `phone`; `updateProfile` sends it; `toStaffProfile` maps it (§4.3) |
| 4 | `apps/web/src/services/types.ts` | Changed | `StaffProfile.phone: string \| null`; `ProfileChanges` gains `phone: string` (the field's text) |
| 5 | `apps/web/src/services/auth-errors.ts` | Changed | `ERROR_KEYS_BY_OWN_KEY.phone_required: 'phoneRequired'` (`invalid_phone` is already mapped) |
| 6 | `apps/web/src/services/auth-errors.test.ts` | Changed | `phone_required` → `phoneRequired`; `invalid_phone` → `invalidPhone` |
| 7 | `apps/web/src/constants/error.constants.ts` | Changed | `PORTAL_ERRORS.phoneRequired`; `PROFILE_VALIDATION.phoneRequired` (§4.5) |
| 8 | `apps/web/src/constants/portal.constants.ts` | Changed | `PROFILE_PAGE.labels.phone`, `PROFILE_PAGE.hints.phone` (§4.5) |
| 9 | `apps/web/src/lib/profile-validation.ts` | Changed | `ProfileErrors` gains `phone`; `validateProfile(values, savedPhone)`; new `validateProfilePhone` (§4.4) |
| 10 | `apps/web/src/lib/profile-validation.test.ts` | Changed | Phone cases (§4.7) |
| 11 | `apps/web/src/components/portal/PortalField.tsx` | Changed | `TextInput` accepts `type: 'tel'` and an optional `inputMode` |
| 12 | `apps/web/src/components/portal/ProfileForm.tsx` | Changed | The phone field and its server-error mapping (§4.4) |
| 13 | `apps/web/src/components/portal/ProfileForm.test.tsx` | New | Component tests (§4.7) |
| 14 | `apps/web/src/constants/content.constants.ts` | Changed | `PRIVACY`: heading "Portal accounts", one sentence, `lastUpdated` (§4.6) |
| 15 | `apps/web/src/routes/privacy.test.tsx` | Changed | Heading lookups renamed; phone sentence test (§4.7) |
| 16 | `docs/requirements/invite-onboarding.md` | Changed | "Fields": the phone can now be changed on My profile and by an admin (link here) |

**Not touched:** `routes/portal/profile.tsx` and `routes/portal/admin-staff-member.tsx` (both
already pass the profile and a save function to `ProfileForm`; the admin page's `refresh`
already reloads `getStaffMember`, so the header's phone link updates), `admin-staff.tsx` (its
Phone column reads `admin_list_staff()`), `complete_onboarding()`, `database.types.ts` (`phone` is
already a column; no RPC changes).

### 4.2 Migration `20261026100000_staff_phone_edit.sql` (in this order)

**Step 1. Grant**

```sql
-- Staff (and admins, for staff) change the phone through the existing profile update (02b item 4).
-- status, terms_accepted_at and password_set_at stay ungranted (AC-4.7).
grant update (phone) on public.profiles to authenticated;
```

RLS is unchanged: "Staff update their own profile; admins update all"
(`20261006004522_staff_accounts.sql` lines 471–480) already allows only an active tutor or admin
on their own row (`is_active_staff()` needs `status = 'active'`, so invited and deactivated
accounts fail), or an admin with aal2 on any row. Families fail the policy.

**Step 2. Validating trigger**

```sql
-- Checks and normalises a phone change (AC-4.2–4.4, AC-4.7). security definer: execute on
-- private.normalise_au_phone is revoked from authenticated (review-2b finding 8).
-- complete_onboarding() passes unchanged: staff get an already-normalised number, families null over null.
create function private.check_profile_phone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.phone := nullif(trim(new.phone), ''); -- the form sends a blank field as text
  if new.phone is not distinct from old.phone then
    return new; -- includes blank over no number: other fields still save (AC-4.4)
  end if;
  if new.phone is null then
    raise exception 'phone_required'; -- a saved number can be changed, never cleared
  end if;
  if new.role not in ('tutor', 'admin') then
    raise exception 'invalid_input'; -- families never hold a phone, even if an admin tries
  end if;
  new.phone := private.normalise_au_phone(new.phone);
  if new.phone is null then
    raise exception 'invalid_phone';
  end if;
  return new;
end;
$$;

create trigger profiles_check_phone
  before update of phone on public.profiles
  for each row execute function private.check_profile_phone();
```

- A value equal to the stored one after normalising (for example `0412 345 678` over
  `+61412345678`) changes nothing, so the audit trigger sees no change and writes nothing.
- The existing `phone` check constraint (`20261023100000` line 20) stays as the last line of
  defence.
- Errors are raised with the default SQLSTATE `P0001`. PostgREST answers 400 with the message as
  the key, which `toErrorKey` maps by message.

**Step 3. `updated_at` follows a phone change** (02b item 4 point 4, `[ASSUMPTION]` there)

```sql
drop trigger profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update of full_name, bio, qualifications, subjects, avatar_path, role, is_active, phone
  on public.profiles
  for each row execute function private.set_updated_at();
```

(Column list copied from `20261006004522` lines 231–234, plus `phone`.)

**Step 4. Admin audit records `phone` by name only** (AC-4.6)

`create or replace function private.audit_admin_profile_edit()`: body copied from
`20261006004522_staff_accounts.sql` lines 237–263 (never redefined since), plus one line after
the `avatar_path` line:

```sql
  if new.phone is distinct from old.phone then changed := array_append(changed, 'phone'); end if;
```

```sql
drop trigger profiles_audit_admin_edit on public.profiles;
create trigger profiles_audit_admin_edit
  after update of full_name, bio, qualifications, subjects, avatar_path, phone on public.profiles
  for each row execute function private.audit_admin_profile_edit();
```

The self-edit rule (`editor = new.id` → no row) and `details = {"fields": [...]}` are unchanged,
so the number never reaches `audit_log`.

**Step 5. Grants and comment**

```sql
revoke execute on function private.check_profile_phone() from public, anon, authenticated;

comment on column public.profiles.phone is
  'Staff only: an Australian number as +61…, given at setup; changed later on My profile or by an admin (item 4). Never public.';
```

Rollback (forward migration if ever needed): `revoke update (phone)`, drop `profiles_check_phone`
and the function, re-create the two triggers with their old column lists and restore the old
audit body. No data changes.

### 4.3 Contracts

**Table write (PostgREST, through `updateProfile`)**

`PATCH /rest/v1/profiles?id=eq.<uuid>&select=<PROFILE_COLUMNS>` with
`{ full_name, bio, qualifications, subjects, phone }`, one statement, so a phone error saves
nothing (AC-4.3, AC-4.5).

| Caller | Row | Result |
|---|---|---|
| Active tutor or admin | own | 200 with the row; `phone` normalised |
| Admin aal2 | a staff row | 200; one `profile_edited_by_admin` audit row if any field changed |
| Admin aal2 | a family row, phone non-blank | 400 `invalid_input` |
| Admin aal1, tutor on someone else, family, invited, deactivated | any | 200 with no row → service returns `fail('notSaved')` (RLS filters it) |
| Anyone | blank over a saved number | 400 `phone_required` |
| Anyone allowed | not an Australian number | 400 `invalid_phone` |
| Anyone | `status`, `terms_accepted_at`, `password_set_at` | 401/403 `42501` (no column grant) |

**Service (`profile.service.ts`)**

```ts
const PROFILE_COLUMNS = 'id, email, full_name, bio, qualifications, subjects, avatar_path, phone';

/** Saves name, subjects, bio, qualifications and phone. Returns the profile as saved. */
export async function updateProfile(userId: string, changes: ProfileChanges): Promise<Result<StaffProfile>>;
// columns: { full_name: trim, bio: trim, qualifications, subjects, phone: changes.phone.trim() || null }
```

`getMyProfile`, `getProfile`, `updateMyProfile` keep their signatures. `toStaffProfile` adds
`phone: row.phone`.

### 4.4 Components and behaviour

**`lib/profile-validation.ts`**

```ts
export type ProfileErrors = Partial<Record<'fullName' | 'phone' | 'bio' | 'qualifications', string>>;

/** Blank is fine only if nothing is saved yet (AC-4.4); otherwise it must be Australian (AC-4.2). */
export function validateProfilePhone(phone: string, savedPhone: string | null): string | undefined;
//   phone.trim() === '' → savedPhone ? PROFILE_VALIDATION.phoneRequired : undefined
//   !isValidAustralianPhone(phone) → PORTAL_VALIDATION.phoneInvalid (the setup form's text)

export function validateProfile(values: ProfileChanges, savedPhone: string | null): ProfileErrors;
// adds errors.phone from validateProfilePhone; the other rules are unchanged
```

**`components/portal/PortalField.tsx`**: `TextInputProps.type` becomes
`'text' | 'email' | 'tel'`, plus `inputMode?: 'tel'`, passed to the `<input>`.

**`components/portal/ProfileForm.tsx`**

- `FIELD_IDS.phone = 'profile-phone'`.
- State `phone`, initial `formatPhone(profile.phone)` (`lib/format.ts`; empty for null).
- Rendered **after Full name** (the setup form's order):
  `<TextInput id={FIELD_IDS.phone} type="tel" inputMode="tel" autoComplete="tel" label={PROFILE_PAGE.labels.phone} hint={PROFILE_PAGE.hints.phone} value={phone} onChange={setPhone} error={errors.phone} />`.
- `handleSubmit`: `changes` gains `phone`; `validateProfile(changes, profile.phone)`. The existing
  first-error focus works unchanged because `FIELD_IDS` gains `phone` (no new DOM call is added).
- On `!result.ok`:
  - `result.error` is `'invalidPhone'` or `'phoneRequired'` → `setErrors({ phone: PORTAL_ERRORS[result.error] })`,
    no form alert. The server refused what the browser let through, so the message sits on the field (AC-4.3).
  - anything else → the existing `FormAlert` with `PORTAL_ERRORS[result.error]`.
  - Every field keeps its typed value either way (state is untouched), so a phone error never
    throws away other edits (AC-4.5).
- On success: also `setPhone(formatPhone(result.data.phone))`, then the existing
  `PROFILE_PAGE.saved` status and `onSaved()` (which revalidates, refreshing the header name).

### 4.5 UI states and constants

| State | What shows | Constants key |
|---|---|---|
| Loaded, number saved | Field pre-filled `0412 345 678` / `(03) 9876 5432` | `PROFILE_PAGE.labels.phone`, `.hints.phone` |
| Loaded, no number yet (pre-onboarding staff) | Empty field, same hint | same |
| Browser check: invalid | Inline error on the field, focus moves to it, nothing sent | `PORTAL_VALIDATION.phoneInvalid` |
| Browser check: blank over a saved number | Inline error | `PROFILE_VALIDATION.phoneRequired` |
| Server refuses phone | Inline error on the field | `PORTAL_ERRORS.invalidPhone` / `.phoneRequired` |
| Other failure (network, notSaved) | Existing form alert above the button | `PORTAL_ERRORS[...]` |
| Saving | Button disabled, `PROFILE_PAGE.saving` | existing |
| Saved | `PROFILE_PAGE.saved` status | existing |
| Permission | The page is behind the staff layout; the admin page behind the admin layout. A refused row (aal1 admin) shows `PORTAL_ERRORS.notSaved` | existing |
| Mobile 360 px, light/dark | Same `PortalForm.module.css` input as every portal field; `type="tel"` opens the keypad | n/a |

New text:

| Key | Text |
|---|---|
| `PROFILE_PAGE.labels.phone` | `JOIN_PAGE.labels.phone` (reference, so it stays `'Phone number'`) |
| `PROFILE_PAGE.hints.phone` | ~~`So AJ Classes can reach you about your classes. Only AJ Classes admins can see it; it's never shown on the website.`~~ Shortened 2026-10-29 to two lines at 360 px (actionItems 27c, Saurabh approved): `So AJ Classes can reach you. Only admins see it; it's never on the website.` |
| `PROFILE_VALIDATION.phoneRequired` | `Please enter a phone number. You can change it, but you can't remove it.` |
| `PORTAL_ERRORS.phoneRequired` | same text as `PROFILE_VALIDATION.phoneRequired` |

`PROFILE_PAGE` is defined after `JOIN_PAGE` in `portal.constants.ts` (lines 213 vs 461), so the
reference is safe. `[ASSUMPTION]` The admin staff page shows the same "you" hint, as it already
does for the bio hint; it's the shared form (R2a US18).

### 4.6 Privacy (AC-4.9, B17)

In `PRIVACY.sections` (`content.constants.ts`, the section that starts "Portal accounts are
created only by invitation"):

- `heading`: `'Student and parent portal accounts'` → `'Portal accounts'`.
- Insert after "For each account we keep your name, email address and sign-in times.":
  **"For tutors and other staff we also keep a phone number, given at account setup or added later on My profile, and kept up to date by them or an admin. We use it to contact them about classes; only they and AJ Classes admins can see it, and it is never published."**
- `PRIVACY.lastUpdated`: the month the release goes to `main` (`'Last updated: <Month> 2026'`).
  The Developer sets the build month; if the release slips a month, the release step updates it.
- The section's existing code comment ("Wording for the owner to review") gains "and the staff
  phone sentence (item 4)". No `[TBC]`, TODO or "draft" literal (04-plan T3.8 rule). Approval is
  tracked as **B17 / Q7** in §13.

**Merge conflict to expect:** held item 2 edits the same `text` and its tests look the section up
by the old heading. Whichever merges second keeps both sentences and uses `'Portal accounts'`
(§9).

### 4.7 Test approach per AC

Commands: `pnpm test`, `pnpm db:test`, `pnpm lint`. `staff_phone.test.sql` fixtures:
admin `a1` (aal2 factor), tutor `b1` (phone `+61412345678`), tutor `b2` (no phone), deactivated
tutor `c1`, invited tutor `c2` (`p_joined => false`), student `s1` and parent `p1`
(`tests.create_family_account`). Phones are set as superuser in set-up.

| AC | How it's tested | Type / file |
|---|---|---|
| 4.1 | `ProfileForm.test.tsx`: label "Phone number"; value `0412 345 678` from `+61412345678`, empty from null; hint text; the input has `type="tel"` and `inputMode="tel"`. Manual: `tutor@local.test` → My profile | Unit + manual |
| 4.2 | pgTAP as b1: `0412 345 678`, `0412-345-678`, `(03) 9876 5432`, `(08) 8123 4567`, `+61 2 9876 5432` → stored `+61412345678`, …, `+61298765432`. `profile-validation.test.ts`: the same five accepted. Manual: save, reload, the field shows the formatted number | DB + unit + manual |
| 4.3 | pgTAP: `0512345678`, `041234567`, `04123456789`, `0412abc678`, `+1 202 555 0100` each `throws_ok(..., 'P0001', 'invalid_phone')`, and b1's phone is unchanged after. Unit: same values rejected. `ProfileForm.test.tsx`: `onSave` resolving `fail('invalidPhone')` shows the message on the phone field, not as a form alert | DB + unit |
| 4.4 | pgTAP: b1 sets `''`, `'   '` and `null` → `phone_required`; b2 (no phone) updates `full_name` with `phone = ''` → `lives_ok`, phone still null. Unit: `validateProfilePhone('', '+61…')` → required; `('', null)` → undefined | DB + unit |
| 4.5 | `ProfileForm.test.tsx`: edit bio and phone, `onSave` → `fail('phoneRequired')`: the bio textarea still holds the edit and no "Profile saved." shows; `onSave` → success: "Profile saved." once and `onSaved` called once; one Save button. Manual: header name refreshes after a name change | Unit + manual |
| 4.6 | pgTAP as a1 aal2: update b1 phone → exactly one `profile_edited_by_admin` row, `details->'fields' ? 'phone'`, `details::text !~ '[0-9]'`; `admin_list_staff(b1).phone` is the new value; b1 editing own phone → 0 new audit rows; a1 editing own phone → 0. Manual: Admin → Staff → b1: change, the header link and the list's Phone column show it; Admin → Activity shows "profile edited" with no number | DB + manual |
| 4.7 | pgTAP: b1 updating b2's phone `returning id` → empty, b2 unchanged; b1 `select phone from profiles where id = b2` → empty; s1 and p1 updating their own `phone` → empty (0 rows, RLS); a1 setting s1's phone → `invalid_input`; c1 and c2 updating their own → empty; a1 at aal1 updating b1 → empty; b1 setting `status`, `terms_accepted_at`, `password_set_at` → `42501`. `onboarding.test.sql` unchanged and green (invited tutor's `complete_onboarding` still stores `+61…`; a student's phone still `invalid_input`) | DB |
| 4.8 | After the local-Supabase gate build (§0.3): `grep -rlE` for every form (`+61…`, digits only, formatted) of the numbers actually stored on local staff profiles → nothing in `apps/web/build/client`. Don't use `0412 345 678`: it is the example in the invalid-phone error text (dev notes item 4, D2). Code check: `grep -rn "phone" apps/web/src/services/public-*.ts apps/web/src/services/*.client.ts apps/web/src/routes/sitemap.ts apps/web/src/lib/seo.ts` finds no profile phone. The only `phone` in JSON-LD is `BUSINESS.phone` | Manual (scripted) |
| 4.9 | `privacy.test.tsx`: the "Portal accounts" section contains "For tutors and other staff we also keep a phone number", "given at account setup or added later on My profile", "kept up to date by them or an admin", "only they and AJ Classes admins can see it, and it is never published"; no section is still called "Student and parent portal accounts"; the existing duplicate-heading test still passes | Unit |
| 4.10 | Manual at 360 px, light and dark, on My profile and Admin → Staff → person: the field, its hint and its error are legible and the phone keypad opens (iOS Safari or Chrome device mode). Unit: covered in 4.1 (`type`, `inputMode`) | Manual + unit |
| Audit and `updated_at` | pgTAP: b1's `updated_at` increases after a phone change | DB |

### 4.8 Release (Saurabh)

1. B17: approve the §4.6 sentence and the heading change (Q7, batched with items 2 and 3).
2. Hosted migration: `supabase db push` (or `supabase/scripts/deploy.sh`, which pushes migrations
   first). No function deploy.
3. Merge to `main` per the release branch rule (04-plan §2).
4. Optional live check (team, read-only): `curl -s https://ajclasses.com.au/privacy | grep -c "For tutors and other staff"` = 1.

---

## Item 5 — Content security policy on public pages

ADR-0005. No migration, no runtime code, no new dependency.

### 5.1 Files to touch (16)

| # | Path | New / changed | Responsibility |
|---|---|---|---|
| 1 | `apps/web/vercel.json` | Changed | New public CSP rule (§5.2) |
| 2 | `apps/web/serve.railway.json` | Changed | Public CSP on the `**/*` rule (§5.2) |
| 3 | `apps/web/scripts/hosting-constants.ts` | New | `HOSTED_SUPABASE_ORIGIN`, `HOSTED_PROJECT_REF`, `LOCAL_SUPABASE_ORIGIN`, `PUBLIC_CSP_SOURCE`, `MIRROR_PORT` |
| 4 | `apps/web/scripts/mirror-config.ts` | New | Pure: `buildMirrorConfig` (§5.4) |
| 5 | `apps/web/scripts/mirror-config.test.ts` | New | Unit tests |
| 6 | `apps/web/scripts/hosted-ref.ts` | New | Pure: `findHostedRefs(root)` |
| 7 | `apps/web/scripts/hosted-ref.test.ts` | New | Unit tests (temp directory fixtures) |
| 8 | `apps/web/scripts/check-hosted-ref.ts` | New | CLI over `findHostedRefs` |
| 9 | `apps/web/scripts/serve-mirror.ts` | New | CLI: build config, check the build, stub analytics, run `serve` |
| 10 | `apps/web/package.json` | Changed | Scripts `mirror`, `check:hosted-ref` |
| 11 | `apps/web/src/hosting-csp.test.ts` | New | Consistency test (§5.5) |
| 12 | `apps/web/src/hosting-config.test.ts` | Changed | Item 1's AC-1.4 test now tells the public and portal CSPs apart (§5.5) |
| 13 | `/package.json` | Changed | `"mirror": "pnpm --filter web mirror"` |
| 14 | `docs/architecture/arch.md` | Changed | §3 Hosting: the public CSP's hosts and the "update both files" rule (AC-5.10) |
| 15 | `docs/requirements/release-1/PRP.md` | Changed | Item 9's three annotations (AC-5.9, §5.6) |
| 16 | `docs/delivery/2026-10-25-pending-requirements/03-design.md` | Changed | One line under §1.6: "AC-1.4's 'no `Content-Security-Policy` on `/posts`' is superseded by item 5: `/posts` now sends the public CSP (03b §5)." |

### 5.2 Header rules

**Public policy** (one string, identical in both files; ADR-0005 decision 1):

```
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://unzjnxctkyahtmrkinyr.supabase.co https://api.web3forms.com https://app.convertkit.com; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

**`vercel.json`**: insert a rule **between** the global `/(.*)` rule and the `/portal/:path*` rule:

```json
{
  "source": "/((?!portal(?:/|$)|__spa-fallback$).*)",
  "headers": [{ "key": "Content-Security-Policy", "value": "<public policy>" }]
}
```

The global rule (HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`) and the portal rule are
byte-for-byte unchanged (AC-5.5, AC-5.6).

**Amended after the item 5 security review (S1):** a `/__spa-fallback` rule, placed before the
portal rule, sends the identical portal CSP, `X-Robots-Tag: noindex, nofollow` and
`Cache-Control: no-store`. Vercel matches header rules on the requested path, so without it a
direct request to the fallback got no CSP at all. The lookahead ends `__spa-fallback$`, so it
excludes exactly that path.

**`serve.railway.json`**: append `{ "key": "Content-Security-Policy", "value": "<public policy>" }`
as the **last** header of the existing `**/*` rule. That rule stays first, before
`__spa-fallback.html`. `serve` applies matching rules in order with the last value per key, so the
portal fallback ends with the portal CSP only (02b §5.3).

### 5.3 What the browser does (for the Tester)

| Request | Vercel headers | Mirror headers |
|---|---|---|
| `/`, `/privacy`, `/programmes/*`, `/resources`, `/resources/*`, `/posts`, `/subscribed`, `/nope` (404) | global + public CSP | Railway `**/*` (minus `X-Robots-Tag`) + public CSP (local origin) |
| `/portal`, `/portal/*` | global + portal CSP, `X-Robots-Tag`, `no-store` | `**/*` + fallback rule: portal CSP (local origin), `X-Robots-Tag`, `no-store` |
| Assets (`/assets/*.js`, images, `favicon.svg`) | global + public CSP (harmless on non-HTML) | same |

### 5.4 Mirror and hosted-ref tools (02b §5.4)

**`scripts/hosting-constants.ts`**

```ts
export const HOSTED_SUPABASE_ORIGIN = 'https://unzjnxctkyahtmrkinyr.supabase.co'; // must match vercel.json / serve.railway.json
export const HOSTED_PROJECT_REF = new URL(HOSTED_SUPABASE_ORIGIN).hostname.split('.')[0] ?? '';
export const LOCAL_SUPABASE_ORIGIN = 'http://127.0.0.1:55321'; // must match supabase/config.toml [api] port
export const PUBLIC_CSP_SOURCE = '/((?!portal(?:/|$)|__spa-fallback$).*)';
export const MIRROR_PORT = 4173;
```

**`scripts/mirror-config.ts`** (pure)

```ts
export type HeaderRule = { source: string; headers: { key: string; value: string }[] };
export type ServeConfig = { public: string; cleanUrls: boolean; trailingSlash: boolean;
  headers: HeaderRule[]; rewrites: { source: string; destination: string }[] };

export class MirrorConfigError extends Error {}

/**
 * serve.railway.json → a serve config that behaves like Vercel locally:
 *   1. drops X-Robots-Tag from the `**\/*` rule only (Railway was a staging host; Vercel sends no
 *      global noindex, and Lighthouse SEO would fail);
 *   2. replaces every HOSTED_SUPABASE_ORIGIN in a header value with `localOrigin`;
 *   3. sets `public` to the absolute `publicDir`, so serve needs no positional folder (03 §1.6).
 * Throws MirrorConfigError if no header value contained HOSTED_SUPABASE_ORIGIN, so a mirror can
 * never silently enforce something other than the committed file.
 */
export function buildMirrorConfig(railway: ServeConfig, options: { localOrigin: string; publicDir: string }): ServeConfig;
```

**`scripts/hosted-ref.ts`** (pure apart from reading files)

```ts
/** Files under `root` (recursively; .js .mjs .cjs .ts .html .json .yml .yaml .md .toml .txt .map)
 *  whose text contains HOSTED_PROJECT_REF. Paths are relative to `root`, sorted. Skips
 *  node_modules, playwright-report and test-results folders and never follows symlinks (pnpm
 *  links packages into e2e/node_modules). `root` may also be a single file. */
export function findHostedRefs(root: string): string[];
```

**`scripts/check-hosted-ref.ts`** (CLI): `node scripts/check-hosted-ref.ts <path> [<path> …]`.
Prints `check-hosted-ref: <n> files` and each hit; exits 1 on any hit or on a path that doesn't
exist (so a mistyped path can't pass), else 0.

**`scripts/serve-mirror.ts`** (CLI)

```
node scripts/serve-mirror.ts [--port 4173] [--origin http://127.0.0.1:55321] [--stub-analytics] [--write-only <file>]
```

1. Reads `serve.railway.json` and builds the config with `--origin` (default
   `$MIRROR_SUPABASE_ORIGIN`, else `LOCAL_SUPABASE_ORIGIN`).
2. Refuses (exit 1) if `build/client` is missing, or `findHostedRefs('build/client')` finds
   anything (AC-5.11).
3. `--stub-analytics`: writes an empty `build/client/_vercel/insights/script.js` if missing.
   `build/` is gitignored and Vercel builds from source, so the stub never reaches a deploy (02b
   §5.4 point 5).
4. Writes the config to `<os.tmpdir()>/aj-classes-mirror-<port>.json` (never the repo). With
   `--write-only <file>` it writes there and exits.
5. Spawns `node_modules/.bin/serve --config <file> -l <port> --no-clipboard` with `cwd` = `apps/web`,
   `stdio: 'inherit'`, and forwards SIGINT/SIGTERM.

`apps/web/package.json` scripts:
`"mirror": "node scripts/serve-mirror.ts --stub-analytics"`,
`"check:hosted-ref": "node scripts/check-hosted-ref.ts"`.

Railway mirror for AC-5.7 stays `PORT=4174 pnpm --filter web start:railway` (unsubstituted; only
`curl` is used against it).

### 5.5 Consistency tests

**`src/hosting-csp.test.ts`** (Vitest, `web` job; imports both JSON files):

1. The public CSP value in `vercel.json` (rule with `source === PUBLIC_CSP_SOURCE`) equals the one
   in `serve.railway.json`'s `**/*` rule, byte for byte. The portal CSP (`/portal/:path*` vs
   `__spa-fallback.html`) is equal in both too.
2. The public policy contains `HOSTED_SUPABASE_ORIGIN`, and no `127.0.0.1`, `localhost`, ` * `,
   `*.` or a bare `https:` / `http:` source (AC-5.1, AC-5.2).
3. Parsed into directives (`split(';')`, trimmed, first word = name), it has exactly:
   `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`,
   `form-action 'self'`, and `connect-src` = `'self'`, the hosted origin,
   `https://api.web3forms.com`, `https://app.convertkit.com` (AC-5.2).
4. The portal CSP string equals today's value (a constant in the test, copied from `vercel.json`
   at `fb738ea`) (AC-5.5).
5. In Railway, the `**/*` rule (with the public CSP) comes before `__spa-fallback.html`.
6. `new RegExp('^' + PUBLIC_CSP_SOURCE + '$')` matches `/`, `/privacy`, `/posts`,
   `/programmes/vce`, `/nope`, `/portalx` and doesn't match `/portal`, `/portal/`,
   `/portal/login`, `/__spa-fallback`.
7. The global rule's four headers equal today's (AC-5.6).

**`src/hosting-config.test.ts`** (item 1): `PORTAL_ONLY_HEADERS` becomes
`['X-Robots-Tag', 'Cache-Control']`, and a new assertion says the only Vercel rule whose CSP value
equals the portal CSP is `/portal/:path*`. The Railway test is unchanged (it already skips
`**/*`).

**`scripts/mirror-config.test.ts`**: the built config has no `X-Robots-Tag` on `**/*` but keeps it
on the fallback; every hosted origin is replaced (public and portal CSP); `public` is absolute;
a config without the hosted origin throws `MirrorConfigError`; the input object isn't mutated.

**`scripts/hosted-ref.test.ts`**: a temp dir with `a.js` containing the ref, `b.js` without, and
`sub/c.html` with it → `['a.js', 'sub/c.html']`; an empty dir → `[]`.

### 5.6 Docs (AC-5.9, AC-5.10)

`docs/requirements/release-1/PRP.md`, each with a link to `../../delivery/2026-10-25-pending-requirements/01b-requirement-items-4-9.md#item-9--hreflang--geo-head-tags-dropped`:
1. F6.3 sample: a line straight **after** the code block (not a comment inside it, which would read as part of the markup to copy): "**Dropped (26 Oct 2026, pending-requirements item 9):** the `hreflang` and `geo.*` tags in the sample above. [Why](link)".
2. F6.3.1: "All the tags above are present and filled with real values on production, **except the `hreflang` and `geo.*` tags, dropped** ([item 9](link))."
3. Launch checklist (line 535): "Every tag in F6.3 is present in production HTML (`hreflang` and `geo.*` dropped, [item 9](link)); Lighthouse SEO = 100".

`docs/architecture/arch.md` §3 Hosting, new paragraph: "Public pages send an enforcing CSP
(ADR-0005). It allows only our own origin plus `connect-src` to Supabase
(`unzjnxctkyahtmrkinyr.supabase.co`), Web3Forms (`api.web3forms.com`) and Kit
(`app.convertkit.com`). Adding any third-party script, image, font, frame or API to a public page
means editing the public CSP in **both** `apps/web/vercel.json` and `apps/web/serve.railway.json`;
`src/hosting-csp.test.ts` fails if they differ."

### 5.7 Test approach per AC

**Gate set-up (Tester):** `pnpm db:start`; the local-Supabase gate build from §0.3 plus
`export VITE_LEAD_CAPTURE=on`, `export VITE_FORM_ACCESS_KEY=local-placeholder` and
`export VITE_KIT_FORM_ID=0000000` (placeholder, so the footer subscribe shows); then `pnpm mirror`
(:4173). At least one local post exists unless the case says otherwise.

**Browser sweep (AC-5.3), Chrome:** DevTools open with *Preserve log*, Console filtered to
"Content-Security-Policy", Network *Request blocking* on for `api.web3forms.com/*`,
`app.convertkit.com/*` and `127.0.0.1:55321/functions/v1/leads*`. Blocked requests then show as
`(blocked:devtools)`, never `(blocked:csp)`, and nothing leaves the browser. `[ASSUMPTION]` This
counts as "mocked at the network layer" for the manual sweep: CSP is evaluated before DevTools
blocking, so a policy gap still shows as a violation. Item 6 adds the automated version with real
`route.fulfill` mocks (§6.5).

| AC | How it's tested | Type / file |
|---|---|---|
| 5.1 | Mirror: `for p in / /privacy /resources /resources/victorian-selective-entry-exam /programmes/vce /programmes/selective-entry /programmes/naplan /posts /subscribed /nope; do printf '%s ' $p; curl -sI localhost:4173$p \| grep -ci '^content-security-policy:'; done` → every line ends `1`; one full header printed shows `connect-src 'self' http://127.0.0.1:55321 …`. Every programme and guide path: loop over `build/client/programmes/*/` and `build/client/resources/*/`. Committed files: `hosting-csp.test.ts` checks 1–2 | Manual (scripted) + unit |
| 5.2 | `hosting-csp.test.ts` checks 2–3. `'unsafe-inline'` reason: ADR-0005 decision 2 | Unit |
| 5.3 | The sweep above on every AC-5.1 page at 360 px and 1280 px: load and hydration; phone menu open/close; News link with posts, then with every post deleted (reload); `/posts` with a list and empty; enquiry submit (blocked Web3Forms and `leads`; the form shows its error state, which is fine); footer subscribe with any email. Console shows 0 CSP violations. TSR table: page × width × browser × result | Manual |
| 5.4 | View source of `/`, `/programmes/vce`, one guide: `application/ld+json` present. Network: images, `/fonts/*`, `favicon.svg`, manifest, OG image all 200, 0 CSP violations. WhatsApp button opens `wa.me`. Staging build (`VITE_APP_ENV=staging`) on the mirror shows the environment marker. Analytics: release check (§5.8) | Manual + release |
| 5.5 | `curl -sI localhost:4173/portal/login \| grep -ci '^content-security-policy:'` = 1 and equals the portal policy with the local origin; `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store` present. Browser on the mirror: sign in as `admin@local.test` (Turnstile test key) with two-step, avatars show on Admin → Staff, 0 CSP violations. `hosting-csp.test.ts` check 4. (File downloads: item 2 is held; its T2.15 re-test covers them, §9) | Manual + unit |
| 5.6 | `curl -sI localhost:4173/` shows `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`. `hosting-csp.test.ts` check 7 (Vercel global rule, incl. HSTS). HSTS itself: release check | Manual + unit + release |
| 5.7 | `PORT=4174 pnpm --filter web start:railway`; `curl -sI localhost:4174/` has the public CSP with the hosted origin; `/portal/login` has exactly 1 CSP, the portal one. `hosting-csp.test.ts` checks 1 and 5 | Manual + unit |
| 5.8 | On the mirror's `/`, DevTools console: `const s = document.createElement('script'); s.src = 'https://example.com/x.js'; document.head.append(s)` → a `script-src` violation in the console and no request. `fetch('https://example.com')` → a `connect-src` violation. Inline `onclick`: `document.body.setAttribute('onclick', 'document.title = "ran"')`, click → the title changes: it **runs on purpose** (`'unsafe-inline'`, ADR-0005 decision 1); TSR records it | Manual |
| 5.9 | Docs diff review: the three PRP lines, each with the link | Review |
| 5.10 | Docs diff review: `arch.md` paragraph | Review |
| 5.11 | `pnpm --filter web check:hosted-ref build/client` → `0 files` (and `serve-mirror` started, which re-checks). During the sweep, Network filter `supabase.co` → 0 rows across all pages (export the HAR; `grep -c supabase.co` = 0) | Manual (scripted) |

### 5.8 Release (Saurabh, then the team)

1. **Before merge to `main`** (Saurabh, behind Vercel's login): open the `develop` preview,
   DevTools → Network → `/portal/login` document → exactly one `content-security-policy`, the
   portal one; `/` → the public one. `vercel.live` toolbar violations on the preview are
   expected; never add that host (ADR-0005).
2. Normal production release.
3. **After release** (team, read-only):
   - `curl -sI https://ajclasses.com.au/` and `…/programmes/vce` show the public CSP;
   - `curl -sI https://ajclasses.com.au/nope` shows it on the 404;
   - `curl -sI https://ajclasses.com.au/portal/login | grep -ci '^content-security-policy:'` = 1, the portal one;
   - `curl -sI https://ajclasses.com.au/__spa-fallback | grep -ci '^content-security-policy:'` = 1, the portal one, with `noindex` and `no-store` (security S1, [06-security-item-5](06-security-item-5.md));
   - `curl -sI https://ajclasses.com.au/_vercel/insights/script.js` → 200;
   - live home page in Chrome: 0 CSP violations for the analytics script and beacon (AC-5.4);
   - `curl -sI https://ajclasses.com.au/ | grep -i strict-transport` present (AC-5.6).
   Fallback if `/portal/*` ever shows two CSPs: revert the release (config only) and list public
   paths explicitly (02b §5.6 risk 1).

No Privacy wording: the CSP collects nothing.

---

## Item 6 — CI quality gates: E2E smoke, Lighthouse, structured data

ADR-0006. No runtime change, no migration. New **dev-only** dependencies, listed with reasons in
the PR description (AC-6.13): `@playwright/test`, `pg`, `@types/pg`, `dotenv` (moved with the E2E
suite, `e2e/` only), `@lhci/cli` (`apps/web`, Lighthouse CI). `@supabase/supabase-js` and
`typescript` and `@types/node` are already in the lockfile; `e2e/` declares all three at the ranges
`apps/web` uses (`@types/node` `^26.6.3`, replacing the old repo's `^20`), so the workspace has
one version of each.

### 6.1 Files to touch (36)

**E2E package (`e2e/`, moved from `~/dev/work/aj_classes-e2e` at its current commit, then edited)**

| # | Path | New / changed | Responsibility |
|---|---|---|---|
| 1 | `pnpm-workspace.yaml` | Changed | `packages: ['apps/*', 'e2e']` |
| 2 | `e2e/package.json` | New | `name: "aj-classes-e2e"`, private, `type: module`; scripts `test:smoke` (`playwright test`), `test:csp` (`playwright test -c playwright.csp.config.ts`), `typecheck` (`tsc --noEmit`); dev dependencies only |
| 3 | `e2e/tsconfig.json` | Moved | `include` gains `csp`, `scripts` |
| 4 | `e2e/playwright.config.ts` | Moved, changed | `trace: 'retain-on-failure'` (with `retries: 0`, `on-first-retry` never records), `video: 'retain-on-failure'`, reporter `[['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]`, `outputDir: 'test-results'` |
| 5 | `e2e/playwright.csp.config.ts` | New | `testDir: './csp'`, `baseURL: 'http://localhost:4173'`, no global setup, imports nothing from `src/` (§6.4 import rule), `webServer: { command: 'pnpm --filter web mirror', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 60_000 }` |
| 6 | `e2e/.env.example` | Moved, changed | Placeholders only for keys (`SUPABASE_ANON_KEY=<from supabase status>` etc.); non-key settings kept, incl. the seeded admin from `supabase/seed.sql`, labelled "local seed account, not real"; `AJ_CLASSES_DIR=..` |
| 7 | `e2e/scripts/local-env.mjs` | New | §6.3 |
| 8 | `e2e/setup/global-setup.ts` | Moved | Unchanged apart from paths |
| 9 | `e2e/src/config.ts` | Moved, changed | Default `AJ_CLASSES_DIR` = repo root (`path.resolve(import.meta.dirname, '../..')`); new `assertLocalUrl(name, url)`: `WEB_BASE_URL`, `SUPABASE_REST_URL`, `MAILPIT_URL` must have host `localhost` or `127.0.0.1`, and `PG_HOST` must be one of those, else throw (AC-6.14 belt and braces) |
| 10 | `e2e/src/fixtures/test-fixtures.ts` | Moved, changed | Extends `hosted-guard.ts`'s `test` instead of `@playwright/test`'s, so every smoke spec gets the guard (§6.4) |
| 10a | `e2e/src/fixtures/hosted-guard.ts` | New | `hostedSupabaseGuard` auto fixture; imports only `@playwright/test` (§6.4) |
| 11 | `e2e/src/mocks/public-services.ts` | New | `mockKit(page)` and `mockLeads(page)` (`route.fulfill` 200 JSON), for the CSP sweep |
| 12–19 | `e2e/src/auth/login.ts`, `src/auth/totp.ts`, `src/db/anon-client.ts`, `src/db/pg-client.ts`, `src/db/poll.ts`, `src/fixtures/markers.ts`, `src/mail/mailpit.ts`, `src/mocks/web3forms.ts` | Moved | Unchanged |
| 20–25 | `e2e/tests/admin-posts.spec.ts`, `admin-posts.selectors.ts`, `our-approach.spec.ts`, `register-interest.spec.ts`, `staff-login.spec.ts`, `invite-onboarding.spec.ts` | Moved | Unchanged; prettier-formatted to this repo's config |
| 26 | `e2e/csp/public-csp.spec.ts` | New | §6.5 |

**Gates in `apps/web/`**

| # | Path | New / changed | Responsibility |
|---|---|---|---|
| 27 | `apps/web/lighthouserc.json` | New | §6.6 thresholds (the one committed config, AC-6.7) |
| 28 | `apps/web/scripts/lighthouse-report.ts` | New | Pure `summarise(results)` + CLI: fail on `supabase.co`, report JS size (§6.6) |
| 29 | `apps/web/scripts/lighthouse-report.test.ts` | New | Unit tests with a trimmed LHR fixture |
| 30 | `apps/web/scripts/structured-data.ts` | New | Pure checks (§6.7) |
| 31 | `apps/web/scripts/structured-data.test.ts` | New | Unit tests, one per AC-6.10 case and per page type |
| 32 | `apps/web/scripts/fixtures/structured-data/*.html` | New | Fixtures (§6.7) |
| 33 | `apps/web/scripts/check-structured-data.ts` | New | CLI over `build/client/**/*.html` |
| 34 | `apps/web/package.json` | Changed | dev dependency `@lhci/cli`; scripts `lighthouse` (`lhci autorun`), `lighthouse:report` (`node scripts/lighthouse-report.ts .lighthouseci`), `check:structured-data` (`node scripts/check-structured-data.ts build/client`) |

**Repo**

| # | Path | New / changed | Responsibility |
|---|---|---|---|
| 35 | `.github/workflows/ci.yml` | Changed | Three jobs; Supabase CLI pinned (§6.8) |
| 36 | `.gitignore`, `.prettierignore`, `README.md`, `docs/testing/ci-gates.md` (new), `docs/architecture/arch.md`, `pnpm-lock.yaml` | Changed | Ignore `e2e/playwright-report/`, `e2e/test-results/`, `apps/web/.lighthouseci/`, `apps/web/lighthouse-report/`; README "Checks" section links the new doc; arch.md §2 CI lists the five jobs; lockfile |

The local `aj_classes-e2e` repo isn't changed by this item (02b §6.1). A "moved to
`aj_classes/e2e`" note in its README is Saurabh's or the Developer's optional step outside this
repo.

### 6.2 E2E target and env (ADR-0006 decision 3)

Dev server on `:5173` (`react-router dev`), which never loads `.env.production`. Job env:

| Variable | Value | Where from |
|---|---|---|
| `VITE_SUPABASE_URL` | `http://127.0.0.1:55321` | workflow `env` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | local `PUBLISHABLE_KEY` | `local-env.mjs` → `$GITHUB_ENV` |
| `VITE_TURNSTILE_SITE_KEY` | `1x00000000000000000000AA` | workflow `env` (Cloudflare's public test key, already in `.env.example`) |
| `VITE_LEAD_CAPTURE` | `on` | workflow `env` (AC-6.3) |
| `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | local demo JWTs | `local-env.mjs` |
| `WEB_BASE_URL`, `PG_*`, `SUPABASE_REST_URL`, `MAILPIT_URL`, `ADMIN_*`, budgets | local values | `local-env.mjs` (non-key settings read from `e2e/.env.example`) |

### 6.3 `e2e/scripts/local-env.mjs`

```
node e2e/scripts/local-env.mjs            # prints KEY=value lines
node e2e/scripts/local-env.mjs > e2e/.env # local runs (gitignored)
node e2e/scripts/local-env.mjs >> "$GITHUB_ENV"  # CI
```

1. `execFileSync('supabase', ['status', '-o', 'json'])` and parse it (keys `ANON_KEY`,
   `SERVICE_ROLE_KEY`, `PUBLISHABLE_KEY`, `API_URL`; checked present with CLI 2.120.0).
2. Refuse (exit 1) unless `API_URL` is `http://127.0.0.1:55321`.
3. Read the non-key lines of `e2e/.env.example` (everything except lines whose value is a
   `<placeholder>`).
4. Print those, plus `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `VITE_SUPABASE_PUBLISHABLE_KEY`, on stdout. When `GITHUB_ACTIONS === 'true'`, first write
   `::add-mask::<value>` for each key on **stderr** (stdout goes into `$GITHUB_ENV`; the runner
   reads workflow commands from both streams), so logs never show them.

So the workflow and `e2e/` hold no key and no hosted value (AC-6.3).

### 6.4 Hosted block-and-count (AC-6.14)

In its own module, `e2e/src/fixtures/hosted-guard.ts`, which imports **only** `@playwright/test`.
It can't live in `test-fixtures.ts`: that file imports the db and mail clients, which import
`src/config.ts`, and `loadConfig()` throws at import time when the stack's env is missing, as it
is in the Lighthouse job (review-3b finding 1).

```ts
import { expect, test as base } from '@playwright/test';

export const test = base.extend<{ hostedSupabaseGuard: void }>({
/** Aborts every request to a *.supabase.co host and fails the test if any was attempted. */
hostedSupabaseGuard: [async ({ context }, use) => {
  const attempted: string[] = [];
  await context.route(/^https:\/\/[^/]+\.supabase\.co\//, (route) => {
    attempted.push(route.request().url());
    return route.abort();
  });
  await use();
  expect(attempted, 'requests to a hosted Supabase project').toEqual([]);
}, { auto: true }],
});
export { expect };
```

- `test-fixtures.ts` builds on it: `import { test as guarded } from './hosted-guard.js'` and
  `export const test = guarded.extend<Fixtures>({ … })`. Every smoke spec keeps importing
  `test-fixtures.ts`, so each one gets the guard.
- The CSP spec (§6.5) imports `test`/`expect` from `hosted-guard.ts` and helpers from
  `src/mocks/*` only.
- **Import rule for the CSP path:** `playwright.csp.config.ts`, `csp/public-csp.spec.ts`,
  `src/fixtures/hosted-guard.ts`, `src/mocks/web3forms.ts` and `src/mocks/public-services.ts`
  never import `src/config.ts`, `src/db/*`, `src/mail/*`, `src/auth/*` or `test-fixtures.ts`,
  directly or through another file. `playwright.csp.config.ts` has no `globalSetup` and takes its
  base URL as a literal. The CSP step in CI runs with none of the E2E env set, so a breach fails
  at once.

### 6.5 `e2e/csp/public-csp.spec.ts` (runs in the Lighthouse job against the mirror)

Imports: `test`, `expect` from `../src/fixtures/hosted-guard.js`; `mockWeb3Forms` and
`mockKit` from `../src/mocks/*` (§6.4 import rule). The build has no Supabase config, so the News
check and `leads` never fire. It does carry placeholder Web3Forms and Kit settings (§6.8), so the
enquiry form really posts to Web3Forms and the footer subscribe is shown and posts to Kit, both
caught by the mocks. For each page in the
Lighthouse set plus `/posts`, `/subscribed`, `/nope`, at 360 × 740 and 1280 × 800:

1. `page.addInitScript` installs a `securitypolicyviolation` listener that pushes
   `{ directive, blockedURI }` to `window.__cspViolations`.
2. `mockWeb3Forms(page)`, `mockKit(page)`.
3. Load, wait for `networkidle`; at 360 px open and close the phone menu; on `/` fill and submit
   the enquiry form (mocked) and the footer subscribe if shown.
4. Assert `window.__cspViolations` is `[]`.
5. One negative test on `/`: `page.addScriptTag({ url: 'https://example.com/x.js' })` rejects and
   `__cspViolations` has one `script-src-elem` entry (AC-5.8, automated).

### 6.6 Lighthouse (AC-6.6–6.8)

**Build:** the no-Supabase gate build (§0.3), then `check:hosted-ref build/client`.

**`apps/web/lighthouserc.json`**

```json
{
  "ci": {
    "collect": {
      "startServerCommand": "node scripts/serve-mirror.ts --stub-analytics",
      "startServerReadyPattern": "Accepting connections",
      "url": [
        "http://localhost:4173/",
        "http://localhost:4173/programmes/vce",
        "http://localhost:4173/programmes/selective-entry",
        "http://localhost:4173/resources",
        "http://localhost:4173/resources/victorian-selective-entry-exam",
        "http://localhost:4173/privacy"
      ],
      "numberOfRuns": 3,
      "settings": { "formFactor": "mobile", "screenEmulation": { "mobile": true } }
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9, "aggregationMethod": "median" }],
        "categories:accessibility": ["error", { "minScore": 0.9, "aggregationMethod": "median" }],
        "categories:best-practices": ["error", { "minScore": 0.9, "aggregationMethod": "median" }],
        "categories:seo": ["error", { "minScore": 1, "aggregationMethod": "median" }]
      }
    },
    "upload": { "target": "filesystem", "outputDir": "./lighthouse-report" }
  }
}
```

- Mobile is Lighthouse's default form factor; it's stated explicitly so a later default change
  can't flip it.
- `startServerReadyPattern`: `serve` 14 logs "Accepting connections at …" when it isn't on a
  TTY. The Developer confirms the exact text on the first CI run.
- **Never `temporary-public-storage`** (02b §6.3). The `filesystem` folder is uploaded as a workflow
  artifact (7 days).
- **JS size gate (AC-6.8).** The first CI run reports the per-page JS transfer (below). If every
  page's median is ≤ 100 KB (102,400 bytes) gzipped, the Developer adds
  `"resource-summary:script:size": ["error", { "maxNumericValue": 102400, "aggregationMethod": "median" }]`
  in the same PR. If not, the baseline goes in the TSR and the gate goes to the Later bucket with
  the MUI chunk split. No commented-out assertion is committed.
- **Thresholds are never lowered** (AC-6.7). A miss is fixed if small, or written up in the TSR
  and the review for a PO call before merge.

**`scripts/lighthouse-report.ts`**

```ts
export type PageReport = { url: string; supabaseRequests: string[]; scriptTransferBytes: number };

/** One LHR (Lighthouse result JSON) → its page report: every network-requests URL containing
 *  "supabase.co", and the resource-summary "script" transferSize. */
export function reportFor(lhr: unknown): PageReport;

/** Median script bytes per URL across runs, for the step summary. */
export function medianScriptBytes(reports: PageReport[]): Record<string, number>;
```

CLI: reads every `.lighthouseci/lhr-*.json`, prints a Markdown table (page, median JS KB) to
`$GITHUB_STEP_SUMMARY` when set (else stdout), and **exits 1 if any report has a
`supabaseRequests` entry** (AC-6.14, review-2b finding 6). The LHR shape is narrowed with type
guards, no `any`.

### 6.7 Structured data (AC-6.9, AC-6.10)

**Expected types per page**, from `lib/seo.ts` today:

| Built file | Page | Required `@type`s in the `@graph` | Required, non-empty |
|---|---|---|---|
| `index.html` | `/` | a node whose `@type` includes both `EducationalOrganization` and `LocalBusiness`; `WebSite`; `FAQPage` | Org/LocalBusiness: `name`, `url`, `logo`, `address`; WebSite: `name`, `url`; FAQPage: `mainEntity` ≥ 1, each `Question` has `name` and `acceptedAnswer.text` |
| `programmes/<slug>/index.html` (all, `vce` included) | programme pages | `Course`, `BreadcrumbList` | Course: `name`, `description`, `provider.name`; BreadcrumbList: `itemListElement` ≥ 1, each `ListItem` has numeric `position`, `name`, `item` |
| `resources/<slug>/index.html` | guides | `Article`, `BreadcrumbList` | Article: `headline`, `author.name`, `publisher.name`; BreadcrumbList as above |
| every other HTML file (`privacy`, `resources`, `posts`, `subscribed`, `404`, `__spa-fallback`) | — | none required | any JSON-LD present still gets the generic checks |

**Generic checks, every page:** each `<script type="application/ld+json">` parses; every value
under a key `url`, `item`, `logo`, `image` or `@id` is an absolute URL starting
`https://ajclasses.com.au/` (or equal to `https://ajclasses.com.au`); no node has `@type`
`Review` or `AggregateRating`, and no key `review` or `aggregateRating`, anywhere (R1 F6.4.3).
PO-confirmed (AC-6.9, §14): `sameAs` values are social profile links, off-site by
definition, so they only need to be absolute `https://` URLs.

**`scripts/structured-data.ts`**

```ts
export type Problem = { file: string; message: string };
export type PageKind = 'home' | 'programme' | 'guide' | 'other';

export function pageKindFor(relativeFile: string): PageKind;      // by path pattern
export function extractJsonLd(html: string): string[];            // raw block texts, in order
export function checkPage(relativeFile: string, html: string): Problem[];
```

Each message names the file and the problem, e.g.
`programmes/vce/index.html: Course is missing "provider"`. CLI (`check-structured-data.ts`)
walks `build/client`, prints each problem, and exits 1 if there is any, or if no `home` page was
found (an empty build can't pass).

**Fixtures (`scripts/fixtures/structured-data/`)**: `home-valid.html`, `programme-valid.html`,
`guide-valid.html` (copied from a real build), `broken-json.html`, `course-missing-provider.html`,
`relative-url.html` (`"item": "/programmes/vce"`), `localhost-url.html`
(`"url": "http://localhost:5173/"`), `review.html` (an `AggregateRating` node).

### 6.8 Workflow (`.github/workflows/ci.yml`)

Header comment lists five jobs. Existing `database` job: `version: latest` → `version: 2.120.0`
(the local CLI version; drift fix, 02b §6.3). The `web` job is unchanged; it already runs the
new Vitest tests (`scripts/*.test.ts`, `src/hosting-csp.test.ts`).

```yaml
  e2e:
    name: E2E smoke
    runs-on: ubuntu-latest
    timeout-minutes: 15
    env:
      VITE_SUPABASE_URL: http://127.0.0.1:55321
      VITE_TURNSTILE_SITE_KEY: 1x00000000000000000000AA   # Cloudflare's public always-pass test key
      VITE_LEAD_CAPTURE: 'on'
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - name: No hosted project reference in the workflow or the specs
        run: pnpm --filter web check:hosted-ref ../../.github/workflows ../../e2e
      - uses: supabase/setup-cli@v1
        with: { version: 2.120.0 }
      - name: Start local Supabase (services the specs use)
        run: supabase start -x studio,imgproxy,logflare,vector,supavisor,postgres-meta
      - name: Local keys into the job env (masked)
        run: node e2e/scripts/local-env.mjs >> "$GITHUB_ENV"
      - run: pnpm --filter aj-classes-e2e typecheck
      - run: pnpm --filter aj-classes-e2e exec playwright install --with-deps chromium
      - name: E2E smoke (global setup starts the dev server on 5173)
        run: pnpm --filter aj-classes-e2e test:smoke
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-report
          path: |
            e2e/playwright-report
            e2e/test-results
          retention-days: 7

  lighthouse:
    name: Lighthouse
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - checkout, pnpm, node 24, pnpm install --frozen-lockfile (as above)
      - name: Build with no Supabase config (never the hosted project)
        run: pnpm build
        # Placeholders so the CSP sweep exercises the enquiry and subscribe code; both are mocked.
        env: { VITE_APP_ENV: production, VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_LEAD_CAPTURE: '', VITE_FORM_ACCESS_KEY: local-placeholder, VITE_KIT_FORM_ID: '0000000' }
      - run: pnpm --filter web check:hosted-ref build/client
      - run: pnpm --filter web lighthouse
      - name: No Supabase requests; JS size per page
        run: pnpm --filter web lighthouse:report
      - run: pnpm --filter aj-classes-e2e exec playwright install --with-deps chromium
      - name: CSP sweep on the mirror (item 5, AC-5.3 and AC-5.8)
        run: pnpm --filter aj-classes-e2e test:csp
      - if: always()
        uses: actions/upload-artifact@v4
        with: { name: lighthouse-report, path: apps/web/lighthouse-report, retention-days: 7 }

  structured-data:
    name: Structured data
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - checkout, pnpm, node 24, pnpm install --frozen-lockfile
      - name: Build with no Supabase config
        run: pnpm build
        env: { VITE_APP_ENV: production, VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_LEAD_CAPTURE: '' }
      - run: pnpm --filter web check:hosted-ref build/client
      - run: pnpm --filter web check:structured-data
```

(The "checkout, pnpm, node, install" lines are written out in full in the file, as in the `web`
job.)

- **Invite onboarding in the smoke** (01b assumption 5): included by default. If the E2E job's
  3 recorded runs exceed 15 minutes, the Developer adds `--grep-invert "Invite onboarding"` to
  `test:smoke` and the TSR names it under "Not covered". Mailpit stays running either way.
- `leads` in CI calls Zoho at `host.docker.internal:55398`, which isn't served; the enquiry is
  still saved with CRM status `failed`, which the spec doesn't check (it polls
  `public.enquiries`). Accepted.
- **Cost:** none (public repo).

### 6.9 Docs (AC-6.12)

`docs/testing/ci-gates.md`: one section per gate with the exact commands CI uses, run from the
repo root: E2E (`pnpm db:start`, `node e2e/scripts/local-env.mjs > e2e/.env`,
`pnpm --filter aj-classes-e2e test:smoke`; the dev server is started by global setup with the
`VITE_*` values from `e2e/.env`), Lighthouse (the no-Supabase build, `check:hosted-ref`,
`lighthouse`, `lighthouse:report`, `test:csp`), structured data (build,
`check:structured-data`), and the hosted-request rule. It supersedes the local E2E repo's
"Preconditions" (that repo is frozen). README "Checks" links it.

### 6.10 Test approach per AC

| AC | How it's tested | Type / file |
|---|---|---|
| 6.1 | PR run shows three new checks named "E2E smoke", "Lighthouse", "Structured data". A throwaway commit on the branch that breaks one spec (e.g. a wrong heading in `our-approach.spec.ts`) fails only "E2E smoke" and the workflow; reverted before review | CI + manual |
| 6.2 | CI log: `supabase start` applies every migration and `seed.sql`; 4 (or 5) specs pass; each spec's DB assertion is visible in its code (dual-surface kept, files unchanged) | CI |
| 6.3 | The `check:hosted-ref` step over `.github/workflows` and `e2e` passes. Review: no `.env*` written into the checkout's tracked files (`git status --porcelain` after the run is clean except ignored files); `VITE_LEAD_CAPTURE` is in job env; `e2e/.env.example` has placeholders for every key | CI + review |
| 6.4 | TSR records the job and workflow durations of 3 runs: E2E ≤ 15 min, Lighthouse and structured data ≤ 10 min, workflow ≤ 20 min | CI |
| 6.5 | The deliberate-failure run (6.1) uploads `e2e-report` with the HTML report and trace; retention shows 7 days | CI |
| 6.6 | CI log shows 6 URLs × 3 runs, mobile, against :4173 with the stub; assertions pass | CI |
| 6.7 | Thresholds live only in `lighthouserc.json`; review checks they equal 0.9 / 0.9 / 0.9 / 1 | Review |
| 6.8 | Step summary table of median JS KB per page; TSR records it and the gate decision | CI |
| 6.9 | `structured-data.test.ts`: the three valid fixtures pass; `pageKindFor` maps `index.html`, `programmes/vce/index.html`, `resources/x/index.html`, `privacy/index.html`; CI job green on the real build | Unit + CI |
| 6.10 | `structured-data.test.ts`: each invalid fixture returns exactly one problem naming the file and the issue (broken JSON; missing `provider`; relative URL; localhost URL; Review/AggregateRating) | Unit |
| 6.11 | After the next production release: Google Rich Results Test and Schema Markup Validator on live `/`, `/programmes/vce`, one guide. TSR: "Organization / LocalBusiness detected, no errors" with the date | Manual, release |
| 6.12 | `docs/testing/ci-gates.md` review; a fresh clone follows it and runs each gate | Review + manual |
| 6.13 | PR description lists the five new dev dependencies with one-line reasons | Review |
| 6.14 | `check:hosted-ref` on both builds and on workflow + `e2e/`; `hostedSupabaseGuard` in every spec; `lighthouse:report` fails on any `supabase.co`. Unit: `lighthouse-report.test.ts` — an LHR with `https://x.supabase.co/rest/v1/posts` in `network-requests` gives one entry; without, none. `mirror-config`/`hosted-ref` tests (item 5). Proof run: temporarily build Lighthouse with `VITE_SUPABASE_URL=https://example.supabase.co` → the report step fails; reverted | CI + unit + manual |

### 6.11 Release

None to merge. Optional, after merge (Saurabh, GitHub settings): make "web", "database", "E2E
smoke", "Lighthouse" and "Structured data" required status checks on `develop` and `main`.

---

## Item 7 — Hold results, and returned work stays visible after leaving a class

ADR-0007. One migration, no function deploy, no new dependency. Built while item 2 is held, so
AC-7.2's file half and AC-7.15 move to item 2's re-test (T2.15, §9).

### 7.1 Files to touch (25)

**Database (`supabase/`)**

| # | Path | New / changed | Responsibility |
|---|---|---|---|
| 1 | `migrations/20261027100000_fair_results.sql` | New | §7.2 in order |
| 2 | `tests/database/fair_results.test.sql` | New | §7.7 |

**Web (`apps/web/src/`)**

| # | Path | New / changed | Responsibility |
|---|---|---|---|
| 3 | `services/assignments.service.ts` | Changed | `ASSIGNMENT_COLUMNS` and `AssignmentRow` gain `hold_results`; `toAssignmentSummary` maps `holdResults`; new `setHoldResults` (§7.3) |
| 4 | `services/types.ts` | Changed | `AssignmentSummary.holdResults: boolean`; `FamilyAssignment.isPastClass: boolean`; `FamilyAssignmentView` picks `isPastClass` |
| 5 | `services/family-data.ts` | Changed | `FamilyAssignmentRow.is_past_class`; `toFamilyAssignment` maps it (the JSON already carries `isPastClass`) |
| 6 | `services/family-data.test.ts` | New | Mapping tests |
| 7 | `services/index.ts` | Changed | Export `setHoldResults` |
| 8 | `services/auth-errors.ts` | Changed | `hold_needs_questions: 'holdNeedsQuestions'` |
| 9 | `services/auth-errors.test.ts` | Changed | The new key |
| 10 | `services/database.types.ts` | Regenerated | `pnpm db:types` |
| 11 | `constants/error.constants.ts` | Changed | `PORTAL_ERRORS.holdNeedsQuestions` |
| 12 | `constants/online-assignments.constants.ts` | Changed | `HOLD_RESULTS` (§7.5) |
| 13 | `constants/family.constants.ts` | Changed | `FAMILY_TAGS.pastClass` (§7.5) |
| 14 | `components/portal/HoldResultsSetting.tsx` | New | The checkbox, its hint and its locked state (§7.4) |
| 15 | `components/portal/HoldResultsSetting.test.tsx` | New | Component tests |
| 16 | `components/portal/StatusChips.tsx` | Changed | `PastClassChip` |
| 17 | `components/portal/StatusChips.test.tsx` | New | `PastClassChip` renders the constant |
| 18 | `components/portal/index.ts` | Changed | Exports |
| 19 | `routes/portal/assignment-detail.tsx` | Changed | Renders `HoldResultsSetting` below `QuestionList` when `questionCount > 0` |
| 20 | `routes/portal/student-home.tsx` | Changed | `ReturnedItem` shows `PastClassChip` when `item.isPastClass` |
| 21 | `routes/portal/parent-child.tsx` | Changed | `AssignmentRow` chips row adds `PastClassChip` |
| 22 | `routes/portal/student-assignment.tsx` | Changed | `PageHeader` meta adds `PastClassChip` |
| 23 | `routes/portal/parent-child-assignment.tsx` | Changed | Same |

**Docs**

| # | Path | Change |
|---|---|---|
| 24 | `docs/requirements/release-3/r3b/review.md` | F8 and F28 rows: "Resolved 2026, pending-requirements item 7" with a link to 01b (AC-7.17) |
| 25 | `docs/requirements/release-3/r3b/design.md` | §4 student and parent rows state rule (b); D8 notes the hold switch (AC-7.17) |

### 7.2 Migration `20261027100000_fair_results.sql` (in this order)

**Step 1. The flag**

```sql
alter table public.assignments
  add column hold_results boolean not null default false;

comment on column public.assignments.hold_results is
  'Keep all-multiple-choice work Submitted until staff return it (ADR-0007). Changeable only on drafts.';

grant insert (hold_results), update (hold_results) on public.assignments to authenticated;
```

The assignments RLS (`can_manage_assignment`: the class tutor or an admin) is unchanged, so only
staff who can manage the assignment can set it (AC-7.6).

**Step 2. Guard** (style of item 2's `check_file_handin_flag`)

```sql
-- Locked once published (AC-7.1). A permitted back-to-draft unlocks it, because
-- check_assignment_status already allows that only before anyone starts. Setting it needs at least
-- one question: paper homework never auto-returns, and neither does a file hand-in once item 2
-- lands (it can't have questions), so AC-7.2 needs no other rule.
create function private.check_hold_results()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.hold_results is distinct from old.hold_results
     and old.status = 'published' then
    raise exception 'assignment_published';
  end if;
  if new.hold_results and (tg_op = 'INSERT' or not old.hold_results)
     and not exists (select 1 from public.assignment_questions q where q.assignment_id = new.id) then
    raise exception 'hold_needs_questions';
  end if;
  return new;
end;
$$;

create trigger assignments_check_hold_results
  before insert or update of hold_results on public.assignments
  for each row execute function private.check_hold_results();
```

`[ASSUMPTION]` Deleting every question afterwards leaves a stale `true`. It's harmless (paper
never auto-returns, and the UI hides the switch without questions), so the question-delete path
isn't changed.

**Step 3. The read rule**

```sql
-- Rule (a) or rule (b): enrolled in the active class, or the student's result is returned
-- (ADR-0007). Read paths only; every write keeps assignment_visible_to.
create function private.assignment_readable_by(target_student uuid, target_assignment uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.assignment_visible_to(target_student, target_assignment)
      or exists (
           select 1
           from public.assignments a
           join public.assignment_results r on r.assignment_id = a.id
           where a.id = target_assignment
             and a.status = 'published'
             and r.student_id = target_student
             and r.status = 'returned'
         )
$$;
```

**Step 4. `student_submit` keeps held work Submitted** (AC-7.3)

`create or replace function public.student_submit(target_assignment uuid)`: body copied from
`20261007090321_family_functions.sql` lines 463–528 (not redefined since on `develop`). One
change, the final branch:

```sql
  if exists (
    select 1 from public.assignment_questions q
    where q.assignment_id = target_assignment and q.kind = 'written'
  ) or (select a.hold_results from public.assignments a where a.id = target_assignment) then
    return 'submitted';
  end if;
```

Auto-marking above it is unchanged, so every answer has `awarded_marks`, and the tutor's Return
passes `unmarked_answers` straight away (AC-7.4). `check_assignment_result` (item 3's body) sets
`marked_by` on that staff return, so item 3's trigger queues the email. Auto-returns keep
`marked_by` null (AC-7.5).

**Step 5. The list builder and its wrappers (drop and recreate)**

```sql
drop function public.student_assignments();
drop function public.parent_child_assignments(uuid);
drop function private.assignments_for_student(uuid, boolean);
```

`create function private.assignments_for_student(target_student uuid, for_parent boolean)`: body
copied from `20261007090321` lines 151–203, with three changes:

```sql
returns table ( …the 15 existing columns…, is_past_class boolean )
…
  select …the 15 existing expressions…,
         not (e.student_id is not null and c.is_active)            -- is_past_class (AC-7.12)
  from public.assignments a
  join public.classes c on c.id = a.class_id
  left join public.enrolments e on e.class_id = a.class_id and e.student_id = target_student
  left join public.assignment_results r on r.assignment_id = a.id and r.student_id = target_student
  where a.status = 'published'
    and ((e.student_id is not null and c.is_active) or r.status = 'returned')   -- rule (a) or (b)
  order by a.due_on nulls last, a.published_at desc
```

(`enrolments` has one row per class and student, so the left join can't duplicate rows.)

`public.student_assignments()` and `public.parent_child_assignments(uuid)`: bodies copied from
`20261007090321` lines 347–370 and 574–598; their `returns table` gains `is_past_class boolean`
last. Grants re-applied exactly as `20261007090321` lines 786–830 do for these three:

```sql
revoke execute on function private.assignments_for_student(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.student_assignments(), public.parent_child_assignments(uuid) from public, anon, authenticated;
grant execute on function public.student_assignments(), public.parent_child_assignments(uuid) to authenticated;
```

**Step 6. `assignment_view` gains `isPastClass`**

`create or replace function private.assignment_view(target_student uuid, target_assignment uuid, for_parent boolean)`:
body copied from `20261007090321` lines 206–268, plus one key after `'comment', summary.comment,`:

```sql
    'isPastClass', summary.is_past_class,
```

It reads the builder, so rule (b) applies to `student_assignment`, `parent_child_assignment`
(item 3's body, unchanged) and the email link target (AC-7.14). The before-return hiding (no
`correctOption`, `explanation`, `awardedMarks`, `mark` until `returned`) is unchanged (AC-7.3,
AC-7.6).

**Step 7. "Work returned" recipients follow rule (b)** (02b §7.1 point 6)

`create or replace function private.work_returned_recipients(uuid, uuid)`: body copied from
`20261025110000_work_returned_email.sql` lines 115–138; both `assignment_visible_to(...)` calls
become `assignment_readable_by(...)`. (Item 8 replaces this function with `email_recipients`.)

**Step 8. Grants**

```sql
revoke execute on function
  private.check_hold_results(),
  private.assignment_readable_by(uuid, uuid)
from public, anon, authenticated;
```

`student_submit`, `assignment_view` and `work_returned_recipients` are `create or replace`, so
their existing grants stay.

### 7.3 Contracts

| RPC / table | Change | Errors |
|---|---|---|
| `PATCH assignments` with `hold_results` | New column, staff only (RLS) | `assignment_published` (P0001) after publishing; `hold_needs_questions` (P0001) with no questions; other tutor → 0 rows |
| `student_submit(uuid) → text` | Returns `'submitted'` when `hold_results` | unchanged: `not_found` P0002 (past class or not visible), `not_online`, `already_submitted` |
| `student_assignments()`, `parent_child_assignments(uuid)` | `+ is_past_class boolean`; rule (b) rows added | unchanged (`require_student` / `require_my_child`) |
| `student_assignment(uuid)`, `parent_child_assignment(uuid, uuid)` → jsonb | `+ isPastClass`; rule (b) readable | unchanged |
| `student_save_answer(...)` | none (still `assignment_visible_to`) | past class → `not_found` P0002 (AC-7.11) |

**Service (`assignments.service.ts`)**

```ts
/** Turns "hold results until returned" on or off on a draft (ADR-0007). */
export async function setHoldResults(assignmentId: string, hold: boolean): Promise<Result>;
// update({ hold_results: hold }).eq('id', assignmentId).select('id').maybeSingle()
// error → fail(toErrorKey(error)); no row → fail('notAllowed'); else succeed()
```

`saveAssignment` is unchanged (it never sends `hold_results`, so editing a published assignment's
title can't trip the guard).

### 7.4 Components and behaviour

**`components/portal/HoldResultsSetting.tsx`**

```ts
type HoldResultsSettingProps = {
  assignmentId: string;
  holdResults: boolean;
  isPublished: boolean;
  onChanged: () => void;
};
export function HoldResultsSetting(props: HoldResultsSettingProps): JSX.Element;
```

- MUI `FormControlLabel` + `Checkbox` labelled `HOLD_RESULTS.label`, then a
  `Typography variant="body2" color="text.secondary"` hint, inside a `Paper variant="outlined"`
  with `sx={{ p: 3 }}` (same look as the question cards).
- Draft: enabled. `onChange` → `action.run(() => setHoldResults(assignmentId, checked))`; on
  success `onChanged()` (the page revalidates). Disabled while `action.busy`. Error →
  `<Alert severity="error">{action.error}</Alert>`.
- Published: `disabled`, checked state shown, and `HOLD_RESULTS.lockedNote` replaces the hint.
- **`assignment-detail.tsx`**: rendered straight after `<QuestionList … />`, inside the same
  `(isOnline || !assignment.isPublished)` block, only when `assignment.questionCount > 0`
  (AC-7.1, AC-7.2: paper homework never shows it). Back to draft makes it editable again with no
  extra code (it reads `isPublished`).
- `[ASSUMPTION]` It saves on change, like the question list's other draft actions, rather than in
  the Edit dialog. The dialog has no questions when an assignment is created, so the switch would
  be hidden there just when it's needed.

**`PastClassChip`** (`StatusChips.tsx`): `<Chip size="small" variant="outlined" label={FAMILY_TAGS.pastClass} />`.
Shown next to the status chip in `parent-child.tsx`'s `AssignmentRow`, under the class name in
`student-home.tsx`'s `ReturnedItem`, and in the `PageHeader` meta on both assignment pages. Past
class work is always Returned, so it only ever appears in "Marked and returned" and the pages are
already read-only (no `SolveForm`; `canAnswer` is false for `returned`) (AC-7.11). The existing
empty text `STUDENT_HOME.returned.empty` is unchanged (AC-7.12).

`[ASSUMPTION]` Past-class returned work counts in the child's progress summary
(`lib/family-progress.ts`, unchanged): it's part of their record of marks.

### 7.5 UI states and constants

| State | What shows | Key |
|---|---|---|
| Draft with ≥ 1 question | Enabled checkbox + hint | `HOLD_RESULTS.label`, `.hint` |
| Saving | Checkbox disabled | — |
| Save refused (e.g. published in another tab) | Error alert | `PORTAL_ERRORS.assignmentPublished` / `.holdNeedsQuestions` / `.notAllowed` |
| Published | Disabled checkbox showing its value + locked note | `HOLD_RESULTS.lockedNote` |
| No questions (paper) | Not rendered | — |
| Student after submitting held work | Existing "Handed in!" notice; status chip "Waiting for marking" | `SOLVE_PAGE.handedIn`, `FAMILY_STATUS_LABELS.submitted` |
| Past class (list and page) | Chip | `FAMILY_TAGS.pastClass` |
| Mobile 360 px, light/dark | MUI theme colours only; chips wrap (`flexWrap: 'wrap'` rows already) | — |

| Key | Text |
|---|---|
| `HOLD_RESULTS.label` | `Hold results until I return them` |
| `HOLD_RESULTS.hint` | ~~`Students see their marks and the correct answers only when you return their work. This matters only when every question is multiple choice: work with a written question is always held until you return it.`~~ Shortened 2026-10-29 to two lines at 360 px (actionItems 27c, Saurabh approved): `Marks and answers stay hidden until you return the work. Written work is always held.` |
| `HOLD_RESULTS.lockedNote` | `Locked because the assignment is published. Move it back to draft to change this.` |
| `PORTAL_ERRORS.holdNeedsQuestions` | `Add at least one question before holding results.` |
| `FAMILY_TAGS.pastClass` | `Past class` |

### 7.6 Status and visibility (one table for the Tester)

| Student's situation | Result status | Student list / page | Parent | Can write? |
|---|---|---|---|---|
| Enrolled, class active | any | shown (rule a), status rules as today | shown | yes, as today |
| Removed, or class archived | `returned` | shown, "Past class", read-only | shown | no (`not_found`) |
| Removed, or class archived | none, `not_submitted`, `in_progress`, `submitted`, `marked` | hidden | hidden | no |
| Any | assignment is a draft | hidden | hidden | no |
| Student deactivated / parent unlinked | any | `student_assignments()`, `student_assignment()`: 42501 `not_student` | `parent_child_assignments()`: P0002 `not_found` (via `require_my_child`, ITEM3-FU-1); `parent_child_assignment()`: 42501 `not_found` | no |
| Roster row deleted | (results cascade) | nothing | nothing | no |
| Re-enrolled | any | rule (a), `is_past_class = false` | shown | yes |

### 7.7 Test approach per AC

`fair_results.test.sql` fixtures: admin `a1` (aal2), tutors `b1` (class `c1`) and `b2` (class
`c2`); student account `s1` on roster `d1` with parents `p1`, `p2`; student `s2`/`d2` with parent
`p3`; assignments in `c1`: `h1` all-MCQ (2 questions) with hold, `h2` all-MCQ without hold,
`w1` with a written question, `x1` paper (`max_mark`), `n1` all-MCQ not started, `i1` in progress,
`u1` submitted-not-returned, `r1` returned; one draft `dr1`. Built as drafts, questions added,
then published, as `family_portal.test.sql` does. Starts with `delete from public.email_outbox`.
**Every outbox assertion filters `kind = 'work_returned'`** from the start, so item 8's
`new_assignment` rows (queued when the fixtures publish) can't change its counts (review-3b
finding 3).

| AC | How it's tested | Type / file |
|---|---|---|
| 7.1 | pgTAP: `hold_results` defaults false; as b1, set true on a draft with questions → ok; publish; set false → `assignment_published`; back to draft (no one started) → set false → ok; as b2 → 0 rows; as a1 aal2 → ok. `HoldResultsSetting.test.tsx`: draft → enabled, clicking calls `setHoldResults(id, true)` (mocked `@/services`) then `onChanged`; published → disabled with the locked note; error → alert | DB + unit |
| 7.2 | pgTAP: on paper `x1` (draft) set true → `hold_needs_questions`; insert as true with no questions → same. Manual: paper homework page shows no checkbox. File hand-in half → T2.15 (§9) | DB + manual |
| 7.3 | pgTAP as s1: `student_submit(h1)` = `'submitted'`; result `submitted`; answers have `awarded_marks`; `student_assignment(h1)` has `status = 'submitted'`, every `correctOption` null, `explanation` '', `awardedMarks` null, `mark` null; `student_assignments()` row for h1 has `mark` null and `status = 'submitted'` | DB |
| 7.4 | pgTAP as b1: update h1/d1 result to `returned` → lives_ok; `marked_by` = b1; 3 `work_returned` outbox rows (s1, p1, p2); `student_assignment(h1)` now shows `correctOption`, `awardedMarks`. Manual: the tutor opens the held submission, sees the auto-marks, adds a comment and Returns; within 5 minutes the local cron kick delivers the "work returned" email to Mailpit | DB + manual |
| 7.5 | pgTAP: `student_submit(h2)` = `'returned'`, `marked_by` null, 0 outbox rows. Existing `family_portal.test.sql` D8 tests stay green | DB |
| 7.6 | pgTAP as p1 before return: `parent_child_assignment(d1, h1)` has no correct options or awarded marks; `parent_child_assignments(d1)` h1 `mark` null. As s1 the same through both RPCs | DB |
| 7.7 | Manual at 360 px, light and dark, as `tutor@local.test` on a draft with an all-MCQ question: the "Hold results until I return them" checkbox, its label and its hint wrap and stay legible; on a published one the disabled state and the locked note too. `HoldResultsSetting.test.tsx` asserts the label and hint text come from `HOLD_RESULTS` | Manual + unit |
| 7.8 | pgTAP: delete `enrolments(c1, d1)`; as s1 `student_assignments()` contains `r1` with `is_past_class = true` and `student_assignment(r1)->>'isPastClass' = 'true'`; as p1 `parent_child_assignments(d1)` and `parent_child_assignment(d1, r1)` the same. Manual: student home "Marked and returned" shows r1 with "Past class"; parent child page and assignment page too | DB + manual |
| 7.9 | pgTAP: re-enrol, then `update classes set is_active = false where id = c1` (as superuser) → same results as 7.8 | DB |
| 7.10 | pgTAP after removal (and after archiving): `n1`, `i1`, `u1` absent from both lists and `student_assignment(u1)` → P0002; `dr1` absent; `student_timetable()` has no `c1` session; `parent_child_timetable(d1)` neither | DB |
| 7.11 | pgTAP as s1 after removal: `student_save_answer(r1, q, 0)` → P0002 `not_found`; `student_submit(r1)` → P0002; after archiving (still enrolled) the same. Manual: the page shows results only, no Save/Hand in | DB + manual |
| 7.12 | Unit: `family-data.test.ts` maps `is_past_class` → `isPastClass`; `StatusChips.test.tsx` renders "Past class". Manual: tag in list and page; "Nothing returned yet." with no returned work | Unit + manual |
| 7.13 | pgTAP: s2 never sees r1 (list, view P0002); p3 `parent_child_assignment(d1, r1)` → 42501; deactivate s1's profile → `student_assignments()` and `student_assignment(r1)` 42501 `not_student`; unlink p2 → as p2, `parent_child_assignments(d1)` P0002 `not_found` (raised by `require_my_child`, unchanged, ITEM3-FU-1) and `parent_child_assignment(d1, r1)` 42501 `not_found` (item 3's BUG-7 body); delete roster row `d1` (cascade) → no result row, p1 sees nothing; re-enrol after 7.8 → `is_past_class = false` | DB |
| 7.14 | pgTAP after removal: `parent_child_assignment(d1, r1)` returns JSON (the email link's RPC); `private.work_returned_recipients(r1, d1)` (as superuser) still lists s1, p1, p2 (item 8 changes this one call to `private.email_recipients('work_returned', r1, d1)`, §8.1). Manual: open the Mailpit "View feedback" link after removing the student → the page opens | DB + manual |
| 7.15 | Moves to T2.15 (item 2 held), §9 | — |
| 7.16 | Manual at 360 px, light and dark: the "Past class" chip on student home, the parent's child page and both assignment pages, and the read-only page around it | Manual |
| 7.17 | Docs diff review | Review |
| Grants | pgTAP: `function_privs_are` / `has_function_privilege`: `authenticated` can execute `student_assignments()` and `parent_child_assignments(uuid)`; `anon` can't; nobody but the owner executes `private.assignment_readable_by` and `private.check_hold_results` | DB |

### 7.8 Release (Saurabh)

1. Hosted migration: `supabase db push` (or `deploy.sh`). No function deploy.
2. Normal production release.
3. Item 2 stays held; when it's rebased, §9 applies.
No Privacy wording: rule (b) keeps showing families data they already saw; the policy's "Parents
linked to a student can see that student's assignments…" still holds.

---

## Item 8 — "New assignment" and "due tomorrow" emails

ADR-0008 (extends ADR-0004). One migration, one function deploy, no new dependency.

### 8.1 Files to touch (25)

**Database and function (`supabase/`)**

| # | Path | New / changed | Responsibility |
|---|---|---|---|
| 1 | `migrations/20261028100000_more_email_alerts.sql` | New | §8.2 in order |
| 2 | `tests/database/email_alerts.test.sql` | New | §8.10 |
| 3 | `tests/database/email_outbox.test.sql` | Changed | Item 3's tests on the new shapes (§8.10 "Item 3 regression") |
| 3a | `tests/database/fair_results.test.sql` | Changed | Item 7's AC-7.14 call `private.work_returned_recipients(r1, d1)` becomes `private.email_recipients('work_returned', r1, d1)` (the old function is dropped). Its outbox assertions already filter `kind = 'work_returned'` (§7.7), so nothing else changes |
| 4 | `functions/notifications/copy.ts` | Changed | `EMAIL_KINDS`, per-kind wording (§8.5) |
| 5 | `functions/notifications/template.ts` | Changed | `ClaimedRow.kind`, `.due_on`; `renderEmail`; shared shell; `formatDueDate` (§8.4) |
| 6 | `functions/notifications/index.ts` | Changed | Claims with `supported_kinds`; renders with `renderEmail` |
| 7 | `scripts/test-notifications.mjs` | Changed | Unit and end-to-end checks for the new kinds (§8.10) |
| 8 | `README.md` | Changed | "Work returned emails" runbook → "Portal emails": three kinds, the `due-tomorrow-reminders` job and its kill switch, deploy order |

**Web (`apps/web/src/`)**

| # | Path | New / changed | Responsibility |
|---|---|---|---|
| 9 | `services/types.ts` | Changed | `NotificationSettings`, `EmailKind`, `EmailProblem.kind`, reason `'too_late'` |
| 10 | `services/notifications.service.ts` | Changed | Three columns; `kind` mapped (§8.6) |
| 11 | `services/notifications.service.test.ts` | Changed | Column list, defaults, payload, kind |
| 12 | `services/database.types.ts` | Regenerated | `pnpm db:types` |
| 13 | `routes/portal/account.tsx` | Changed | `NotificationsSection`: three switches, one Save |
| 14 | `routes/portal/admin-emails.tsx` | Changed | Type column |
| 15 | `lib/email-problems.ts` | Changed | `type` label |
| 16 | `lib/email-problems.test.ts` | Changed | Every kind and `too_late` labelled |
| 17 | `constants/portal.constants.ts` | Changed | `ACCOUNT_PAGE.notifications.newAssignment`, `.dueTomorrow`; `EMAILS_PAGE.columns.type`, `.kinds`, `.reasons.too_late`, `.intro` (§8.8) |
| 18 | `constants/content.constants.ts` | Changed | `PRIVACY` service-email sentence (§8.9) |
| 19 | `routes/privacy.test.tsx` | Changed | The new sentence replaces item 3's assertion |

**Docs**

| # | Path | Change |
|---|---|---|
| 20 | `docs/architecture/arch.md` | §4 scheduled jobs: `due-tomorrow-reminders` (hourly, acts at 15:10 Melbourne); `notifications` sends three kinds |
| 21 | `docs/budget.md` | §2 Resend row: three kinds; §5 Decision 1's upgrade trigger (once Saurabh answers it) |
| 22 | `docs/requirements/release-5/PRP.md` | R5-02 (new assignment, due tomorrow) and R5-04 (two more switches) built, link here |
| 23 | `docs/requirements/release-2/go-live.md` | Item 8 release steps, once released |
| 24 | `apps/web/src/routes/portal/account.module.css` | Conditional: only if three switch rows need spacing; reuse `.section` first |

ADR-0008 is Accepted and isn't edited.

### 8.2 Migration `20261028100000_more_email_alerts.sql` (in this order)

**Step 1. Switches** (AC-8.10, AC-8.15)

```sql
alter table public.notification_settings
  add column new_assignment boolean not null default true, -- a missing row still means on
  add column due_tomorrow   boolean not null default true;

grant insert (new_assignment, due_tomorrow), update (new_assignment, due_tomorrow)
  on public.notification_settings to authenticated;
```

The three own-row policies (item 3, step 2) are table-wide, so they cover the new columns.
`[ASSUMPTION — Security to confirm]` on by default (01b assumption 11).

**Step 2. Outbox: kinds, deadline, reason**

```sql
alter table public.email_outbox
  drop constraint email_outbox_kind_check,
  add constraint email_outbox_kind_check
    check (kind in ('work_returned', 'new_assignment', 'due_tomorrow')),
  drop constraint email_outbox_reason_check,
  add constraint email_outbox_reason_check
    check (reason in ('rejected', 'rate_limited', 'server_error', 'network',
                      'no_address', 'max_attempts', 'config_missing', 'too_late')),
  add column send_before timestamptz; -- null: no deadline (work_returned)

create index email_outbox_deadline_idx on public.email_outbox (send_before)
  where status = 'pending' and send_before is not null;

comment on column public.email_outbox.send_before is
  'Latest moment the email may still go out (ADR-0008). Pending rows past it become failed / too_late.';
```

The constraint names are Postgres's defaults for the inline checks in item 3's `create table`;
the Developer confirms them with `\d public.email_outbox` before writing the step. The unique key
`email_outbox_once (kind, assignment_id, student_id, recipient_id)` is **unchanged**, so
"republishing never notifies" and "one reminder even if the due date changes" hold **within the
90-day outbox retention, as AC-3.5** (review-1b round 2).

**Step 3. Melbourne helpers**

```sql
-- The one place the reminder hour lives (01b assumption 10: 3 pm, after school).
create function private.reminder_hour()
returns int language sql immutable set search_path = '' as $$ select 15 $$;

create function private.melbourne_date(at timestamptz)
returns date language sql stable set search_path = '' as $$
  select (at at time zone 'Australia/Melbourne')::date
$$;

-- Midnight at the start of a Melbourne day, DST included.
create function private.melbourne_day_start(day date)
returns timestamptz language sql stable set search_path = '' as $$
  select day::timestamp at time zone 'Australia/Melbourne'
$$;

-- True in exactly one hourly run a day, whatever time zone pg_cron schedules in (review-2b 4).
create function private.is_reminder_hour(at timestamptz)
returns boolean language sql stable set search_path = '' as $$
  select extract(hour from at at time zone 'Australia/Melbourne') = private.reminder_hour()
$$;

-- "New assignment" deadline (ADR-0008 decision 2; PO confirmation in §14): the end of the due
-- date, or 7 days after publishing when there's no due date.
create function private.new_assignment_send_before(due date, published timestamptz)
returns timestamptz language sql stable set search_path = '' as $$
  select case when due is null then published + interval '7 days'
              else private.melbourne_day_start(due + 1) end
$$;
```

**Step 4. One recipient function for every kind** (ADR-0008 decision 3)

```sql
-- Is this kind still worth sending for this student's work? queued_due_on: the due date a
-- reminder was queued for (from its send_before); a changed due date means skipped (AC-8.8).
create function private.email_still_relevant(
  target_kind text, target_assignment uuid, target_student uuid, queued_due_on date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case target_kind
    when 'work_returned' then private.assignment_readable_by(target_student, target_assignment)
    when 'new_assignment' then private.assignment_visible_to(target_student, target_assignment)
    when 'due_tomorrow' then
      private.assignment_visible_to(target_student, target_assignment)
      and private.is_online_assignment(target_assignment)
      and exists (select 1 from public.assignments a
                  where a.id = target_assignment and a.due_on = queued_due_on)
      and coalesce((select r.status from public.assignment_results r
                    where r.assignment_id = target_assignment and r.student_id = target_student),
                   'not_submitted') in ('not_submitted', 'in_progress')
    else false
  end
$$;

-- Who should get this kind of email about this student's work (AC-3.1, AC-8.1, AC-8.11): the
-- active student account and each active linked parent, minus anyone whose switch for this kind
-- is off, while the email is still relevant. The queue and the claim both use it (03 §4 choice 7).
create function private.email_recipients(
  target_kind text, target_assignment uuid, target_student uuid, queued_due_on date default null)
returns table (profile_id uuid, recipient_role text)
language sql
stable
security definer
set search_path = ''
as $$
  with people as (
    select p.id, 'student'::text as recipient_role
    from public.students s
    join public.profiles p on p.id = s.profile_id
    where s.id = target_student and s.is_active
      and p.is_active and p.status = 'active' and p.role = 'student'
    union
    select p.id, 'parent'
    from public.student_guardians g
    join public.students s on s.id = g.student_id
    join public.profiles p on p.id = g.parent_id
    where g.student_id = target_student and s.is_active
      and p.is_active and p.status = 'active' and p.role = 'parent'
  )
  select pe.id, pe.recipient_role
  from people pe
  left join public.notification_settings ns on ns.profile_id = pe.id
  where private.email_still_relevant(target_kind, target_assignment, target_student, queued_due_on)
    and coalesce(case target_kind
                   when 'work_returned'  then ns.work_returned
                   when 'new_assignment' then ns.new_assignment
                   when 'due_tomorrow'   then ns.due_tomorrow
                 end, true)
$$;
```

The people set is item 3's `work_returned_recipients` (`20261025110000` lines 115–138, as
changed by item 7) unchanged.

**Step 5. Queue "new assignment" on publish** (AC-8.1, AC-8.3, AC-8.4, AC-8.12)

```sql
-- Runs in the publisher's transaction: a rolled-back publish queues nothing, and a send failure
-- never reaches the tutor. Students enrolled later get nothing (AC-8.4). Nothing is queued once
-- the deadline has passed (work published after its due date), so there's never a false Failed row.
create function private.queue_new_assignment_emails()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  deadline timestamptz;
begin
  if tg_op = 'UPDATE' and old.status = 'published' then
    return null; -- already published before this change
  end if;
  deadline := private.new_assignment_send_before(new.due_on, new.published_at);
  if deadline <= now() then
    return null;
  end if;
  insert into public.email_outbox (kind, assignment_id, student_id, recipient_id, recipient_role, send_before)
  select 'new_assignment', new.id, e.student_id, r.profile_id, r.recipient_role, deadline
  from public.enrolments e
  cross join lateral private.email_recipients('new_assignment', new.id, e.student_id) r
  where e.class_id = new.class_id
  on conflict on constraint email_outbox_once do nothing; -- republishing never notifies (AC-8.3)
  return null;
end;
$$;

-- OLD can't be referenced in WHEN for an INSERT-or-UPDATE trigger, so the old status is checked inside.
create trigger assignments_queue_new_assignment_email
  after insert or update of status on public.assignments
  for each row
  when (new.status = 'published')
  execute function private.queue_new_assignment_emails();
```

`published_at` is set by the BEFORE trigger `check_assignment_status`, so the AFTER trigger sees
it. `[ASSUMPTION]` Moving a published assignment to another class (only allowed before anyone
starts) doesn't notify the new class; the trigger fires only on becoming published.

**Step 6. Queue "due tomorrow" from an hourly job** (AC-8.5, AC-8.6)

```sql
-- One day's reminders, for work due the day after `today` (Melbourne). Split from the cron entry
-- so pgTAP can call it for any day.
create function private.queue_due_tomorrow_emails_for(today date)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.email_outbox (kind, assignment_id, student_id, recipient_id, recipient_role, send_before)
  select 'due_tomorrow', a.id, e.student_id, r.profile_id, r.recipient_role,
         private.melbourne_day_start(today + 1)
  from public.assignments a
  join public.enrolments e on e.class_id = a.class_id
  cross join lateral private.email_recipients('due_tomorrow', a.id, e.student_id, today + 1) r
  where a.status = 'published'
    and a.due_on = today + 1
    -- AC-8.6: skip work published on the day before it's due (that's today) or later; its
    -- "new assignment" email covers it. Work published yesterday or earlier gets a reminder.
    and private.melbourne_date(a.published_at) < today
  on conflict on constraint email_outbox_once do nothing
$$;

-- pg_cron entry: hourly at :10, acts only in the Melbourne 15:00 hour (ADR-0008 decision 4).
create function private.queue_due_tomorrow_emails()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.is_reminder_hour(now()) then
    return;
  end if;
  perform private.queue_due_tomorrow_emails_for(private.melbourne_date(now()));
end;
$$;

-- cron.schedule replaces a job of the same name. Kill switch (supabase/README.md):
-- select cron.unschedule('due-tomorrow-reminders');
select cron.schedule('due-tomorrow-reminders', '10 * * * *', $$select private.queue_due_tomorrow_emails()$$);
```

Class active, enrolment, online and not-handed-in are all inside `email_recipients`, so the
queue and the claim agree. `[ASSUMPTION]` (02b) a missed 15:10 run has no catch-up.

**Step 7. "Work returned" uses the shared function**

`create or replace function private.queue_work_returned_email()`: body copied from
`20261025110000` lines 149–163; the `from private.work_returned_recipients(new.assignment_id, new.student_id) r`
line becomes `from private.email_recipients('work_returned', new.assignment_id, new.student_id) r`.
The trigger `assignment_results_queue_email` is unchanged.

**Step 8. Claim: supported kinds, deadline, order** (ADR-0008 decisions 2, 5, 6)

```sql
drop function public.notify_claim_emails();

-- supported_kinds: the kinds the calling worker can render. Today's worker calls with no argument
-- and keeps claiming only work_returned, so the migration can land before the function deploy
-- (review-2b finding 1). Reminders first (their deadline is hours away), then oldest first.
create function public.notify_claim_emails(supported_kinds text[] default array['work_returned'])
returns table (
  id uuid, kind text, recipient_role text, email text, recipient_first_name text,
  child_first_name text, assignment_id uuid, student_id uuid,
  assignment_title text, class_name text, due_on date)
```

Body copied from `20261025110000` lines 189–243, with these changes (every column reference
stays table-qualified, because `kind` and `due_on` are now also output names):

1. The skip update calls
   `private.email_recipients(o.kind, o.assignment_id, o.student_id, private.melbourne_date(o.send_before))`
   instead of `work_returned_recipients(...)`. It runs for every pending row, of every kind.
2. The claim's inner select becomes:
   ```sql
   select x.id from public.email_outbox x
   where x.status = 'pending'
     and x.kind = any (supported_kinds)
     and (x.send_before is null or x.send_before > now())
   order by (x.kind = 'due_tomorrow') desc, x.created_at
   limit room
   for update skip locked
   ```
3. The final select returns `c.kind` after `c.id`, and `a.due_on` last; its `order by` becomes
   `(c.kind = 'due_tomorrow') desc, c.created_at`.

The `no_address` update, the advisory lock and the cap are unchanged.

**Step 9. The kick sweeps expired rows** (AC-8.7)

`create or replace function private.kick_email_worker()`: body copied from `20261025110000` lines
299–336, plus, straight after the reclaim update and before the first early return:

```sql
  -- Past their deadline: failed, shown to admins as "Too late to send". Here, not in the worker,
  -- because the kick never calls the worker while the cap is full (02b §8.4).
  update public.email_outbox
  set status = 'failed', reason = 'too_late'
  where status = 'pending' and send_before <= now();
```

**Step 10. Admin list gains the kind** (AC-8.13)

```sql
drop function public.admin_email_problems(int);
create function public.admin_email_problems(max_rows int default 100)
returns table (
  id uuid, created_at timestamptz, kind text, recipient_role text, assignment_title text,
  state text, reason text)
```

Body copied from `20261025110000` lines 365–399; the select list gains `o.kind` after
`o.created_at`. `too_late` comes through as a stored failed reason with no other change.

**Step 11. Drop the old helper and grant**

```sql
drop function private.work_returned_recipients(uuid, uuid);

revoke execute on function
  private.reminder_hour(), private.melbourne_date(timestamptz), private.melbourne_day_start(date),
  private.is_reminder_hour(timestamptz), private.new_assignment_send_before(date, timestamptz),
  private.email_still_relevant(text, uuid, uuid, date),
  private.email_recipients(text, uuid, uuid, date),
  private.queue_new_assignment_emails(),
  private.queue_due_tomorrow_emails_for(date), private.queue_due_tomorrow_emails()
from public, anon, authenticated;

revoke execute on function
  public.notify_claim_emails(text[]), public.admin_email_problems(int)
from public, anon, authenticated;
grant execute on function public.notify_claim_emails(text[]) to service_role;
grant execute on function public.admin_email_problems(int) to authenticated;
```

`trim_history` is unchanged: the new kinds are trimmed after 90 days like the first.

### 8.3 Status machine (additions to 03 §3.3)

```
publish ──trigger──▶ pending(new_assignment, send_before = end of due date | +7 d) ── as 03 §3.3
15:10 Melbourne ──job──▶ pending(due_tomorrow, send_before = start of due date)  ── as 03 §3.3
pending ──kick sweep, send_before <= now()──▶ failed (too_late)
pending ──claim: not relevant any more (draft again, handed in, due date changed, left class,
          switch off)──▶ skipped (not shown to admins)
pending(new kinds) + old worker ──▶ not claimed; Waiting / "Not attempted" after 2 h, then too_late
```

### 8.4 Edge function `notifications`

**`copy.ts`**

```ts
export const EMAIL_KINDS = ['work_returned', 'new_assignment', 'due_tomorrow'] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

export type AssignmentWords = WorkReturnedWords & { dueDate: string }; // '' when there's no due date
```

`COPY` keeps every existing key for `work_returned` (so item 3's tests stay valid) and gains
`newAssignment` and `dueTomorrow` blocks with `subject`, `body` (per role) and `button` (§8.5).
`footerReason` and `footerStop` are shared. `PATHS` is unchanged: both new emails link to the
same assignment pages as "View feedback".

**`template.ts`**

```ts
export type ClaimedRow = { id: string; kind: EmailKind; recipient_role: RecipientRole; email: string;
  recipient_first_name: string; child_first_name: string; assignment_id: string; student_id: string;
  assignment_title: string; class_name: string; due_on: string | null };

/** "Thursday 30 October" from "2026-10-30" (read as a calendar date, never shifted by time zone). */
export function formatDueDate(isoDate: string | null): string;
// new Intl.DateTimeFormat('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
//   .format(new Date(`${isoDate}T00:00:00Z`)); '' for null

export function renderWorkReturned(row: ClaimedRow, siteUrl: string): EmailMessage; // unchanged output
export function renderNewAssignment(row: ClaimedRow, siteUrl: string): EmailMessage;
export function renderDueTomorrow(row: ClaimedRow, siteUrl: string): EmailMessage;
/** Picks the renderer by row.kind. */
export function renderEmail(row: ClaimedRow, siteUrl: string): EmailMessage;
```

The HTML document from `renderHtml` becomes `renderShell({ label, greeting, body, button,
buttonUrl, accountUrl })`, shared by all three (same table, colours and footer). Every value is
still escaped, and every interpolated string still goes through `oneLine`. `viewFeedbackUrl` is
reused for the button link of all three (rename to `assignmentUrl`; `viewFeedbackUrl` stays as an
alias only if a test imports it, otherwise rename the import).

**`index.ts`**: `service.rpc('notify_claim_emails', { supported_kinds: [...EMAIL_KINDS] })`;
`render: (row) => renderEmail(row, siteUrl)`. Header comment updated to "sends queued portal
emails (ADR-0004, ADR-0008)". Nothing else changes (batch loop, gate, statuses).

### 8.5 Email wording (function `copy.ts`)

| Key | Student | Parent |
|---|---|---|
| `newAssignment.subject` | `New work set: ${title}` | `New work for ${child}: ${title}` |
| `newAssignment.body` | `Your tutor has set "${title}" for ${className}.` + (due) ` It's due ${dueDate}.` | `${child}'s tutor has set "${title}" for ${className}.` + (due) ` It's due ${dueDate}.` |
| `newAssignment.button` | `View assignment` | same |
| `dueTomorrow.subject` | `Due tomorrow: ${title}` | `${child}'s work is due tomorrow: ${title}` |
| `dueTomorrow.body` | `"${title}" for ${className} is due tomorrow (${dueDate}) and hasn't been handed in yet.` | `${child}'s "${title}" for ${className} is due tomorrow (${dueDate}) and hasn't been handed in yet.` |
| `dueTomorrow.button` | `View assignment` | same |
| greeting, footer, sender | as item 3 | as item 3 |

No instructions, questions, attachment names, marks or answers (AC-8.2, AC-8.9): the claim
returns none of them. The student email's "child's first name" is the greeting, since the student
is the child (AC-8.2).

### 8.6 Web

`services/types.ts`:

```ts
export type NotificationSettings = { workReturned: boolean; newAssignment: boolean; dueTomorrow: boolean };
export type EmailKind = 'work_returned' | 'new_assignment' | 'due_tomorrow';
export type EmailProblemReason = …existing… | 'too_late';
export type EmailProblem = { id: string; at: string; kind: EmailKind; recipientRole: 'student' | 'parent';
  assignmentTitle: string; state: EmailProblemState; reason: EmailProblemReason };
```

`services/notifications.service.ts`: `DEFAULT_SETTINGS` has all three `true`; select
`'work_returned, new_assignment, due_tomorrow'`; the update-then-insert sends all three columns;
`EmailProblemRow.kind` mapped to `kind`. Signatures unchanged.

`routes/portal/account.tsx` `NotificationsSection`: initial state falls back to
`{ workReturned: true, newAssignment: true, dueTomorrow: true }`; three `FormControlLabel` +
`Switch` rows in this order: `workReturned`, `newAssignment`, `dueTomorrow` (keys: the setting
names), one Save, the existing `saved` status and error alert. Each switch sets only its own
field (AC-8.10).

`routes/portal/admin-emails.tsx`: a **Type** column after When, showing
`describeEmailProblem(problem).type`. The table already sits in a `TableContainer`, which
scrolls sideways at 360 px (AC-8.13).

`lib/email-problems.ts`: `EmailProblemLabels` gains `type: EMAILS_PAGE.kinds[problem.kind]`.

### 8.7 UI states

| Screen | State | What shows | Key |
|---|---|---|---|
| Account → Notifications | Students and parents only | Three switches, on unless turned off | `ACCOUNT_PAGE.notifications.*` |
| | Staff | Section not rendered (unchanged) | — |
| | Load failed | Defaults (all on) shown, as today | — |
| | Saving / saved / error | Button `saving`; `saved`; `FormAlert` | existing keys |
| Admin → Emails | Empty | `EMAILS_PAGE.empty` (unchanged) | |
| | Rows | When, Type, Recipient, Assignment, State, Reason | `EMAILS_PAGE.columns.*`, `.kinds.*` |
| | Load error / not admin | `LoadError` / admin layout guard (unchanged) | |
| Both | 360 px, light/dark | switch rows wrap; table scrolls | — |

### 8.8 Constants (`portal.constants.ts`)

| Key | Text |
|---|---|
| `ACCOUNT_PAGE.notifications.newAssignment` | `Email me when new work is set` |
| `ACCOUNT_PAGE.notifications.dueTomorrow` | `Email me the day before work is due` |
| `EMAILS_PAGE.intro` | `Portal emails that failed, or haven't gone out about 2 hours after they were queued. Sent emails aren't listed.` |
| `EMAILS_PAGE.columns.type` | `Type` |
| `EMAILS_PAGE.kinds` | `work_returned: 'Work returned'`, `new_assignment: 'New assignment'`, `due_tomorrow: 'Due tomorrow'` |
| `EMAILS_PAGE.reasons.too_late` | `Too late to send` |

The comment above `EMAILS_PAGE` ("Reason keys must match the codes admin_email_problems
returns") gains "and kind keys the `email_outbox.kind` values".

### 8.9 Privacy (B17)

Replace item 3's two sentences ("When your child's work is marked and returned, we email you and
your child (if they have their own account). These are service emails; you can turn them off in
Account → Notifications.") with:

**"We email you and your child (if they have their own account) when new work is set, the day before online work is due if it hasn't been handed in yet, and when work is marked and returned. These are service emails; you can turn each one off in Account → Notifications."**

`privacy.test.tsx`: the item 3 test asserts the new text instead (and still "you can turn each
one off in Account → Notifications"). Approval: B17 / Q7 (§13). If item 3's sentence hasn't been
approved by then, Saurabh approves the new one instead.

### 8.10 Test approach per AC

`email_alerts.test.sql` reuses `email_outbox.test.sql`'s fixtures (copy the set-up block: staff,
kid1/3/4/6, parents 1–6, classes c1/c2, settings off for kid6 and parent6) and adds: an online
assignment `o1` (one MCQ), a paper `x1` (`max_mark`), all **drafts**, with due dates set relative
to `private.melbourne_date(now())`. It starts with `delete from public.email_outbox` and deletes
again after set-up. Publishing is done as tutor b1 (`tests.authenticate_as`). The cap is replaced
inside the transaction as item 3's tests do. Time-dependent rows are created with explicit
`send_before`/`created_at` values; nothing waits on the clock.
Hand-made rows must still be relevant, so that the claim's skip step leaves them pending:
- every recipient is still eligible: published assignment, enrolled student, switch on;
- a hand-made `due_tomorrow` row uses an online assignment with `due_on = melbourne_date(send_before)`, not handed in (review-3b round 2).

| AC | How it's tested | Type / file |
|---|---|---|
| 8.1 | pgTAP: b1 publishes o1 → `new_assignment` rows for kid1, parent1 and parent2; none for parent3 (deactivated) or kid6/parent6 (switch off). Add one fixture link, parent2 → Kid Six: parent2 then gets **two** rows, one per child (AC-8.1's "one per recipient per enrolled student"). Paper x1 → the same recipients. An assignment inserted straight as published queues too. Script: b1 publishes a seeded draft via REST, one worker run → Mailpit has the student and parent emails | DB + script |
| 8.2 | Script unit: `formatDueDate('2026-10-30')` = `Friday 30 October` and `formatDueDate(null)` = `''`; `renderNewAssignment` subject and body contain the child's first name, the title, the class name and "It's due Friday 30 October."; with `due_on = null` there's no "It's due"; the button text is "View assignment" and links to the student and parent paths; a fixture instructions string never appears in the html or text (the claim doesn't return it). Browser: open the Mailpit link signed out → sign in → lands on the page | Script + manual |
| 8.3 | pgTAP: publish, back to draft before the claim → `notify_claim_emails(array[all three])` returns no `new_assignment` rows and they end `skipped`, none in `admin_email_problems`; republish → still exactly the original rows (no new ones), **within the 90-day outbox retention, as AC-3.5** (a row trimmed after 90 days can be queued again; known limit §8.12) | DB |
| 8.4 | pgTAP: enrol a new student after publishing → no row for them | DB |
| 8.5 | pgTAP: o1 due tomorrow (Melbourne), published 3 days ago (set `published_at` as superuser); `queue_due_tomorrow_emails_for(today)` → `due_tomorrow` rows for kid1 + parents with `send_before = melbourne_day_start(today + 1)`; with kid1 `in_progress` → still queued; recipients follow the `due_tomorrow` switch. Script: same set-up via SQL, call the function, run the worker → Mailpit reminder | DB + script |
| 8.6 | pgTAP: no due date → none; paper x1 due tomorrow → none; kid1 `submitted` (or `returned`) at queue time → none; submitted **after** queueing → claim skips it; publish-date boundary (o1 due tomorrow, `published_at` set as superuser): published `today - 1` (Melbourne) → **queued**; published `today`, the day before it's due → **not** queued (AC-8.6, §8.2 step 6) | DB |
| 8.7 | pgTAP: a pending `due_tomorrow` row and a pending `new_assignment` row, each with `send_before = now() - interval '1 minute'`: `notify_claim_emails(array[all three])` returns neither; `kick_email_worker()` turns both into `failed` / `too_late`; `admin_email_problems` lists both as failed `too_late`. A pending `work_returned` row (no `send_before`) is untouched. Unit: `email-problems.test.ts` labels `too_late` "Too late to send" | DB + unit |
| 8.8 | pgTAP: queue a reminder, change `due_on` → the claim skips it; run the queue again for the new date's eve → no second row (unique key), **within the 90-day outbox retention, as AC-3.5** | DB |
| 8.9 | Script unit: `renderDueTomorrow` for `due_on = '2026-10-30'` contains the child's first name, the title, the class, `is due tomorrow (Friday 30 October)` and "View assignment"; no instructions or marks | Script |
| 8.10 | `notifications.service.test.ts`: select lists the three columns; no row → all true; save sends all three. pgTAP: kid1 inserts/updates own `new_assignment`, `due_tomorrow`; can't read or change parent1's; tutor refused. Manual: Account → Notifications as student and parent shows three switches, staff sees none; Save shows "Saved…"; sign out/in keeps them | Unit + DB + manual |
| 8.11 | pgTAP: kid2 (roster only), kid3 (invited), kid4 with no active parent, every switch off → publish `lives_ok`, 0 rows; same for `queue_due_tomorrow_emails_for`; `admin_email_problems` empty; tutors, admins, other families never in the outbox | DB |
| 8.12 | pgTAP: with the cap replaced by 0 (all "sent"), publish → `lives_ok`; with the Vault worker secret deleted → `lives_ok`, rows pending. Manual: stop the edge runtime, publish → no error | DB + manual |
| 8.13 | pgTAP: `admin_email_problems` returns `kind` for each kind; no address/body column (`proargnames` check updated); refused for non-admins (unchanged). `email-problems.test.ts`: every kind has a label. Manual: Admin → Emails Type column, empty text unchanged, 360 px light/dark | DB + unit + manual |
| 8.14 | pgTAP, three pending rows with explicit `created_at`: `work_returned` at `now() - 3 h`, `new_assignment` at `now() - 2 h`, `due_tomorrow` at `now() - 1 h`. Cap replaced by 3 → the claim returns `due_tomorrow`, then `work_returned`, then `new_assignment` (reminder first, then oldest first); cap 2 → `due_tomorrow`, `work_returned`; cap 1 → `due_tomorrow` only (each case in its own savepoint, rows reset to pending). `notify_claim_emails()` with no argument returns only `work_returned` rows (old worker compatibility) | DB |
| 8.15 | pgTAP: b2 publishing c1's draft → 0 rows updated, 0 outbox rows; `authenticated` `insert into email_outbox` → 42501; families `select` it → 0 rows/42501; `notify_claim_emails(text[])` not executable by `authenticated` | DB |
| 8.16 | Script: Mailpit messages have `From: hello@ajclasses.com.au` and the header block; wording only in `copy.ts` (review). Release check uses the seeded fake family (§8.11) | Script + review + release |
| 8.17 | Manual: Account → Notifications at 360 px light/dark; both new emails in Mailpit's preview at 360 px | Manual |
| DST and schedule | pgTAP: `is_reminder_hour` true at `2027-04-03 04:10Z` (AEDT) and `2027-04-05 05:10Z` (AEST), false at `2027-04-03 05:10Z` and `2027-04-05 04:10Z`; around 4 Oct 2026, true at `2026-10-03 05:10Z` (AEST) and `2026-10-05 04:10Z` (AEDT), false at `2026-10-03 04:10Z` and `2026-10-05 05:10Z`. `melbourne_day_start('2026-10-05')` = `2026-10-04 13:00Z`, `('2026-10-04')` = `2026-10-03 14:00Z`, `('2027-04-05')` = `2027-04-04 14:00Z`. `cron.job` has `due-tomorrow-reminders` with schedule `10 * * * *` | DB |
| "New assignment" deadline | pgTAP: due date set → `send_before = melbourne_day_start(due + 1)`; no due date → `published_at + 7 days`; published after the due date → no rows queued (no false Failed) | DB |
| Item 7 regression | `fair_results.test.sql`: the AC-7.14 recipient call uses `email_recipients('work_returned', …)`; it stays green, because its outbox counts filter `kind = 'work_returned'` | DB |
| Item 3 regression | `email_outbox.test.sql`: after its fixtures, `delete from public.email_outbox` again (publishing now queues `new_assignment` rows); the `proargnames[1:]` check of `notify_claim_emails`' output names now skips the input `supported_kinds` (compare `proargnames` filtered by `proargmodes = 't'`) and expects `kind` and `due_on` added; the `admin_email_problems` names check expects `kind`; every other item 3 assertion stays green | DB |

`test-notifications.mjs` additions: unit checks for `formatDueDate`, `renderNewAssignment`,
`renderDueTomorrow`, `renderEmail` dispatch (each kind), escaping in the new bodies; e2e: drain as
today (the seed's published work now also queues `new_assignment` rows; the first worker call
sends them to Mailpit and `DELETE /api/v1/messages` clears them), then one new-assignment and one
due-tomorrow round trip. The `$$` and pause/resume rules of 03 §3.10 apply; also pause
`due-tomorrow-reminders` with the same `cron.alter_job` statement so a 15:10 run can't add rows
mid-test.

### 8.11 Release (Saurabh)

0. **Answer 02b Decision 1** (Resend volume and the Pro upgrade trigger). It gates this release
   only.
1. B17: the §8.9 sentence (Q7).
2. **Migration first:** `supabase/scripts/deploy.sh` pushes migrations, then deploys functions, so
   one run keeps the order. If done by hand: `supabase db push`, then
   `supabase functions deploy notifications`, **never the function first** (it would get
   `PGRST202` and stop all email, ADR-0008 decision 6).
3. Expect on the first 15:10 run after deploy: reminders for already-published online work due
   the next day (real families, by design).
4. Release check with the seeded fake family only (AC-3.11 / 03 §3.7): publish one paper
   assignment to the test class → both test inboxes get "New work set" within 5 minutes; set one
   online assignment due tomorrow, published 2+ days earlier, in the test class → after 15:10 both
   get "Due tomorrow"; `/portal/admin/emails` is empty. Delete the test class after.
5. Watch Admin → Emails for "Daily limit" and "Too late to send" for the first fortnight
   (Decision 1's trigger).

### 8.12 Known limits

- At-most-once for "new assignment" and "due tomorrow" holds **within the 90-day outbox
  retention, as AC-3.5**: a republish or re-dated reminder more than 90 days after the first row
  could send one more email.
- A reminder claimed seconds before midnight may be delivered seconds after it (the claim checks
  `send_before`; the send takes up to a few seconds).
- No catch-up for a missed 15:10 run.

---

## 9. Held item 2: what its rebase (T2.15) must carry

When item 2 is rebased onto `develop` for release (expected after items 4–8):

1. **Before renaming,** Saurabh runs `supabase migration list` and confirms `20261025134709` was
   never applied to the hosted project (ADR-0007 decision 4). Then the file is renamed to a fresh
   timestamp later than `20261028100000`.
2. **Rebuild from the current body** (never item 2's snapshot):
   - `student_submit`: keep item 7's `or hold_results` final branch; add item 2's `handin` and
     `no_files` rules;
   - `assignments_for_student` and both wrappers: keep the left join, rule (b) and
     `is_past_class`; add `is_file_handin`;
   - `assignment_view`: keep `isPastClass`; add `isFileHandin` and the files;
   - `can_read_assignment_file`: every family branch uses `assignment_readable_by`, including
     `target_student = my_student_id()` (the student's own hand-in) (review-2b finding 2);
   - `is_online_assignment`: item 2's version. Item 8's `email_still_relevant('due_tomorrow')`
     then covers file hand-in with no change (AC-8.5).
   - item 2's upload, register and remove checks keep `assignment_visible_to`.
3. **Tests to add or keep on the rebased branch:** item 7's `fair_results.test.sql` and item 8's
   `email_alerts.test.sql` stay green; new cases: setting `hold_results` on a file hand-in →
   `hold_needs_questions` (AC-7.2 file half); a removed student reads their returned hand-in's
   files and the tutor's attachments, and can't upload or remove (AC-7.15); publishing a file
   hand-in queues "new assignment" (AC-8.1) and a due-tomorrow file hand-in not handed in queues a
   reminder (AC-8.5). From security review item 7, S3 ([06-security-item-7](06-security-item-7.md)):
   (a) a removed student gets no storage SELECT on a non-returned assignment's files (pgTAP);
   (b) the PO decides whether tutor attachments added after the student's work was returned are
   readable under rule (b); if not, rule (b) file reads cover only objects created before
   `returned_at`; (c) upload, register and remove keep `assignment_visible_to`, each with a pgTAP
   case after removal.
4. **Privacy:** item 2's sentences go into the "Portal accounts" section next to item 4's; its
   `privacy.test.tsx` lookups use `'Portal accounts'`.
5. `email_outbox.test.sql`: item 2's 35-line change is reapplied on top of item 8's version.

---

## 10. Design choices made here (`[ASSUMPTION]`)

1. **Item 4:** the phone sits after Full name; the admin page reuses the "you" hint.
2. **Item 4:** server phone errors show on the field, not as a form alert.
3. **Item 4:** `PRIVACY.lastUpdated` is the build month and is corrected at release if it slips.
4. **Item 5:** the manual CSP sweep uses DevTools request blocking as its network-layer mock;
   item 6 automates it with real mocks.
5. **Item 5:** one committed toolset (`serve-mirror.ts`, `check-hosted-ref.ts`) replaces the
   scratch `jq` mirror and the ad-hoc N-02 grep.
6. **Item 6:** `e2e/` declares `@supabase/supabase-js` at `apps/web`'s range instead of rewriting
   the anon client.
7. **Item 6:** `trace: 'retain-on-failure'` (the old `on-first-retry` never records with
   `retries: 0`).
8. **Item 6:** the CSP sweep runs in the Lighthouse job against the same no-Supabase build.
9. **Item 6:** invite onboarding runs in the smoke unless the 3 recorded runs exceed 15 minutes.
10. **Item 6:** `e2e/` gets typecheck and prettier, not ESLint (it has no React and no app code).
11. **Item 7:** the hold switch saves on change on the assignment page, below the questions.
12. **Item 7:** a stale `hold_results = true` after deleting every question is left as is.
13. **Item 7:** past-class returned work counts in the progress summary.
14. **Item 8:** `email_recipients` takes a fourth, defaulted `queued_due_on` argument (§11).
15. **Item 8:** moving a published assignment to another class doesn't notify the new class.
16. **Item 8:** the "due tomorrow" queue is split into a testable `…_for(today)` function and a
    guarded cron entry.

## 11. Where I differ from the architecture

**No disagreement with any decision.** Two details, inside its intent:

1. **`email_recipients` has a fourth argument**, `queued_due_on date default null`. 02b §8.2 says
   the reminder is re-checked against "the date the row was queued for, worked out from
   `send_before`", but its three-argument signature has nowhere to pass it. The claim passes
   `melbourne_date(o.send_before)`; the queue passes `today + 1`; other kinds ignore it.
2. **The relevance check is its own function** (`email_still_relevant`), called by
   `email_recipients`, so each kind's condition reads as one `case` arm.

Nothing goes back to the Architect.

## 12. Known limits (deferred, named)

- Item 4: no verification of a changed number (01b Later).
- Item 5: inline scripts run (`'unsafe-inline'`); hash-based `script-src` is Later (ADR-0005).
- Item 6: E2E covers the dev build; the production build is covered by Lighthouse and the CSP
  sweep. A Cloudflare outage can fail the sign-in spec.
- Item 7: removing a student no longer revokes their returned work (02b §7.4 risk 1; Security
  notes it).
- Item 8: §8.12.

## 13. Questions only Saurabh can answer (none block the build)

1. `[TBC: B17 / Q7 – Saurabh]` Privacy wording batch, now: item 2's sentences (03 §2.8), item 3's
   (03 §3.8, replaced by item 8's §8.9 if item 8 ships before approval), **item 4's §4.6 sentence
   and the heading "Portal accounts"**, and **item 8's §8.9 sentence**.
2. `[TBC: 02b Decision 1 – Saurabh]` Resend volume rule. Gates item 8's release only.
3. `[TBC: item 4, 7, 8 hosted migration deploys and item 8's function deploy – Saurabh]` (§4.8,
   §7.8, §8.11).
4. `[TBC: optional required status checks in GitHub – Saurabh]` (§6.11).
5. `[TBC: item 5 preview header check behind Vercel's login – Saurabh]` (§5.8 step 1).

## 14. Product Owner confirmations (confirmed)

All three were **confirmed by the PO on 26 Oct 2026** (`283d5c6`) and are now in 01b: items 1–2
in AC-8.4, item 3 in AC-6.9. They're built as stated.

1. **Item 8: "new assignment" emails expire** (02b §8.4, ADR-0008 decision 2). *Confirmed:* kept
   the Architect's rule. An unsent "new assignment" email may go out until the **end of the due
   date** (midnight Melbourne at the start of the next day), or until **7 days after publishing**
   when there's no due date. After that it shows on Admin → Emails as Failed, "Too late to send".
   *Why:* under the 70-a-day cap, a "new work set" email arriving after the work was due is
   noise; reminders go first and stay on time.
2. **Item 8: nothing is queued already expired.** *Confirmed:* kept. Work published **after**
   its due date has passed gets no "new assignment" email at all (no row, so no false Failed row).
   Work published **on** its due date still gets one that day.
3. **Item 6: `sameAs` links** in the home page JSON-LD point to social profiles, so the "every URL
   starts `https://ajclasses.com.au`" rule (AC-6.9) applies to `url`, `item`, `logo`, `image` and
   `@id`; `sameAs` only has to be an absolute `https://` URL. *Confirmed:* this reading; the
   alternative fails the check on the business's own Facebook link.

Items 1–2 are already in AC-8.4 and item 3 in AC-6.9 (01b change log, 26 Oct 2026), so the
design and the requirement now agree.

## 15. Self gap review (before handing to the Reviewer)

| Check | Result |
|---|---|
| Every AC 4.1–4.10, 5.1–5.11, 6.1–6.14, 7.1–7.17, 8.1–8.17 has a test or a named check | Yes: §4.7, §5.7, §6.10, §7.7, §8.10. AC-7.15 and the file half of 7.2 are moved to T2.15 (§9), as 01b allows |
| No test, gate or CI run requests the hosted project | §0.3; `check:hosted-ref` on builds, workflow and `e2e/`; block-and-count; LHR check |
| New SQL functions: `search_path = ''`, revokes, explicit grants | §4.2 step 5, §7.2 step 8, §8.2 step 11 |
| Signature changes: drop, recreate, re-grant | `assignments_for_student` + wrappers (§7.2 step 5), `notify_claim_emails`, `admin_email_problems` (§8.2 steps 8, 10) |
| Shared functions rebuilt from named current bodies | §4.2 step 4, §7.2 steps 4–7, §8.2 steps 7–10 (file and lines given) |
| Deploy order safe either way the migration lands | `supported_kinds` default; release steps say migration first |
| No phone exposed anywhere new | §4.7 AC-4.8; no public/family read of `profiles.phone` |
| KINET rules: services-only HTTP, constants, no inline styles, no `any`, keys, no `console.log`, TODO format | §0.2; new components use MUI `sx`; scripts use type guards |
| Every changed behaviour has a test | Each file list pairs code with its test file |
| Existing tests that the changes break are named | `hosting-config.test.ts` (item 5), `privacy.test.tsx` (items 4, 8), `email_outbox.test.sql` (item 8), item 7's `fair_results.test.sql` under item 8 (one call renamed; outbox counts filtered by kind from the start), `auth-errors.test.ts` (items 4, 7), `notifications.service.test.ts`, `email-problems.test.ts` (item 8) |

## Change log

| Date | Change | Why |
|---|---|---|
| 26 Oct 2026 | First version, items 4–8 | /deliver stage 3 for 01b and 02b |
| 26 Oct 2026 | Revised after [review-3b](review-3b-items-4-8.md) round 1 (findings 1–11); §14 marked confirmed | See below; PO confirmations in 01b (`283d5c6`) |
| 26 Oct 2026 | §4.6 Privacy sentence and §4.7 AC-4.9 phrases: "given at account setup or added later on My profile" and "only they and AJ Classes admins can see it". `[ASSUMPTION]` still pending Saurabh's B17 / Q7 approval | [06-security-item-4](06-security-item-4.md) S3: some staff add their number after setup, and staff can see their own number |

**Review-3b changes (26 Oct 2026):**
1. **CSP sweep loads without the E2E env** (§6.1 rows 5, 10, 10a; §6.4; §6.5): the guard moves to `e2e/src/fixtures/hosted-guard.ts` (imports only `@playwright/test`); `test-fixtures.ts` extends it; the CSP spec imports only it and `src/mocks/*`; nothing on the CSP config path imports `src/config.ts`.
2. **AC-8.6 boundary** (§8.2 step 6 comment, §8.10): published `today - 1` is queued, published `today` isn't.
3. **Item 7's test under item 8** (§7.7, §8.1 row 3a, §8.10, §15): `fair_results.test.sql` filters outbox assertions by `kind = 'work_returned'` from the start; item 8 renames its one `work_returned_recipients` call to `email_recipients('work_returned', …)`.
4. **Unlink codes per RPC** (§7.6, §7.7 AC-7.13): `parent_child_assignments` P0002 (`require_my_child`, ITEM3-FU-1); `parent_child_assignment` 42501.
5. **AC-7.7 row** added (§7.7); AC-7.16's row now covers the chip only.
6. **Lighthouse build env** (§6.8): `VITE_FORM_ACCESS_KEY: local-placeholder`, `VITE_KIT_FORM_ID: '0000000'`, so the sweep runs the enquiry and subscribe code.
7. **AC-8.14 order** (§8.10): explicit `created_at` values, three-row case with `new_assignment` third.
8. **AC-8.7 expiry** (§8.10): a `new_assignment` row past `send_before` is swept to `too_late` too.
9. **October DST false cases** (§8.10): `2026-10-03 04:10Z` and `2026-10-05 05:10Z`.
10. **e2e types** (§6 intro): `e2e/` declares `@types/node` at `apps/web`'s range.
11. **Text** (§4.5, §8.2 step 9, §14): `JOIN_PAGE` line 213; `kick_email_worker` body lines 299–336; §14's closing line says the items are already in AC-8.4 and AC-6.9.
