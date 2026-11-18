import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { MOCK_TESTS_LINK_CARD, PORTAL_ROUTES } from '@/constants';

import ParentHomePage from './parent-home';

vi.mock('@/services', () => ({
  giveConsent: vi.fn(),
  listChildAssignments: vi.fn(),
  listMyChildren: vi.fn(),
}));
vi.mock('./member-layout', () => ({
  usePortalAccess: () => ({ profile: { fullName: 'Pat Parent', role: 'parent' } }),
}));

describe('parent home, mock tests link (mock tests AC 8)', () => {
  it('links to the parent mock tests, even with no linked child yet', async () => {
    const Stub = createRoutesStub([
      {
        path: PORTAL_ROUTES.parent,
        Component: ParentHomePage,
        loader: () => ({ ok: true, data: [] }),
      },
    ]);
    render(<Stub initialEntries={[PORTAL_ROUTES.parent]} />);

    expect(await screen.findByRole('link', { name: MOCK_TESTS_LINK_CARD.link })).toHaveAttribute(
      'href',
      PORTAL_ROUTES.parentMockTests,
    );
  });
});
