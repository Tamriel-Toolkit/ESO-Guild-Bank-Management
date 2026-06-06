import { expect, test } from '@playwright/test'

test('guest can complete onboarding and log a ledger entry', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('ESO Guild Gold Ledger')).toBeVisible()
  await expect(page.getByText('Guest mode is temporary. Create an account to store data on the server for publication.')).toBeVisible()

  await page.getByRole('button', { name: 'Open tutorial' }).click()
  await expect(page.getByText('Guided Tour')).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Skip', exact: true }).click()

  await page.getByLabel('Gold Amount').fill('2500')
  await page.getByLabel('Member').fill('member-one')
  await page.getByLabel('Optional Notes').fill('Guest smoke entry')
  await page.getByRole('checkbox', { name: 'Dues' }).click()
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByText('member-one')).toBeVisible()
  await expect(page.getByText('Guest smoke entry')).toBeVisible()
  await expect(page.getByRole('cell', { name: '2,500g' }).first()).toBeVisible()
})