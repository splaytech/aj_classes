-- R3b Student & parent portal: two new account roles.
-- Kept in its own migration because Postgres can't use a new enum value inside the transaction
-- that adds it, and the next migration uses them. Design: docs/requirements/release-3/r3b/design.md §3.

alter type public.app_role add value if not exists 'student';
alter type public.app_role add value if not exists 'parent';
