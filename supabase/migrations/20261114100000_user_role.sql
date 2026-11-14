-- Open sign-up (ADR-0011): a new account role for people who sign up on the website.
-- Kept in its own migration because Postgres can't use a new enum value inside the transaction
-- that adds it, and the next migration uses it (precedent: 20261007090319_family_roles.sql).
-- Design: docs/delivery/2026-11-13-open-sign-up/03-design.md §3.

alter type public.app_role add value if not exists 'user';
