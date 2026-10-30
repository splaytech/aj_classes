# Enhancement: Admin Daily Post Page

Add a dynamic page where an admin can post something each day, like a blog
entry (title + body, timestamped, listed newest-first). This is an
enhancement to an existing, already-running project — follow its current
stack, auth, routing, and data-layer conventions; do not introduce a new
framework or restructure existing code.

## Status

- 25 Oct 2026: `/posts` is pre-rendered as a shell (heading, intro, meta) and loads posts live in
  the browser with plain `fetch`, so it works on Vercel with no rewrite. A "News" link shows in
  the header and footer only when at least one post exists. _(30 Oct 2026: footer only; the header no longer shows News.)_ Separate empty and error states.
  See [ADR-0001](../decisions/0001-public-pages-live-reads-via-plain-fetch.md) and
  [item 1 of the pending-requirements delivery](../delivery/2026-10-25-pending-requirements/03-design.md).
