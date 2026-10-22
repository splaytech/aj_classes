// Invite a new staff member by name and e-mail (R2a story US1).

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';

import { INVITE_DIALOG, PORTAL_COMMON, PORTAL_ERRORS, PROFILE_LIMITS } from '@/constants';
import { isValidEmail } from '@/lib/validation';
import type { Result } from '@/services';

type InviteDialogProps = {
  open: boolean;
  onInvite: (email: string, fullName: string) => Promise<Result<string>>;
  onInvited: (email: string, userId: string) => void;
  onClose: () => void;
};

export function InviteDialog({ open, onInvite, onInvited, onClose }: InviteDialogProps) {
  const titleId = useId();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({ fullName: '', email: '' });
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);

  function reset() {
    setFullName('');
    setEmail('');
    setErrors({ fullName: '', email: '' });
    setFormError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = fullName.trim();
    const found = {
      fullName:
        name.length < PROFILE_LIMITS.nameMin || name.length > PROFILE_LIMITS.nameMax
          ? PORTAL_ERRORS.invalidName
          : '',
      email: inviteEmailError(email),
    };
    setErrors(found);
    if (found.fullName || found.email) return;

    setSending(true);
    setFormError('');
    const result = await onInvite(email.trim(), name);
    setSending(false);

    if (!result.ok) {
      setFormError(PORTAL_ERRORS[result.error]);
      return;
    }
    reset();
    onInvited(email.trim(), result.data);
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={sending ? undefined : handleClose}
      aria-labelledby={titleId}
      fullWidth
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle id={titleId}>{INVITE_DIALOG.heading}</DialogTitle>
        <DialogContent>
          <Stack spacing={4}>
            <DialogContentText>{INVITE_DIALOG.intro}</DialogContentText>
            <TextField
              label={INVITE_DIALOG.nameLabel}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              error={Boolean(errors.fullName)}
              helperText={errors.fullName}
              autoComplete="off"
              required
            />
            <TextField
              label={INVITE_DIALOG.emailLabel}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={Boolean(errors.email)}
              helperText={errors.email || INVITE_DIALOG.roleNote}
              autoComplete="off"
              required
            />
            {formError && <Alert severity="error">{formError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={sending}>
            {PORTAL_COMMON.cancel}
          </Button>
          <Button type="submit" variant="contained" disabled={sending}>
            {sending ? INVITE_DIALOG.sending : INVITE_DIALOG.send}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/** Worded for someone else's address (the shared check says "your"). */
function inviteEmailError(email: string): string {
  if (!email.trim()) return INVITE_DIALOG.emailRequired;
  return isValidEmail(email) ? '' : PORTAL_ERRORS.invalidEmail;
}
