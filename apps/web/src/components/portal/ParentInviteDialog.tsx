// Invite a parent for a student, or link a parent who already has an account (R3b story FA2).
// The name is only needed for a new parent; the server says so if it's missing. If the e-mail
// belongs to someone who signed up on the website, the admin confirms before they are linked
// (open sign-up AC-33): the form gives way to that question.

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

import { PARENT_INVITE_DIALOG, PORTAL_COMMON, PORTAL_ERRORS, PROFILE_LIMITS } from '@/constants';
import { formatDate } from '@/lib/format';
import { isValidEmail } from '@/lib/validation';
import type { ParentInviteOutcome, Result } from '@/services';

type ParentInviteDialogProps = {
  open: boolean;
  studentName: string;
  onInvite: (
    email: string,
    fullName: string,
    confirmUserId?: string,
  ) => Promise<Result<ParentInviteOutcome>>;
  onDone: (email: string, outcome: ParentInviteOutcome) => void;
  onClose: () => void;
};

export function ParentInviteDialog({
  open,
  studentName,
  onInvite,
  onDone,
  onClose,
}: ParentInviteDialogProps) {
  const titleId = useId();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({ fullName: '', email: '' });
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);
  const [toConfirm, setToConfirm] = useState<SignedUpOutcome | null>(null);

  function reset() {
    setFullName('');
    setEmail('');
    setErrors({ fullName: '', email: '' });
    setFormError('');
    setToConfirm(null);
  }

  function finish(result: Result<ParentInviteOutcome>) {
    if (!result.ok) {
      if (result.error === 'invalidName')
        setErrors({ fullName: PORTAL_ERRORS.invalidName, email: '' });
      else setFormError(PORTAL_ERRORS[result.error]);
      return;
    }
    if (result.data.kind === 'needsConfirmation') {
      setToConfirm(result.data);
      return;
    }
    const sentTo = email.trim();
    reset();
    onDone(sentTo, result.data);
  }

  async function handleConfirm() {
    if (!toConfirm) return;
    setSending(true);
    setFormError('');
    const result = await onInvite(email.trim(), fullName.trim(), toConfirm.userId);
    setSending(false);
    // A refused or changed promotion goes back to the form, where Invite or link tries again.
    if (!result.ok) setToConfirm(null);
    finish(result);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = fullName.trim();
    const found = { fullName: nameError(name), email: emailError(email) };
    setErrors(found);
    if (found.fullName || found.email) return;

    setSending(true);
    setFormError('');
    const result = await onInvite(email.trim(), name);
    setSending(false);
    finish(result);
  }

  function handleClose() {
    reset();
    onClose();
  }

  if (toConfirm) {
    const words = PARENT_INVITE_DIALOG.promote;
    return (
      <Dialog
        open={open}
        onClose={sending ? undefined : handleClose}
        aria-labelledby={titleId}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle id={titleId}>{words.heading}</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <DialogContentText>{words.text(studentName)}</DialogContentText>
            <DialogContentText>
              {words.signedUp(
                words.methods[toConfirm.signedUpWith],
                formatDate(toConfirm.signedUpAt),
              )}
            </DialogContentText>
            {toConfirm.signedUpWith === 'google' && (
              <DialogContentText>{words.googleMobile}</DialogContentText>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={sending}>
            {PORTAL_COMMON.cancel}
          </Button>
          <Button variant="contained" onClick={handleConfirm} disabled={sending}>
            {sending ? words.linking : words.confirm}
          </Button>
        </DialogActions>
      </Dialog>
    );
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
        <DialogTitle id={titleId}>{PARENT_INVITE_DIALOG.heading}</DialogTitle>
        <DialogContent>
          <Stack spacing={4}>
            <DialogContentText>{PARENT_INVITE_DIALOG.intro(studentName)}</DialogContentText>
            <TextField
              label={PARENT_INVITE_DIALOG.emailLabel}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={Boolean(errors.email)}
              helperText={errors.email}
              autoComplete="off"
              required
            />
            <TextField
              label={PARENT_INVITE_DIALOG.nameLabel}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              error={Boolean(errors.fullName)}
              helperText={errors.fullName || PARENT_INVITE_DIALOG.nameHint}
              autoComplete="off"
            />
            {formError && <Alert severity="error">{formError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={sending}>
            {PORTAL_COMMON.cancel}
          </Button>
          <Button type="submit" variant="contained" disabled={sending}>
            {sending ? PARENT_INVITE_DIALOG.sending : PARENT_INVITE_DIALOG.send}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

type SignedUpOutcome = Extract<ParentInviteOutcome, { kind: 'needsConfirmation' }>;

/** Optional, but if given it must be a sensible length. */
function nameError(name: string): string {
  if (!name) return '';
  const fits = name.length >= PROFILE_LIMITS.nameMin && name.length <= PROFILE_LIMITS.nameMax;
  return fits ? '' : PORTAL_ERRORS.invalidName;
}

function emailError(email: string): string {
  if (!email.trim()) return PARENT_INVITE_DIALOG.emailRequired;
  return isValidEmail(email) ? '' : PORTAL_ERRORS.invalidEmail;
}
