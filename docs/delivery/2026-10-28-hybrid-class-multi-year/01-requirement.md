# 01 — Requirement: hybrid classes and multiple year levels

Stage 1 (Product Owner) of `/deliver`. Branch `feature/hybrid-class-multi-year`. Date 2026-10-28.

Saurabh's ask: "in the website add option of a hybrid class which is both in person and online. also let tutor select multiple years for a class - make it a multi select drop down."

## What exists today (checked in the repo)

1. Classes are created and edited in the staff portal through `apps/web/src/components/portal/ClassDialog.tsx` (New class / Edit class).
2. `public.classes.delivery` allows only `in_person` and `online`. `public.classes.year_level` is one nullable number from 2 to 12. A null value means "Any year" (`supabase/migrations/20261007061232_classes_timetable_assignments.sql`).
3. Only admins can add or change classes. The RLS policies are "Admins add classes" and "Admins change classes". Tutors can only read their own active classes.
4. Location is optional for every delivery type and can be up to 100 characters. The hint reads "Room, or the online meeting place (e.g. Zoom)." (`CLASS_DIALOG.hints.location`).
5. Labels in `apps/web/src/constants/portal.constants.ts`:
   - `DELIVERY_LABELS` = `In person`, `Online`
   - `YEAR_LEVEL_TEXT.label` = `Year ${n}`, `YEAR_LEVEL_TEXT.any` = `Any year`
   - `DELIVERY_WITH_LOCATION` = `${delivery} · ${location}`
6. Where a class's year is shown (via `classYearLabel` in `apps/web/src/lib/labels.ts`): the Classes list Year column (`routes/portal/classes.tsx`) and the chip on the class detail header (`routes/portal/class-detail.tsx`).
7. Where delivery is shown (via `deliveryLabel`): the class detail header chip and its Delivery fact (`class-detail.tsx`), and `WeekTimetable.tsx`. `WeekTimetable` is used by the staff timetable, the student timetable and the parent child page, so families see delivery too. The family timetable data comes from the SQL functions in `20261007090321_family_functions.sql`, which return `delivery` as text.
8. The Classes list has no filtering or sorting by year or delivery.
9. The public marketing pages (`programmes.constants.ts`, `programme.tsx`) do not read class rows. Their "or online" copy is static.
10. The mobile app (`aj_classes_mobile`, a separate repo) reads `classes.year_level` directly and shows `Year N` in `admin_classes_body.dart`, `tutor_classes_body.dart` and `tutor_class_screen.dart`. It also reads `delivery` in `timetable_session.dart`.

## Assumptions

- [ASSUMPTION A1] "In the website" means the staff/family portal in `apps/web`. It does not mean the public marketing pages, which show no class data.
- [ASSUMPTION A2] "Let tutor select" means the person filling in the class form. Today that can only be an admin. This work does not give tutors the right to create or edit classes. If Saurabh wants tutors to edit classes, that is a separate permission change (see Deferred D1).
- [ASSUMPTION A3] Hybrid uses the same location rule as the other types: optional, up to 100 characters. Today nothing is required for in-person classes either, so a required rule just for hybrid would be inconsistent. Only the hint text changes so it covers hybrid.
- [ASSUMPTION A4] Choosing no years is still allowed and shows as `Any year` (as today, for classes like UCAT and GAMSAT). Choosing any set of years from 2 to 12 is allowed, including years that are not next to each other.
- [ASSUMPTION A5] Each existing class keeps its current setting: one year becomes a set with that one year, and null stays `Any year`. No existing class becomes hybrid.
- [ASSUMPTION A6] The mobile app must keep working after this change without a mobile release. A class with more than one year may show a reduced view on mobile (for example, only the lowest year, or no year), but it must not crash or show an error. How to do this is the Architect's decision. Full multi-year and hybrid display on mobile is deferred (D3).

## User stories

**US1 — Hybrid delivery.** As an admin setting up a class, I want to mark it Hybrid (in person and online at the same time), so that students, parents and tutors can see that either way of attending works.

**US2 — Several year levels.** As an admin setting up a class, I want to pick several year levels from a multi-select dropdown, so that a class such as a mixed Years 7–9 group shows the right years.

**US3 — See it everywhere.** As a tutor, student or parent, I want the class's delivery and years to show the same way on every portal screen, so that I know who the class is for and how to attend.

## Acceptance criteria

### Hybrid delivery (US1, US3)

