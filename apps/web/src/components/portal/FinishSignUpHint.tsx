// "To finish signing up, use the link we e-mailed you, or Forgot password." (AC-19, AC-20): one
// wording, on the resend page's reply and the sign-in page's notice.

import { Link } from 'react-router';

import { FINISH_SIGN_UP_HINT, PORTAL_ROUTES } from '@/constants';

export function FinishSignUpHint() {
  return (
    <p>
      {FINISH_SIGN_UP_HINT.before}
      <Link to={PORTAL_ROUTES.forgotPassword}>{FINISH_SIGN_UP_HINT.link}</Link>
      {FINISH_SIGN_UP_HINT.after}
    </p>
  );
}
