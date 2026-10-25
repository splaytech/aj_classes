# ADR-0003: Assignment files use a private bucket, a metadata table and upload-then-register

- **Status:** Proposed (2026-10-25, Architect, `/deliver` pending-requirements Stage 2; becomes Accepted when the stage is approved)
- **Source:** `docs/delivery/2026-10-25-pending-requirements/02-architecture.md` §2.2–2.3

## Context

Tutors attach files to assignments, and students hand in photos and PDFs (R3-03, R3-04). Limits
(5 files, images ≤ 2 MB after compression, other files ≤ 10 MB, 20 MB in total) must hold even
when the browser is bypassed. Visibility depends on the result status (AC-2.7). No file may have
a public URL.

## Decision

1. One private bucket, `assignment-files`: 10 MB per-file cap; MIME types PDF, DOCX, JPEG, PNG
   and WebP. Paths:
   - `{assignment}/attachments/{file}`
   - `{assignment}/submissions/{student}/{file}`
2. `public.assignment_files` holds the metadata and is the source of truth. Families write only
   through security-definer RPCs.
3. **Upload, then register:** the register RPC reads the real size and the **declared** MIME type
   from `storage.objects` (Storage doesn't sniff content). It enforces count, size and status,
   and moves the work to In progress. Unregistered uploads are visible only to the uploader.
   - The INSERT policy refuses a sixth object in any folder, registered or not. That's at most
     50 MB per student per assignment.
   - A sweep of unregistered uploads is deferred.
4. Storage policies call `private.*` functions. There is no UPDATE policy. Submitted files can't
   be deleted by anyone through the API.
5. Signed URLs last **60 s**, are created on Download click, and use the `download` option.
6. Deleting an assignment goes through the edge function `assignment-files`
   (`delete-assignment`): the caller's RLS check, then a list of every object under the
   `{assignment}/` prefix, then the cascade delete, then removal with the service key (retried
   once). Anything left is covered by the Later sweep of folders with no `assignments` row.
8. Staff RLS on `assignment_files` hides student rows until the work is Submitted or Returned,
   the same rule as the storage SELECT policy (one `private.can_read_assignment_file`).
7. Images are compressed in the browser by `prepareWorkPhoto` in `lib/photo.ts`: long edge
   ≤ 2000 px, JPEG, which strips EXIF.

## Consequences

- One new table, one bucket, about six RPCs and one edge function.
- Release needs Supabase Pro (budget §3.1, B3) for storage and backups.
- Orphan objects are possible but invisible. They cost storage only.

## Alternatives rejected

- Storage-only, with no metadata table: there's no server-side size or total check, and listing
  needs N calls.
- Register first: the size is unverifiable, and rows can be left without files.
- A public bucket or long-lived URLs: they leak student work.
- Cron-drained delete outbox: it ties item 2 to item 3.
