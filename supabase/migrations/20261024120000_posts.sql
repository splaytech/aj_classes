-- Admin daily posts (posts.md): a short title + body an admin publishes, shown newest-first to
-- every website visitor. Only admins (two-step) write; anyone, signed in or not, may read.

create table public.posts (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(), -- publish time; also the ordering key
  updated_at timestamptz not null default now(),
  title      text not null check (char_length(title) between 1 and 120),
  body       text not null check (char_length(body) between 1 and 5000), -- plain text, rendered escaped
  author_id  uuid references auth.users (id) on delete set null
);

create index posts_created_idx on public.posts (created_at desc);

comment on table public.posts is
  'Admin daily posts (posts.md). Admins (two-step) write; anyone may read.';

revoke all on public.posts from anon, authenticated;
grant select on public.posts to anon; -- public read, the new path
grant select, insert, update, delete on public.posts to authenticated; -- gated by RLS below

alter table public.posts enable row level security;

create policy "Anyone reads posts"
  on public.posts for select to anon, authenticated
  using (true);

create policy "Admins insert posts"
  on public.posts for insert to authenticated
  with check ((select private.is_admin()));

create policy "Admins update posts"
  on public.posts for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "Admins delete posts"
  on public.posts for delete to authenticated
  using ((select private.is_admin()));
