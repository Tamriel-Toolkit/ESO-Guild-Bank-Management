# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: verify_recruitment.spec.js >> guest can discover guilds
- Location: e2e/verify_recruitment.spec.js:3:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: /Discover Guilds/i })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByRole('button', { name: /Discover Guilds/i })

```

```yaml
- banner:
  - img "ESO Guild Gold Ledger coin"
  - heading "ESO Guild Gold Ledger" [level=6]
  - button "Browse Guilds"
  - button "Open tutorial"
  - button "Sign up / Log in"
- text: Elder Scrolls Online Guild Ledger
- heading "Track Guild Gold Flow" [level=4]
- paragraph: Track deposits, withdrawals, and sales tax with member-linked entries.
- button "Export Reports"
- alert: Guest mode is temporary. Create an account to save your data to the server.
- heading "Add Entry" [level=6]
- text: Type
- combobox "Type": Deposit
- text: Gold Amount
- spinbutton "Gold Amount"
- text: Date
- textbox "Date": 2026-07-05
- text: Member
- combobox "Member"
- text: Optional Notes
- textbox "Optional Notes"
- checkbox "Donation"
- text: Donation
- checkbox "Dues"
- text: Dues
- button "Save"
- heading "Search, Filters, and Saved Views" [level=6]
- paragraph: Narrow the ledger by member, amount, type, notes, and dates. Saved views keep recurring review setups one click away.
- text: Saved view
- combobox "Saved view"
- button "Save current view"
- button "Delete view" [disabled]
- button "Clear filters"
- text: Search notes, members, and types
- textbox "Search notes, members, and types"
- text: Member filter
- combobox "Member filter"
- text: Entry type
- combobox "Entry type": All types
- text: Deposit subtype
- combobox "Deposit subtype": All deposits
- text: Withdrawal category
- combobox "Withdrawal category": All withdrawals
- text: Min amount
- spinbutton "Min amount"
- text: Max amount
- spinbutton "Max amount"
- text: Start date
- textbox "Start date": 2026-07-05
- text: End date
- textbox "End date": 2026-07-05
- button "All dates"
- button "Today"
- text: "Showing 0 of 0 entries Date range: 07/05/2026 - 07/05/2026 Filtered view active"
- heading "Statistics" [level=6]
- paragraph: Aggregates reflect the current filtered ledger view, so reports stay readable as the log grows.
- text: "Periods shown: 4 Entries in view: 0 Top donors shown per row: 0"
- table:
  - rowgroup:
    - row "Range Entries Top Contributors Deposits Withdrawals Sales Tax Grand Total":
      - columnheader "Range"
      - columnheader "Entries"
      - columnheader "Top Contributors"
      - columnheader "Deposits"
      - columnheader "Withdrawals"
      - columnheader "Sales Tax"
      - columnheader "Grand Total"
  - rowgroup:
    - row "Toggle Overall Overall":
      - cell "Toggle Overall Overall":
        - button "Toggle Overall"
        - heading "Overall" [level=6]
    - row "07/05/2026 0 No donation deposits recorded 0g 0g 0g 0g":
      - cell "07/05/2026":
        - paragraph: 07/05/2026
      - cell "0"
      - cell "No donation deposits recorded"
      - cell "0g"
      - cell "0g"
      - cell "0g"
      - cell "0g"
    - row "Toggle Monthly Monthly":
      - cell "Toggle Monthly Monthly":
        - button "Toggle Monthly"
        - heading "Monthly" [level=6]
    - row "07/01/2026 - 07/31/2026 0 No donation deposits recorded 0g 0g 0g 0g":
      - cell "07/01/2026 - 07/31/2026":
        - paragraph: 07/01/2026 - 07/31/2026
      - cell "0"
      - cell "No donation deposits recorded"
      - cell "0g"
      - cell "0g"
      - cell "0g"
      - cell "0g"
    - row "Toggle Weekly Weekly":
      - cell "Toggle Weekly Weekly":
        - button "Toggle Weekly"
        - heading "Weekly" [level=6]
    - row "07/05/2026 - 07/11/2026 0 No donation deposits recorded 0g 0g 0g 0g":
      - cell "07/05/2026 - 07/11/2026":
        - paragraph: 07/05/2026 - 07/11/2026
      - cell "0"
      - cell "No donation deposits recorded"
      - cell "0g"
      - cell "0g"
      - cell "0g"
      - cell "0g"
    - row "Toggle Daily Daily":
      - cell "Toggle Daily Daily":
        - button "Toggle Daily"
        - heading "Daily" [level=6]
    - row "07/05/2026 0 No donation deposits recorded 0g 0g 0g 0g":
      - cell "07/05/2026":
        - paragraph: 07/05/2026
      - cell "0"
      - cell "No donation deposits recorded"
      - cell "0g"
      - cell "0g"
      - cell "0g"
      - cell "0g"
- heading "Statistics Graph" [level=6]
- paragraph: No statistics data is available for the selected range.
- heading "Entry Breakdown" [level=6]
- paragraph: No statistics data is available for the selected range.
- heading "Log Entries" [level=6]
- text: 0 matching
- navigation "pagination navigation":
  - list:
    - listitem:
      - button "Go to first page" [disabled]
    - listitem:
      - button "Go to previous page" [disabled]
    - listitem:
      - button "page 1": "1"
    - listitem:
      - button "Go to next page" [disabled]
    - listitem:
      - button "Go to last page" [disabled]
- text: Entries per page
- combobox "Entries per page": "10"
- table:
  - rowgroup:
    - row "Date Type Member Amount Notes Actions":
      - columnheader "Date":
        - button "Date"
      - columnheader "Type":
        - button "Type"
      - columnheader "Member":
        - button "Member"
      - columnheader "Amount":
        - button "Amount"
      - columnheader "Notes":
        - button "Notes"
      - columnheader "Actions"
  - rowgroup:
    - row "No entries yet.":
      - cell "No entries yet."
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  |
  3  | test('guest can discover guilds', async ({ page }) => {
  4  |   await page.goto('/');
  5  |
  6  |   // Wait for "Discover Guilds" button and click it
  7  |   const discoverBtn = page.getByRole('button', { name: /Discover Guilds/i });
> 8  |   await expect(discoverBtn).toBeVisible();
     |                             ^ Error: expect(locator).toBeVisible() failed
  9  |   await discoverBtn.click();
  10 |
  11 |   // Should now see the Guild Discovery page
  12 |   await expect(page.locator('.eso-hero-title')).toHaveText('Guild Discovery', { timeout: 15000 });
  13 |
  14 |   // Should see the test guild we seeded
  15 |   await expect(page.getByRole('heading', { name: 'Test Public Guild' })).toBeVisible();
  16 |   await expect(page.getByText('This is a test public guild.')).toBeVisible();
  17 |
  18 |   // View profile
  19 |   await page.getByRole('button', { name: /View Profile/i }).first().click();
  20 |   await expect(page.locator('.eso-hero-title')).toHaveText('Guild Profile');
  21 |   await expect(page.getByText('This is a test public guild.')).toBeVisible();
  22 |   await expect(page.getByText('Weekends')).toBeVisible();
  23 | });
  24 |
```