# 02b — Architecture: build-queue items 4–8

> **Stage:** 2 of /deliver (Architect) · **Date:** 26 Oct 2026 · **Branch:** `feature/staff-phone-privacy` (from `develop` at `fb738ea`)
> **Input:** [01b-requirement-items-4-9.md](01b-requirement-items-4-9.md) (approved) and [review-1b](review-1b-items-4-9.md), including its round 2 note;
> [02-architecture.md](02-architecture.md) (style, cross-item notes); [04-plan.md](04-plan.md) §1.1; ADRs 0001–0004;
> the migrations up to `20261025110100`; held item 2's `20261025134709_assignment_files.sql` (read from `feature/homework-file-uploads`, not checked out);
> `apps/web/vercel.json`, `serve.railway.json`, `.github/workflows/ci.yml`; the local E2E repo `~/dev/work/aj_classes-e2e` (read only).
> **Next stage:** Solution Designer (contracts, migration bodies, file lists), per item.
> **ADRs added (Proposed):** [0005](../../decisions/0005-public-csp-static-headers.md) public CSP,
> [0006](../../decisions/0006-ci-gates-e2e-in-repo.md) CI gates and E2E in this repo,
> [0007](../../decisions/0007-returned-work-outlives-enrolment.md) returned work outlives enrolment, plus hold results,
> [0008](../../decisions/0008-scheduled-and-multi-kind-email.md) more email kinds, extending ADR-0004.
> Each becomes Accepted when this stage's review approves it, as 0001–0004 did. Item 4 needs no ADR.
> Item 9 is dropped; its only work is AC-5.9, a docs change that ships with item 5.

## Decisions for Saurabh

Only one item meets the pause rule (money), and it gates **item 8's release only**. Nothing here
adds a vendor, changes auth, or locks in a data model. Every schema change is an additive column
with a default, a widened check, a trigger, or a rebuilt function, and each can be migrated
forward or back.

### PAUSE FOR SAURABH — 1. Email volume once items 3 and 8 both run (item 8 release only)

**Why it's raised now.** Item 8 asks for the volume to be checked again (§8.6). At item 3's
planning volume (60 active portal students, 3 pieces of work a week each, about 2.5 recipients per
student), the three email kinds come to about **4,100 a month, or about 135 a day**. The app cap is
**70 a day** (ADR-0004), so on an average day it would hold back about half of them.
- The cap still protects sign-in email and Resend's 3,000-a-month limit, so nothing breaks.
- But "new assignment" emails would build up a queue. That's why §8 gives them a deadline and puts
  them last in the queue.
- The break-even is about **30 active portal students** with their parents. Below that, Free fits.

**Exact question:** "Item 8 roughly doubles app email. On Resend Free, the app can send 70 a day,
which covers about 30 active portal students. Do you approve this rule: we stay on Free, and you
upgrade to Resend Pro (≈ A$31/month) when either of these happens?
- active portal students go over about 30;
- **Daily limit** rows show up on Admin → Emails in two separate weeks.

Or would you rather upgrade before item 8 goes live?"

**Recommendation:** stay on Free and approve the trigger. Real portal use is still small (Q3 asks
whether any families have been invited yet). The queue rules in §8.4 keep overload safe:
- reminders go first;
- "new work" emails that would arrive too late are dropped and shown as **Failed**, not sent late.

**Can the build go ahead without an answer?** **Yes.** This only gates item 8's release.

### Decisions taken without pausing (recorded as `[ASSUMPTION]` where they're judgement calls)

| # | Item | Decision | Why it didn't need a pause |
|---|---|---|---|
| 1 | 4 | A column grant on `phone`, plus a validating trigger (§4) | Uses the existing profile update path. Reversible by revoking the grant |
| 2 | 5 | A public CSP with `'unsafe-inline'` for scripts and styles, and header rules that don't overlap (ADR-0005) | Config only. Can be tightened later |
| 3 | 6 | The smoke specs move into this repo, under `e2e/` (ADR-0006). Q21 is **not** asked | No account, no cost. The specs hold only local demo values already in the public `seed.sql` |
| 4 | 7 | Rule (b) gets a separate read check, and writes keep following enrolment (ADR-0007) | Requirement already approved by the PO. A function change, reversible |
| 5 | 8 | A new ADR-0008 extends ADR-0004, which isn't edited | Same machinery, new kinds |

---

## Item 4 — Staff phone on My profile, plus the Privacy update

**Architecture impact: some (low).** It needs one small migration, and the web change follows the
existing profile form. No new pattern, so no ADR.

### Chosen approach: a column grant plus a validating trigger

Both My profile and the admin staff page already save through one function,
`services/profile.service.ts` → `updateProfile(userId, changes)`. It makes a single
`profiles.update(...)` call, guarded by RLS:
- "Staff update their own profile; admins update all" means an active tutor or admin can change
  their own row, and an admin with aal2 can change any row;
- families, invited accounts and deactivated accounts fail `my_active_role()` / `is_active_staff()`.

So the smallest change that keeps every AC-4.7 rule is to let `phone` ride on that same update.

1. **Grant.** Add `grant update (phone) on public.profiles to authenticated`.
   - `status`, `terms_accepted_at` and `password_set_at` stay ungranted (AC-4.7 last bullet).
2. **`BEFORE UPDATE OF phone` trigger** on `profiles`, `private.check_profile_phone()`. It acts only
   when `new.phone is distinct from old.phone`:
   - `new.phone` is null and `old.phone` isn't: refuse with `phone_required` (AC-4.4).
     - If both are null, the trigger does nothing, so an account with no phone yet can still save
       its other fields.
   - The row's role isn't `tutor` or `admin`: refuse with `invalid_input`. Families never hold a
     phone, even if an admin tries to set one (AC-4.7).
   - Otherwise it sets `new.phone := private.normalise_au_phone(new.phone)`, the same function
     onboarding uses. A null result is refused with `invalid_phone` (AC-4.2, AC-4.3). The existing
     `phone` check constraint stays as the last line of defence.
   - `complete_onboarding()` also writes `phone`, and passes this trigger without change:
     - for staff it writes an already-normalised value, and normalising again changes nothing;
     - for families it writes null over null, so the trigger doesn't act.

     Onboarding is unchanged (AC-4.7 carve-out). pgTAP keeps the onboarding tests green.
