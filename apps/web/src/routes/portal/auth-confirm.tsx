// Where invite and reset emails land (design §9.1). Nothing happens until the person clicks
// Continue, so an email scanner that opens the link can't use it up. The token is then removed
// from the address bar. Supabase uses the token up here (single use, 1 hour); an invite then
// goes on to the setup form, which the account can't skip (invite-onboarding design).

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
import { confirmEmailLink } from '@/services';
import type { EmailLinkType, ErrorKey } from '@/services';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.authConfirm);
}

function readLinkType(value: string | null): EmailLinkType | null {
  return value === 'invite' || value === 'recovery' ? value : null;
}

/** Supabase gives the same error for an expired link and a used one, so both read as expired. */
function linkErrorMessage(type: EmailLinkType, error: ErrorKey): string {
  if (type === 'invite' && error === 'linkExpired') return PORTAL_ERRORS.inviteExpired;
  return `${PORTAL_ERRORS[error]} ${AUTH_LINK_ERRORS[type]}`;
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
    setChecking(true);
    setError('');
    const result = await confirmEmailLink(tokenHash, type);

    // Never leave the token in the address bar or browser history (R2a review G12).
    window.history.replaceState(null, '', PORTAL_ROUTES.authConfirm);

    if (result.ok) {
      navigate(type === 'invite' ? PORTAL_ROUTES.join : PORTAL_ROUTES.setPassword, {
        replace: true,
      });
      return;
    }
    setChecking(false);
    setError(linkErrorMessage(type, result.error));
  }

  return (
    <AuthCard heading={AUTH_CONFIRM_PAGE.heading[type]} intro={AUTH_CONFIRM_PAGE.intro[type]}>
      <FormAlert message={error} />
      {error ? (
        type === 'recovery' && (
          <Link to={PORTAL_ROUTES.forgotPassword}>{AUTH_CONFIRM_PAGE.requestNewLink}</Link>
        )
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
