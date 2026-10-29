// Parent home (R3b stories FP1, FP3): each linked child with their classes, work to do and
// average mark, and, until it's recorded, a prompt to allow the child their own account.

import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { Link as RouterLink, useLoaderData, useRevalidator } from 'react-router';

import { ConfirmDialog, LoadError, PageHeader, SectionCard } from '@/components/portal';
import {
  BUSINESS,
  CLOCK,
  PARENT_HOME,
  PORTAL_SEO,
  PROGRESS_TEXT,
  parentChildPath,
} from '@/constants';
import { familyProgress } from '@/lib/family-progress';
import { firstName, studentYearLabel } from '@/lib/labels';
import { buildPortalMeta } from '@/lib/seo';
import { usePortalAction } from '@/lib/use-portal-action';
import { giveConsent, listChildAssignments, listMyChildren } from '@/services';
import type { Child, FamilyAssignment, Result } from '@/services';

import { usePortalAccess } from './member-layout';

type ChildSummary = { child: Child; assignments: FamilyAssignment[] };

export function meta() {
  return buildPortalMeta(PORTAL_SEO.parent);
}

// Access (parent) is checked by the parent layout; the database returns only their children.
export async function clientLoader(): Promise<Result<ChildSummary[]>> {
  const children = await listMyChildren();
  if (!children.ok) return children;

  const lists = await Promise.all(children.data.map((child) => listChildAssignments(child.id)));
  return {
    ok: true,
    data: children.data.map((child, index) => {
      const list = lists[index];
      return { child, assignments: list?.ok ? list.data : [] };
    }),
  };
}

export default function ParentHomePage() {
  const loaded = useLoaderData<typeof clientLoader>();
  const access = usePortalAccess();
  const revalidator = useRevalidator();

  if (!loaded.ok) return <LoadError error={loaded.error} />;

  return (
    <>
      <PageHeader
        title={PARENT_HOME.greeting(firstName(access.profile?.fullName ?? ''))}
        intro={PARENT_HOME.intro}
      />
      {loaded.data.length === 0 ? (
        <Alert severity="info">{PARENT_HOME.empty}</Alert>
      ) : (
        <Stack spacing={4}>
          {loaded.data.map((summary) => (
            <ChildCard
              key={summary.child.id}
              {...summary}
              onConsented={() => void revalidator.revalidate()}
            />
          ))}
        </Stack>
      )}
      {BUSINESS.invoicePortalUrl && <InvoicesCard url={BUSINESS.invoicePortalUrl} />}
    </>
  );
}

/** Link to Zoho Invoice's customer portal (leads-and-crm.md §4.5); shown once it's set. */
function InvoicesCard({ url }: { url: string }) {
  const { invoices } = PARENT_HOME;
  return (
    <Stack sx={{ mt: 4 }}>
      <SectionCard title={invoices.heading}>
        <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
          <Typography>{invoices.text}</Typography>
          <Button
            variant="outlined"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${invoices.open} ${invoices.newTab}`}
          >
            {invoices.open}
          </Button>
        </Stack>
      </SectionCard>
    </Stack>
  );
}

type ChildCardProps = ChildSummary & { onConsented: () => void };

function ChildCard({ child, assignments, onConsented }: ChildCardProps) {
  const progress = familyProgress(assignments);
  const consent = PARENT_HOME.consent;
  const action = usePortalAction();
  const [confirming, setConfirming] = useState(false);
  const classes =
    child.classNames.length > 0
      ? child.classNames.join(CLOCK.listSeparator)
      : PARENT_HOME.notInClass;

  async function handleConsent() {
    const given = await action.run(() => giveConsent(child.id), consent.done);
    setConfirming(false);
    if (given) onConsented();
  }

  return (
    <SectionCard
      title={child.fullName}
      action={
        <Button variant="contained" component={RouterLink} to={parentChildPath(child.id)}>
          {PARENT_HOME.view}
        </Button>
      }
    >
      <Stack spacing={2}>
        <Typography color="textSecondary">
          {studentYearLabel(child.yearLevel)}
          {CLOCK.listSeparator}
          {classes}
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Chip
            size="small"
            color={progress.toDo > 0 ? 'warning' : 'default'}
            variant="outlined"
            label={PARENT_HOME.toDo(progress.toDo)}
          />
          <Chip
            size="small"
            variant="outlined"
            label={
              progress.averagePercent === null
                ? PROGRESS_TEXT.noMarks
                : PARENT_HOME.average(progress.averagePercent)
            }
          />
          <Chip
            size="small"
            variant="outlined"
            label={PARENT_HOME.accountStatus[child.accountStatus]}
          />
        </Stack>

        {action.notice && <Alert severity="success">{action.notice}</Alert>}
        {action.error && <Alert severity="error">{action.error}</Alert>}
        {!child.consentRecordedAt && (
          <Alert
            severity="info"
            action={
              <Button color="inherit" disabled={action.busy} onClick={() => setConfirming(true)}>
                {consent.allow}
              </Button>
            }
          >
            <AlertTitle>{consent.heading(child.fullName)}</AlertTitle>
            {consent.text(child.fullName)}
          </Alert>
        )}
      </Stack>

      <ConfirmDialog
        open={confirming}
        title={consent.confirmTitle(child.fullName)}
        text={consent.confirmText(child.fullName)}
        confirmLabel={consent.allow}
        busy={action.busy}
        onConfirm={handleConsent}
        onClose={() => setConfirming(false)}
      />
    </SectionCard>
  );
}
