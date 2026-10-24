// Admin → Staff (R2a story US14): everyone with access, their status, and Invite.

import PersonAddIcon from '@mui/icons-material/PersonAdd';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import { useState } from 'react';
import { Link as RouterLink, useLoaderData, useRevalidator } from 'react-router';

import {
  InviteDialog,
  LoadError,
  PageHeader,
  RoleChip,
  AccountStatusChip,
} from '@/components/portal';
import { PORTAL_COMMON, PORTAL_SEO, STAFF_PAGE, staffMemberPath } from '@/constants';
import { formatDateTime, formatPhone } from '@/lib/format';
import { buildPortalMeta } from '@/lib/seo';
import { filterStaff, accountStatus } from '@/lib/account-status';
import type { StaffFilter } from '@/lib/account-status';
import { inviteStaff, listStaff } from '@/services';

const FILTERS: StaffFilter[] = ['all', 'active', 'invited', 'deactivated'];

export function meta() {
  return buildPortalMeta(PORTAL_SEO.adminStaff);
}

// Access (admin) is checked by the admin layout.
export async function clientLoader() {
  return listStaff();
}

export default function AdminStaffPage() {
  const loaded = useLoaderData<typeof clientLoader>();
  const revalidator = useRevalidator();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StaffFilter>('all');
  const [inviting, setInviting] = useState(false);
  const [notice, setNotice] = useState('');

  if (!loaded.ok) return <LoadError error={loaded.error} />;

  const now = new Date();
  const rows = filterStaff(loaded.data, search, filter, now);

  function handleInvited(email: string) {
    setInviting(false);
    setNotice(STAFF_PAGE.invited(email));
    revalidator.revalidate();
  }

  return (
    <>
      <PageHeader
        title={STAFF_PAGE.heading}
        intro={STAFF_PAGE.intro}
        actions={
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => setInviting(true)}
          >
            {STAFF_PAGE.invite}
          </Button>
        }
      />

      {notice && (
        <Alert severity="success" sx={{ mb: 4 }} onClose={() => setNotice('')}>
          {notice}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ mb: 4 }}>
        <TextField
          label={STAFF_PAGE.searchLabel}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          size="small"
          sx={{ minWidth: { sm: 320 } }}
        />
        <TextField
          select
          label={STAFF_PAGE.statusFilterLabel}
          value={filter}
          onChange={(event) => setFilter(event.target.value as StaffFilter)}
          size="small"
          sx={{ minWidth: 180 }}
        >
          {FILTERS.map((option) => (
            <MenuItem key={option} value={option}>
              {STAFF_PAGE.statusFilters[option]}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label={STAFF_PAGE.heading}>
          <TableHead>
            <TableRow>
              <TableCell>{STAFF_PAGE.columns.name}</TableCell>
              <TableCell>{STAFF_PAGE.columns.email}</TableCell>
              <TableCell>{STAFF_PAGE.columns.phone}</TableCell>
              <TableCell>{STAFF_PAGE.columns.role}</TableCell>
              <TableCell>{STAFF_PAGE.columns.status}</TableCell>
              <TableCell>{STAFF_PAGE.columns.twoStep}</TableCell>
              <TableCell>{STAFF_PAGE.columns.lastSignIn}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((member) => (
              <TableRow key={member.id} hover>
                <TableCell>
                  <Link
                    component={RouterLink}
                    to={staffMemberPath(member.id)}
                    sx={{ fontWeight: 700 }}
                  >
                    {member.fullName || member.email}
                  </Link>
                </TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {member.phone ? formatPhone(member.phone) : PORTAL_COMMON.none}
                </TableCell>
                <TableCell>
                  <RoleChip role={member.role} />
                </TableCell>
                <TableCell>
                  <AccountStatusChip status={accountStatus(member, now)} />
                </TableCell>
                <TableCell>
                  {member.role === 'admin'
                    ? member.hasTwoStep
                      ? STAFF_PAGE.twoStepOn
                      : STAFF_PAGE.twoStepOff
                    : PORTAL_COMMON.none}
                </TableCell>
                <TableCell>
                  {member.lastSignInAt ? formatDateTime(member.lastSignInAt) : PORTAL_COMMON.never}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>{STAFF_PAGE.empty}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <InviteDialog
        open={inviting}
        onInvite={inviteStaff}
        onInvited={handleInvited}
        onClose={() => setInviting(false)}
      />
    </>
  );
}
