// Admin → Staff → one person (R2a stories US10, US15–US18): invite, access, two-step, profile.

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useLoaderData, useNavigate, useRevalidator } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';

import {
  ConfirmDialog,
  LoadError,
  NotFoundPanel,
  PageHeader,
  PhotoEditor,
  ProfileForm,
  RoleChip,
  SectionCard,
  AccountStatusChip,
} from '@/components/portal';
import {
  PORTAL_ROUTES,
  PORTAL_SEO,
  STAFF_MEMBER_PAGE,
  ROLE_LABELS,
  STAFF_ROLES,
} from '@/constants';
import type { StaffRole } from '@/constants';
import { formatDate, formatDateTime, formatPhone } from '@/lib/format';
import { buildPortalMeta } from '@/lib/seo';
import { hasJoined, accountStatus } from '@/lib/account-status';
import { usePortalAction } from '@/lib/use-portal-action';
import {
  cancelInvite,
  getProfile,
  getStaffMember,
  removePhoto,
  resendInvite,
  resetStaffTwoStep,
  setAccountActive,
  setStaffRole,
  updateProfile,
  uploadPhoto,
} from '@/services';
import type { StaffMember, StaffProfile } from '@/services';

import { useStaffAccess } from './staff-layout';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.adminStaffMember);
}

// Access (admin) is checked by the admin layout.
export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const userId = params.userId ?? '';
  const [member, profile] = await Promise.all([getStaffMember(userId), getProfile(userId)]);
  return { member, profile };
}

export default function AdminStaffMemberPage() {
  const { member, profile } = useLoaderData<typeof clientLoader>();
  const access = useStaffAccess();
  const revalidator = useRevalidator();

  if (!member.ok)
    return member.error === 'notFound' ? <NotFoundPanel /> : <LoadError error={member.error} />;

  const person = member.data;
  const isYou = person.id === access.userId;
  const refresh = () => revalidator.revalidate();

  return (
    <>
      <PageHeader
        title={`${person.fullName || person.email}${isYou ? ` ${STAFF_MEMBER_PAGE.you}` : ''}`}
        intro={person.email}
        back={{ to: PORTAL_ROUTES.adminStaff, label: STAFF_MEMBER_PAGE.back }}
        meta={
          <>
            <RoleChip role={person.role} />
            <AccountStatusChip status={accountStatus(person, new Date())} />
            {person.joinedAt && (
              <Typography variant="body2" color="textSecondary">
                {STAFF_MEMBER_PAGE.joined(formatDate(person.joinedAt))}
              </Typography>
            )}
            {person.lastSignInAt && (
              <Typography variant="body2" color="textSecondary">
                {STAFF_MEMBER_PAGE.lastSignIn(formatDateTime(person.lastSignInAt))}
              </Typography>
            )}
            {person.phone && (
              <Typography variant="body2" color="textSecondary">
                {STAFF_MEMBER_PAGE.phone}{' '}
                <Link href={STAFF_MEMBER_PAGE.phoneLink(person.phone)}>
                  {formatPhone(person.phone)}
                </Link>
              </Typography>
            )}
            {person.termsAcceptedAt && (
              <Typography variant="body2" color="textSecondary">
                {STAFF_MEMBER_PAGE.termsAccepted(formatDate(person.termsAcceptedAt))}
              </Typography>
            )}
          </>
        }
      />

      <Stack spacing={4}>
        {hasJoined(person) ? (
          <>
            <AccessSection person={person} isYou={isYou} onChanged={refresh} />
            <TwoStepSection person={person} isYou={isYou} onChanged={refresh} />
          </>
        ) : (
          <InviteSection person={person} />
        )}
        {profile.ok && <ProfileSection profile={profile.data} onChanged={refresh} />}
      </Stack>
    </>
  );
}

function InviteSection({ person }: { person: StaffMember }) {
  const navigate = useNavigate();
  const action = usePortalAction();
  const [confirming, setConfirming] = useState(false);
  const expired = accountStatus(person, new Date()) === 'inviteExpired';

  async function handleCancel() {
    const cancelled = await action.run(() => cancelInvite(person.id));
    setConfirming(false);
    if (cancelled) navigate(PORTAL_ROUTES.adminStaff, { replace: true });
  }

  return (
    <SectionCard title={STAFF_MEMBER_PAGE.invite.heading}>
      <Stack spacing={3}>
        <Typography>{STAFF_MEMBER_PAGE.invite.sentOn(formatDateTime(person.invitedAt))}</Typography>
        {expired && <Alert severity="warning">{STAFF_MEMBER_PAGE.invite.expired}</Alert>}
        {action.notice && <Alert severity="success">{action.notice}</Alert>}
        {action.error && <Alert severity="error">{action.error}</Alert>}
        <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            disabled={action.busy}
            onClick={() =>
              action.run(() => resendInvite(person.id), STAFF_MEMBER_PAGE.invite.resent)
            }
          >
            {action.busy ? STAFF_MEMBER_PAGE.invite.resending : STAFF_MEMBER_PAGE.invite.resend}
          </Button>
          <Button color="error" disabled={action.busy} onClick={() => setConfirming(true)}>
            {STAFF_MEMBER_PAGE.invite.cancel}
          </Button>
        </Stack>
      </Stack>
      <ConfirmDialog
        open={confirming}
        title={STAFF_MEMBER_PAGE.invite.confirmCancelTitle}
        text={STAFF_MEMBER_PAGE.invite.confirmCancelText(person.email)}
        confirmLabel={STAFF_MEMBER_PAGE.invite.cancel}
        destructive
        busy={action.busy}
        onConfirm={handleCancel}
        onClose={() => setConfirming(false)}
      />
    </SectionCard>
  );
}

