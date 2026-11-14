// Where Google sends people back (open sign-up, 03 §7.6). With a one-time code, the session is
// made and /portal sends them on (a new account to the finish step, an existing Google account
// home). With an error, the message says what happened: Supabase puts it in the query and repeats
// it in the fragment (05-dev-notes, slice 0 S3 shapes). The address is wiped either way.

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { AuthCard, FormAlert } from '@/components/portal';
import formStyles from '@/components/portal/PortalForm.module.css';
import {
  AUTH_CALLBACK_PAGE,
  PORTAL_ERRORS,
  PORTAL_QUERY,
  PORTAL_ROUTES,
  PORTAL_SEO,
} from '@/constants';
import { buildPortalMeta } from '@/lib/seo';
import { finishGoogleSignIn } from '@/services';
import type { ErrorKey, Result } from '@/services';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.authCallback);
}

type CallbackParams = { code: string; errorCode: string; errorDescription: string; error: string };

/** Reads the callback's parameters from the query, falling back to the fragment. */
export function readCallbackParams(search: string, hash: string): CallbackParams {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  const read = (name: string) => query.get(name) || fragment.get(name) || '';
  return {
    code: query.get(PORTAL_QUERY.oauthCode) ?? '',
    error: read(PORTAL_QUERY.oauthError),
    errorCode: read(PORTAL_QUERY.oauthErrorCode),
    errorDescription: read(PORTAL_QUERY.oauthErrorDescription),
  };
}

/**
 * Which message to show for a refused Google sign-in. Our sign-up hook's refusals arrive as the
 * description; a ban and Auth's own sign-up switch as the code. Anything else, the linking
 * trigger's refusal included, is message M (AC-54): this e-mail already has an account.
 */
export function callbackErrorKey(params: CallbackParams): ErrorKey {
  if (params.errorDescription === 'google_email_unverified') return 'googleEmailUnverified';
  if (
    params.errorDescription === 'sign_up_closed' ||
    params.errorDescription === 'sign_up_refused' ||
    params.errorCode === 'signup_disabled'
  ) {
    return 'signUpClosed';
  }
  if (params.errorCode === 'user_banned') return 'notActive';
  return 'googleAccountExists';
}

// A code works once. React runs effects twice in development (StrictMode), so the exchange is
// shared per code and both runs wait for the same answer.
const exchanges = new Map<string, Promise<Result>>();
function exchangeOnce(code: string): Promise<Result> {
  const started = exchanges.get(code) ?? finishGoogleSignIn(code);
  exchanges.set(code, started);
  return started;
}

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  // Read before the effect wipes the address (both StrictMode renders see the same URL).
  const [params] = useState(() => readCallbackParams(window.location.search, window.location.hash));
  const [error, setError] = useState(() =>
    params.code ? '' : PORTAL_ERRORS[callbackErrorKey(params)],
  );

  useEffect(() => {
    let current = true; // a result that arrives after the page has gone is dropped
    // Never leave the code or the error in the address bar or browser history.
    window.history.replaceState(null, '', PORTAL_ROUTES.authCallback);
    if (!params.code) return;

    exchangeOnce(params.code).then((result) => {
      if (!current) return;
      if (result.ok) navigate(PORTAL_ROUTES.root, { replace: true });
      else setError(PORTAL_ERRORS[result.error]);
    });
    return () => {
      current = false;
    };
  }, [navigate, params]);

  if (!error) {
    return (
      <AuthCard heading={PORTAL_SEO.authCallback}>
        <p className={formStyles.hint} role="status">
          {AUTH_CALLBACK_PAGE.checking}
        </p>
      </AuthCard>
    );
  }
  return (
    <AuthCard heading={PORTAL_SEO.login}>
      <FormAlert message={error} />
      <Link to={PORTAL_ROUTES.login}>{AUTH_CALLBACK_PAGE.backToSignIn}</Link>
    </AuthCard>
  );
}
