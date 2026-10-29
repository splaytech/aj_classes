// Admin → Students → one student (R3b stories FA1–FA3): parental consent, the student's own
// account, their parents and their classes.

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link as RouterLink, useLoaderData, useRevalidator } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import {
  AccountStatusChip,
  ConfirmDialog,
  LoadError,
  NotFoundPanel,
  PageHeader,
  ParentInviteDialog,
  PermissionChips,
  SectionCard,
} from '@/components/portal';
import {
  ADMIN_STUDENT_PAGE,
  PARENT_INVITE_DIALOG,
  PORTAL_ERRORS,
  PORTAL_ROUTES,
  PORTAL_SEO,
  classPath,
} from '@/constants';
import { accountStatus, hasJoined } from '@/lib/account-status';
import { formatDate, formatDateTime } from '@/lib/format';
import { studentYearLabel } from '@/lib/labels';
import { buildPortalMeta } from '@/lib/seo';
import { usePortalAction } from '@/lib/use-portal-action';
import { isValidEmail } from '@/lib/validation';
import {
  cancelInvite,
  getStudentFamily,
  inviteParent,
  inviteStudentAccount,
  recordConsent,
  resendInvite,
  setAccountActive,
  unlinkParent,
} from '@/services';
import type { FamilyAccount, StudentFamily } from '@/services';

type SectionProps = { student: StudentFamily; onChanged: () => void };
type PortalAction = ReturnType<typeof usePortalAction>;

export function meta() {
  return buildPortalMeta(PORTAL_SEO.adminStudent);
}

// Access (admin) is checked by the admin layout.
export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  return getStudentFamily(params.studentId ?? '');
}

export default function AdminStudentPage() {
  const loaded = useLoaderData<typeof clientLoader>();
  const revalidator = useRevalidator();

  if (!loaded.ok) {
    return loaded.error === 'notFound' ? <NotFoundPanel /> : <LoadError error={loaded.error} />;
  }
  const student = loaded.data;
  const refresh = () => revalidator.revalidate();

  return (
    <>
      <PageHeader
        title={student.fullName}
        intro={studentYearLabel(student.yearLevel)}
        back={{ to: PORTAL_ROUTES.adminStudents, label: ADMIN_STUDENT_PAGE.back }}
      />
      {!student.isActive && (
        <Alert severity="info" sx={{ mb: 4 }}>
          {ADMIN_STUDENT_PAGE.archived}
        </Alert>
      )}
      <Stack spacing={4}>
        <ConsentSection student={student} onChanged={refresh} />
        <StudentAccountSection student={student} onChanged={refresh} />
        <ParentsSection student={student} onChanged={refresh} />
        <ClassesSection student={student} />
      </Stack>
    </>
  );
}

function ActionAlerts({ action }: { action: PortalAction }) {
  return (
    <>
      {action.notice && <Alert severity="success">{action.notice}</Alert>}
      {action.error && <Alert severity="error">{action.error}</Alert>}
    </>
  );
}

/** FA1: consent is recorded once, by an admin here or by a parent in the portal. */
function ConsentSection({ student, onChanged }: SectionProps) {
  const texts = ADMIN_STUDENT_PAGE.consent;
  const action = usePortalAction();
  const [confirming, setConfirming] = useState(false);

  async function handleRecord() {
    const recorded = await action.run(() => recordConsent(student.id), texts.done);
    setConfirming(false);
    if (recorded) onChanged();
  }

  const status =
    student.consentRecordedAt && student.consentSource
      ? texts.recorded(formatDate(student.consentRecordedAt), texts.sources[student.consentSource])
      : texts.none;

  return (
    <SectionCard title={texts.heading}>
      <Stack spacing={3}>
        <Typography color="textSecondary">{texts.intro}</Typography>
        <Typography sx={{ fontWeight: 700 }}>{status}</Typography>
        <ActionAlerts action={action} />
        {!student.consentRecordedAt && (
          <Box>
            <Button
              variant="contained"
              disabled={action.busy || !student.isActive}
              onClick={() => setConfirming(true)}
            >
              {texts.record}
            </Button>
          </Box>
        )}
      </Stack>
      <ConfirmDialog
        open={confirming}
        title={texts.confirmTitle}
        text={texts.confirmText(student.fullName)}
        confirmLabel={texts.record}
        busy={action.busy}
        onConfirm={handleRecord}
        onClose={() => setConfirming(false)}
      />
    </SectionCard>
  );
}

/**
 * FA3: invite the student once consent is recorded; then resend, cancel or (de)activate.
 * The section owns the action, so its message stays when the view changes (e.g. invite sent).
 */