3. **Audit (AC-4.6).** Add `phone` in two places:
   - the field list in `private.audit_admin_profile_edit()`;
   - the column list of `profiles_audit_admin_edit` (`after update of …`).

   The audit records field **names** only, so the number never reaches `audit_log`. The self-edit
   rule (`editor = new.id`) is unchanged, so a staff member editing their own phone writes no
   audit row.
4. `[ASSUMPTION]` Add `phone` to the `profiles_set_updated_at` column list too. A phone change is a
   real profile change.
5. **Read path.**
   - Own profile: `PROFILE_COLUMNS` gains `phone`. The own-row select policy already allows it.
   - Admin: `admin_list_staff()` already returns `phone`.
   - Nothing family-facing or public reads `profiles.phone`, and no public build reads `profiles` at
     all (AC-4.8).
6. **Web.** One phone field in the shared profile form, reusing `isValidAustralianPhone` and
   `formatPhone`. Error keys `invalid_phone` (already mapped for onboarding) and the new
   `phone_required` map to inline messages. Because the update is a single statement, a phone error
   saves nothing, and the form keeps the other edits in state (AC-4.3, AC-4.5).
7. **Privacy (AC-4.9).** Text-only, in `PRIVACY` (`content.constants.ts`). **Merge conflict to
   expect:** held item 2 edits the same portal paragraph. Whichever merges second keeps both
   sentences.

### Alternatives considered

| Option | Why not |
|---|---|
| Own-profile RPC, like `complete_onboarding()` (e.g. `update_my_profile(...)` or `set_my_phone(text)`) | Admins would need a second RPC. Either the whole profile save moves into RPCs (the avatar upload → update → delete-old order would have to be rebuilt in two places), or the phone saves in its own call. A separate call isn't atomic with the rest of the form, so a phone error after the other fields saved would break "nothing is saved" (AC-4.3). It's more code for the same rules |
| Column grant only, normalising in the browser | AC-4.3 needs the server to refuse bad input when the browser check is bypassed. The check constraint alone refuses unnormalised input like `0412 345 678`, so it would force the browser format onto every API caller, and it couldn't express `phone_required` |

### Risks

1. **Error text.** If the web app maps `invalid_input` generically, an admin trying to set a phone
   on a family profile would see a vague error. The UI never offers that, so the risk is low. The
   Designer lists the error keys.
2. **Held item 2's Privacy edit** conflicts textually (see point 7). It's caught in review.

### Release

One hosted migration deploy (Saurabh). B17 wording (Q7, batched). No function deploy.

---

## Item 5 — Content security policy on public pages

**Architecture impact: some.** No code or migration. It changes the header configuration and adds
gate tooling: one committed mirror script and one consistency test. ADR-0005.

### 5.1 The policy

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self';
connect-src 'self' https://unzjnxctkyahtmrkinyr.supabase.co https://api.web3forms.com https://app.convertkit.com;
frame-src 'none';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none'
```

What each host is for, checked against `src/`:

| Host | Used by | Directive |
|---|---|---|
| `https://unzjnxctkyahtmrkinyr.supabase.co` | the `leads` function (`leads.client.ts`) and the News check and `/posts` (`public-posts.client.ts`) | `connect-src` |
| `https://api.web3forms.com` | the enquiry form (`web3forms.client.ts`, `fetch`) | `connect-src` |
| `https://app.convertkit.com` | the footer subscribe (`kit.client.ts`). It uses `fetch`, not a form post, so `form-action` stays `'self'` | `connect-src` |
| `'self'` | Vercel Web Analytics: `/_vercel/insights/script.js` and its beacon (production builds load the same-origin path) | `script-src`, `connect-src` |

- No public page loads a third-party image, font or frame, so `img-src`, `font-src` and `frame-src`
  are kept tight.
- `data:` stays in `img-src` for inline SVG and data-URI icons.
- Turnstile is portal-only (`login.tsx`, `forgot-password.tsx`), so `challenges.cloudflare.com` is
  **not** in the public policy.

### 5.2 `script-src` and `style-src`: `'unsafe-inline'` (decision)

I counted the scripts in a current production build of `/`, `/privacy`, `/programmes/vce` and
`/posts`. Each page carries **7 executable inline scripts**:
- React Router's scroll restoration;
- `window.__reactRouterContext`;
- the `type="module"` route import;
- React's streaming helpers (`$RT`, `$RB`, `$RC`);
- the stream close.

The home page also carries **6 inline `style` attributes**.

The module script differs on every page (each imports its own route chunks), and its asset hashes
change on every build. On a static host, the options are:
- **Nonces** need a server to render each response. There is none (`ssr: false`, static files).
- **Hashes** would need a hash list per page, regenerated every build. `vercel.json` is static and
  is read before the build runs. Generating headers would mean moving to Vercel's Build Output API,
  a hosting-model change, which is out of scope.

So the public policy uses `'unsafe-inline'` for scripts and styles, the same as the portal today.
- **What it still stops** (stories C1, C2):
  - loading script from any host but our own;
  - `fetch` or XHR to an unlisted host, and image beacons to one;
  - form posts off-site;
  - plugins;
  - `<base>` hijacking;
  - framing.
- **What it doesn't stop:** an injected inline script runs, and it could navigate the page away
  with data in the URL. CSP doesn't govern top-level navigation.
- **AC-5.8, second bullet:** inline `onclick` attributes **do** run, on purpose, as a consequence of
  `'unsafe-inline'`. React adds no inline handlers (0 `on*=` attributes in the built HTML), so
  nothing relies on this.
- **AC-5.8's first bullet stays the proof that the policy enforces:** a script from an unlisted
  host is blocked.