1. The Delivery dropdown in the New class dialog has three options in this order: `In person`, `Online`, `Hybrid`.
2. The Delivery dropdown in the Edit class dialog has the same three options. When an existing hybrid class is opened, `Hybrid` is selected.
3. When you save a new class with Hybrid selected and then reopen it, `Hybrid` is still selected. The same is true after editing a class from In person or Online to Hybrid, and after editing it from Hybrid back to either of them.
4. The hybrid label is `Hybrid`, added to `DELIVERY_LABELS` in `portal.constants.ts`. No hard-coded string goes in components.
5. For a Hybrid class, Location is optional (up to 100 characters), as for the other types. Over 100 characters shows the existing error `Please keep the location under 100 characters.` and the class is not saved.
6. The Location hint is updated so it also fits hybrid, for example `Room, the online meeting place (e.g. Zoom), or both for hybrid.`. It stays in `CLASS_DIALOG.hints.location`.
7. A Hybrid class shows `Hybrid` in each of these places:
   - the class detail header chip
   - the class detail Delivery fact (`Hybrid · <location>` when there is a location, otherwise `Hybrid`)
   - the staff timetable
   - the student timetable
   - the parent child page timetable
8. The database rejects any delivery value other than `in_person`, `online` and `hybrid`. Tester checks this with a pgTAP test.

### Multiple year levels (US2, US3)

9. In both New class and Edit class, the Year level field is a multi-select dropdown listing Year 2 to Year 12 in ascending order. You can tick and untick any number of years.
10. With no years ticked, the field shows `Any year` and the class saves with no year levels.
11. When you save a class with a set of years and reopen Edit, exactly those years are ticked. This includes years that are not next to each other.
12. Opening Edit on a class that existed before this change shows its one year ticked, or no years ticked if it was `Any year`. Saving it without changes leaves the years as they were.
13. Display format, used on every screen that shows a class's year, with years always sorted ascending whatever order they were ticked in:
    - no years: `Any year`
    - one year: `Year 8`
    - an unbroken run of three or more years: `Years 7–9` (en dash)
    - two years next to each other: `Years 7, 8`
    - years not next to each other: `Years 7, 9, 11`
    - a mix of the two: `Years 7–9, 11`
14. The formatted years show in the Classes list Year column and in the class detail header chip. Both use one label function in `apps/web/src/lib/labels.ts`, and its text comes from `YEAR_LEVEL_TEXT` in `portal.constants.ts`.
15. The database rejects any year outside 2 to 12 and any repeated year within a class. Tester checks this with a pgTAP test.
16. Student year levels do not change. Student fields still hold one year or "Other": the join form, student dialog, student lists, the enrol picker, result cards, and the parent home and child pages.

### Both

17. Permissions stay as they are. Admins can create and edit classes, including delivery and years. A tutor cannot create or edit a class, and the existing `classes_rls` tests still pass.
18. The mobile app does not crash and shows no error on admin and tutor class screens, or on the student timetable, when it reads a hybrid or multi-year class (A6). Tester checks this against local Supabase with the current mobile build, or else by reviewing what the API returns compared with what the mobile parsers expect.
19. A co-located unit test (`apps/web/src/lib/labels.test.ts`) covers each case in AC 13. The repo's full checks pass: format, lint, typecheck, test, build and the pgTAP tests.

## Scope

**In v1:** AC 1–19, on the portal web app plus any database migration they need. Migration and data-preserving design are the Architect's call.

**Deferred (later release bucket):**

- D1. Letting tutors create or edit their own classes. This is a permission change, so Saurabh decides. See A2.
- D2. Filtering or sorting the Classes list by year or delivery. None exists today.
- D3. Mobile app showing `Hybrid` and multi-year labels to match the web. This needs a mobile release in `aj_classes_mobile`.
- D4. Separate in-person and online locations for hybrid classes (two fields). For now one Location field holds both.
- D5. Matching students to classes by year, for example warning when a Year 5 student is enrolled in a Years 7–9 class.
- D6. Public marketing pages mentioning hybrid classes. Any copy needs Saurabh to confirm that hybrid is actually offered.

## Amendments from review-1 (folded in by team lead)

- **A6 (amended):** the current mobile build selects `classes.year_level` by name (`aj_classes_mobile/lib/features/tutor/data/tutor_repo.dart:21`) for the admin and tutor class lists. A **numeric `year_level` column must stay readable** by that build. Dropping it, renaming it or changing its type would break both lists. `tutor_class_screen.dart:112` reads the student's year, not the class's, and is not affected.
- **AC 7 (amended):** every timetable bullet means "Hybrid, with the location when one is set" (e.g. `Hybrid · <location>`).
- **AC 18 (amended):** run the mobile app against local Supabase where possible, and record in the TSR whether it was run or only checked by code review.
