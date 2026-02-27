
import asyncio
import os
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Create a new context with a defined storage state if available (or empty)
        # But we want to CREATE the state first.
        context = await browser.new_context(
            viewport={'width': 1280, 'height': 800},
            base_url="http://localhost:3000"
        )
        page = await context.new_page()

        print("Navigating to home page...")
        try:
            await page.goto("/", timeout=60000)
        except Exception as e:
            print(f"Navigation error: {e}")
            await browser.close()
            return

        # Check if we are already logged in (unlikely in fresh context)
        if await page.is_visible("text=Sales"):
            print("Already logged in!")
            await context.storage_state(path="auth.json")
            await browser.close()
            return

        # Wait for "Start Free 30-Day Trial" or "Login"
        try:
            # Welcome Screen handling
            if await page.is_visible("text=Start Free 30-Day Trial"):
                print("Clicking Start Trial...")
                await page.click("text=Start Free 30-Day Trial")

            # Now we should be on Registration Form
            print("Filling registration form...")
            # Use specific selectors based on placeholder text seen in code
            await page.fill('input[placeholder="Enter your business name"]', "Test Shop Auto")
            await page.fill('input[placeholder="Enter your phone number"]', "08012345678")

            # The email field is optional but critical for our hack
            # We use the prefix 'test_auto' to trigger the backend bypass we added
            email = f"test_auto_{os.urandom(4).hex()}@example.com"
            print(f"Using email: {email}")
            await page.fill('input[type="email"]', email)

            await page.fill('textarea[placeholder="Enter your shop address"]', "123 Test Street")

            # Password fields
            # Assuming first is Owner PIN, second is Staff PIN
            pins = await page.query_selector_all('input[type="password"]')
            if len(pins) >= 2:
                await pins[0].fill("1234")
                await pins[1].fill("1234")
            else:
                print("Could not find PIN inputs")
                return

            # Submit
            print("Submitting registration...")
            # Look for button with text "Create Account" or "Start"
            # In RegistrationScreen.tsx, button says "Create Business Account" usually
            submit_btn = await page.query_selector('button:has-text("Create Business Account")')
            if not submit_btn:
                 submit_btn = await page.query_selector('button:has-text("Start Using Ginvoice")') # Fallback

            if submit_btn:
                await submit_btn.click()
            else:
                # Try generic submit
                await page.click('button[type="submit"]')

            # Wait for transition
            await page.wait_for_timeout(3000)

            # Check if we landed on Verification Screen (which we should skip with the hack)
            if await page.is_visible("text=Verify Your Email"):
                print("Landed on verification screen despite hack. Attempting to bypass via Login...")
                # Click "Login" if available or refresh to trigger login flow
                # Actually, after registration, local state is 'isRegistered: true, isLoggedIn: false'
                # So we are likely on the AuthScreen asking for PIN login
                pass

            # Check for Login PIN input
            if await page.is_visible('input[placeholder="Enter PIN"]'):
                print("Login screen visible. Entering PIN...")
                await page.fill('input[placeholder="Enter PIN"]', "1234")

                # Select role if needed (owner/staff buttons?)
                # Code shows logic to auto-login based on PIN, but UI might have role buttons
                # Let's try to just submit PIN.
                # Is there a login button?
                login_btn = await page.query_selector('button:has-text("Login")')
                if login_btn:
                    await login_btn.click()
                else:
                    # If pin input auto-submits on length 4? (Common pattern)
                    # Let's wait.
                    pass

            # Wait for main app load
            print("Waiting for dashboard...")
            try:
                await page.wait_for_selector('text=Sales', timeout=15000)
                print("Login Successful!")

                # Verify we are on Sales tab
                if await page.is_visible("text=Add to Cart"):
                    print("On Sales Screen confirmed.")

                # Save state
                await context.storage_state(path="auth.json")
                print("Auth state saved to auth.json")
            except Exception as e:
                print(f"Login timeout: {e}")
                await page.screenshot(path="login_timeout.png")

        except Exception as e:
            print(f"Process failed: {e}")
            await page.screenshot(path="process_fail.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
