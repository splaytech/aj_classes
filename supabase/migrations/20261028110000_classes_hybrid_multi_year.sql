-- Hybrid delivery and several year levels per class (docs/delivery/2026-10-28-hybrid-class-multi-year,
-- ADR-0009). `year_levels` is the only writable year field; `year_level` is a read-only compat
-- column for the shipped mobile build (aj_classes_mobile tutor_repo.dart:21).

-- ---------------------------------------------------------------------------
-- 1. Year levels array with its shape check
-- ---------------------------------------------------------------------------

-- `<@` limits values to 2–12 and also rejects null elements.
-- array_ndims rejects {{7,8}}.
-- array_lower = 1 rejects [0:0]={7}, which would otherwise give a null year_level.
-- For '{}' both functions return null, so the check passes: do not wrap them in coalesce.
alter table public.classes
  add column year_levels smallint[] not null default '{}',
  add constraint classes_year_levels_valid check (
    year_levels <@ '{2,3,4,5,6,7,8,9,10,11,12}'::smallint[]
    and array_ndims(year_levels) = 1
    and array_lower(year_levels, 1) = 1
  );

-- ---------------------------------------------------------------------------
-- 2. Backfill, keeping updated_at
-- ---------------------------------------------------------------------------

-- updated_at should still show when an admin last edited the class, not when this ran.
alter table public.classes disable trigger classes_set_updated_at;
update public.classes
  set year_levels = case when year_level is null then '{}' else array[year_level] end;
alter table public.classes enable trigger classes_set_updated_at;

-- ---------------------------------------------------------------------------
-- 3. Drop the old column (also drops classes_year_level_check and its column grants)
-- ---------------------------------------------------------------------------

alter table public.classes drop column year_level;

-- ---------------------------------------------------------------------------
-- 4. Re-add year_level as a generated compat column
-- ---------------------------------------------------------------------------

-- Readable through the table-level select grant. Nothing is granted to write it, and Postgres
-- rejects a non-default write to a generated column anyway (428C9).
alter table public.classes
  add column year_level smallint
    generated always as (case when cardinality(year_levels) = 1 then year_levels[1] end) stored;

-- ---------------------------------------------------------------------------
-- 5. Grants
-- ---------------------------------------------------------------------------

-- RLS ("Admins add classes", "Admins change classes") still limits rows to admins.
grant insert (year_levels), update (year_levels) on public.classes to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Order guard (after the backfill)
-- ---------------------------------------------------------------------------

-- Rejects repeats and out-of-order years so each set has one stored form (DEC-HM-1).
-- A trigger, not a CHECK: a CHECK calling a private function needs execute for authenticated.
create function private.check_class_year_levels()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  year_value smallint;
  previous_value smallint;
begin
  -- Let NOT NULL report a null array (23502), not foreach (22004).
  if new.year_levels is null then
    return new;
  end if;
  foreach year_value in array new.year_levels loop
    if previous_value is not null and year_value <= previous_value then
      raise exception using errcode = 'check_violation', message = 'invalid_year_levels';
    end if;
    previous_value := year_value;
  end loop;
  return new;
end;
$$;

create trigger classes_check_year_levels
  before insert or update of year_levels on public.classes
  for each row execute function private.check_class_year_levels();

revoke execute on function private.check_class_year_levels() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Delivery check gains hybrid
-- ---------------------------------------------------------------------------

alter table public.classes
  drop constraint classes_delivery_check,
  add constraint classes_delivery_check check (delivery in ('in_person', 'online', 'hybrid'));

-- ---------------------------------------------------------------------------
-- 8. Comments
-- ---------------------------------------------------------------------------

comment on column public.classes.year_levels is
  'Year levels the class is for, strictly ascending, 2–12. Empty = Any year.';
comment on column public.classes.year_level is
  'Read-only compat for mobile builds that select year_level: the year when exactly one is set, '
  'else null. Drop once mobile reads year_levels (requirement D3).';
