// Admin → Users (open sign-up, 03 §7.8): people who signed up on the website, newest first, the
// sign-up switch, and Deactivate / Reactivate. Linking a user to a child is on the student's page.

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useLoaderData, useRevalidator } from 'react-router';

import {
  AccountStatusChip,
  ConfirmDialog,
  LoadError,
  PageHeader,
  SectionCard,
} from '@/components/portal';
import { PORTAL_ERRORS, PORTAL_SEO, USERS_PAGE } from '@/constants';
import { formatDate } from '@/lib/format';
import { buildPortalMeta } from '@/lib/seo';
import { getSignUpOptions, listUsers, setAccountActive, setSignUpOpen } from '@/services';
import type { SignedUpUser } from '@/services';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.adminUsers);
}

// Access (admin) is checked by the admin layout. Busy counts as open here: showing the daily cap
// is deferred (D10).
export async function clientLoader() {
  const users = await listUsers();
  // Someone who isn't an admin with two-step sends no further request (staff-client.ts).
  if (!users.ok) return { users, signUpOpen: false };
  const options = await getSignUpOptions();
  return { users, signUpOpen: options.status !== 'closed' };
}

type Pending = { kind: 'switch' } | { kind: 'active'; user: SignedUpUser };

export default function AdminUsersPage() {
  const { users, signUpOpen } = useLoaderData<typeof clientLoader>();
  const revalidator = useRevalidator();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  if (!users.ok) return <LoadError error={users.error} />;

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setError('');
    const result =
      pending.kind === 'switch'
        ? await setSignUpOpen(!signUpOpen)
        : await setAccountActive(pending.user.id, !pending.user.isActive);
    setBusy(false);
    setPending(null);
    if (!result.ok) {
      setError(PORTAL_ERRORS[result.error]);
      return;
    }
    setNotice(noticeFor(pending, signUpOpen));
    revalidator.revalidate();
  }

  return (
    <>
      <PageHeader title={USERS_PAGE.heading} intro={USERS_PAGE.intro} />

      {notice && (
        <Alert severity="success" sx={{ mb: 4 }} onClose={() => setNotice('')}>
          {notice}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 4 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <SectionCard title={USERS_PAGE.switch.heading}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ alignItems: { sm: 'center' } }}
        >
          <Typography>{signUpOpen ? USERS_PAGE.switch.open : USERS_PAGE.switch.closed}</Typography>
          <Button variant="outlined" onClick={() => setPending({ kind: 'switch' })}>
            {signUpOpen ? USERS_PAGE.switch.close : USERS_PAGE.switch.reopen}
          </Button>
        </Stack>
      </SectionCard>

      <TableContainer component={Paper} variant="outlined" sx={{ mt: 4 }}>
        <Table size="small" aria-label={USERS_PAGE.heading}>
          <TableHead>
            <TableRow>
              <TableCell>{USERS_PAGE.columns.name}</TableCell>
              <TableCell>{USERS_PAGE.columns.email}</TableCell>
              <TableCell>{USERS_PAGE.columns.signedUp}</TableCell>
              <TableCell>{USERS_PAGE.columns.how}</TableCell>
              <TableCell>{USERS_PAGE.columns.finished}</TableCell>
              <TableCell>{USERS_PAGE.columns.status}</TableCell>
              <TableCell>{USERS_PAGE.columns.action}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.data.map((user) => (
              <TableRow key={user.id} hover>
                <TableCell sx={{ fontWeight: 700 }}>{user.fullName || user.email}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {USERS_PAGE.signedUpOn(formatDate(user.signedUpAt))}
                </TableCell>
                <TableCell>{USERS_PAGE.how[user.signedUpWith]}</TableCell>
                <TableCell>
                  {user.finished ? USERS_PAGE.finished.yes : USERS_PAGE.finished.no}
                </TableCell>
                <TableCell>
                  <AccountStatusChip status={user.isActive ? 'active' : 'deactivated'} />
                </TableCell>
                <TableCell>
                  <Button size="small" onClick={() => setPending({ kind: 'active', user })}>
                    {user.isActive ? USERS_PAGE.deactivate : USERS_PAGE.reactivate}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {users.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>{USERS_PAGE.empty}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Typography color="textSecondary" sx={{ mt: 2 }}>
        {USERS_PAGE.hint}
      </Typography>

      {pending && (
        <ConfirmDialog
          open
          busy={busy}
          {...dialogFor(pending, signUpOpen)}
          onConfirm={confirm}
          onClose={() => setPending(null)}
        />
      )}
    </>
  );
}

function dialogFor(pending: Pending, signUpOpen: boolean) {
  if (pending.kind === 'switch') {
    const words = signUpOpen ? USERS_PAGE.switch.closeDialog : USERS_PAGE.switch.openDialog;
    return {
      title: words.title,
      text: words.text,
      confirmLabel: signUpOpen ? USERS_PAGE.switch.close : USERS_PAGE.switch.reopen,
      destructive: signUpOpen,
    };
  }
  const name = pending.user.fullName || pending.user.email;
  const words = pending.user.isActive ? USERS_PAGE.deactivateDialog : USERS_PAGE.reactivateDialog;
  return {
    title: words.title(name),
    text: words.text,
    confirmLabel: pending.user.isActive ? USERS_PAGE.deactivate : USERS_PAGE.reactivate,
    destructive: pending.user.isActive,
  };
}

function noticeFor(pending: Pending, signUpOpen: boolean): string {
  if (pending.kind === 'switch') {
    return signUpOpen ? USERS_PAGE.switch.closedNotice : USERS_PAGE.switch.openedNotice;
  }
  const name = pending.user.fullName || pending.user.email;
  return pending.user.isActive ? USERS_PAGE.deactivated(name) : USERS_PAGE.reactivated(name);
}
