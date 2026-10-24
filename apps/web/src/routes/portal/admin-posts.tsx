// Admin → Posts (posts.md): compose a short update, and edit or delete posts already published.
// Every post is public the instant it's saved — RLS, not this page, is what makes it so.

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useLoaderData, useRevalidator } from 'react-router';

import {
  ConfirmDialog,
  LoadError,
  PageHeader,
  TextAreaInput,
  TextInput,
} from '@/components/portal';
import { POST_LIMITS, POSTS_PAGE, PORTAL_SEO } from '@/constants';
import { formatDateTime } from '@/lib/format';
import { buildPortalMeta } from '@/lib/seo';
import { usePortalAction } from '@/lib/use-portal-action';
import { createPost, deletePost, listPosts, updatePost } from '@/services';
import type { Post } from '@/services';

export function meta() {
  return buildPortalMeta(PORTAL_SEO.adminPosts);
}

// Access (admin) is checked by the admin layout.
export async function clientLoader() {
  return listPosts();
}

function emptyDraft(): { title: string; body: string } {
  return { title: '', body: '' };
}

export default function AdminPostsPage() {
  const loaded = useLoaderData<typeof clientLoader>();
  const revalidator = useRevalidator();
  const action = usePortalAction();
  const [draft, setDraft] = useState(emptyDraft());
  const [editingId, setEditingId] = useState('');
  const [editDraft, setEditDraft] = useState(emptyDraft());
  const [toDelete, setToDelete] = useState<Post | null>(null);

  if (!loaded.ok) return <LoadError error={loaded.error} />;

  async function publish() {
    const worked = await action.run(
      () => createPost({ title: draft.title, body: draft.body }),
      POSTS_PAGE.published,
    );
    if (worked) {
      setDraft(emptyDraft());
      revalidator.revalidate();
    }
  }

  function startEdit(post: Post) {
    action.clear();
    setEditingId(post.id);
    setEditDraft({ title: post.title, body: post.body });
  }

  function cancelEdit() {
    setEditingId('');
    setEditDraft(emptyDraft());
  }

  async function saveEdit() {
    const worked = await action.run(
      () => updatePost(editingId, { title: editDraft.title, body: editDraft.body }),
      POSTS_PAGE.saved,
    );
    if (worked) {
      cancelEdit();
      revalidator.revalidate();
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const worked = await action.run(() => deletePost(toDelete.id), POSTS_PAGE.deleted);
    if (worked) {
      setToDelete(null);
      revalidator.revalidate();
    }
  }

  return (
    <>
      <PageHeader title={POSTS_PAGE.heading} intro={POSTS_PAGE.intro} />
      <Stack spacing={2} sx={{ mb: 2 }}>
        {action.notice && <Alert severity="success">{action.notice}</Alert>}
        {action.error && <Alert severity="error">{action.error}</Alert>}
      </Stack>

      <Paper variant="outlined" sx={{ p: 3, mb: 4 }}>
        <Stack spacing={2}>
          <TextInput
            id="post-title"
            label={POSTS_PAGE.titleLabel}
            value={draft.title}
            onChange={(title) => setDraft((current) => ({ ...current, title }))}
            maxLength={POST_LIMITS.titleMax}
          />
          <TextAreaInput
            id="post-body"
            label={POSTS_PAGE.bodyLabel}
            value={draft.body}
            onChange={(body) => setDraft((current) => ({ ...current, body }))}
            maxLength={POST_LIMITS.bodyMax}
          />
          <Box>
            <Button variant="contained" onClick={publish} disabled={action.busy}>
              {action.busy ? POSTS_PAGE.publishing : POSTS_PAGE.publish}
            </Button>
          </Box>
        </Stack>
      </Paper>

      <Stack spacing={2}>
        {loaded.data.map((post) =>
          editingId === post.id ? (
            <Paper key={post.id} variant="outlined" sx={{ p: 3 }}>
              <Stack spacing={2}>
                <TextInput
                  id={`post-title-${post.id}`}
                  label={POSTS_PAGE.titleLabel}
                  value={editDraft.title}
                  onChange={(title) => setEditDraft((current) => ({ ...current, title }))}
                  maxLength={POST_LIMITS.titleMax}
                />
                <TextAreaInput
                  id={`post-body-${post.id}`}
                  label={POSTS_PAGE.bodyLabel}
                  value={editDraft.body}
                  onChange={(body) => setEditDraft((current) => ({ ...current, body }))}
                  maxLength={POST_LIMITS.bodyMax}
                />
                <Stack direction="row" spacing={2}>
                  <Button variant="contained" onClick={saveEdit} disabled={action.busy}>
                    {action.busy ? POSTS_PAGE.saving : POSTS_PAGE.save}
                  </Button>
                  <Button onClick={cancelEdit} disabled={action.busy}>
                    {POSTS_PAGE.cancel}
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          ) : (
            <Paper key={post.id} variant="outlined" sx={{ p: 3 }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-start' } }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {formatDateTime(post.publishedAt)}
                  </Typography>
                  <Typography variant="h6" component="h2">
                    {post.title}
                  </Typography>
                  <Typography sx={{ whiteSpace: 'pre-wrap' }}>{post.body}</Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                  <Button size="small" onClick={() => startEdit(post)} disabled={action.busy}>
                    {POSTS_PAGE.edit}
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => setToDelete(post)}
                    disabled={action.busy}
                  >
                    {POSTS_PAGE.delete}
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          ),
        )}
        {loaded.data.length === 0 && (
          <Typography color="text.secondary">{POSTS_PAGE.empty}</Typography>
        )}
      </Stack>

      <ConfirmDialog
        open={toDelete !== null}
        title={POSTS_PAGE.confirmDeleteTitle}
        text={POSTS_PAGE.confirmDeleteText(toDelete?.title ?? '')}
        confirmLabel={POSTS_PAGE.delete}
        destructive
        busy={action.busy}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