function StudentAccountSection({ student, onChanged }: SectionProps) {
  const texts = ADMIN_STUDENT_PAGE.account;
  const action = usePortalAction();
  const viewProps = { action, onChanged };

  return (
    <SectionCard
      title={texts.heading}
      action={
        <AccountStatusChip
          status={student.account ? accountStatus(student.account, new Date()) : 'none'}
        />
      }
    >
      <Stack spacing={3}>
        <Typography color="textSecondary">{texts.intro}</Typography>
        {!student.account && <StudentInviteForm student={student} {...viewProps} />}
        {student.account && !hasJoined(student.account) && (
          <PendingInvite account={student.account} {...viewProps} />
        )}
        {student.account && hasJoined(student.account) && (
          <ActiveAccount account={student.account} {...viewProps} />
        )}
        <ActionAlerts action={action} />
      </Stack>
    </SectionCard>
  );
}

type AccountViewProps = { action: PortalAction; onChanged: () => void };

function StudentInviteForm({ student, action, onChanged }: AccountViewProps & SectionProps) {
  const texts = ADMIN_STUDENT_PAGE.account;
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const canInvite = Boolean(student.consentRecordedAt) && student.isActive;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    if (!isValidEmail(address)) {
      setEmailError(address ? PORTAL_ERRORS.invalidEmail : PARENT_INVITE_DIALOG.emailRequired);
      return;
    }
    setEmailError('');
    const sent = await action.run(
      () => inviteStudentAccount(student.id, address),
      texts.sent(address),
    );
    if (sent) onChanged();
  }

  return (
    <Stack component="form" spacing={3} onSubmit={handleSubmit} noValidate>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: { sm: 'flex-start' } }}
      >
        <TextField
          size="small"
          type="email"
          label={texts.emailLabel}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={Boolean(emailError)}
          helperText={emailError || (canInvite ? '' : texts.needsConsent)}
          disabled={!canInvite}
          autoComplete="off"
          sx={{ minWidth: { sm: 320 } }}
        />
        <Button type="submit" variant="contained" disabled={!canInvite || action.busy}>
          {action.busy ? texts.sending : texts.send}
        </Button>
      </Stack>
    </Stack>
  );
}

function PendingInvite({
  account,
  action,
  onChanged,
}: AccountViewProps & { account: FamilyAccount }) {
  const texts = ADMIN_STUDENT_PAGE.account;
  const [confirming, setConfirming] = useState(false);
  const expired = accountStatus(account, new Date()) === 'inviteExpired';

  async function handleCancel() {
    const cancelled = await action.run(() => cancelInvite(account.id), texts.cancelled);
    setConfirming(false);
    if (cancelled) onChanged();
  }

  return (
    <>
      <Typography>{texts.email(account.email)}</Typography>
      {/* Invites sent before ADR-0010 have no date; they show only as expired (AC 25). */}
      {account.invitedAt && (
        <Typography color="textSecondary">
          {texts.invitedOn(formatDateTime(account.invitedAt))}
        </Typography>
      )}
      {expired && <Alert severity="warning">{texts.expired}</Alert>}
      <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          disabled={action.busy}
          onClick={() => action.run(() => resendInvite(account.id), texts.resent)}
        >
          {texts.resend}
        </Button>
        <Button color="error" disabled={action.busy} onClick={() => setConfirming(true)}>
          {texts.cancel}
        </Button>
      </Stack>
      <ConfirmDialog
        open={confirming}
        title={texts.confirmCancelTitle}
        text={texts.confirmCancelText(account.email)}
        confirmLabel={texts.cancel}
        destructive
        busy={action.busy}
        onConfirm={handleCancel}
        onClose={() => setConfirming(false)}
      />
    </>
  );
}

function ActiveAccount({
  account,
  action,
  onChanged,
}: AccountViewProps & { account: FamilyAccount }) {
  const texts = ADMIN_STUDENT_PAGE.account;
  const [confirming, setConfirming] = useState(false);
  const nextActive = !account.isActive;

  async function handleConfirm() {
    const changed = await action.run(
      () => setAccountActive(account.id, nextActive),
      nextActive ? texts.reactivated : texts.deactivated,
    );
    setConfirming(false);
    if (changed) onChanged();
  }

  return (
    <>
      <Typography>{texts.email(account.email)}</Typography>
      <Typography color="textSecondary">
        {account.lastSignInAt
          ? texts.lastSignIn(formatDateTime(account.lastSignInAt))
          : texts.neverSignedIn}
      </Typography>
      {account.termsAcceptedAt && (
        <Typography color="textSecondary">
          {texts.termsAccepted(formatDate(account.termsAcceptedAt))}
        </Typography>
      )}
      <Box>
        <Button
          color={nextActive ? 'primary' : 'error'}
          variant={nextActive ? 'contained' : 'outlined'}
          disabled={action.busy}
          onClick={() => setConfirming(true)}
        >
          {nextActive ? texts.reactivate : texts.deactivate}
        </Button>
      </Box>
      <ConfirmDialog
        open={confirming}
        title={nextActive ? texts.confirmReactivateTitle : texts.confirmDeactivateTitle}
        text={
          nextActive
            ? texts.confirmReactivateText(account.fullName || account.email)
            : texts.confirmDeactivateText(account.fullName || account.email)
        }
        confirmLabel={nextActive ? texts.reactivate : texts.deactivate}
        destructive={!nextActive}
        busy={action.busy}
        onConfirm={handleConfirm}
        onClose={() => setConfirming(false)}
      />
    </>
  );
}