type SectionProps = { person: StaffMember; isYou: boolean; onChanged: () => void };

function AccessSection({ person, isYou, onChanged }: SectionProps) {
  const roleAction = usePortalAction();
  const activeAction = usePortalAction();
  const [role, setRole] = useState<StaffRole>(person.role);
  const [confirming, setConfirming] = useState<'role' | 'active' | null>(null);
  const name = person.fullName || person.email;
  const texts = STAFF_MEMBER_PAGE.access;

  async function changeRole() {
    const changed = await roleAction.run(() => setStaffRole(person.id, role), texts.roleChanged);
    setConfirming(null);
    if (changed) onChanged();
  }

  async function changeActive() {
    const nextActive = !person.isActive;
    const changed = await activeAction.run(
      () => setAccountActive(person.id, nextActive),
      nextActive ? texts.reactivated : texts.deactivated,
    );
    setConfirming(null);
    if (changed) onChanged();
  }

  return (
    <SectionCard title={texts.heading}>
      <Stack spacing={4}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={3}
          sx={{ alignItems: { sm: 'center' } }}
        >
          <TextField
            select
            size="small"
            label={texts.roleLabel}
            value={role}
            onChange={(event) => setRole(event.target.value as StaffRole)}
            sx={{ minWidth: 180 }}
          >
            {STAFF_ROLES.map((option) => (
              <MenuItem key={option} value={option}>
                {ROLE_LABELS[option]}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            disabled={role === person.role || roleAction.busy}
            onClick={() => setConfirming('role')}
          >
            {texts.saveRole}
          </Button>
        </Stack>
        {roleAction.notice && <Alert severity="success">{roleAction.notice}</Alert>}
        {roleAction.error && <Alert severity="error">{roleAction.error}</Alert>}

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={3}
          sx={{ alignItems: { sm: 'center' } }}
        >
          <Typography>{person.isActive ? texts.active : texts.inactive}</Typography>
          <Button
            variant="outlined"
            color={person.isActive ? 'error' : 'primary'}
            disabled={isYou || activeAction.busy}
            onClick={() => setConfirming('active')}
          >
            {person.isActive ? texts.deactivate : texts.reactivate}
          </Button>
        </Stack>
        {isYou && (
          <Typography variant="body2" color="textSecondary">
            {texts.selfNote}
          </Typography>
        )}
        {activeAction.notice && <Alert severity="success">{activeAction.notice}</Alert>}
        {activeAction.error && <Alert severity="error">{activeAction.error}</Alert>}
      </Stack>

      <ConfirmDialog
        open={confirming === 'role'}
        title={texts.confirmRoleTitle}
        text={role === 'admin' ? texts.toAdmin(name) : texts.toTutor(name)}
        confirmLabel={texts.saveRole}
        busy={roleAction.busy}
        onConfirm={changeRole}
        onClose={() => setConfirming(null)}
      />
      <ConfirmDialog
        open={confirming === 'active'}
        title={person.isActive ? texts.confirmDeactivateTitle : texts.confirmReactivateTitle}
        text={
          person.isActive ? texts.confirmDeactivateText(name) : texts.confirmReactivateText(name)
        }
        confirmLabel={person.isActive ? texts.deactivate : texts.reactivate}
        destructive={person.isActive}
        busy={activeAction.busy}
        onConfirm={changeActive}
        onClose={() => setConfirming(null)}
      />
    </SectionCard>
  );
}

function TwoStepSection({ person, isYou, onChanged }: SectionProps) {
  const action = usePortalAction();
  const [confirming, setConfirming] = useState(false);
  const texts = STAFF_MEMBER_PAGE.twoStep;

  async function reset() {
    const done = await action.run(() => resetStaffTwoStep(person.id), texts.done);
    setConfirming(false);
    if (done) onChanged();
  }

  return (
    <SectionCard title={texts.heading}>
      <Stack spacing={3}>
        <Typography>{person.hasTwoStep ? texts.on : texts.off}</Typography>
        {isYou ? (
          <Typography variant="body2" color="textSecondary">
            {texts.selfNote}
          </Typography>
        ) : (
          <div>
            <Button
              variant="outlined"
              color="error"
              disabled={!person.hasTwoStep || action.busy}
              onClick={() => setConfirming(true)}
            >
              {action.busy ? texts.resetting : texts.reset}
            </Button>
          </div>
        )}
        {action.notice && <Alert severity="success">{action.notice}</Alert>}
        {action.error && <Alert severity="error">{action.error}</Alert>}
      </Stack>
      <ConfirmDialog
        open={confirming}
        title={texts.confirmTitle}
        text={texts.confirmText(person.fullName || person.email)}
        confirmLabel={texts.reset}
        destructive
        busy={action.busy}
        onConfirm={reset}
        onClose={() => setConfirming(false)}
      />
    </SectionCard>
  );
}

/** The same photo and profile form staff use for themselves, saving to this person (US18). */
function ProfileSection({ profile, onChanged }: { profile: StaffProfile; onChanged: () => void }) {
  return (
    <SectionCard title={STAFF_MEMBER_PAGE.profile.heading}>
      <Stack spacing={6}>
        <PhotoEditor
          profile={profile}
          onUpload={(photo) => uploadPhoto(profile.id, photo)}
          onRemove={() => removePhoto(profile.id)}
          onChanged={onChanged}
        />
        <ProfileForm
          key={profile.id}
          profile={profile}
          onSave={(changes) => updateProfile(profile.id, changes)}
          onSaved={onChanged}
        />
      </Stack>
    </SectionCard>
  );
}
