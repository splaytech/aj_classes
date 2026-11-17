# BUG-2 — U-9: signed-up users also get "Your AJ Classes code" (plan-error claim)

- **Case:** U-9 (AC-29). Round 1, build `5b95315` (code `5e92ee6`), local stack.
- **Severity:** Low / likely not an app defect. The Tester claims a **plan error**; the lead rules.

## Steps
1. Run Sitting 2 (OTP-2 and OTP-3 ask Auth for a re-authentication code for two signed-up users).
2. `db "select count(*) from public.email_outbox o join public.profiles p on p.id = o.recipient_id where p.role = 'user'"`
3. `mail_subjects <each finished t6 user>` (Mailpit).

## Expected (plan U-9)
Outbox rows for users `0`. Each finished `t6` user's mailbox holds only `Confirm your e-mail for AJ Classes`,
`Reset your AJ Classes password` (where a case sent one) and `Your password was changed` (where a case changed it).

## Actual
- Outbox rows for users: `0`. No "New work", "due" or "marked" subject in any user's mailbox.
- `t6-…-reauth` and `t6-…-finishcode` also hold `Your AJ Classes code` (3 and 1 of them). Those are the
  re-authentication codes OTP-2 and OTP-3 deliberately trigger (Change password and the finish step after a session
  older than a day), so the plan's list of allowed subjects is incomplete, not the app.

## Plan-error claim (Tester)
U-9 was written before the 8-digit code cases (OTP-2, OTP-3) existed. The code e-mail is an Auth account e-mail
like the reset e-mail, and it can't go out without the user asking to change a password. Suggest the lead appends
`Your AJ Classes code (only where a case asked for one)` to U-9's allowed list. Note that AC-29's own wording ("The
only emails they get are confirmation and password reset") already excluded the "Your password was changed" notice
that the lead's earlier ruling accepted; the code e-mail is the same kind of exception, and the PO may want AC-29
reworded once.

## Evidence
Mailpit per-address subjects for the 10 finished `t6` users (run-1 Sitting 2 log), outbox query `0`.

## Ruled plan error by lead (L-2), 2026-11-16

Re-checked after Sitting 2 against the L-2 list: user outbox rows `0`; across every role-`user` mailbox the subjects
are only `Confirm your e-mail for AJ Classes` (26), `Your password was changed` (15), `Reset your AJ Classes
password` (5), `Your AJ Classes code` (4, OTP-2/OTP-3) and `A new verification method was added to your account`
(2, Auth's security notice for the two CF-9 L-1 enrolments the case itself made). No "New work", "due" or "marked"
subject anywhere. U-9 recorded `PASS (L-2)`.
