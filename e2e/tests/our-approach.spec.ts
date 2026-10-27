import { test, expect } from '../src/fixtures/test-fixtures.js';

const STEPS = [
  { name: 'Assess', assertion: 'We start by knowing your child.' },
  { name: 'Plan', assertion: 'We build a plan that fits.' },
  { name: 'Practise', assertion: 'We turn practice into confidence.' },
  { name: 'Review', assertion: 'We keep you in the loop.' },
];

test.describe('Our Approach homepage section', () => {
  test('renders all four steps, in order, each with one h3', async ({ page }) => {
    await page.goto('/#approach');

    const cards = page.locator('#approach ol > li');
    await expect(cards).toHaveCount(STEPS.length);

    for (let i = 0; i < STEPS.length; i += 1) {
      const card = cards.nth(i);
      const headings = card.locator('h3');
      await expect(headings).toHaveCount(1);
      await expect(headings).toHaveText(STEPS[i].name);
      await expect(card.getByText(STEPS[i].assertion)).toBeVisible();
    }
  });
});
