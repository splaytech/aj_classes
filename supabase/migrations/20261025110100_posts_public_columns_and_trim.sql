-- Posts hardening deferred from item 1 (delivery 2026-10-25, 04-plan §7 item 5; item 1 security
-- review finding 1 and dev notes §7).
--   1. Visitors read only the columns the public site shows, never author_id. The public client
--      already asks for just these (PUBLIC_POST_COLUMNS).
--   2. A title or body of only spaces or line breaks is refused by the database too, not just by
--      the admin page. The raw length cap stays, so padding can't store an over-long value.

revoke select on public.posts from anon;
grant select (id, created_at, updated_at, title, body) on public.posts to anon;

-- E' \t\n\r': the whitespace the admin page's trim() removes, so both refuse the same values.
alter table public.posts
  drop constraint posts_title_check,
  add constraint posts_title_check
    check (char_length(btrim(title, E' \t\n\r')) >= 1 and char_length(title) <= 120),
  drop constraint posts_body_check,
  add constraint posts_body_check
    check (char_length(btrim(body, E' \t\n\r')) >= 1 and char_length(body) <= 5000);