- **Later bucket:** hash-based `script-src`, if hosting ever moves to generated headers. It goes
  with "tighten the portal's `'unsafe-inline'`".

### 5.3 No stacking on `/portal/*` (AC-5.5)

Vercel's docs don't say what happens when two matching rules set the same header. If a response
carried two CSP headers, browsers would enforce *both*, which is what the CSP spec requires (01b
assumption 4). The portal would then lose Turnstile and Supabase images. **Decision: the rules never
overlap, so no merge behaviour matters.**
- **`vercel.json`:** a new header rule with
  `"source": "/((?!portal(?:/|$)|__spa-fallback).*)"` carries the public CSP. The existing
  `/portal/:path*` rule keeps the portal CSP, `X-Robots-Tag` and `Cache-Control` unchanged. The
  global `/(.*)` rule keeps HSTS, `nosniff`, `X-Frame-Options` and `Referrer-Policy` (AC-5.6).
- **`serve.railway.json`:** `serve` matches headers against the *served file* (the portal is
  rewritten to `__spa-fallback.html`). It applies every matching rule in order, and the **last
  value for a key wins** (`serve-handler` 6.1.7, `appendHeaders`: `target[key] = value`). So the
  public CSP goes on `**/*`, placed **before** the existing `__spa-fallback.html` rule. The portal
  file then ends up with exactly one CSP header, the portal one (AC-5.7).
- **Proof:**
  - in the local gate, `curl -sI` on `/portal/login` counts exactly 1 `Content-Security-Policy`,
    equal to the portal string, on both mirrors;
  - on the live site, the same `curl` is added to item 5's release check, next to the analytics
    check.

  Vercel's preview is behind Vercel's login, so a pre-release header check there is Saurabh's
  browser step (DevTools → Network on `/portal/login`). It's listed under the release steps.

### 5.4 Local and CI enforcement with the local Supabase origin (the 01b blocker fix)

The constraint (AC-5.1, AC-5.11, AC-6.6): enforce exactly the committed policy, but with
`http://127.0.0.1:55321` in place of the hosted origin, and never build against the hosted
project.
1. **One committed mirror script** (Node, no dependencies; name and location are the Designer's
   call, e.g. `apps/web/scripts/serve-mirror.mjs`). It replaces item 1's scratch `jq` line, so
   gates, the TSR and CI all use one tool. It:
   - reads `serve.railway.json`;
   - removes Railway's global `X-Robots-Tag` (as item 1's mirror did), otherwise Lighthouse SEO
     fails;
   - replaces every occurrence of `https://unzjnxctkyahtmrkinyr.supabase.co` in header values with
     `$MIRROR_SUPABASE_ORIGIN` (default `http://127.0.0.1:55321`);
   - **exits non-zero if the hosted origin isn't found**, so a mirror can never silently enforce
     something other than the committed file;
   - writes the `serve` config to a path it's given (scratch, never the repo).
2. **One consistency test** (Vitest, in the existing `web` job; it reads the two JSON files). It
   asserts:
   - the public CSP is byte-identical in `vercel.json` and `serve.railway.json`, and so is the
     portal CSP;
   - the public policy names `https://unzjnxctkyahtmrkinyr.supabase.co` and contains no
     `127.0.0.1`, `localhost`, `*` or bare `https:` (AC-5.1, AC-5.2);
   - every AC-5.2 directive is present;
   - the portal CSP string equals today's value (AC-5.5);
   - the Railway rule order is public first, then `__spa-fallback.html`;
   - the Vercel public `source` excludes `portal`.

   So "the mirror equals `vercel.json`" holds by construction: the mirror is built from Railway, and
   the test proves Railway carries the same policy as `vercel.json`.
