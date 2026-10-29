// Where the invite email lands (ADR-0010). Nothing happens until the person clicks Continue, so an
// email scanner that opens the link can't use it up. The token leaves the address bar before any
// request. invite-redeem then uses the link up (single use, 14 days) and hands back a one-time
// sign-in token, which signs the person in; the setup form follows (invite-onboarding design).
// Every refused link reads the same, whatever the reason (AC 11). The ErrorBoundary is
// portal-root's, as for every portal page.

import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { AuthCard, FormAlert } from '@/components/portal';
import formStyles from '@/components/portal/PortalForm.module.css';
import { Button } from '@/components/ui';
import {
  AUTH_CONFIRM_PAGE,
  PORTAL_COMMON,
  PORTAL_ERRORS,
  PORTAL_QUERY,
  PORTAL_ROUTES,
  PORTAL_SEO,
} from '@/constants';
import { afterHop, afterRedeem } from '@/lib/invite-steps';
import type { InviteStep } from '@/lib/invite-steps';
import { buildPortalMeta } from '@/lib/seo';
import { redeemInvite, signInWithInviteHop } from '@/services';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.invite);
}

/** Redeems the link and signs in; with a hop token from a failed sign-in, only signs in again. */
async function redeemAndSignIn(
  token: string,
  hopToken: string | null,
): Promise<{ kind: 'signedIn' } | InviteStep> {
  if (hopToken) return afterHop(await signInWithInviteHop(hopToken), hopToken);

  const redeemed = afterRedeem(await redeemInvite(token));
  if (redeemed.kind !== 'hop') return redeemed;
  return afterHop(await signInWithInviteHop(redeemed.tokenHash), redeemed.tokenHash);
}

export default function InvitePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Kept from the first render, so Try again never depends on the address bar (which is cleared).
  const [token] = useState(() => searchParams.get(PORTAL_QUERY.inviteToken) ?? '');
  const [step, setStep] = useState<InviteStep>({ kind: 'ready' });

  if (!token) {
    return <AuthCard heading={PORTAL_ERRORS.linkExpired} intro={AUTH_CONFIRM_PAGE.invalidLink} />;
  }

  async function handleContinue() {
    // Never leave the token in the address bar or browser history (AC 8), even if a request hangs.
    window.history.replaceState(null, '', PORTAL_ROUTES.invite);
    const hopToken = step.kind === 'retry' ? step.tokenHash : null;
    setStep({ kind: 'checking' });

    const next = await redeemAndSignIn(token, hopToken);
    if (next.kind === 'signedIn') {
      navigate(PORTAL_ROUTES.join, { replace: true });
      return;
    }
    setStep(next);
  }

  const failed = step.kind === 'refused' || step.kind === 'retry';
  return (
    <AuthCard
      heading={AUTH_CONFIRM_PAGE.heading.invite}
      intro={failed ? undefined : AUTH_CONFIRM_PAGE.intro.invite}
    >
      {step.kind === 'refused' && (
        <>
          <FormAlert message={PORTAL_ERRORS.inviteExpired} />
          <Link to={PORTAL_ROUTES.login}>{AUTH_CONFIRM_PAGE.alreadySetUp}</Link>
        </>
      )}
      {step.kind === 'retry' && (
        <>
          <FormAlert message={PORTAL_ERRORS[step.error]} />
          <div className={formStyles.actions}>
            <Button onClick={handleContinue}>{PORTAL_COMMON.tryAgain}</Button>
          </div>
        </>
      )}
      {!failed && (
        <div className={formStyles.actions}>
          <Button onClick={handleContinue} disabled={step.kind === 'checking'}>
            {step.kind === 'checking' ? AUTH_CONFIRM_PAGE.checking : AUTH_CONFIRM_PAGE.continue}
          </Button>
        </div>
      )}
    </AuthCard>
  );
}
