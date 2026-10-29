import { query } from './pg-client.js';

/**
 * Every local request reaches invite-redeem from one Docker address, so 10 redeems in 15 minutes
 * (ADR-0010's rate limit) is easy to hit across runs. Local database only.
 */
export async function clearInviteRedeemAttempts(): Promise<void> {
  await query('DELETE FROM private.invite_redeem_attempts');
}

/**
 * Moves an invite's link and its "Invited on" date back by the same amount, so the link and the
 * admin's status chip agree (03-design §8.1 item 2). `interval` is a Postgres interval such as
 * '13 days'. Local database only.
 */
export async function backdateInvite(email: string, interval: string): Promise<void> {
  await query(
    `UPDATE private.invite_tokens t
        SET sent_at = t.sent_at - $2::interval, expires_at = t.expires_at - $2::interval
       FROM public.profiles p
      WHERE p.id = t.profile_id AND p.email = $1`,
    [email, interval],
  );
  await query(
    'UPDATE public.profiles SET invited_at = invited_at - $2::interval WHERE email = $1',
    [email, interval],
  );
}
