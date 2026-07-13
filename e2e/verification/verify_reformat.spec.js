
import { test, expect } from '@playwright/test';

test('verify reformatted ledger filters', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Go to Ledger as guest
  await page.getByRole('button', { name: /Try as Guest/i }).click();
  await page.getByRole('link', { name: /Ledger/i }).click();

  // Wait for the filter card
  await expect(page.getByText(/Ledger Filters/i)).toBeVisible();

  // Check for section headers
  await expect(page.getByText(/Search & Members/i)).toBeVisible();
  await expect(page.getByText(/Date Range/i)).toBeVisible();
  await expect(page.getByText(/Categories & Limits/i)).toBeVisible();

  // Take screenshot
  await page.screenshot({ path: '/home/jules/verification/ledger_filters_reformatted.png', fullPage: false });
});
