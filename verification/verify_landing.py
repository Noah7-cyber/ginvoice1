from playwright.sync_api import sync_playwright
import time

def verify_frontend():
    with sync_playwright() as p:
        # Desktop
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()

        try:
            # Login
            print("Logging in...")
            page.goto("http://localhost:5173/")
            # Wait for content to load
            page.wait_for_load_state("networkidle")

            if page.get_by_role("button", name="Login").first.is_visible():
                page.get_by_role("button", name="Login").first.click()

            page.wait_for_selector("input[placeholder*='store.com']", timeout=10000)
            page.fill("input[placeholder*='store.com']", "test@shop.com")
            page.fill("input[placeholder='••••']", "1234")
            page.click("button:has-text('Log In to Store')")

            print("Waiting for dashboard/sidebar...")
            # Wait for any post-login element. Sidebar is 'aside'.
            try:
                page.wait_for_selector("aside", timeout=15000)
            except Exception as e:
                print("Sidebar not found, checking current URL and Screenshotting...")
                print(f"Current URL: {page.url}")
                page.screenshot(path="verification/login_failed.png")
                raise e

            # 1. Verify Welcome Screen (Log out to check)
            print("Verifying Welcome Screen changes...")
            # Use specific locator for Logout in sidebar
            if page.locator("aside button:has-text('Logout')").is_visible():
                 page.locator("aside button:has-text('Logout')").click()
            else:
                 # Fallback if sidebar hidden (shouldn't be on desktop)
                 page.goto("http://localhost:5173/")
                 # Ensure we are logged out or see logout button

            time.sleep(2)

            # Check for new text on Welcome Screen
            if page.get_by_text("The Operating System for Nigerian Traders").is_visible():
                print("PASS: New Headline found.")
            else:
                print("FAIL: New Headline missing.")

            if page.get_by_text("Master the 2026 Tax Laws").is_visible():
                print("PASS: Tax Readiness Section found.")
            else:
                print("FAIL: Tax Readiness Section missing.")

            # Login again
            page.get_by_role("button", name="Login").first.click()
            page.fill("input[placeholder*='store.com']", "test@shop.com")
            page.fill("input[placeholder='••••']", "1234")
            page.click("button:has-text('Log In to Store')")
            page.wait_for_selector("aside", timeout=15000)

            # 2. Verify Dashboard Expenses Card
            print("Verifying Dashboard Expenses Card...")
            page.goto("http://localhost:5173/dashboard")
            # Wait for any dashboard unique text
            page.wait_for_selector("h1:has-text('Owner Dashboard')")
            time.sleep(2)

            # Look for "Today's Expenses" (Carousel Item 1)
            # The carousel might be rendering based on default timeRange '7d'
            if page.get_by_text("Today's Expenses").is_visible():
                print("PASS: Expenses Carousel found.")
            else:
                print("FAIL: Expenses Carousel missing.")

            # 3. Verify Date Picker
            # Look for input type=month which we added
            date_input = page.locator("input[type='month']")
            if date_input.count() > 0:
                print("PASS: Month picker found.")

            page.screenshot(path="verification/landing_dashboard_check.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/landing_error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_frontend()
