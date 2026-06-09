import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('login page is reachable and has no critical accessibility violations', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  const blockingViolations = results.violations.filter((violation) =>
    violation.impact === 'critical' || violation.impact === 'serious'
  );
  expect(blockingViolations).toEqual([]);
});
