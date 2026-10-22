-- Enquiries now go to Zoho CRM as leads instead of Zoho Bigin (owner decision, 23 Oct 2026;
-- leads-and-crm.md). One Zoho record per enquiry: the lead. No pipeline record any more.

alter table public.enquiries rename column crm_contact_id to crm_lead_id;
alter table public.enquiries drop column crm_deal_id;

comment on table public.enquiries is
  'Website enquiries (leads-and-crm.md). Written only by the leads edge function, which sends each to Zoho CRM as a lead; admins read and delete.';
