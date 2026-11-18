import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { MOCK_TESTS_LINK_CARD, PORTAL_ROUTES } from '@/constants';

import StudentHomePage from './student-home';

vi.mock('@/services', () => ({ listMyAssignments: vi.fn() }));
vi.mock('./member-layout', () => ({
  usePortalAccess: () => ({ profile: { fullName: 'Sam Student', role: 'student' } }),
}));

describe('student home, mock tests link (mock tests AC 8)', () => {
  it('links to the student mock tests', async () => {
    const Stub = createRoutesStub([
      {
        path: PORTAL_ROUTES.student,
        Component: StudentHomePage,
        loader: () => ({ ok: true, data: [] }),
      },
    ]);
    render(<Stub initialEntries={[PORTAL_ROUTES.student]} />);

    expect(await screen.findByRole('link', { name: MOCK_TESTS_LINK_CARD.link })).toHaveAttribute(
      'href',
      PORTAL_ROUTES.studentMockTests,
    );
  });
});
