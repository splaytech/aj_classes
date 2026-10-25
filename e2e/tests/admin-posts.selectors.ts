import type { Page } from '@playwright/test';

export const adminPostsSelectors = {
  newTitle: (page: Page) => page.locator('#post-title'),
  newBody: (page: Page) => page.locator('#post-body'),
  publishButton: (page: Page) => page.getByRole('button', { name: /^publish$/i }),

  editTitle: (page: Page, postId: string) => page.locator(`#post-title-${postId}`),
  editBody: (page: Page, postId: string) => page.locator(`#post-body-${postId}`),
  saveButton: (page: Page) => page.getByRole('button', { name: /^save$/i }),

  // Each post row is a MUI Paper (div), not a list item; scope by the post's own h2 heading.
  rowByTitle: (page: Page, title: string) =>
    page
      .locator('.MuiPaper-root')
      .filter({ has: page.getByRole('heading', { level: 2, name: title, exact: true }) }),
  editButtonForRow: (page: Page, title: string) =>
    adminPostsSelectors.rowByTitle(page, title).getByRole('button', { name: /^edit$/i }),
  deleteButtonForRow: (page: Page, title: string) =>
    adminPostsSelectors.rowByTitle(page, title).getByRole('button', { name: /^delete$/i }),
  confirmDeleteButton: (page: Page) =>
    page.getByRole('dialog').getByRole('button', { name: /^delete$/i }),
};

export const publicPostsSelectors = {
  heading: (page: Page) => page.getByRole('heading', { name: 'Latest news', level: 1 }),
  postTitles: (page: Page) => page.locator('li h2'),
};
