APPROVED

# Review 5 — item 4 diff

**Scope:** `git diff develop...HEAD -- . ':!docs/delivery'`. App commits: 2d418fe, 4a0a417, c7b3921, 9f625b8, d6d4d85, and the notes in cf8da23.

**Checked against:**
- 01b AC-4.1–4.10;
- 02b §4;
- 03b §4.1–4.8;
- 04b T4.0–T4.10;
- dev notes D1–D6;
- the CLAUDE.md rules.

**Ran (read-only):**
- 4 affected vitest files: 38/38 pass.
- typecheck and lint: clean.
- `db:test`: not run. Its result is taken from the dev notes: 14 files, 501 tests.

## Blocking

None.

## Verified

- **Migration:** matches 03b §4.2.
  - Only `update (phone)` is granted.
  - The trigger is `security definer` with `search_path = ''`, and its execute right is revoked.
  - Blank handling: `nullif(trim())` runs before the no-change check.
  - Errors: clearing a saved number gives `phone_required`; a phone on a family profile gives `invalid_input`.
  - A reformatted entry of the same number writes no audit row.
  - The audit records field names only, and the `phone` line is added to both lists.
  - `updated_at` is set.
  - Onboarding is unaffected.
- **pgTAP:** covers every row of the 03b §4.7 matrix, plus D4.
- **UI:**
  - The field has `type`, `inputMode` and `autoComplete` set to `tel`, with `aria-describedby`.
  - `phone_required` maps to `phoneRequired`.
  - Other errors still go to `FormAlert`.
  - The phone saves in the same PATCH as the other fields.
  - `getProfile` now selects `phone`.
- **Repo rules:** no inline styles, no `any`, no TODOs.
- **PRIVACY:** the heading and sentence match 03b §4.6 word for word.
- **Deviations D1–D6:** all accepted.

## Nits (non-blocking)

1. `ProfileForm.test.tsx:255` asserts `PORTAL_ERRORS.phoneRequired`, but the browser path shows `PROFILE_VALIDATION.phoneRequired`. Assert the latter.
2. `error.constants.ts:90/:120` repeats the `phoneRequired` sentence. Optionally define it once.
3. Info: the branch also carries ADRs 0005–0008 from the architecture stage, as expected.
4. Info: O1 (scroll to the first bad field, already on `develop`) and O2 (hint wraps at 360 px) are for a ticket or the PO.
