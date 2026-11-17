import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MOCK_TAGS } from '@/constants';
import { EMPTY_MOCK_TAGS } from '@/lib/mock-tests';

import { MockTagLine } from './MockTagLine';

describe('MockTagLine', () => {
  it('shows each tag by its label (AC 23)', () => {
    render(
      <MockTagLine tags={{ subject: 'maths', stream: 'naplan', yearLevels: [], anyYear: true }} />,
    );
    expect(screen.getByText(MOCK_TAGS.line(MOCK_TAGS.subjectLabel, 'Maths'))).toBeInTheDocument();
    expect(screen.getByText(MOCK_TAGS.line(MOCK_TAGS.streamLabel, 'NAPLAN'))).toBeInTheDocument();
    expect(
      screen.getByText(MOCK_TAGS.line(MOCK_TAGS.yearLevelLabel, 'Any year')),
    ).toBeInTheDocument();
  });

  it('says Not set for each missing tag (AC 18, 23)', () => {
    render(<MockTagLine tags={EMPTY_MOCK_TAGS} stacked />);
    expect(screen.getAllByText(new RegExp(`: ${MOCK_TAGS.notSet}$`))).toHaveLength(3);
  });
});
