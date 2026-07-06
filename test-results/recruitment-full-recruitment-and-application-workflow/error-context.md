# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recruitment.spec.js >> full recruitment and application workflow
- Location: e2e/recruitment.spec.js:3:1

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Need an account?' })

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - banner [ref=e4]:
        - generic [ref=e5]:
          - generic [ref=e6]:
            - img [ref=e7]
            - heading [level=6] [ref=e8]: ESO Guild Gold Ledger
          - generic [ref=e9]:
            - button [ref=e10] [cursor=pointer]: Browse Guilds
            - button [ref=e11] [cursor=pointer]:
              - img [ref=e12]
            - button [ref=e14] [cursor=pointer]: Sign up / Log in
      - generic [ref=e16]:
        - generic [ref=e17]:
          - generic [ref=e18]: Elder Scrolls Online Guild Ledger
          - heading [level=4] [ref=e19]: Track Guild Gold Flow
          - paragraph [ref=e20]: Track deposits, withdrawals, and sales tax with member-linked entries.
        - button [ref=e22] [cursor=pointer]: Export Reports
        - generic [ref=e23]:
          - alert [ref=e24]:
            - img [ref=e26]
            - generic [ref=e28]: Logged out.
            - button [ref=e30] [cursor=pointer]:
              - img [ref=e31]
          - alert [ref=e33]:
            - img [ref=e35]
            - generic [ref=e37]: Guest mode is temporary. Create an account to save your data to the server.
        - generic [ref=e39]:
          - heading [level=6] [ref=e40]: Add Entry
          - generic [ref=e41]:
            - generic [ref=e42]:
              - generic [ref=e43]: Type
              - generic [ref=e44]:
                - combobox [ref=e45] [cursor=pointer]: Deposit
                - textbox: deposit
                - img
                - group:
                  - generic: Type
            - generic [ref=e46]:
              - generic: Gold Amount
              - generic [ref=e47]:
                - spinbutton [ref=e48]
                - group:
                  - generic: Gold Amount
            - generic [ref=e49]:
              - generic [ref=e50]: Date
              - generic [ref=e51]:
                - textbox [ref=e52]: 2026-07-05
                - group:
                  - generic: Date
            - generic [ref=e54]:
              - generic: Member
              - generic [ref=e55]:
                - combobox [ref=e56]
                - group:
                  - generic: Member
            - generic [ref=e58]:
              - generic: Optional Notes
              - generic [ref=e59]:
                - textbox [ref=e60]
                - group:
                  - generic: Optional Notes
            - generic [ref=e61]:
              - generic [ref=e62] [cursor=pointer]:
                - generic [ref=e63]:
                  - checkbox [ref=e64]
                  - img [ref=e65]
                - generic [ref=e67]: Donation
              - generic [ref=e68] [cursor=pointer]:
                - generic [ref=e69]:
                  - checkbox [ref=e70]
                  - img [ref=e71]
                - generic [ref=e73]: Dues
            - button [ref=e74] [cursor=pointer]: Save
        - generic [ref=e77]:
          - generic [ref=e78]:
            - generic [ref=e79]:
              - heading [level=6] [ref=e80]: Search, Filters, and Saved Views
              - paragraph [ref=e81]: Narrow the ledger by member, amount, type, notes, and dates. Saved views keep recurring review setups one click away.
            - generic [ref=e82]:
              - generic [ref=e83]:
                - generic: Saved view
                - generic [ref=e84]:
                  - combobox [ref=e85] [cursor=pointer]
                  - textbox
                  - img
                  - group:
                    - generic: Saved view
              - button [ref=e86] [cursor=pointer]: Save current view
              - button [disabled]: Delete view
              - button [ref=e87] [cursor=pointer]: Clear filters
          - generic [ref=e88]:
            - generic [ref=e89]:
              - generic: Search notes, members, and types
              - generic [ref=e90]:
                - textbox [ref=e91]
                - group:
                  - generic: Search notes, members, and types
            - generic [ref=e93]:
              - generic: Member filter
              - generic [ref=e94]:
                - combobox [ref=e95]
                - group:
                  - generic: Member filter
            - generic [ref=e97]:
              - generic [ref=e98]: Entry type
              - generic [ref=e99]:
                - combobox [ref=e100] [cursor=pointer]: All types
                - textbox: all
                - img
                - group:
                  - generic: Entry type
            - generic [ref=e101]:
              - generic [ref=e102]: Deposit subtype
              - generic [ref=e103]:
                - combobox [ref=e104] [cursor=pointer]: All deposits
                - textbox: all
                - img
                - group:
                  - generic: Deposit subtype
            - generic [ref=e105]:
              - generic [ref=e106]: Withdrawal category
              - generic [ref=e107]:
                - combobox [ref=e108] [cursor=pointer]: All withdrawals
                - textbox: all
                - img
                - group:
                  - generic: Withdrawal category
            - generic [ref=e109]:
              - generic: Min amount
              - generic [ref=e110]:
                - spinbutton [ref=e111]
                - group:
                  - generic: Min amount
            - generic [ref=e112]:
              - generic: Max amount
              - generic [ref=e113]:
                - spinbutton [ref=e114]
                - group:
                  - generic: Max amount
          - generic [ref=e115]:
            - generic [ref=e116]:
              - generic [ref=e117]: Start date
              - generic [ref=e118]:
                - textbox [ref=e119]: 2026-07-05
                - group:
                  - generic: Start date
            - generic [ref=e120]:
              - generic [ref=e121]: End date
              - generic [ref=e122]:
                - textbox [ref=e123]: 2026-07-05
                - group:
                  - generic: End date
            - button [ref=e124] [cursor=pointer]: All dates
            - button [ref=e125] [cursor=pointer]: Today
          - generic [ref=e126]:
            - generic [ref=e128]: Showing 0 of 0 entries
            - generic [ref=e130]: "Date range: 07/05/2026 - 07/05/2026"
            - generic [ref=e132]: Filtered view active
        - generic [ref=e134]:
          - generic [ref=e135]:
            - generic [ref=e136]:
              - heading [level=6] [ref=e137]: Statistics
              - paragraph [ref=e138]: Aggregates reflect the current filtered ledger view, so reports stay readable as the log grows.
            - generic [ref=e139]:
              - generic [ref=e141]: "Periods shown: 4"
              - generic [ref=e143]: "Entries in view: 0"
              - generic [ref=e145]: "Top donors shown per row: 0"
          - table [ref=e147]:
            - rowgroup [ref=e148]:
              - row [ref=e149]:
                - columnheader [ref=e150]: Range
                - columnheader [ref=e151]: Entries
                - columnheader [ref=e152]: Top Contributors
                - columnheader [ref=e153]: Deposits
                - columnheader [ref=e154]: Withdrawals
                - columnheader [ref=e155]: Sales Tax
                - columnheader [ref=e156]: Grand Total
            - rowgroup [ref=e157]:
              - row [ref=e158]:
                - cell [ref=e159]:
                  - generic [ref=e160] [cursor=pointer]:
                    - button [ref=e161]:
                      - img [ref=e162]
                    - heading [level=6] [ref=e164]: Overall
              - row [ref=e165]:
                - cell [ref=e166]:
                  - paragraph [ref=e167]: 07/05/2026
                - cell [ref=e168]: "0"
                - cell [ref=e169]: No donation deposits recorded
                - cell [ref=e170]: 0g
                - cell [ref=e171]: 0g
                - cell [ref=e172]: 0g
                - cell [ref=e173]: 0g
              - row [ref=e174]:
                - cell [ref=e175]:
                  - generic [ref=e176] [cursor=pointer]:
                    - button [ref=e177]:
                      - img [ref=e178]
                    - heading [level=6] [ref=e180]: Monthly
              - row [ref=e181]:
                - cell [ref=e182]:
                  - paragraph [ref=e183]: 07/01/2026 - 07/31/2026
                - cell [ref=e184]: "0"
                - cell [ref=e185]: No donation deposits recorded
                - cell [ref=e186]: 0g
                - cell [ref=e187]: 0g
                - cell [ref=e188]: 0g
                - cell [ref=e189]: 0g
              - row [ref=e190]:
                - cell [ref=e191]:
                  - generic [ref=e192] [cursor=pointer]:
                    - button [ref=e193]:
                      - img [ref=e194]
                    - heading [level=6] [ref=e196]: Weekly
              - row [ref=e197]:
                - cell [ref=e198]:
                  - paragraph [ref=e199]: 07/05/2026 - 07/11/2026
                - cell [ref=e200]: "0"
                - cell [ref=e201]: No donation deposits recorded
                - cell [ref=e202]: 0g
                - cell [ref=e203]: 0g
                - cell [ref=e204]: 0g
                - cell [ref=e205]: 0g
              - row [ref=e206]:
                - cell [ref=e207]:
                  - generic [ref=e208] [cursor=pointer]:
                    - button [ref=e209]:
                      - img [ref=e210]
                    - heading [level=6] [ref=e212]: Daily
              - row [ref=e213]:
                - cell [ref=e214]:
                  - paragraph [ref=e215]: 07/05/2026
                - cell [ref=e216]: "0"
                - cell [ref=e217]: No donation deposits recorded
                - cell [ref=e218]: 0g
                - cell [ref=e219]: 0g
                - cell [ref=e220]: 0g
                - cell [ref=e221]: 0g
        - generic [ref=e224]:
          - generic [ref=e225]:
            - heading [level=6] [ref=e226]: Statistics Graph
            - paragraph [ref=e228]: No statistics data is available for the selected range.
          - generic [ref=e229]:
            - heading [level=6] [ref=e230]: Entry Breakdown
            - paragraph [ref=e232]: No statistics data is available for the selected range.
        - generic [ref=e234]:
          - generic [ref=e235]:
            - generic [ref=e236]:
              - generic [ref=e237]:
                - heading [level=6] [ref=e238]: Log Entries
                - generic [ref=e240]: 0 matching
              - navigation [ref=e241]:
                - list [ref=e242]:
                  - listitem [ref=e243]:
                    - button [disabled]:
                      - img
                  - listitem [ref=e244]:
                    - button [disabled]:
                      - img
                  - listitem [ref=e245]:
                    - button [ref=e246] [cursor=pointer]: "1"
                  - listitem [ref=e247]:
                    - button [disabled]:
                      - img
                  - listitem [ref=e248]:
                    - button [disabled]:
                      - img
            - generic [ref=e249]:
              - generic [ref=e250]: Entries per page
              - generic [ref=e251]:
                - combobox [ref=e252] [cursor=pointer]: "10"
                - textbox: "10"
                - img
                - group:
                  - generic: Entries per page
          - table [ref=e254]:
            - rowgroup [ref=e255]:
              - row [ref=e256]:
                - columnheader [ref=e257]:
                  - button [ref=e258] [cursor=pointer]:
                    - text: Date
                    - img [ref=e259]
                - columnheader [ref=e261]:
                  - button [ref=e262] [cursor=pointer]:
                    - text: Type
                    - img [ref=e263]
                - columnheader [ref=e265]:
                  - button [ref=e266] [cursor=pointer]:
                    - text: Member
                    - img [ref=e267]
                - columnheader [ref=e269]:
                  - button [ref=e270] [cursor=pointer]:
                    - text: Amount
                    - img [ref=e271]
                - columnheader [ref=e273]:
                  - button [ref=e274] [cursor=pointer]:
                    - text: Notes
                    - img [ref=e275]
                - columnheader [ref=e277]: Actions
            - rowgroup [ref=e278]:
              - row [ref=e279]:
                - cell [ref=e280]: No entries yet.
    - generic [ref=e282]:
      - generic [ref=e283]:
        - text: Guided Tour
        - heading [level=6] [ref=e284]: Welcome to the Guild Ledger
      - paragraph [ref=e285]: This walkthrough highlights the main tools for tracking gold, reviewing trends, and managing your guild. You can skip it anytime.
      - generic [ref=e286]:
        - generic [ref=e287]: Step 1 of 6
        - generic [ref=e288]:
          - button [ref=e289] [cursor=pointer]: Skip
          - button [disabled]: Back
          - button [ref=e290] [cursor=pointer]: Next
  - dialog "Create account" [active] [ref=e293]:
    - heading "Create account" [level=2] [ref=e294]
    - generic [ref=e296]:
      - generic [ref=e297]:
        - generic: Username
        - generic [ref=e298]:
          - textbox "Username" [ref=e299]
          - group:
            - generic: Username
      - generic [ref=e300]:
        - generic: Recovery email
        - generic [ref=e301]:
          - textbox "Recovery email" [ref=e302]
          - group:
            - generic: Recovery email
        - paragraph [ref=e303]: Used for verification and password resets.
      - generic [ref=e304]:
        - generic: Password
        - generic [ref=e305]:
          - textbox "Password" [ref=e306]
          - group:
            - generic: Password
        - paragraph [ref=e307]: Use at least 10 characters.
    - generic [ref=e308]:
      - button "Have an account?" [ref=e310] [cursor=pointer]
      - button "Create account" [ref=e311] [cursor=pointer]
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test'
  2  |
  3  | test('full recruitment and application workflow', async ({ page, context }) => {
  4  |   const uniqueId = Math.random().toString(36).slice(2, 7)
  5  |   const ownerUsername = `owner_${uniqueId}`
  6  |   const applicantUsername = `applicant_${uniqueId}`
  7  |   const guildName = `Guild_${uniqueId}`
  8  |
  9  |   // 1. Owner Sign Up
  10 |   await page.goto('/')
  11 |   await page.getByRole('button', { name: 'Sign up / Log in' }).click()
  12 |   await page.getByRole('button', { name: 'Need an account?' }).click()
  13 |   await page.getByLabel('Username').fill(ownerUsername)
  14 |   await page.getByLabel('Recovery Email').fill(`${ownerUsername}@example.com`)
  15 |   await page.getByLabel('Password', { exact: true }).fill('password1234')
  16 |   await page.getByRole('button', { name: 'Create account' }).click()
  17 |   await expect(page.getByText('Account created')).toBeVisible()
  18 |
  19 |   // 2. Create Guild
  20 |   await page.getByLabel('New guild').fill(guildName)
  21 |   await page.getByRole('button', { name: 'Add' }).click()
  22 |   await expect(page.getByText('Guild created securely')).toBeVisible()
  23 |
  24 |   // 3. Configure Recruitment
  25 |   await page.getByRole('tab', { name: 'Recruitment' }).click()
  26 |   await expect(page.getByTestId('recruitment-settings-title')).toBeVisible()
  27 |   await page.getByLabel('Enable Public Recruitment').check()
  28 |   await page.getByLabel('Guild Focus').click()
  29 |   await page.getByRole('option', { name: 'Social' }).click()
  30 |   await page.getByLabel('Guild Description').fill('We are a friendly social guild.')
  31 |   await page.getByRole('button', { name: 'Add Requirement' }).click()
  32 |   await page.getByPlaceholder('e.g. CP 160+, Level 50, Discord required...').fill('Be nice.')
  33 |   await page.getByRole('button', { name: 'Add Question' }).click()
  34 |   await page.getByPlaceholder('e.g. What is your primary role (Tank/Healer/DPS)?').fill('Favorite color?')
  35 |   await page.getByRole('button', { name: 'Save Settings' }).click()
  36 |   await expect(page.getByText('Recruitment settings saved successfully')).toBeVisible()
  37 |
  38 |   await page.getByRole('button', { name: 'Log out' }).click()
  39 |   await expect(page.getByRole('button', { name: 'Sign up / Log in' })).toBeVisible()
  40 |
  41 |   // 4. Applicant Sign Up
  42 |   await page.getByRole('button', { name: 'Sign up / Log in' }).click()
> 43 |   await page.getByRole('button', { name: 'Need an account?' }).click()
     |                                                                ^ Error: locator.click: Test timeout of 60000ms exceeded.
  44 |   await page.getByLabel('Username').fill(applicantUsername)
  45 |   await page.getByLabel('Recovery Email').fill(`${applicantUsername}@example.com`)
  46 |   await page.getByLabel('Password', { exact: true }).fill('password1234')
  47 |   await page.getByRole('button', { name: 'Create account' }).click()
  48 |   await expect(page.getByText('Account created')).toBeVisible()
  49 |
  50 |   // 5. Discover and Apply
  51 |   await page.getByRole('button', { name: 'Browse Guilds' }).click()
  52 |   await expect(page.getByRole('heading', { name: 'Guild Discovery' })).toBeVisible()
  53 |
  54 |   // Find the specific guild card to avoid clicking on others from previous runs
  55 |   const guildCard = page.locator('.MuiCard-root').filter({ hasText: guildName })
  56 |   await expect(guildCard).toBeVisible()
  57 |   await guildCard.getByRole('button', { name: 'View Profile' }).click()
  58 |
  59 |   await expect(page.getByText('We are a friendly social guild.')).toBeVisible()
  60 |   await expect(page.getByText('Be nice.')).toBeVisible()
  61 |
  62 |   await page.getByLabel('Favorite color?').fill('Blue')
  63 |   await page.getByRole('button', { name: 'Submit Application' }).click()
  64 |   await expect(page.getByText('Your application has been submitted successfully!')).toBeVisible()
  65 |
  66 |   // 6. Check My Apps
  67 |   await page.getByRole('tab', { name: 'My Apps' }).click()
  68 |   await expect(page.getByText(guildName)).toBeVisible()
  69 |   await expect(page.getByText('PENDING')).toBeVisible()
  70 |
  71 |   await page.getByRole('button', { name: 'Log out' }).click()
  72 |
  73 |   // 7. Owner Review
  74 |   await page.getByRole('button', { name: 'Sign up / Log in' }).click()
  75 |   await page.getByLabel('Username').fill(ownerUsername)
  76 |   await page.getByLabel('Password').fill('password1234')
  77 |   await page.getByRole('button', { name: 'Log in' }).click()
  78 |
  79 |   await page.getByRole('tab', { name: 'Recruitment' }).click()
  80 |   await page.getByRole('tab', { name: 'Applications' }).click()
  81 |   await expect(page.getByText(applicantUsername)).toBeVisible()
  82 |   await expect(page.getByText('Blue')).toBeVisible()
  83 |
  84 |   await page.getByRole('button', { name: 'Start Review' }).click()
  85 |   await page.getByLabel('Status').click()
  86 |   await page.getByRole('option', { name: 'Accepted (Add to Guild)' }).click()
  87 |   await page.getByLabel('Officer Notes').fill('Welcome aboard!')
  88 |   await page.getByRole('button', { name: 'Save' }).click()
  89 |
  90 |   // 8. Verify membership
  91 |   await page.getByRole('tab', { name: 'Members', exact: true }).click()
  92 |   // The applicant should now be in the member list
  93 |   await expect(page.getByRole('heading', { name: 'Member Management' }).first()).toBeVisible()
  94 |   // Search for the member name in the table body specifically (it's in an input field)
  95 |   await expect(page.locator(`input[value="${applicantUsername}"]`)).toBeVisible()
  96 | })
  97 |
```