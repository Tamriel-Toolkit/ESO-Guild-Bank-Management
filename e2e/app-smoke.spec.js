import { expect, test } from '@playwright/test'

test('guest can complete onboarding and log a ledger entry', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('ESO Guild Gold Ledger')).toBeVisible()

  // The new WelcomePage is visible
  await expect(page.getByText('Master Your Guild\'s Fortune')).toBeVisible()

  // Navigate to ledger as guest
  await page.getByRole('button', { name: 'Try as Guest' }).click()

  // Guest mode notification is now in a popover
  const notifications_btn = page.getByRole('button', { name: 'Open notifications' })
  await expect(notifications_btn).toBeVisible()
  await notifications_btn.click()
  await expect(page.getByText('Guest mode is temporary. Create an account to save your data to the server.')).toBeVisible()
  // Close popover to continue
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Open tutorial' }).click()
  await expect(page.getByText('Guided Tour')).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Skip', exact: true }).click()

  await page.getByLabel('Gold Amount').fill('2500')
  await page.getByRole('combobox', { name: 'Member', exact: true }).fill('member-one')
  await page.getByLabel('Optional Notes').fill('Guest smoke entry')
  await page.getByRole('checkbox', { name: 'Dues' }).click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByText('member-one')).toBeVisible()
  await expect(page.getByText('Guest smoke entry')).toBeVisible()
  await expect(page.getByRole('cell', { name: '2,500g' }).first()).toBeVisible()
})