/** FA2: parents are invited (or linked) from here; links can be removed (F25). */
function ParentsSection({ student, onChanged }: SectionProps) {
  const texts = ADMIN_STUDENT_PAGE.parents;
  const action = usePortalAction();
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<FamilyAccount | null>(null);
  const now = new Date();

  async function handleRemove() {
    if (!removing) return;
    const removed = await action.run(() => unlinkParent(student.id, removing.id), texts.removed);
    setRemoving(null);
    if (removed) onChanged();
  }

  return (
    <SectionCard
      title={texts.heading}
      action={
        <Button variant="outlined" disabled={!student.isActive} onClick={() => setInviting(true)}>
          {texts.add}
        </Button>
      }
    >
      <Stack spacing={3}>
        <Typography color="textSecondary">{texts.intro}</Typography>
        {student.parents.length > 0 && (
          <Typography variant="body2" color="textSecondary">
            {texts.permissionsHint}
          </Typography>
        )}
        <ActionAlerts action={action} />
        {student.parents.length === 0 ? (
          <Typography>{texts.empty}</Typography>
        ) : (
          <Stack divider={<Divider flexItem />} spacing={2}>
            {student.parents.map((parent) => (
              <Stack
                key={parent.id}
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>
                    {parent.fullName || parent.email}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {parent.email}
                  </Typography>
                  {parent.termsAcceptedAt && (
                    <Typography variant="body2" color="textSecondary">
                      {texts.termsAccepted(formatDate(parent.termsAcceptedAt))}
                    </Typography>
                  )}
                  {hasJoined(parent) && (
                    <Box sx={{ mt: 1 }}>
                      <PermissionChips
                        consents={parent.consents}
                        label={texts.permissionsLabel(parent.fullName || parent.email)}
                      />
                    </Box>
                  )}
                </Box>
                <Stack
                  direction="row"
                  spacing={1}
                  useFlexGap
                  sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                >
                  <AccountStatusChip status={accountStatus(parent, now)} />
                  {!hasJoined(parent) && (
                    <Button
                      size="small"
                      disabled={action.busy}
                      onClick={() => action.run(() => resendInvite(parent.id), texts.resent)}
                    >
                      {texts.resend}
                    </Button>
                  )}
                  <Button
                    size="small"
                    color="error"
                    aria-label={texts.removeLabel(parent.fullName || parent.email)}
                    disabled={action.busy}
                    onClick={() => setRemoving(parent)}
                  >
                    {texts.remove}
                  </Button>
                </Stack>
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>

      <ParentInviteDialog
        open={inviting}
        studentName={student.fullName}
        onInvite={(email, fullName) => inviteParent(student.id, email, fullName)}
        onDone={(email, outcome) => {
          setInviting(false);
          action.announce(outcome.linked ? texts.linked(email) : texts.invited(email));
          onChanged();
        }}
        onClose={() => setInviting(false)}
      />
      <ConfirmDialog
        open={removing !== null}
        title={texts.confirmRemoveTitle}
        text={
          removing
            ? texts.confirmRemoveText(removing.fullName || removing.email, student.fullName)
            : ''
        }
        confirmLabel={texts.remove}
        destructive
        busy={action.busy}
        onConfirm={handleRemove}
        onClose={() => setRemoving(null)}
      />
    </SectionCard>
  );
}

function ClassesSection({ student }: { student: StudentFamily }) {
  const texts = ADMIN_STUDENT_PAGE.classes;

  return (
    <SectionCard title={texts.heading}>
      {student.classes.length === 0 ? (
        <Typography>{texts.empty}</Typography>
      ) : (
        <Stack spacing={1}>
          {student.classes.map((item) => (
            <Link key={item.id} component={RouterLink} to={classPath(item.id)}>
              {item.name}
            </Link>
          ))}
        </Stack>
      )}
    </SectionCard>
  );
}
