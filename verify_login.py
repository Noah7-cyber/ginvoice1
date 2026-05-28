
import asyncio
import json
import random
import time
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            viewport={'width': 1280, 'height': 720},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        )
        page = await context.new_page()

        print("Navigating to home page...")
        try:
            await page.goto("http://localhost:3000", timeout=60000)
        except Exception as e:
            print(f"Error navigating to home page: {e}")
            await browser.close()
            return

        # 1. Register a new user
        print("Starting registration...")
        # Check if we are on the welcome screen or registration/login screen
        if await page.is_visible("text=Start Free 30-Day Trial"):
            await page.click("text=Start Free 30-Day Trial")

        # Fill registration form
        email = f"test_auto_{int(time.time())}_{random.randint(1000, 9999)}@example.com"
        print(f"Registering with email: {email}")

        await page.fill('input[placeholder="Enter your business name"]', "Test Shop")
        await page.fill('input[placeholder="Enter your phone number"]', "08012345678")
        await page.fill('input[placeholder="Enter your email address (optional)"]', email) # It seems to be optional in placeholder but let's see
        await page.fill('textarea[placeholder="Enter your shop address"]', "123 Lagos Street")

        # Handling the password fields - might need to be specific if there are multiple password inputs
        # Assuming the order is owner pin then staff pin based on typical flows
        password_inputs = await page.query_selector_all('input[type="password"]')
        if len(password_inputs) >= 2:
            await password_inputs[0].fill("1234") # Owner PIN
            await password_inputs[1].fill("1234") # Staff PIN
        else:
             print("Could not find password inputs")
             await page.screenshot(path="registration_fail.png")
             return

        # Click Register/Create Account button
        await page.click('button:has-text("Create Account")')

        # Wait for navigation or success message
        try:
             # Wait for either the dashboard/sales screen or verification screen
             # Based on code, it might go to verification screen first if email is provided
             await page.wait_for_timeout(5000)

             # Check for verification screen
             if await page.is_visible("text=Verify Your Email"):
                 print("Verification screen detected. (This should not happen with test_auto prefix hack)")
                 # If the hack worked, we should be logged in or able to log in immediately?
                 # Actually the hack sets emailVerified=true in DB, but the frontend state might still be 'isRegistered: true, isLoggedIn: false'
                 # forcing a manual login. Let's check.
                 pass

             # Try to log in if we are redirected to login or stuck on registration success
             if await page.is_visible('input[placeholder="Enter PIN"]'):
                 print("Login screen detected. Logging in...")
                 await page.fill('input[placeholder="Enter PIN"]', "1234")
                 await page.click('button:has-text("Login")')

             # Wait for main app
             await page.wait_for_selector('text=Sales', timeout=10000)
             print("Successfully logged in!")

             # Save storage state for future tests
             await context.storage_state(path="auth.json")
             print("Saved auth state to auth.json")

        except Exception as e:
            print(f"Registration/Login failed: {e}")
            await page.screenshot(path="login_fail_debug.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
