import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { PROFILE_PAGE } from '@/constants';
import { setupUser } from '@/test/user';

import { QualificationsEditor } from './QualificationsEditor';

function Editor({ initial }: { initial: string[] }) {
  const [lines, setLines] = useState(initial);
  return <QualificationsEditor idPrefix="quals" lines={lines} onChange={setLines} />;
}

describe('QualificationsEditor', () => {
  it('moves focus into the new box when a line is added', async () => {
    const user = setupUser();
    render(<Editor initial={['B.Ed, Monash University']} />);

    await user.click(screen.getByRole('button', { name: PROFILE_PAGE.addQualification }));

    expect(screen.getByLabelText(PROFILE_PAGE.qualificationLabel(2))).toHaveFocus();
  });

  it('focuses each new box in turn', async () => {
    const user = setupUser();
    render(<Editor initial={[]} />);
    const add = screen.getByRole('button', { name: PROFILE_PAGE.addQualification });

    await user.click(add);
    await user.click(add);

    expect(screen.getByLabelText(PROFILE_PAGE.qualificationLabel(2))).toHaveFocus();
  });

  it('focuses the new box again after adding, removing and adding the same line', async () => {
    const user = setupUser();
    render(<Editor initial={['B.Ed, Monash University']} />);
    const add = screen.getByRole('button', { name: PROFILE_PAGE.addQualification });

    await user.click(add);
    await user.click(screen.getByRole('button', { name: PROFILE_PAGE.removeQualification(2) }));
    await user.click(add);

    expect(screen.getByLabelText(PROFILE_PAGE.qualificationLabel(2))).toHaveFocus();
  });
});
