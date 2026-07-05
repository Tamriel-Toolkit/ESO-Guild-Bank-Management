import asyncio
from playwright.async_api import async_playwright

async def verify():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        page = await context.new_page()

        # Login first to make a guild public
        await page.goto("http://localhost:5173/login")
        await page.fill('input[type="email"]', "owner@example.com")
        await page.fill('input[type="password"]', "password123")
        await page.click('button[type="submit"]')
        await page.wait_for_url("**/")

        # Create guild if not exists
        await page.fill('input[placeholder="New guild"]', "Discovery Test Guild")
        await page.click('button:has-text("Add")')

        # Go to Recruitment tab
        await page.click('button:has-text("Members")')
        await page.click('button:has-text("Recruitment")')

        # Enable Public Recruitment
        checkbox = page.locator('text=Enable Public Recruitment').locator('input')
        checked = await checkbox.is_checked()
        if not checked:
            await page.click('text=Enable Public Recruitment')

        await page.fill('textarea[placeholder*="Describe your guild"]', "A test guild for discovery verification.")
        await page.click('button:has-text("Save Settings")')
        await page.wait_for_timeout(1000)

        # Now logout and check discovery
        await page.click('button:has-text("Log out")')
        await page.wait_for_url("**/")

        # Navigate directly to discovery
        await page.goto("http://localhost:5173/discovery")
        await page.wait_for_selector('text=Discover Guilds')
        await page.screenshot(path="verification/discovery_v2.png")

        # Check if our guild is there
        await page.wait_for_selector('text=Discovery Test Guild')
        await page.screenshot(path="verification/discovery_with_guild.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify())
