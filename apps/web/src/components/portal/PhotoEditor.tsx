// Profile photo: choose, preview, then "Use this photo" uploads straight away (R2a story US13, V31).
// The photo is cropped, resized and re-encoded in the browser first (lib/photo.ts).

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

import { Button } from '@/components/ui';
import { AUTH_ERRORS, PROFILE_PAGE, PROFILE_VALIDATION } from '@/constants';
import { checkPhotoFile, preparePhoto } from '@/lib/photo';
import type { Result, StaffProfile } from '@/services';

import { FormAlert, FormStatus } from './PortalField';
import formStyles from './PortalForm.module.css';
import styles from './PhotoEditor.module.css';

const FILE_INPUT_ID = 'profile-photo-file';
const HEADING_ID = 'profile-photo-heading';

/** A chosen, resized photo waiting for "Use this photo", with a temporary URL to preview it. */
type PendingPhoto = { blob: Blob; previewUrl: string };

type PhotoEditorProps = {
  profile: StaffProfile;
  onUpload: (photo: Blob) => Promise<Result<StaffProfile>>;
  onRemove: () => Promise<Result<StaffProfile>>;
  onChanged: () => void;
};

export function PhotoEditor({ profile, onUpload, onRemove, onChanged }: PhotoEditorProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingPhoto | null>(null);
  useReleasePreviewUrl(pending);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState<'idle' | 'uploading' | 'removing'>('idle');

  async function handleFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // choosing the same file again should still trigger a change
    setStatus('');
    if (!file) return;

    const problem = checkPhotoFile(file);
    if (problem) {
      setError(problem);
      return;
    }

    const prepared = await preparePhoto(file);
    if (!prepared) {
      setError(PROFILE_VALIDATION.photoUnreadable);
      return;
    }
    setError('');
    setPending({ blob: prepared, previewUrl: URL.createObjectURL(prepared) });
  }

  async function handleUse() {
    if (!pending) return;
    setBusy('uploading');
    const result = await onUpload(pending.blob);
    setBusy('idle');
    if (!result.ok) {
      setError(AUTH_ERRORS[result.error]);
      return;
    }
    setPending(null);
    setStatus(PROFILE_PAGE.photo.saved);
    onChanged();
  }

  async function handleRemove() {
    if (!window.confirm(PROFILE_PAGE.photo.confirmRemove)) return;
    setBusy('removing');
    const result = await onRemove();
    setBusy('idle');
    if (!result.ok) {
      setError(AUTH_ERRORS[result.error]);
      return;
    }
    setStatus(PROFILE_PAGE.photo.removed);
    onChanged();
  }

  const previewUrl = pending?.previewUrl ?? null;
  const shownUrl = previewUrl ?? profile.photoUrl;

  return (
    <section className={styles.photo} aria-labelledby={HEADING_ID}>
      <h2 id={HEADING_ID} className={styles.heading}>
        {PROFILE_PAGE.photo.heading}
      </h2>

      <div className={styles.row}>
        {shownUrl ? (
          <img
            className={styles.image}
            src={shownUrl}
            alt={
              previewUrl ? PROFILE_PAGE.photo.previewAlt : PROFILE_PAGE.photo.alt(profile.fullName)
            }
            width={128}
            height={128}
          />
        ) : (
          <div className={styles.placeholder}>{PROFILE_PAGE.photo.noPhoto}</div>
        )}

        <div className={styles.actions}>
          <p className={formStyles.hint}>{PROFILE_PAGE.photo.note}</p>
          <p className={formStyles.hint}>{PROFILE_PAGE.photo.hint}</p>
          <input
            ref={fileInput}
            id={FILE_INPUT_ID}
            className={styles.fileInput}
            type="file"
            accept={PROFILE_PAGE.photo.accept}
            onChange={handleFileChosen}
          />

          {pending ? (
            <div className={formStyles.actions}>
              <Button onClick={handleUse} disabled={busy !== 'idle'}>
                {busy === 'uploading' ? PROFILE_PAGE.photo.uploading : PROFILE_PAGE.photo.use}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setPending(null)}
                disabled={busy !== 'idle'}
              >
                {PROFILE_PAGE.photo.cancel}
              </Button>
            </div>
          ) : (
            <div className={formStyles.actions}>
              <Button variant="secondary" onClick={() => fileInput.current?.click()}>
                {profile.photoUrl ? PROFILE_PAGE.photo.change : PROFILE_PAGE.photo.choose}
              </Button>
              {profile.photoUrl && (
                <button
                  type="button"
                  className={formStyles.textButton}
                  onClick={handleRemove}
                  disabled={busy !== 'idle'}
                >
                  {busy === 'removing' ? PROFILE_PAGE.photo.removing : PROFILE_PAGE.photo.remove}
                </button>
              )}
            </div>
          )}

          <FormAlert message={error} />
          <FormStatus message={status} />
        </div>
      </div>
    </section>
  );
}

/** Frees the preview's temporary URL once it's replaced, cleared or the page is left. */
function useReleasePreviewUrl(pending: PendingPhoto | null) {
  useEffect(() => {
    return () => {
      if (pending) URL.revokeObjectURL(pending.previewUrl);
    };
  }, [pending]);
}
