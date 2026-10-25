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
| [0004](0004-email-outbox-cron-worker.md) | App email through an outbox table, `pg_cron` and an edge function worker | Accepted; extended by [0008](0008-scheduled-and-multi-kind-email.md) |
| [0005](0005-public-csp-static-headers.md) | Public pages send an enforcing CSP from static headers, with rules that never overlap the portal's | Accepted |
| [0006](0006-ci-gates-e2e-in-repo.md) | E2E specs live in this repo, and CI gates run only against local services | Accepted |
| [0007](0007-returned-work-outlives-enrolment.md) | Returned work stays readable after leaving a class; writes still follow enrolment; results can be held | Accepted |
| [0008](0008-scheduled-and-multi-kind-email.md) | "New assignment" and "due tomorrow" emails reuse the outbox (extends 0004) | Accepted |
