# review-1 — Stage 1 (Requirement) gate

APPROVED

Scope matches the one-liner: hybrid delivery and multi-select year are both covered, with nothing dropped or added. Each AC is numbered and testable. A1–A5 hold against the code. V1 and deferred (D1–D6) are clearly split.

Verified: admin-only insert and update RLS on classes (migration 20261007061232 lines 364–378); the delivery and year_level constraints (lines 33–34); classYearLabel used at classes.tsx:112 and class-detail.tsx:116; deliveryLabel used at class-detail.tsx:117 and 188 and WeekTimetable.tsx:117.

## Findings

1. Non-blocking: item 10 is partly wrong. tutor_class_screen.dart:112 reads the student's year_level, not the class's. The real limit is aj_classes_mobile tutor_repo.dart:21, whose select names `year_level` explicitly; dropping or renaming it breaks the admin and tutor class lists. An array would display "Year [7, 8, 9]" (admin_classes_body.dart:57). A6 should state that a numeric `year_level` must stay readable by the current mobile build.
2. Non-blocking: AC 18's fallback (comparing the API output to the parsers) is weaker than running the app. Prefer running the mobile app against local Supabase, and record in the TSR which method was used.
3. Non-blocking: AC 7's timetable bullets should add "with location when set" (WeekTimetable.tsx:117 shows `Hybrid · <location>`).
4. Non-blocking: AC 13 shows two consecutive years as `Years 7, 8`, not `Years 7–8`. Fine unless Saurabh objects.
5. Non-blocking, Developer note: update the hand-written `Delivery` type (services/types.ts:207) and the generated database.types.ts.
