-- Website enquiries, saved before they're sent to Zoho Bigin (leads-and-crm.md §2).
-- Only the `leads` edge function (secret key) writes; admins with two-step read and delete.

create table public.enquiries (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  name           text not null check (char_length(name) between 2 and 100),
  email          text not null check (char_length(email) between 3 and 254 and email like '%_@_%'),
  phone          text check (phone is null or char_length(phone) <= 30),
  message        text check (message is null or char_length(message) <= 2000),
  wants_updates  boolean not null default false,
  crm_status     text not null default 'pending'
                   check (crm_status in ('pending', 'synced', 'failed', 'off')),
  crm_contact_id text,
  crm_deal_id    text,
  crm_error      text check (crm_error is null or char_length(crm_error) <= 500),
  crm_synced_at  timestamptz
);

create index enquiries_created_idx on public.enquiries (created_at desc);

comment on table public.enquiries is
  'Website enquiries (leads-and-crm.md). Written only by the leads edge function; admins read and delete.';

-- Rate limit for the public form: a salted hash of the sender's address, kept for an hour.
create table public.enquiry_rate_limits (
  ip_hash    text not null check (char_length(ip_hash) = 64),
  created_at timestamptz not null default now()
);

create index enquiry_rate_limits_idx on public.enquiry_rate_limits (ip_hash, created_at);

comment on table public.enquiry_rate_limits is
  'Recent enquiry senders as salted hashes, for rate limiting only. Rows older than an hour are deleted.';

revoke all on public.enquiries, public.enquiry_rate_limits from anon, authenticated;
grant select, delete on public.enquiries to authenticated; -- RLS: admins only

alter table public.enquiries enable row level security;
alter table public.enquiry_rate_limits enable row level security; -- no policies: secret key only

create policy "Admins read enquiries"
  on public.enquiries for select to authenticated
  using ((select private.is_admin()));

create policy "Admins delete enquiries"
  on public.enquiries for delete to authenticated
  using ((select private.is_admin()));
