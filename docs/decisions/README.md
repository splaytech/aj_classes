# Architecture decision records

One file per significant decision: `NNNN-short-title.md`, numbered in order, never renumbered.
Status is Proposed, Accepted or Superseded (link the replacement). Same format as
`aj_classes_mobile/docs/decisions/`. A one-line summary of each also goes into
`~/second-brain/Projects/AJClasses/_knowledge/decisions.md`.

| ADR | Title | Status |
|---|---|---|
| [0001](0001-public-pages-live-reads-via-plain-fetch.md) | Public pages read live data with plain `fetch`; `/posts` is pre-rendered | Accepted |
| [0002](0002-explicit-file-handin-flag.md) | File hand-in is an explicit flag on assignments | Accepted |
| [0003](0003-assignment-files-storage.md) | Assignment files: private bucket, metadata table, upload-then-register | Accepted |
| [0004](0004-email-outbox-cron-worker.md) | App email through an outbox table, `pg_cron` and an edge function worker | Accepted |
