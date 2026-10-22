// The code step after the password, for accounts with two-step sign-in (story US8).

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import { AuthCard, TwoStepCodeForm } from '@/components/portal';
import formStyles from '@/components/portal/PortalForm.module.css';
import { LOGIN_VERIFY_PAGE, PORTAL_QUERY, PORTAL_ROUTES, PORTAL_SEO } from '@/constants';
import { safeNextPath } from '@/lib/portal-access';
import { guardPortalPage } from '@/lib/portal-guard';
import { buildPortalMeta } from '@/lib/seo';
import { signOut } from '@/services';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.loginVerify);
}

export async function clientLoader({ request }: ClientLoaderFunctionArgs) {
  await guardPortalPage(request, 'twoStepVerify');
  return null;
}

export default function LoginVerifyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [leaving, setLeaving] = useState(false);

  function goOn() {
    const next = safeNextPath(searchParams.get(PORTAL_QUERY.next));
    navigate(next ?? PORTAL_ROUTES.root, { replace: true });
  }

  async function cancel() {
    setLeaving(true);
    await signOut();
    navigate(PORTAL_ROUTES.login, { replace: true });
  }

  return (
    <AuthCard heading={LOGIN_VERIFY_PAGE.heading} intro={LOGIN_VERIFY_PAGE.intro}>
      <TwoStepCodeForm onVerified={goOn} />
      <button type="button" className={formStyles.textButton} onClick={cancel} disabled={leaving}>
        {LOGIN_VERIFY_PAGE.cancel}
      </button>
    </AuthCard>
  );
}
