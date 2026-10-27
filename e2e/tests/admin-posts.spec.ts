import { test, expect } from '../src/fixtures/test-fixtures.js';
import { pollForRow } from '../src/db/poll.js';
import { adminPostsSelectors, publicPostsSelectors } from './admin-posts.selectors.js';

interface PostRow {
  id: string;
  title: string;
  body: string;
  author_id: string | null;
}

/** What a visitor may read: the anon column grant in app migration 20261025110100 (no author_id). */
interface PublicPostRow {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  body: string;
}

test.describe('Admin Daily Posts', () => {
  test('create, edit, delete a post reflected in both UI and DB', async ({
    authedAdminPage,
    db,
    marker,
    cleanup,
  }) => {
    const titleMarker = marker('post');
    cleanup.register(() =>
      db
        .query('DELETE FROM public.posts WHERE title LIKE $1', [`${titleMarker.prefix}%`])
        .then(() => undefined),
    );

    await authedAdminPage.goto('/portal/admin/posts');
    await adminPostsSelectors.newTitle(authedAdminPage).fill(titleMarker.value);
    await adminPostsSelectors.newBody(authedAdminPage).fill('Initial body content.');
    await adminPostsSelectors.publishButton(authedAdminPage).click();
    await expect(authedAdminPage.getByText('Post published.')).toBeVisible();

    const created = await pollForRow(
      () =>
        db.query<PostRow>('SELECT id, title, body, author_id FROM public.posts WHERE title = $1', [
          titleMarker.value,
        ]),
      (rows) => rows.length > 0,
      { description: `post row title=${titleMarker.value}` },
    );
    const post = created[0];
    expect(post.body).toBe('Initial body content.');
    // author_id is never populated by posts.service.ts's createPost() (no client-side auth.uid()
    // and no DB default/trigger) — it stays null. Asserted here so a future author-id feature
    // regresses visibly instead of silently.
    expect(post.author_id).toBeNull();

    const updatedBody = 'Updated body content.';
    await adminPostsSelectors.editButtonForRow(authedAdminPage, titleMarker.value).click();
    await adminPostsSelectors.editBody(authedAdminPage, post.id).fill(updatedBody);
    await adminPostsSelectors.saveButton(authedAdminPage).click();
    await expect(authedAdminPage.getByText('Post updated.')).toBeVisible();

    await pollForRow(
      () => db.query<{ body: string }>('SELECT body FROM public.posts WHERE id = $1', [post.id]),
      (rows) => rows[0]?.body === updatedBody,
      { description: `post ${post.id} updated body` },
    );

    await adminPostsSelectors.deleteButtonForRow(authedAdminPage, titleMarker.value).click();
    await adminPostsSelectors.confirmDeleteButton(authedAdminPage).click();
    await expect(authedAdminPage.getByText('Post deleted.')).toBeVisible();

    await pollForRow(
      () => db.query<{ id: string }>('SELECT id FROM public.posts WHERE id = $1', [post.id]),
      (rows) => rows.length === 0,
      { description: `post ${post.id} deleted` },
    );
  });

  test('public /posts renders published posts newest-first', async ({
    authedAdminPage,
    db,
    marker,
    cleanup,
  }) => {
    const olderMarker = marker('order-older');
    const newerMarker = marker('order-newer');
    cleanup.register(() =>
      db
        .query('DELETE FROM public.posts WHERE title LIKE $1', [`${olderMarker.prefix}%`])
        .then(() => undefined),
    );

    await authedAdminPage.goto('/portal/admin/posts');
    for (const title of [olderMarker.value, newerMarker.value]) {
      await adminPostsSelectors.newTitle(authedAdminPage).fill(title);
      await adminPostsSelectors.newBody(authedAdminPage).fill('Ordering probe body.');
      await adminPostsSelectors.publishButton(authedAdminPage).click();
      await expect(authedAdminPage.getByText('Post published.')).toBeVisible();
    }

    await pollForRow(
      () =>
        db.query<{ title: string }>('SELECT title FROM public.posts WHERE title = $1', [
          newerMarker.value,
        ]),
      (rows) => rows.length > 0,
    );

    await authedAdminPage.goto('/posts');
    await expect(publicPostsSelectors.heading(authedAdminPage)).toBeVisible();
    // /posts is pre-rendered and loads its list after mount (app ADR-0001), so the h1 is there
    // before any post. Wait for both markers before reading the order (BUG-2).
    for (const title of [newerMarker.value, olderMarker.value]) {
      await expect(
        publicPostsSelectors.postTitles(authedAdminPage).filter({ hasText: title }),
      ).toBeVisible();
    }
    const titles = await publicPostsSelectors.postTitles(authedAdminPage).allTextContents();
    const newerIndex = titles.indexOf(newerMarker.value);
    const olderIndex = titles.indexOf(olderMarker.value);
    expect(newerIndex).toBeGreaterThanOrEqual(0);
    expect(olderIndex).toBeGreaterThanOrEqual(0);
    expect(newerIndex).toBeLessThan(olderIndex);
  });

  test('long unbroken titles and URLs wrap: no sideways scroll on /posts or the admin page', async ({
    authedAdminPage,
    db,
    marker,
    cleanup,
  }) => {
    const titleMarker = marker('wrap');
    cleanup.register(() =>
      db
        .query('DELETE FROM public.posts WHERE title LIKE $1', [`${titleMarker.value}%`])
        .then(() => undefined),
    );
    // The longest title the page allows (120), ending in one unbroken run of letters (app BUG-4).
    const longTitle = titleMarker.value + 'W'.repeat(120 - titleMarker.value.length);
    const longUrlBody =
      'Enrol here: https://forms.example.com/ajclasses/term-1-2027-enrolment-form?utm_source=website&utm_medium=news&utm_campaign=term1';

    await authedAdminPage.goto('/portal/admin/posts');
    await adminPostsSelectors.newTitle(authedAdminPage).fill(longTitle);
    await adminPostsSelectors.newBody(authedAdminPage).fill(longUrlBody);
    await adminPostsSelectors.publishButton(authedAdminPage).click();
    await expect(authedAdminPage.getByText('Post published.')).toBeVisible();

    for (const width of [375, 1280]) {
      await authedAdminPage.setViewportSize({ width, height: 812 });
      for (const path of ['/posts', '/portal/admin/posts']) {
        await authedAdminPage.goto(path);
        await expect(
          authedAdminPage.getByRole('heading', { level: 2, name: longTitle }),
        ).toBeVisible();
        const overflow = await authedAdminPage.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${path} at ${width}px scrolls sideways`).toBe(0);
      }
    }
  });

  test('XSS guard: script payload renders as text, never executes', async ({
    authedAdminPage,
    db,
    marker,
    cleanup,
  }) => {
    const titleMarker = marker('xss');
    cleanup.register(() =>
      db
        .query('DELETE FROM public.posts WHERE title = $1', [titleMarker.value])
        .then(() => undefined),
    );

    const probe = '<script>window.__e2e_xss_probe = true</script> plain text';

    await authedAdminPage.goto('/portal/admin/posts');
    await adminPostsSelectors.newTitle(authedAdminPage).fill(titleMarker.value);
    await adminPostsSelectors.newBody(authedAdminPage).fill(probe);
    await adminPostsSelectors.publishButton(authedAdminPage).click();
    await expect(authedAdminPage.getByText('Post published.')).toBeVisible();

    await pollForRow(
      () =>
        db.query<{ id: string }>('SELECT id FROM public.posts WHERE title = $1', [
          titleMarker.value,
        ]),
      (rows) => rows.length > 0,
    );

    await authedAdminPage.goto('/posts');
    await expect(authedAdminPage.getByText(probe)).toBeVisible();

    const probeRan = await authedAdminPage.evaluate(
      () => (window as unknown as { __e2e_xss_probe?: boolean }).__e2e_xss_probe,
    );
    expect(probeRan).toBeUndefined();
  });

  test('RLS: anon can read the public post columns but not author_id, and cannot write', async ({
    authedAdminPage,
    anonDb,
    db,
    marker,
    cleanup,
  }) => {
    const titleMarker = marker('rls');
    cleanup.register(() =>
      db
        .query('DELETE FROM public.posts WHERE title = $1', [titleMarker.value])
        .then(() => undefined),
    );

    await authedAdminPage.goto('/portal/admin/posts');
    await adminPostsSelectors.newTitle(authedAdminPage).fill(titleMarker.value);
    await adminPostsSelectors.newBody(authedAdminPage).fill('RLS asymmetry probe.');
    await adminPostsSelectors.publishButton(authedAdminPage).click();
    await expect(authedAdminPage.getByText('Post published.')).toBeVisible();

    const [post] = await pollForRow(
      () =>
        db.query<PostRow>('SELECT id, title, body, author_id FROM public.posts WHERE title = $1', [
          titleMarker.value,
        ]),
      (rows) => rows.length > 0,
    );

    // Visitors may read only the columns in the anon column grant (app migration 20261025110100).
    const selectResult = await anonDb.select<PublicPostRow>(
      'posts',
      'id,created_at,updated_at,title,body',
    );
    expect(selectResult.error).toBeNull();
    expect(selectResult.data?.some((row) => row.id === post.id)).toBe(true);

    const authorResult = await anonDb.select('posts', 'author_id');
    expect(authorResult.error?.code).toBe('42501');

    const insertResult = await anonDb.insert('posts', { title: 'should-not-insert', body: 'nope' });
    expect(insertResult.error?.code).toBe('42501');

    const updateResult = await anonDb.update(
      'posts',
      { id: post.id },
      { body: 'should-not-update' },
    );
    expect(updateResult.error?.code).toBe('42501');

    const deleteResult = await anonDb.delete('posts', { id: post.id });
    expect(deleteResult.error?.code).toBe('42501');
  });
});