3. **Builds for gates are never hosted.**
   - The item 5 gate and E2E builds use `VITE_SUPABASE_URL=http://127.0.0.1:55321`.
   - The Lighthouse and structured-data builds use **no Supabase config at all**
     (`VITE_SUPABASE_URL=` and `VITE_SUPABASE_PUBLISHABLE_KEY=`, item 1's N-25). Item 1 proved
     that blanking these overrides `.env.production`.
   - A grep of `build/client` for `unzjnxctkyahtmrkinyr` must return 0 (N-02) before anything is
     served.
4. **Mocks, as AC-5.3 requires.** Web3Forms is always mocked at the network layer. `leads` is either
   mocked or served by the local stack. Its CORS allow-list is 5173 only, so a mirror on 4173 should
   mock `leads`. The Designer picks.
5. **Vercel Analytics locally:** the gate writes an empty `build/client/_vercel/insights/script.js`
   **after** the build, in the gate or CI step only. Vercel builds from source, so the stub can't
   reach a deploy. The real check stays in the live release check (AC-5.4).

### 5.5 Alternatives considered

| Option | Why not |
|---|---|
| Per-page script hashes | Hashes change every build; static `vercel.json` can't carry them without moving to the Build Output API |
| `Content-Security-Policy-Report-Only` first | AC-5.1 asks for enforcing. Reporting needs an endpoint (Sentry, B14), which is deferred |
| One global CSP rule, with the portal rule "overriding" it | Vercel's same-key behaviour is undocumented. If both are enforced, portal sign-in breaks in production |
| Make the public policy a superset of the portal's, so stacking is harmless | It would loosen public pages to hosts they don't use (Turnstile, Supabase images) |
| Derive the mirror by translating `vercel.json` patterns into `serve` globs | More code, plus a pattern translator to maintain. The Railway config plus the equality test gives the same guarantee |
| Build the gates with the committed `.env.production` | Reads the shared production database and could send a real enquiry to Zoho (review-1b finding 1) |

### 5.6 Risks

1. **Vercel's negative lookahead `source`.** It's a documented path-to-regexp form, commonly used
   in rewrites, but not yet proven on this project. Mitigation: Saurabh's preview header check
   before release, and the live `curl` count straight after. Fallback: if `/portal/*` ever shows two
   CSP headers, revert the release (config only), then list the public paths explicitly.
2. **A new third-party service silently fails** (that's the intent of C2). `arch.md` gets the host
   list and the "update both files" rule (AC-5.10). The consistency test catches drift between the
   two files.
3. **Lighthouse "CSP effective against XSS"** reports `'unsafe-inline'`. It's an informational audit
   with no Best Practices weight in current Lighthouse. If a later Lighthouse version weights it,
   AC-6.7 applies: the gap is written up and goes back to the PO, and the threshold isn't lowered.
4. **Railway removal (Later clean-up)** would remove the mirror's base file. Whoever does that
   clean-up renames it to a mirror-only config rather than deleting it.

### Release

Normal production release. Before release, Saurabh's preview check (risk 1). After release, the
team's read-only live checks: 01b's three lines, plus the portal CSP header count.

---

## Item 6 — CI quality gates: E2E smoke, Lighthouse, structured data

**Architecture impact: some.** Three new CI jobs, a new `e2e/` workspace package, and two dev
tools. No runtime change. ADR-0006.

### 6.1 How CI gets the specs: **option (a), move them into this repo** (decision)

- The specs move into **`e2e/`** at the repo root, as a pnpm workspace package (`pnpm-workspace.yaml`
  gains `'e2e'`). It holds the harness, fixtures and all 5 specs. Its dependencies are dev-only:
  `@playwright/test`, `pg`, `dotenv`, `@types/*`. The local repo's `@supabase/supabase-js`
  dependency is replaced by the root workspace's copy, if the harness still needs it.
- **This repo becomes the one home for E2E.** The local `aj_classes-e2e` repo is frozen. A
  "moved to `aj_classes/e2e`" note in its README is optional, and it's for Saurabh or the Developer
  to add. This stage doesn't change that repo.
- **Why (a):**
  - No account or deploy key, so **Q21 is not asked**.
  - Specs change in the same PR as the feature they test, so items 7 and 8 can add specs in the
    same branch.
  - There's nothing secret to protect: every credential in the suite is a Supabase CLI local demo
    value or the seeded local admin, and `supabase/seed.sql` already publishes the admin password
    and TOTP seed in this public repo.
- **Public-repo hygiene, stricter than the local repo:**
  - The demo JWTs are **not** committed. `e2e/.env.example` holds placeholders and non-key
    settings only. CI and local runs take the keys from `supabase status -o env` at run time. This
    also stops `kinet validate`'s `no-hardcoded-secrets` from flagging JWT-shaped strings.
  - `e2e/.env` is gitignored.
  - A grep step proves the workflow and `e2e/` contain no `unzjnxctkyahtmrkinyr` (AC-6.3).
- **The local repo's "separate repo by design" rule** is overturned on purpose, and ADR-0006
  records it. Its own rule, that the suite never changes app files, still holds: specs live in
  `e2e/` and only read the app.

### 6.2 E2E target: the **dev server on :5173** (decision)

- The suite's allow-lists assume it (`config.toml`: `leads` `ALLOWED_ORIGINS`, Auth `site_url` and
  redirect URLs). It's the setup the specs were proven on.
- **It's also the safer build:** development mode never loads the committed `.env.production`. Every
  `VITE_*` value comes from job env:
  - `VITE_SUPABASE_URL=http://127.0.0.1:55321`;
  - the publishable key from `supabase status`;
  - Cloudflare's public always-pass Turnstile **test** site key (the one `config.toml` uses
    locally);
  - `VITE_LEAD_CAPTURE=on` (AC-6.3).
- The production build and the CSP are exercised by the Lighthouse job instead (§6.3). A Playwright
  CSP sweep over the Lighthouse page set, failing on any `securitypolicyviolation`, is a cheap
  add-on in that job. `[ASSUMPTION]` I recommend it, but it's the Designer's call.

### 6.3 Jobs (each is its own named job, so a failure says which gate failed; AC-6.1)

```
                 ┌──────────── on: push develop/main, pull_request ────────────┐
web (exists)     database (exists)     E2E smoke            Lighthouse          Structured data
format/lint/     supabase db start     supabase start       build (no Supabase) build (no Supabase)
type/test/build  supabase test db      (-x unneeded svcs)   N-02 grep           N-02 grep
+ CSP consistency                      keys ← status -o env mirror script       check script over
  test (item 5)                        dev server :5173     analytics stub      build/client/**/*.html
                                       playwright (smoke)   lhci autorun        (+ its unit tests
                                       block+count          (median of 3)        run in `web`)
                                       *.supabase.co        upload report
                                       upload report on     (filesystem, never
                                       failure (7 days)      public storage)
```

- **E2E smoke:**
  - Pin the Supabase CLI version. `latest` makes CI drift; this also applies to the existing
    `database` job, as a small fix.
  - Run `supabase start` and exclude services the specs don't use (Studio, imgproxy, logflare,
    vector) to save time. Then start the dev server and run the smoke specs.
  - Every page gets one Playwright route for `**/*.supabase.co/**` that **aborts and counts** the
    request. A count above 0 fails the run (AC-6.14).
  - Run invite onboarding as well if the job stays ≤ 15 min over 3 runs (01b assumption 5).
- **Lighthouse:**
  - `@lhci/cli` (dev dependency) with one committed `lighthouserc` holding the thresholds:
    Performance, Accessibility and Best Practices `minScore 0.9`, SEO `1`, `numberOfRuns: 3`,
    median aggregation (AC-6.6, AC-6.7).
  - It runs against the mirror from §5.4 on a production build with **no Supabase config**, so no
    Supabase request is possible at all. The CSP is enforced with the substituted origin anyway.
  - It **must not** use LHCI's `temporary-public-storage` upload, which sends reports to a third
    party. Use `filesystem` plus a workflow artifact.
  - JS transfer size is reported from `resource-summary` (AC-6.8). It becomes a budget assertion
    only if the baseline already meets ≤ 100 KB.
