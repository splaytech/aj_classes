# Owner decisions reminder — for Saurabh

These are your own decisions (go-live.md §6), not Ajay's — nothing here needs the client.

1. Read the Privacy Policy's portal and enquiry wording before inviting any families.
   Good practice — do this before sending the first family invite.

2. Confirm `+61 469 800 685` is the right WhatsApp Business number (see whatsapp-button.md).
   Good practice — quick sanity check before go-live.

3. Move the Supabase project to the Pro plan before real family data goes in (no pausing,
   daily backups). Blocking — this is a real-data-safety item; don't put live family data
   on the free plan.

4. Staging and prod share one database. This isn't a one-time action — it's an ongoing
   rule: always test with clearly fake names, and delete test accounts and enquiries
   afterwards, every time.

5. Send the developer the Zoho Invoice customer-portal address. Blocking for one feature —
   until this is sent, parents won't see "Fees and invoices" on their home page.

Bottom line: #3 and #5 block real use (data safety and a visible feature); #1 and #2 are
quick pre-launch checks; #4 is a standing habit, not a checkbox.
