# review-2 — Stage 2 (Architecture) gate

APPROVED

The change is additive and keeps existing data, consistent with 01 and its amended A6 (the shipped mobile build can still read a numeric `year_level`). Checked against aj_classes and aj_classes_mobile.

Verified:
- (a) Nothing depends on classes.year_level: no views, policies or functions use it, and the only index is on tutor_id. Every other hit is the student's year_level, except seed.sql:104-116, which 02 already flags. PG 17 computes stored generated columns after BEFORE triggers.
- (b) Mobile: tutor_repo.dart:21 selects by name; admin_classes_body.dart and tutor_classes_body.dart show the year only when it is not null, so a null for multi-year classes is safe. delivery is parsed as String? and never shown. Mobile never writes to classes.
- (c) Grants: dropping the column removes its column grants; the table-level select covers the new columns; a stale tab sending year_level gets 42501 and nothing is written.
- (d) A trigger is right over a CHECK, because a CHECK would need execute on a private function (precedent: check_profile_phone).
- (e) Delivery values are listed only in types.ts:207, ClassDialog.tsx:23 and portal.constants.ts:706.
- (f) Nothing needs Saurabh.

## Findings

1. Non-blocking: add `revoke execute on function private.<guard>() from public, anon, authenticated;` for the new trigger function (pattern: staff_phone_edit.sql:118).
2. Non-blocking: keep the `array_ndims(...) = 1` check without coalesce, so an empty array is allowed. Add `array_lower(year_levels,1) = 1` (or reject in the guard) so `[0:0]={7}` cannot silently produce a null year_level. A separate no-nulls clause is optional, since `<@` already rejects NULL elements.
3. Non-blocking: keep migration steps 1–6 in the written order: backfill before the drop, and the guard trigger after the backfill.
4. Non-blocking: the impact table misses ClassInput.yearLevel (types.ts), the class-validation.test.ts:12 fixture and the ClassDialog.tsx defaults at :39 and :53.
5. Non-blocking: move the ordered `DELIVERIES` list into constants next to DELIVERY_LABELS (no magic strings).
6. Non-blocking: keep the untracked actionItems.md out of this branch's commits.
