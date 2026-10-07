// Admin → Activity (R2a story US19): who changed staff access, and when. Newest first.

import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { useLoaderData } from 'react-router';

import { LoadError, PageHeader } from '@/components/portal';
import {
  ACTIVITY_LABELS,
  ACTIVITY_PAGE,
  PORTAL_COMMON,
  PORTAL_SEO,
  STAFF_ROLE_LABELS,
} from '@/constants';
import type { StaffRole } from '@/constants';
import { formatDateTime } from '@/lib/format';
import { buildPortalMeta } from '@/lib/seo';
import { listActivity } from '@/services';
import type { ActivityEntry } from '@/services';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.adminActivity);
}

// Access (admin) is checked by the admin layout.
export async function clientLoader() {
  return listActivity();
}

/** A short, readable summary of an entry's details (e.g. "Tutor → Admin"). */
function describeDetails(entry: ActivityEntry): string {
  const { details } = entry;
  if (entry.action === 'role_changed') {
    const from = STAFF_ROLE_LABELS[details.from as StaffRole] ?? String(details.from);
    const to = STAFF_ROLE_LABELS[details.to as StaffRole] ?? String(details.to);
    return ACTIVITY_PAGE.roleChange(from, to);
  }
  if (entry.action === 'profile_edited_by_admin' && Array.isArray(details.fields)) {
    return ACTIVITY_PAGE.fields(details.fields.join(', '));
  }
  return '';
}

export default function AdminActivityPage() {
  const loaded = useLoaderData<typeof clientLoader>();
  if (!loaded.ok) return <LoadError error={loaded.error} />;

  return (
    <>
      <PageHeader title={ACTIVITY_PAGE.heading} intro={ACTIVITY_PAGE.intro} />
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label={ACTIVITY_PAGE.heading}>
          <TableHead>
            <TableRow>
              <TableCell>{ACTIVITY_PAGE.columns.when}</TableCell>
              <TableCell>{ACTIVITY_PAGE.columns.who}</TableCell>
              <TableCell>{ACTIVITY_PAGE.columns.what}</TableCell>
              <TableCell>{ACTIVITY_PAGE.columns.target}</TableCell>
              <TableCell>{ACTIVITY_PAGE.columns.details}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loaded.data.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(entry.at)}</TableCell>
                <TableCell>{entry.actorName || ACTIVITY_PAGE.someone}</TableCell>
                <TableCell>{ACTIVITY_LABELS[entry.action] ?? entry.action}</TableCell>
                <TableCell>{entry.targetName || PORTAL_COMMON.none}</TableCell>
                <TableCell>{describeDetails(entry)}</TableCell>
              </TableRow>
            ))}
            {loaded.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>{ACTIVITY_PAGE.empty}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}
