import { expect, test } from '@playwright/test'

test('full recruitment and application workflow', async ({ page, context }) => {
  const uniqueId = Math.random().toString(36).slice(2, 7)
  const ownerUsername = `owner_${uniqueId}`
  const applicantUsername = `applicant_${uniqueId}`
  const guildName = `Guild_${uniqueId}`

  // 1. Owner Sign Up
  await page.goto('/')
  // Use the "Get Started" button on the WelcomePage
  await page.getByRole('button', { name: 'Get Started' }).click()
  await page.getByLabel('Username').fill(ownerUsername)
  await page.getByLabel('Recovery Email').fill(`${ownerUsername}@example.com`)
  await page.getByLabel('Password', { exact: true }).fill('password1234')
  await page.getByRole('button', { name: 'Create account' }).click()

  // Account created notification is now in a popover
  const notifications_btn = page.getByRole('button', { name: 'Open notifications' })
  await expect(notifications_btn).toBeVisible()
  await notifications_btn.click()
  await expect(page.getByText('Account created')).toBeVisible()
  await page.keyboard.press('Escape')

  // 2. Create Guild
  await page.getByLabel('New guild').fill(guildName)
  await page.getByRole('button', { name: 'Add' }).click()
  await notifications_btn.click()
  await expect(page.getByText('Guild created securely')).toBeVisible()
  await page.keyboard.press('Escape')

  // 3. Configure Recruitment
  await page.getByRole('tab', { name: 'Recruitment' }).click()
  await expect(page.getByTestId('recruitment-settings-title')).toBeVisible()
  await page.getByLabel('Enable Public Recruitment').check()
  await page.getByLabel('Guild Focus').click()
  await page.getByRole('option', { name: 'Social' }).click()
  await page.getByLabel('Guild Description').fill('We are a friendly social guild.')
  await page.getByRole('button', { name: 'Add Requirement' }).click()
  await page.getByPlaceholder('e.g. CP 160+, Level 50, Discord required...').fill('Be nice.')
  await page.getByRole('button', { name: 'Add Question' }).click()
  await page.getByPlaceholder('e.g. What is your primary role (Tank/Healer/DPS)?').fill('Favorite color?')
  await page.getByRole('button', { name: 'Save Settings' }).click()
  await expect(page.getByText('Recruitment settings saved successfully')).toBeVisible()

  await page.getByRole('button', { name: 'Log out' }).click()
  // Should be back on the WelcomePage
  await expect(page.getByText('Master Your Guild\'s Fortune')).toBeVisible()

  // 4. Applicant Sign Up
  await page.getByRole('button', { name: 'Get Started' }).click()
  await page.getByLabel('Username').fill(applicantUsername)
  await page.getByLabel('Recovery Email').fill(`${applicantUsername}@example.com`)
  await page.getByLabel('Password', { exact: true }).fill('password1234')
  await page.getByRole('button', { name: 'Create account' }).click()

  // Account created notification is now in a popover
  await notifications_btn.click()
  await expect(page.getByText('Account created')).toBeVisible()
  await page.keyboard.press('Escape')

  // 5. Discover and Apply
  await page.getByRole('tab', { name: 'Ledger' }).click() // Transition to discovery from a logged in state normally requires clicking a tab or link
  await page.getByRole('button', { name: 'Browse Guilds' }).first().click()
  // Use first() to avoid ambiguity because both hero and discovery page have this title
  await expect(page.getByRole('heading', { name: 'Guild Discovery' }).first()).toBeVisible()

  // Find the specific guild card to avoid clicking on others from previous runs
  const guildCard = page.locator('.MuiCard-root').filter({ hasText: guildName })
  await expect(guildCard).toBeVisible()
  await guildCard.getByRole('button', { name: 'View Profile' }).click()

  await expect(page.getByText('We are a friendly social guild.')).toBeVisible()
  await expect(page.getByText('Be nice.')).toBeVisible()

  await page.getByLabel('Favorite color?').fill('Blue')
  await page.getByRole('button', { name: 'Submit Application' }).click()
  await expect(page.getByText('Your application has been submitted successfully!')).toBeVisible()

  // 6. Check My Apps
  await page.getByRole('tab', { name: 'My Apps' }).click()
  await expect(page.getByText(guildName)).toBeVisible()
  await expect(page.getByText('PENDING')).toBeVisible()

  await page.getByRole('button', { name: 'Log out' }).click()

  // 7. Owner Review
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.getByLabel('Username').fill(ownerUsername)
  await page.getByLabel('Password').fill('password1234')
  await page.getByRole('button', { name: 'Log in' }).click()

  await page.getByRole('tab', { name: 'Recruitment' }).click()
  await page.getByRole('tab', { name: 'Applications' }).click()
  await expect(page.getByText(applicantUsername)).toBeVisible()
  await expect(page.getByText('Blue')).toBeVisible()

  await page.getByRole('button', { name: 'Start Review' }).click()
  await page.getByLabel('Status').click()
  await page.getByRole('option', { name: 'Accepted (Add to Guild)' }).click()
  await page.getByLabel('Officer Notes').fill('Welcome aboard!')
  await page.getByRole('button', { name: 'Save' }).click()

  // 8. Verify membership
  await page.getByRole('tab', { name: 'Members', exact: true }).click()
  // The applicant should now be in the member list
  await expect(page.getByRole('heading', { name: 'Member Management' }).first()).toBeVisible()
  // Search for the member name in the table body specifically (it's in an input field)
  await expect(page.locator(`input[value="${applicantUsername}"]`)).toBeVisible()
})
