// An assignment's title, linking to its page, with a "Draft" chip until it's published (R3b FT2).

import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import { Link as RouterLink } from 'react-router';

import { ASSIGNMENT_STATE_LABELS, assignmentPath } from '@/constants';
import type { AssignmentSummary } from '@/services';

type AssignmentTitleLinkProps = {
  assignment: Pick<AssignmentSummary, 'id' | 'title' | 'isPublished'>;
};

export function AssignmentTitleLink({ assignment }: AssignmentTitleLinkProps) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Link component={RouterLink} to={assignmentPath(assignment.id)} sx={{ fontWeight: 700 }}>
        {assignment.title}
      </Link>
      {!assignment.isPublished && <Chip size="small" label={ASSIGNMENT_STATE_LABELS.draft} />}
    </Stack>
  );
}
