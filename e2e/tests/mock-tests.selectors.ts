import type { Page } from '@playwright/test';

export const adminMockTestSelectors = {
  newButton: (page: Page) => page.getByRole('button', { name: 'New mock test' }),
  titleField: (page: Page) => page.getByRole('textbox', { name: /^Title/ }),
  createButton: (page: Page) => page.getByRole('button', { name: 'Create mock test' }),

  addQuestionButton: (page: Page) => page.getByRole('button', { name: 'Add question' }),
  promptField: (page: Page) => page.getByRole('textbox', { name: /^Question/ }),
  optionField: (page: Page, letter: string) =>
    page.getByRole('textbox', { name: `Option ${letter}`, exact: true }),
  correctRadio: (page: Page, letter: string) =>
    page.getByRole('radio', { name: `Option ${letter} is correct` }),
  explanationField: (page: Page) => page.getByRole('textbox', { name: /^Explanation/ }),
  saveQuestionButton: (page: Page) => page.getByRole('button', { name: 'Save question' }),
  questionHeading: (page: Page, position: number) =>
    page.getByRole('heading', { level: 3, name: `Question ${position}` }),

  releaseButton: (page: Page) => page.getByRole('button', { name: 'Release', exact: true }),
  confirmReleaseButton: (page: Page) =>
    page.getByRole('dialog').getByRole('button', { name: 'Release', exact: true }),
  releasedNotice: (page: Page) => page.getByText('Released. People can take it now.'),

  // Tags (categories): MUI selects are comboboxes; their options open in a listbox.
  tagSelect: (page: Page, label: 'Subject' | 'Stream' | 'Year level') =>
    page.getByRole('dialog').getByRole('combobox', { name: label }),
  tagOption: (page: Page, name: string) =>
    page.getByRole('listbox').getByRole('option', { name, exact: true }),
  saveDetailsButton: (page: Page) =>
    page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }),
  editDetailsButton: (page: Page) => page.getByRole('button', { name: 'Edit details' }),
  editTagsButton: (page: Page) => page.getByRole('button', { name: 'Edit tags' }),
  missingTagsHint: (page: Page, names: string) =>
    page.getByText(`Set the ${names} to release this mock test.`),
  cancelDialogButton: (page: Page) =>
    page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }),
  tagsSavedNotice: (page: Page) => page.getByText('Tags saved.'),

  closeNowButton: (page: Page) => page.getByRole('button', { name: 'Close now', exact: true }),
  confirmCloseNowButton: (page: Page) =>
    page.getByRole('dialog').getByRole('button', { name: 'Close now', exact: true }),
  closedNotice: (page: Page) => page.getByText('Closed. People can no longer see it.'),
};

export const takeMockTestSelectors = {
  listHeading: (page: Page) => page.getByRole('heading', { level: 1, name: 'Mock tests' }),
  // Each mock test is a card (a MUI Paper) with its own h2 title and a link to open it.
  cardByTitle: (page: Page, title: string) =>
    page
      .locator('.MuiPaper-root')
      .filter({ has: page.getByRole('heading', { level: 2, name: title, exact: true }) }),
  startLink: (page: Page, title: string) =>
    takeMockTestSelectors.cardByTitle(page, title).getByRole('link', { name: 'Start' }),
  startButton: (page: Page) => page.getByRole('button', { name: 'Start', exact: true }),
  questionHeading: (page: Page, position: number, total: number) =>
    page.getByRole('heading', { level: 2, name: `Question ${position} of ${total}` }),
  option: (page: Page, name: RegExp) => page.getByRole('radio', { name }),
  nextButton: (page: Page) => page.getByRole('button', { name: 'Next', exact: true }),
  submitButton: (page: Page) => page.getByRole('button', { name: 'Submit', exact: true }),
  confirmSubmitButton: (page: Page) =>
    page.getByRole('dialog').getByRole('button', { name: 'Submit', exact: true }),
  score: (page: Page, score: number, total: number) =>
    page.getByText(`${score} of ${total} correct`),
  filter: (page: Page, label: 'Stream' | 'Subject' | 'Year level') =>
    page.getByRole('region', { name: 'Filter mock tests' }).getByRole('combobox', { name: label }),
  filterOption: (page: Page, name: string) =>
    page.getByRole('listbox').getByRole('option', { name, exact: true }),
  noMatch: (page: Page) => page.getByText('No mock tests match these filters.'),
  clearFilters: (page: Page) => page.getByRole('button', { name: 'Clear filters' }),
};

export const forbiddenSelectors = {
  heading: (page: Page) =>
    page.getByRole('heading', { name: "You don't have access to this page" }),
};