- **Structured data:**
  - A dependency-free Node check: a pure module plus a small CLI. Vitest unit tests with fixtures
    cover every AC-6.10 failure. The unit tests run in the existing `web` job; the job itself runs
    the CLI over the fresh build.
  - The expected types per page come from `lib/seo.ts`; the Designer lists them.
- **Time.** Supabase in CI takes about 2–4 minutes cold and Playwright Chromium about 1 minute,
  plus the specs. That fits ≤ 15 minutes, and the jobs run in parallel to stay ≤ 20 minutes in
  total (AC-6.4). The TSR records 3 runs.
- **Cost:** none. The repo is public, so GitHub-hosted minutes are free.

### 6.4 Alternatives considered

| Option | Why not |
|---|---|
| (b) A private E2E repo, checked out with a deploy key | Needs Saurabh to create a repo and a secret (Q21). Specs and features drift across two repos. The secret is one more thing to rotate |
| (c) A submodule | Needs a remote too (Q21), and submodule pinning is easy to get wrong |
| E2E against a production build on the mirror | Needs every `VITE_*` overridden over `.env.production`, plus mirror substitution in the portal CSP too. A real Turnstile key on localhost would fail. Dev mode gets the same journeys with less risk; the production build is checked by Lighthouse |
| E2E against hosted staging | One database serves prod, and staging sits behind Vercel's login (01b deferred) |

### 6.5 Risks

1. **Flakiness** in a cold Supabase start, or in Mailpit timing for invite onboarding. Mitigation:
   pinned CLI, the suite's existing polling budgets, the 7-day trace artifacts (AC-6.5), and
   `retries: 0` kept, so flakiness is visible rather than hidden.
2. **Cloudflare dependency:** the staff sign-in spec loads the Turnstile test widget from
   `challenges.cloudflare.com`. A Cloudflare outage fails that spec. It's accepted and easy to
   diagnose from the trace.
3. **Lighthouse variance** on shared runners. The median of 3 is the mitigation. AC-6.7 forbids
   lowering thresholds.
4. **Two copies of the specs** if the local repo keeps getting edits. Mitigation: ADR-0006 makes
   `e2e/` canonical.

### Release

None to merge. The optional owner step stays as 01b says: required status checks in GitHub
settings.

---

## Item 7 — Hold results, and returned work stays visible after leaving a class

