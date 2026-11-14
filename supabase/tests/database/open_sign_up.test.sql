-- Open sign-up (ADR-0011, docs/delivery/2026-11-13-open-sign-up/03-design.md §3, §10 pgTAP-OS):
-- the user role, role mapping, the before-user-created hook, the linking and wipe triggers, the
-- finish step, the sign-up switch, the guards in existing functions, listing and promotion.

begin;
select no_plan();
select tests.remove_all_accounts();

-- #1 The user role exists
select ok('user' = any (enum_range(null::public.app_role)::text[]), 'public.app_role has the user value');

select * from finish();
rollback;
