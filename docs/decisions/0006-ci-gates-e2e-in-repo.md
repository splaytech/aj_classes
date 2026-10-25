# ADR-0006: E2E specs live in this repo, and CI gates run only against local services

- **Status:** Proposed (2026-10-26, Architect, `/deliver` pending-requirements items 4–8, Stage 2). Becomes Accepted when this stage's review approves it.
- **Source:** `docs/delivery/2026-10-25-pending-requirements/02b-architecture-items-4-8.md` item 6

## Context

The Playwright suite lives in a local-only repo (`aj_classes-e2e`) that has no remote, so CI can't
run it. `splaytech/aj_classes` is public. Every credential the suite uses is a Supabase CLI local
demo value, or the seeded local admin whose password and TOTP seed are already in the public
`supabase/seed.sql`. Lighthouse and structured-data checks have never run in CI. Staging and prod
share one Supabase project, so no gate may touch it.

## Decision

1. **The specs move into `e2e/`**, a pnpm workspace package with dev-only dependencies, and it
   becomes the canonical home of the suite. The local repo is frozen. The local repo's "separate
   repo by design" rule is overturned. Its other rule, that tests never change app files, still
   holds.
2. **No keys are committed.** Runs read the local keys from `supabase status -o env`. `e2e/.env` is
   gitignored, and `e2e/.env.example` holds placeholders only.
3. **CI gets three new named jobs:**
   - **E2E smoke:**
     - a pinned Supabase CLI and `supabase start`;
     - the dev server on :5173 with job-env `VITE_*` values: the local URL and key, Cloudflare's
       test Turnstile key, and `VITE_LEAD_CAPTURE=on`;
     - every `*.supabase.co` request is blocked and counted, and the count must be 0;
     - on failure, the report and traces are uploaded and kept for 7 days.
   - **Lighthouse:**
     - `@lhci/cli` with thresholds in one committed config, median of 3, mobile;
     - a production build with no Supabase config, served by ADR-0005's mirror with an analytics
       stub written after the build;
     - reports stay on the filesystem as artifacts, never LHCI's public storage.
   - **Structured data:** a dependency-free check over `build/client/**/*.html`. Its unit tests run
     in the existing `web` job.
4. **Every gate build is grepped for the hosted project ref and fails on any hit.** The workflow
   file holds no hosted URL, key or secret.

## Consequences

- No owner action or secret is needed (Q21 isn't asked), and GitHub Actions minutes are free for
  a public repo.
- Feature branches add their specs alongside their code.
- E2E covers the dev build. The production build, its headers and its CSP are covered by the
  Lighthouse job.
- A Cloudflare outage can fail the sign-in spec, and a cold Supabase start costs 2–4 minutes per
  run.

## Alternatives rejected

- A private E2E repo checked out with a deploy key, or a submodule: both need a remote and a secret
  (Q21), and the specs drift away from the code.
- E2E on a production build: it needs every `VITE_*` overridden over `.env.production`, and a real
  Turnstile key fails on localhost.
- E2E against hosted staging: one database serves prod, and staging sits behind Vercel's login.