**Architecture impact: some.** It changes the family read rule set in R3b ("visibility follows
enrolment", F8). One migration (or two, if it's split into 7a and 7b). ADR-0007.

### 7.1 Rule (b): a separate *read* check, and writes keep following enrolment (decision)

Today one predicate, `private.assignment_visible_to(student, assignment)` (published, class
active, enrolled), guards both reads and writes:
- `student_save_answer` and `student_submit`;
- item 2's upload, register and remove functions;
- item 3's `work_returned_recipients`;
- item 2's `can_read_assignment_file`.

Separately, `check_assignment_result` refuses any `assignment_results` write for a student who
isn't enrolled (`not_enrolled`).

**Decision:**
1. **Keep `assignment_visible_to` exactly as it is: rule (a).** Every *write* path keeps using it.
   A student who has left can't save, submit, upload or remove anything, and neither can anyone on
   their behalf. `not_enrolled` still blocks staff writes. AC-7.11 then needs no new refusal code:
   past-class work is always Returned, so it's read-only by status, and the server refuses by
   `not_found` or `already_submitted`.
2. **Add `private.assignment_readable_by(student, assignment)`** = rule (a) **or** rule (b): the
   assignment is published and the student's `assignment_results.status = 'returned'`. It's used
   only by *read* paths.
3. **`private.assignments_for_student`**:
   - turns its inner `join enrolments` into a `left join`;
   - its `where` becomes `a.status = 'published' and ((e.student_id is not null and c.is_active) or r.status = 'returned')`;
   - it gains one column, `is_past_class boolean` (= not rule (a)), for the "Past class" tag
     (AC-7.12).

   Adding a column changes the `returns table` signature, so it's **dropped and recreated** with its
   two wrappers, `public.student_assignments()` and `public.parent_child_assignments(uuid)`, and
   their `revoke` / `grant execute` lines are re-applied. This is the same pattern as item 2,
   ADR-0002.
4. **`private.assignment_view`** reads the builder, so it gets rule (b) for free. Its JSON gains
   `isPastClass`. `parent_child_assignment` and `student_assignment` need no change. The email link
   target is covered too (AC-7.14).
5. **What stays hidden is unchanged (AC-7.10, AC-7.13).**
   - Rule (b) only ever adds Returned rows, so not-started, in-progress and submitted work, and
     drafts, stay hidden.
   - `timetable_for_student` isn't touched.
   - `require_student()` and `require_my_child()` still refuse deactivated students and unlinked
     parents.
   - Deleting the roster row or the assignment still cascades to the result.
6. **Item 3's `work_returned_recipients`** swaps its `assignment_visible_to` check for
   `assignment_readable_by`. Otherwise a "work returned" email still waiting under the cap would be
   skipped if the student left the class before it was sent, even though they can still open the
   work.
7. **Item 2 files (AC-7.15), once item 2 is on `develop`:** `can_read_assignment_file` uses
   `assignment_readable_by` in its **family** branches (tutor attachments for students and parents,
   and parents reading a hand-in). Item 2's upload, register and remove checks keep
   `assignment_visible_to`. The storage SELECT policy calls `can_read_assignment_file`, so it
   follows automatically.

### 7.2 Where the hold flag lives (decision)

- **`public.assignments.hold_results boolean not null default false`.** Existing rows get `false`,
  so today's behaviour is kept with no backfill (AC-7.1).
- Add it to the `insert (...)` / `update (...)` column grants and to the staff `ASSIGNMENT_COLUMNS`.
- **Guard trigger** (same style as item 2's `check_file_handin_flag`):
  - A change is refused unless the assignment is (or stays) a draft, so it's locked on publish. A
    permitted back-to-draft unlocks it automatically, because `check_assignment_status` already
    allows back-to-draft only before `has_submissions`. That covers AC-7.1.
  - Setting it `true` is refused when the draft has no questions (paper), or when it's a file
    hand-in once item 2 exists (AC-7.2).
  - Deleting every question afterwards would leave a stale `true` on what is now paper work. That's
    harmless: paper and file hand-in never auto-return, and the UI hides the switch. The Designer
    may clear it in the question-delete path.
- **`student_submit`:** the final auto-return branch gains `or hold_results`, so a held quiz stays
  `submitted` (AC-7.3). Nothing else changes:
  - auto-marking still writes `awarded_marks`, so the tutor's **Return** passes the
    `unmarked_answers` check straight away (AC-7.4);
  - `check_assignment_result` sets `marked_by` on a staff return, so item 3's email is queued;
  - auto-returns keep `marked_by` null, so they send no email (AC-7.5).
- **Families don't need the flag.** The status drives every family screen, and the existing
  before-return hiding in `assignment_view` (no correct option, explanation or awarded marks until
  Returned) already covers AC-7.6.
- **Alternatives:** a per-class default (out of scope, 01b defers making hold the default), or
  inferring hold from a dummy written question (today's workaround, which is what F28 replaces).

### 7.3 Migration order relative to held item 2 (rule)

Item 2 (`20261025134709_assignment_files.sql`) and item 7 both redefine:
- `student_submit`;
- `assignments_for_student`, with both wrappers and their grants;
- `assignment_view`.

Item 7 also changes item 2's `can_read_assignment_file`, and item 2's flag guard sits next to item
7's hold guard. Supabase applies migrations in **filename order** on a fresh database, but in
**push order** on hosted. If item 2 kept its October-25 timestamp and was pushed after item 7, a
local reset would run item 2 *before* item 7, while hosted would run it *after*. The two databases
would end up with different function bodies, and item 2's snapshot of `student_submit` would wipe
out the hold rule on hosted.

**The rule (applies to whichever of item 2 and item 7 merges second; expected: item 2):**
1. **Re-timestamp.** When item 2 is rebased onto `develop` for release, its migration file is
   **renamed** to a fresh timestamp later than every migration on `develop`, including items 7 and
   8. This is safe only because `20261025134709` has never been applied to the hosted project.
   Before the release, Saurabh confirms that with `supabase migration list`, as part of item 2's
   release steps.
2. **Rebuild from the current body.** Every function item 2 replaces is rewritten from its
   **then-current** definition on `develop`, never from item 2's original snapshot, with item 2's
   change added on top:
   - `student_submit` keeps `or hold_results` and adds `handin` and `no_files`;
   - `assignments_for_student` keeps rule (b) and `is_past_class`, and adds `is_file_handin`;
   - `assignment_view` keeps `isPastClass` and adds `isFileHandin` and the files;
   - `can_read_assignment_file` is born using `assignment_readable_by` in its family branches.
3. **Tests pin it.** Item 7's pgTAP tests (rule (b), hold stays `submitted`) run on item 2's
   rebased branch. A rebase that loses either fails CI. Item 2's re-test (T2.15) also takes over
   AC-7.2's file half and AC-7.15 (01b).
4. **Never push out of order.** `supabase db push --include-all` is never used to slip an older
   file under newer ones.

If item 2 merges **first** after all (Pro approved early), the order is simply normal: item 7 is
written on top of it and covers AC-7.2 and AC-7.15 itself.

### 7.4 Risks

1. **Removal no longer revokes returned work.** A student who was enrolled by mistake keeps their
   returned marks and the class's tutor attachments. To cut access, an admin deactivates the
   student or deletes the roster row. Both are existing actions; deleting the row deletes the
   results. Security should note it; a "revoke past-class access" action goes to the Later bucket.
2. **The drop-and-recreate** briefly removes the RPCs inside the migration transaction. That's
   fine in one transaction. A forgotten re-grant is caught by the existing pgTAP grant tests.
3. **Item 2 rebase error:** see §7.3. Mitigated by the rule and the pinned tests.

### Release

One hosted migration deploy (Saurabh). No function deploy.

---

## Item 8 — "New assignment" and "due tomorrow" emails

**Architecture impact: some.** It reuses ADR-0004's machinery unchanged in shape. It adds two
kinds, one trigger, one scheduled query, a deadline column and a queue order. **ADR-0008, a new
ADR extending ADR-0004**, which stays as accepted. A new ADR rather than an addendum, because the
README's statuses have no "amended" state, and a separate file keeps the accepted text untouched
and shows the history.

### 8.1 Data changes (all additive)

- **`email_outbox.kind`** check: add `'new_assignment'` and `'due_tomorrow'`. The unique key
  `email_outbox_once (kind, assignment_id, student_id, recipient_id)` is **unchanged**. It gives
  AC-8.3's "republishing never notifies" and AC-8.8's "at most one reminder even if the due date
  changes", both **within the 90-day outbox retention**, as AC-3.5 does (review-1b round 2 note).
  The Designer carries that qualifier into AC-8.3 and AC-8.8's test wording.
- **`email_outbox.send_before timestamptz null`**: the latest moment a row may still be sent.
  It's null for `work_returned`.
- **`email_outbox.reason`** check: add `'too_late'`. The admin page shows it as "Too late to send".
- **`notification_settings`** gains `new_assignment boolean not null default true` and
  `due_tomorrow boolean not null default true`. A missing row still means on. The column grants and
  the existing own-row RLS are extended (AC-8.10, AC-8.15). `[ASSUMPTION — Security to confirm]`
  on by default, as 01b assumption 11 says.

### 8.2 One recipient function per kind, shared by the queue and the claim

Item 3's rule, "the trigger and the worker's claim use the same function, so they can't
disagree" (03 §4 choice 7), is kept. `private.work_returned_recipients` is generalised to
`private.email_recipients(kind, assignment, student)`:
- **Base set:** the active student account (active roster row) and each active linked parent, as
  AC-3.1 and AC-8.1 require.
- **The kind's switch column** filters that set.
- **The kind's condition:**
  - `work_returned`: `assignment_readable_by` (item 7).
  - `new_assignment`: `assignment_visible_to`, which means published, enrolled and class active.
    Back to draft before the send fails this, so the row is **skipped** (AC-8.3).
  - `due_tomorrow`: `assignment_visible_to`, plus all of these:
    - `private.is_online_assignment(a)`, so file hand-in is included automatically once item 2
      redefines it (AC-8.5 conditional, no extra work);
    - the result status is null, `not_submitted` or `in_progress` (AC-8.6, re-checked at send);
    - `a.due_on` still equals the date the row was queued for, worked out from `send_before`.

    A changed due date means **skipped**, not re-sent (AC-8.8).

`notify_claim_emails` calls it for every pending row, as it does today.

### 8.3 Queueing

```
publish (draft → published, or inserted as published)        pg_cron '10 4,5 * * *' (UTC)
   │ AFTER INSERT OR UPDATE OF status ON assignments              │ private.queue_due_tomorrow_emails()
   │ when new.status = 'published'                                │   return unless Melbourne hour = 15
   │  and (insert or old.status <> 'published')                   │   today := Melbourne date
   ▼                                                              ▼
for each student enrolled now × email_recipients('new_assignment')   published, online, due_on = today + 1,
insert kind 'new_assignment',                                       Melbourne date(published_at) < due_on − 1,
  send_before = start of due date (Melbourne), or published + 7 d  for each enrolled student not handed in
  if there's no due date                                            × email_recipients('due_tomorrow')
on conflict (email_outbox_once) do nothing                          insert kind 'due_tomorrow',
                                                                      send_before = start of due date (Melbourne)
                                                                    on conflict do nothing
                       └───────────── same outbox, same 5-minute worker ─────────────┘
```

- **The publish trigger** runs in the tutor's transaction, as item 3's does. A rolled-back publish
  queues nothing, and a send failure never reaches the tutor (AC-8.12). A student enrolled later
  gets nothing (AC-8.4).
- **Melbourne time without depending on `cron.timezone`.** Hosted `pg_cron` schedules in UTC; item
  3's `daily-history-trim` already works around that. 15:00 Melbourne is 04:00 UTC in daylight
  time (AEDT) and 05:00 UTC in standard time (AEST). The job runs at **04:10 and 05:10 UTC**, and
  the function acts only when `extract(hour from now() at time zone 'Australia/Melbourne') = 15`.
  So it does real work exactly once a day, at 15:10 local, across both DST changes, with no
  schedule edits. A re-run is harmless because of the unique key.
  - `[ASSUMPTION]` If the run is missed (an outage or a paused project), there's no catch-up that
    day. A late reminder isn't worth an extra code path, and AC-8.7 forbids late ones anyway.
- **"Published on or after the day before"** (AC-8.6) uses `published_at`, which
  `check_assignment_status` resets on republish. That's correct: a republish the day before means
  the "new assignment" email covers it.

### 8.4 Expiry and queue order under the cap (AC-8.7, AC-8.14)

- **Expiry sweep, in `private.kick_email_worker()`**, every 5 minutes, before its early returns:
  `pending` rows with `send_before <= now()` become `failed` with reason `too_late`.
  - It sits in the kick, not the worker, because when the cap is full the kick never calls the
    worker. A sweep in the worker would leave expired reminders showing as "Daily limit" instead of
    Failed.
  - The claim also excludes rows past `send_before`, in case a row is claimed seconds before its
    deadline.
- **Queue order in `notify_claim_emails`:** `order by (kind = 'due_tomorrow') desc, created_at`.
  - **Reminders go first.** They're the only kind with a hard deadline within hours, and their
    daily volume is bounded (only work not yet handed in, due tomorrow).
  - **Everything else stays oldest first**, so `work_returned` and `new_assignment` keep ADR-0004's
    FIFO between them.
- `[ASSUMPTION — PO to confirm at design review]` **"New assignment" rows also expire**: at the
  start of the due date, or 7 days after publishing if there's no due date. They then show as
  Failed "Too late to send".
  - This goes slightly beyond 01b, which gives only reminders a deadline.
  - It's the safety valve for Decision 1: without it, a sustained overload would mail "new work
    set" after the work was due.
  - It changes nothing when volume fits the cap.

### 8.5 Worker, admin page and safe deploy order

- `notify_claim_emails` returns `kind` and `due_on` as well, so the `notifications` function can
  render the right template. Its HTML and text versions, and their constants, live in the function
  folder, as item 3's do (AC-8.2, AC-8.9).
- **Deploy-order safety.** The migration and the function deploy are two separate steps by
  Saurabh. If the migration lands first, today's worker would claim a `new_assignment` row and send
  it with the "work returned" template. **Decision:** the claim takes the kinds the caller can
  render, `notify_claim_emails(supported_kinds text[] default array['work_returned'])`.
  - Today's worker calls it with no argument, so it keeps claiming only `work_returned`.
  - The new worker passes all three kinds.
  - Unclaimed new-kind rows wait. After about 2 hours they show as Waiting / "Not attempted", or
    they expire, until the function is deployed.

  Either deploy order is then safe.
- **`admin_email_problems()`** also returns `kind`, for the Type column (AC-8.13), and maps
  `too_late` to its label. Both functions change their return types, so both are dropped and
  recreated with their grants.

### 8.6 Volume re-check (Decision 1)

| Kind | Per piece of work | Monthly, at item 3's planning volume (60 students × 3 a week × 4.3 weeks × 2.5 recipients) |
|---|---|---|
| Work returned (staff returns) | 1 per recipient | ≈ 1,900 (02, item 3) |
| New assignment | 1 per recipient, for every published piece, including auto-returned quizzes and paper | ≈ 1,900 or more |
| Due tomorrow | only online work with a due date not handed in by 3 pm the day before, about 15% of pieces (`[ASSUMPTION]`) | ≈ 300 |
| **Total** | | **≈ 4,100 / month ≈ 135 / day** |

- Cap: 70 a day. Break-even: 70 ÷ (135 ÷ 60) ≈ **30 active portal students**.
- The cap also keeps the app under 2,100 a month, so Resend's 3,000-a-month limit holds with
  sign-in email included.
- **Overload never breaks anything:** reminders still go first, and old "new work" rows expire
  visibly.
- Edge function calls: still at most one per 5 minutes. `pg_cron` adds 2 runs a day, so the cron log
  grows by about 2 rows a day.

### 8.7 Alternatives considered

| Option | Why not |
|---|---|
| A new outbox or worker per kind | ADR-0004 was built to be reused. A second queue would split the one cap |
| A Melbourne-time schedule through `cron.timezone` | It's a server-level setting that can't be relied on on hosted Supabase |
| An hourly cron with a 15:00–19:00 window, for catch-up | More runs and evening emails, for a rare missed run that AC-8.7 would partly forbid anyway |
| Earliest-deadline-first for every kind | If "new assignment" rows carry deadlines, they would jump ahead of "work returned" and starve it under overload |
| A daily digest | Deferred (01b). It's the next lever after Resend Pro if volume grows |
| Clearing the unique key on back-to-draft, so republishing notifies | 01b AC-8.3 rejects it on purpose |

### 8.8 Risks

1. **One database for staging and prod.** Publishing on staging emails real families, the same as
   item 3's risk 2. The release check uses only the seeded fake family (AC-8.16).
2. **A publish storm**, for example a tutor publishing term work for 4 classes at once. It's bounded
   by the cap, and visible as Waiting "Daily limit". This is exactly Decision 1's trigger.
3. **The deploy-order gap** is closed by `supported_kinds` (§8.5).
4. **DST arithmetic:** a pgTAP test pins `send_before` for a due date on each side of a DST change,
   and the hour-15 guard at both UTC slots.

### Release

- A hosted migration deploy: the kinds, the columns, the trigger and the cron job.
- A `notifications` function deploy: the templates and `supported_kinds`.
- Decision 1's watch on the Emails page.

---

## Cross-item notes

- **Order.** The order stays 4 → 5 → 6 → 7 → 8 (04-plan §1.1). Item 5 before 6 means Lighthouse is
  measured with the CSP in place. 7 and 8 land behind 6's gates, and their new E2E specs (if any)
  go into `e2e/` in their own branches.
- **Item 7 before 8:** item 8's `email_recipients('work_returned')` uses item 7's
  `assignment_readable_by`. Built in order, no stub is needed.
- **Held item 2:** see §7.3 for its rebase. Once it lands, item 8 also covers file hand-in through
  `is_online_assignment`, with no item 8 change. Item 5's AC-5.5 then also covers signed-URL
  downloads. They happen only in the portal, and the portal CSP already allows the Supabase host,
  so the public CSP plays no part in them.
- **No hosted requests (01b common rule).**
  - No item adds a hosted call to any local, gate or CI path.
  - Items 5 and 6 add the N-02 grep and the `supabase.co` block-and-count as permanent checks.
  - No test sends a real enquiry (`leads` and Web3Forms are mocked or local).
- **Docs to update when built:**
  - `docs/architecture/arch.md`: the public CSP hosts and the "update both files" rule (AC-5.10);
    the CI jobs; email kinds and the reminder job;
  - `docs/budget.md` §2 and §5: the Resend row (three kinds) and Decision 1's upgrade trigger;
  - `r3b/review.md` F8 and F28, and `r3b/design.md` §4 (AC-7.17);
  - `supabase/README.md`: the new cron job, and its kill switch next to item 3's;
  - the ADR statuses: Proposed → Accepted once this stage is approved, plus the README table.

## Decisions recorded (for `_knowledge/decisions.md`, once Accepted)

- **DEC-PR-5 (item 4):** Staff edit `profiles.phone` through the existing profile update, using a
  column grant and the `check_profile_phone` BEFORE trigger. The trigger normalises with
  `normalise_au_phone`, refuses clearing a saved number, and refuses phones on family rows. The
  admin audit gains `phone`, recorded by field name only. No RPC.
- **DEC-PR-6 (ADR-0005):** Public pages send an enforcing CSP with `'unsafe-inline'` for scripts
  and styles (static hosting can't do nonces, and build-varying hashes don't fit static
  `vercel.json`). Its `connect-src` allows only Supabase, Web3Forms and Kit. The public and portal
  rules never overlap. The local and CI mirror is built from `serve.railway.json` with the hosted
  origin replaced by the local one, and a test keeps both files equal.
- **DEC-PR-7 (ADR-0006):** The E2E specs move into this repo's `e2e/` package, which becomes
  canonical; no Q21. The smoke runs on the dev server on :5173 against a fresh local Supabase, with
  keys from `supabase status`. Lighthouse and the structured-data check run on a production build
  with no Supabase config. Every gate fails on any hosted reference or `supabase.co` request.
- **DEC-PR-8 (ADR-0007):** Writes keep following enrolment (`assignment_visible_to`). Reads use
  `assignment_readable_by` = enrolled or Returned. `assignments.hold_results` is locked on publish,
  and keeps all-MCQ work Submitted until a staff return. Whichever of items 2 and 7 merges second is
  re-timestamped and rebuilt from the current function bodies.
- **DEC-PR-9 (ADR-0008):** There are two new outbox kinds. "New assignment" is queued by a publish
  trigger; "due tomorrow" by a cron at 04:10 and 05:10 UTC, acting only at Melbourne hour 15. Rows
  can carry a `send_before` deadline and expire as `too_late`, swept in the kick. Reminders are
  claimed first, everything else oldest first. Claims are limited to `supported_kinds`, so either
  deploy order is safe.

## Change log

| Date | Change | Why |
|---|---|---|
| 26 Oct 2026 | First version, items 4–8 | /deliver stage 2 for 01b |
