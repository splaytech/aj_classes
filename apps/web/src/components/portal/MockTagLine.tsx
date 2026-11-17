// A mock test's three tags as plain text: "Subject: Maths", "Stream: NAPLAN", "Year level: Any
// year", with "Not set" for a missing one (docs/delivery/2026-11-18-mock-test-closing AC 23, 28).
// Portal pages only: tags appear on no public page, sitemap or e-mail (AC 29).

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { MOCK_TAGS } from '@/constants';
import { mockStreamText, mockSubjectText, mockYearText } from '@/lib/mock-tests';
import type { MockTags } from '@/services';

type MockTagLineProps = {
  tags: MockTags;
  /** One tag per line (the admin list's narrow column); otherwise a wrapping row. */
  stacked?: boolean;
};

export function MockTagLine({ tags, stacked = false }: MockTagLineProps) {
  const items = [
    { label: MOCK_TAGS.subjectLabel, text: mockSubjectText(tags.subject) },
    { label: MOCK_TAGS.streamLabel, text: mockStreamText(tags.stream) },
    { label: MOCK_TAGS.yearLevelLabel, text: mockYearText(tags) },
  ];
  return (
    <Stack
      direction={stacked ? 'column' : 'row'}
      spacing={stacked ? 0 : 2}
      useFlexGap
      sx={{ flexWrap: 'wrap' }}
    >
      {items.map((item) => (
        <Typography key={item.label} variant="body2" color="textSecondary">
          {MOCK_TAGS.line(item.label, item.text)}
        </Typography>
      ))}
    </Stack>
  );
}
