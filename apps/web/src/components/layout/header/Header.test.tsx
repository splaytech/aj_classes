import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { APP_CONFIG, NAV, PORTAL_ROUTES } from '@/constants';
import { homeForRole } from '@/lib/portal-access';
import { renderAt } from '@/test/render';

import { Header } from './Header';

describe('header sign-in link', () => {
  it('has one Sign in link to the portal when the portal is on', () => {
    renderAt(<Header />);
    const links = screen.queryAllByRole('link', { name: NAV.signInLabel });
    if (APP_CONFIG.features.portal) {
      expect(links).toHaveLength(1);
      expect(links[0]).toHaveAttribute('href', PORTAL_ROUTES.login);
      expect(links[0]).toHaveTextContent(NAV.signIn); // the visible text starts the spoken name
    } else {
      expect(links).toHaveLength(0);
    }
  });

  it('after sign-in, each role lands on its own home page', () => {
    expect(homeForRole('admin')).toBe(PORTAL_ROUTES.admin);
    expect(homeForRole('tutor')).toBe(PORTAL_ROUTES.tutor);
    expect(homeForRole('student')).toBe(PORTAL_ROUTES.student);
    expect(homeForRole('parent')).toBe(PORTAL_ROUTES.parent);
  });
});
