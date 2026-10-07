// The frame every create / edit dialog uses: title, fields, error, Cancel and Save.

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import { useId } from 'react';
import type { FormEvent, ReactNode } from 'react';

import { PORTAL_COMMON } from '@/constants';

type FormDialogProps = {
  open: boolean;
  title: string;
  submitLabel: string;
  busyLabel: string;
  busy: boolean;
  error?: string;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
};

export function FormDialog({
  open,
  title,
  submitLabel,
  busyLabel,
  busy,
  error,
  onSubmit,
  onClose,
  children,
}: FormDialogProps) {
  const titleId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      aria-labelledby={titleId}
      fullWidth
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle id={titleId}>{title}</DialogTitle>
        <DialogContent>
          <Stack spacing={4} sx={{ pt: 2 }}>
            {children}
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            {PORTAL_COMMON.cancel}
          </Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? busyLabel : submitLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
