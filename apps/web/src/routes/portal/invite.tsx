// Where the invite email lands (ADR-0010): `/portal/invite#token=…`. The token is in the
// fragment, so it never reaches a server log or a Referer header. Whenever the fragment holds a
// token (the first load, or the link opened again in the same tab, which only changes the
// fragment), the page adopts it and wipes it from the address bar, keeping an in-memory copy
// (06-security finding 1, review-5 round 2). A reload after that shows "This link is incomplete",
// which is expected. Nothing is used up until the person clicks Continue, so an email scanner
// that opens the link can't use it. invite-redeem then uses the link up (single use, 14 days)
// and hands back a one-time sign-in token, which signs the person in; the setup form follows
// (invite-onboarding design). Every refused link reads the same, whatever the reason (AC 11).
// The ErrorBoundary is portal-root's, as for every portal page.

import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { AuthCard, FormAlert } from '@/components/portal';
import formStyles from '@/components/portal/PortalForm.module.css';
import { Button } from '@/components/ui';
import {
  AUTH_CONFIRM_PAGE,
  PORTAL_COMMON,
  PORTAL_ERRORS,
  PORTAL_ROUTES,
  PORTAL_SEO,
} from '@/constants';
import { afterHop, afterRedeem, inviteTokenFromHash } from '@/lib/invite-steps';
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
  const location = useLocation();
  const hashToken = inviteTokenFromHash(location.hash);
  // The in-memory copy: the address bar is cleared straight away (below).
  const [token, setToken] = useState(hashToken);
  const [step, setStep] = useState<InviteStep>({ kind: 'ready' });

  // A newer link opened in the same tab replaces the one in memory (set during render, the React
  // pattern for state that follows a changed input).
  if (hashToken && hashToken !== token) {
    setToken(hashToken);
    setStep({ kind: 'ready' });
  }

  useEffect(() => {
    // Never leave the token in the address bar or browser history (AC 8). `replace`, so the
    // entry that held the token is overwritten, and the router knows the address changed.
    if (location.hash || location.search) navigate(PORTAL_ROUTES.invite, { replace: true });
  }, [location.hash, location.search, navigate]);

  if (!token) {
    return <AuthCard heading={PORTAL_ERRORS.linkExpired} intro={AUTH_CONFIRM_PAGE.invalidLink} />;
  }

  async function handleContinue() {
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
