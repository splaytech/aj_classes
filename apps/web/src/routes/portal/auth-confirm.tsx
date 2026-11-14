// Where password-reset emails land (design §9.1). Nothing happens until the person clicks
// Continue, so an email scanner that opens the link can't use it up. The token is then removed
// from the address bar. Supabase uses the token up here (single use, 1 hour).
// Invites land on /portal/invite now (ADR-0010). An old-format invite link (`type=invite`) still
// shows the welcome card, but Continue refuses it here without any request (AC 38).
// A sign-up confirmation (`type=email`, open sign-up) goes on to the finish step (/portal/join).

import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { AuthCard, FormAlert } from '@/components/portal';
import formStyles from '@/components/portal/PortalForm.module.css';
import { Button } from '@/components/ui';
import {
  AUTH_CONFIRM_PAGE,
  PORTAL_ERRORS,
  AUTH_LINK_ERRORS,
  PORTAL_QUERY,
  PORTAL_ROUTES,
  PORTAL_SEO,
} from '@/constants';
import { buildPortalMeta } from '@/lib/seo';
import { confirmRecoveryLink, confirmSignUpLink } from '@/services';
import type { EmailLinkType } from '@/services';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.authConfirm);
}

function readLinkType(value: string | null): EmailLinkType | null {
  return value === 'invite' || value === 'recovery' || value === 'email' ? value : null;
}

export default function AuthConfirmPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenHash = searchParams.get(PORTAL_QUERY.tokenHash) ?? '';
  const linkType = readLinkType(searchParams.get(PORTAL_QUERY.linkType));

  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  if (!tokenHash || !linkType) {
    return <AuthCard heading={PORTAL_ERRORS.linkExpired} intro={AUTH_CONFIRM_PAGE.invalidLink} />;
  }
  const type: EmailLinkType = linkType;

  async function handleContinue() {
    if (type === 'invite') {
      // Never leave the token in the address bar or browser history (R2a review G12).
      window.history.replaceState(null, '', PORTAL_ROUTES.authConfirm);
      setError(PORTAL_ERRORS.inviteExpired);
      return;
    }

    setChecking(true);
    setError('');
    const isSignUp = type === 'email';
    const result = isSignUp
      ? await confirmSignUpLink(tokenHash)
      : await confirmRecoveryLink(tokenHash);
    window.history.replaceState(null, '', PORTAL_ROUTES.authConfirm);

    if (result.ok) {
      navigate(isSignUp ? PORTAL_ROUTES.join : PORTAL_ROUTES.setPassword, { replace: true });
      return;
    }
    setChecking(false);
    // Supabase gives the same error for an expired link and a used one (AC-18: one message).
    setError(
      isSignUp
        ? PORTAL_ERRORS.linkExpired
        : `${PORTAL_ERRORS[result.error]} ${AUTH_LINK_ERRORS.recovery}`,
    );
  }

  function linkAfterError() {
    if (type === 'recovery') {
      return <Link to={PORTAL_ROUTES.forgotPassword}>{AUTH_CONFIRM_PAGE.requestNewLink}</Link>;
    }
    if (type === 'email') {
      return <Link to={PORTAL_ROUTES.signUpResend}>{AUTH_CONFIRM_PAGE.sendAgain}</Link>;
    }
    return <Link to={PORTAL_ROUTES.login}>{AUTH_CONFIRM_PAGE.alreadySetUp}</Link>;
  }

  // Once the link has failed, "Continue to…" no longer applies, so the intro is dropped.
  return (
    <AuthCard
      heading={AUTH_CONFIRM_PAGE.heading[type]}
      intro={error ? undefined : AUTH_CONFIRM_PAGE.intro[type]}
    >
      <FormAlert message={error} />
      {error ? (
        linkAfterError()
      ) : (
        <div className={formStyles.actions}>
          <Button onClick={handleContinue} disabled={checking}>
            {checking ? AUTH_CONFIRM_PAGE.checking : AUTH_CONFIRM_PAGE.continue}
          </Button>
        </div>
      )}
    </AuthCard>
  );
}
