// Admin → Enquiries (leads-and-crm.md §5): every website enquiry, newest first, and whether it
// reached Zoho CRM. Retry sends it again; Delete is for privacy requests.

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
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

import { ConfirmDialog, CrmStatusChip, LoadError, PageHeader } from '@/components/portal';
import { ENQUIRIES_PAGE, PORTAL_ERRORS, PORTAL_SEO } from '@/constants';
import { canRetry, retryMessage } from '@/lib/enquiry-actions';
import { formatDateTime } from '@/lib/format';
import { buildPortalMeta } from '@/lib/seo';
import { usePortalAction } from '@/lib/use-portal-action';
import { deleteEnquiry, listEnquiries, resyncEnquiry } from '@/services';
import type { Enquiry } from '@/services';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.adminEnquiries);
}

// Access (admin) is checked by the admin layout.
export async function clientLoader() {
  return listEnquiries();
}

export default function AdminEnquiriesPage() {
  const loaded = useLoaderData<typeof clientLoader>();
  const revalidator = useRevalidator();
  const action = usePortalAction();
  const [retryingId, setRetryingId] = useState('');
  const [toDelete, setToDelete] = useState<Enquiry | null>(null);

  if (!loaded.ok) return <LoadError error={loaded.error} />;

  async function retry(enquiry: Enquiry) {
    setRetryingId(enquiry.id);
    action.clear();
    const result = await resyncEnquiry(enquiry.id);
    setRetryingId('');
    if (!result.ok) {
      action.showError(PORTAL_ERRORS[result.error]);
      return;
    }
    const message = retryMessage(result.data);
    if ('notice' in message) action.announce(message.notice);
    else action.showError(message.error);
    revalidator.revalidate();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const worked = await action.run(() => deleteEnquiry(toDelete.id), ENQUIRIES_PAGE.deleted);
    if (worked) {
      setToDelete(null);
      revalidator.revalidate();
    }
  }

  return (
    <>
      <PageHeader title={ENQUIRIES_PAGE.heading} intro={ENQUIRIES_PAGE.intro} />
      <Stack spacing={2} sx={{ mb: 2 }}>
        {action.notice && <Alert severity="success">{action.notice}</Alert>}
        {action.error && <Alert severity="error">{action.error}</Alert>}
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label={ENQUIRIES_PAGE.heading}>
          <TableHead>
            <TableRow>
              <TableCell>{ENQUIRIES_PAGE.columns.received}</TableCell>
              <TableCell>{ENQUIRIES_PAGE.columns.from}</TableCell>
              <TableCell>{ENQUIRIES_PAGE.columns.message}</TableCell>
              <TableCell>{ENQUIRIES_PAGE.columns.crm}</TableCell>
              <TableCell>{ENQUIRIES_PAGE.columns.actions}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loaded.data.map((enquiry) => (
              <TableRow key={enquiry.id} sx={{ verticalAlign: 'top' }}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {formatDateTime(enquiry.receivedAt)}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {enquiry.name}
                  </Typography>
                  <Link href={ENQUIRIES_PAGE.emailLink(enquiry.email)} variant="body2">
                    {enquiry.email}
                  </Link>
                  {enquiry.phone && (
                    <Typography variant="body2">
                      <Link href={ENQUIRIES_PAGE.phoneLink(enquiry.phone)}>{enquiry.phone}</Link>
                    </Typography>
                  )}
                  {enquiry.wantsUpdates && (
                    <Typography variant="caption" color="text.secondary">
                      {ENQUIRIES_PAGE.wantsUpdates}
                    </Typography>
                  )}
                </TableCell>
                <TableCell sx={{ minWidth: 260, maxWidth: 420, whiteSpace: 'pre-wrap' }}>
                  {enquiry.message ?? (
                    <Typography variant="body2" color="text.secondary">
                      {ENQUIRIES_PAGE.noMessage}
                    </Typography>
                  )}
                </TableCell>
                <TableCell sx={{ maxWidth: 220 }}>
                  <CrmStatusChip status={enquiry.crmStatus} />
                  {enquiry.crmStatus === 'failed' && enquiry.crmError && (
                    // Zoho's reason can be long and technical: two lines, the rest on hover.
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      component="p"
                      title={enquiry.crmError}
                      sx={{
                        mt: 0.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        wordBreak: 'break-word',
                      }}
                    >
                      {enquiry.crmError}
                    </Typography>
                  )}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {canRetry(enquiry.crmStatus) && (
                    <Button
                      size="small"
                      onClick={() => retry(enquiry)}
                      disabled={retryingId !== '' || action.busy}
                    >
                      {retryingId === enquiry.id ? ENQUIRIES_PAGE.retrying : ENQUIRIES_PAGE.retry}
                    </Button>
                  )}
                  <Button
                    size="small"
                    color="error"
                    onClick={() => setToDelete(enquiry)}
                    disabled={action.busy}
                  >
                    {ENQUIRIES_PAGE.delete}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {loaded.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>{ENQUIRIES_PAGE.empty}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <ConfirmDialog
        open={toDelete !== null}
        title={ENQUIRIES_PAGE.confirmDeleteTitle}
        text={ENQUIRIES_PAGE.confirmDeleteText(toDelete?.name ?? '')}
        confirmLabel={ENQUIRIES_PAGE.delete}
        destructive
        busy={action.busy}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
