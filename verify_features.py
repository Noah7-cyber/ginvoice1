
import asyncio
import os
import time
from playwright.async_api import async_playwright

# Define auth state file
AUTH_STATE = "auth.json"

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # Check if auth.json exists
        if not os.path.exists(AUTH_STATE):
            print("Auth state not found. Please run verify_login_v2.py first.")
            return

        # Create context with saved auth state
        context = await browser.new_context(
            storage_state=AUTH_STATE,
            viewport={'width': 1280, 'height': 800},
            base_url="http://localhost:3000"
        )
        page = await context.new_page()

        print("--- Starting Verification ---")

        # --- Test 1: Debtor Share ---
        print("\n[Test 1] Debtor Sharing...")
        try:
            await page.goto("/history", timeout=30000)
            await page.wait_for_selector('text=Sales & Debtors', timeout=10000)

            # Switch to Debtors View
            await page.click('button:has-text("Debtors List")')

            # Check if we have any debtors. If not, we need to create one.
            # Let's create a previous debtor quickly via the modal
            if await page.is_visible("text=No Debts Recorded"):
                 print("No debtors found. Creating one...")
                 await page.click('button:has-text("Add Previous Debtor")')
                 await page.fill('input[placeholder="e.g. John Doe"]', "Test Debtor")
                 await page.fill('input[placeholder="0.00"]', "5000")
                 await page.click('button:has-text("Save Debtor")')
                 await page.wait_for_selector('text=Test Debtor')

            # Expand the debtor card
            await page.click('text=Test Debtor')

            # Look for Share Button
            share_btn = page.locator('button:has-text("Share Statement")')
            if await share_btn.is_visible():
                print("✅ Share Statement button found.")
                # Click it to trigger clipboard copy (since navigator.share fails in headless usually)
                await share_btn.click()
                # Check for toast success
                if await page.is_visible("text=Statement copied to clipboard"):
                     print("✅ Toast notification confirmed: Statement copied.")
                else:
                     print("⚠️ Toast not seen, but button clicked.")
            else:
                print("❌ Share Statement button NOT found.")
                await page.screenshot(path="debtor_share_fail.png")

        except Exception as e:
            print(f"❌ Debtor Share Test Failed: {e}")
            await page.screenshot(path="debtor_test_fail.png")

        # --- Test 2: Notification Filtering ---
        print("\n[Test 2] Notification Filtering...")
        try:
            # We need to trigger a sale to generate notifications
            await page.goto("/sales")

            # Add item to cart (assuming products exist, if not we might need to add one)
            # Check if any product card exists
            if not await page.locator('.bg-white.p-4.rounded-2xl').first.is_visible():
                 print("No products found. Adding one...")
                 await page.goto("/inventory")
                 await page.click('button:has-text("Add New")')
                 await page.fill('input[placeholder="e.g. OMO Detergent"]', "Test Product")
                 await page.fill('input[placeholder="e.g. 12345"]', "SKU123")
                 await page.fill('input[value="0"]', "500") # Selling Price
                 await page.fill('input[value="0"]', "500") # Cost Price (maybe 2nd input?)
                 # The form has multiple inputs, let's use labels or order
                 # Cost Price is 1st in grid, Selling is 2nd
                 # Actually let's just fill all inputs with 500
                 inputs = await page.locator('input[type="number"]').all()
                 for inp in inputs:
                     await inp.fill("500")

                 await page.click('button:has-text("Save Product")')
                 await page.wait_for_timeout(2000)
                 await page.goto("/sales")

            # Click a product to add to cart
            await page.click('.bg-white.p-4.rounded-2xl >> nth=0')

            # Open Cart
            await page.click('button:has(.lucide-shopping-cart)')

            # Complete Sale
            await page.fill('input[placeholder="Customer Name (Optional)"]', "Notify Test")
            await page.click('button:has-text("Confirm Payment")')
            await page.click('button:has-text("Complete Sale")')

            # Wait for success
            await page.wait_for_timeout(2000)

            # Open Notification Center
            await page.click('button:has(.lucide-bell)')

            # Check notifications
            # We expect "New Sale"
            # We DO NOT expect "Stock Updated" (modification) for the same event
            await page.wait_for_selector('text=New Sale')
            print("✅ 'New Sale' notification found.")

            if await page.is_visible("text=Product Updated"):
                 print("⚠️ 'Product Updated' notification found. Filtering might be loose or timing off.")
            else:
                 print("✅ 'Product Updated' notification correctly filtered out.")

        except Exception as e:
             print(f"❌ Notification Test Failed: {e}")
             await page.screenshot(path="notify_test_fail.png")

        # --- Test 3: Stock Verify ---
        print("\n[Test 3] Stock Verification...")
        try:
             await page.goto("/inventory")

             # Trigger Verification Modal manually via "Verify Stock" button
             await page.click('button:has-text("Verify Stock")')

             # Check if modal opens
             # It might say "No verification needed" if queue is empty.
             # We can't easily force a queue item without backend access or waiting.
             # However, we can check if the button works.
             if await page.is_visible("text=Stock verification recommended") or await page.is_visible("text=No verification needed"):
                 print("✅ Verify Stock button triggered response.")

                 if await page.is_visible("text=Stock verification recommended"):
                      # Check for category display
                      # The category text is in a small uppercase font
                      # We can verify simply that some text exists
                      print("✅ Verification Modal Open.")

                      # Check for Save & Next button state (should be enabled initially)
                      save_btn = page.locator('button:has-text("Save & Next")')
                      if await save_btn.is_enabled():
                           print("✅ Save & Next button is enabled.")

                      # Enter qty
                      await page.fill('input[placeholder="Counted quantity"]', "10")

                      # Click Save
                      await save_btn.click()

                      # Check for loader? It's fast.
                      # Check for toast success
                      await page.wait_for_selector("text=Verification saved")
                      print("✅ Verification saved successfully.")

             else:
                 print("⚠️ Verify Stock button did not open modal or show toast.")
                 await page.screenshot(path="verify_test_fail.png")

        except Exception as e:
            print(f"❌ Stock Verify Test Failed: {e}")

        # --- Test 4: Mobile UI ---
        print("\n[Test 4] Mobile UI...")
        try:
            # Resize viewport to mobile
            await page.set_viewport_size({"width": 375, "height": 812})
            await page.reload()
            await page.wait_for_timeout(2000)

            # 1. Check FAB in Inventory
            await page.goto("/inventory")
            fab = page.locator('button[aria-label="Add New Product"]')
            if await fab.is_visible():
                print("✅ Mobile FAB found in Inventory.")
            else:
                print("❌ Mobile FAB NOT found.")
                await page.screenshot(path="mobile_fab_fail.png")

            # 2. Check Support Bot Fullscreen
            # Click the floating bot button
            bot_btn = page.locator('button[aria-label="Open gBot support chat"]')
            await bot_btn.click()
            await page.wait_for_timeout(1000)

            # Check if chat window has fixed class or takes full width
            # We can check by evaluating class or visual check
            # The class `fixed inset-0` should be present on the container
            chat_window = page.locator('.fixed.inset-0.z-\[99999\]')
            if await chat_window.is_visible():
                 print("✅ Support Bot is full screen (fixed inset-0).")
            else:
                 print("❌ Support Bot is NOT full screen.")
                 await page.screenshot(path="mobile_bot_fail.png")

        except Exception as e:
            print(f"❌ Mobile UI Test Failed: {e}")
            await page.screenshot(path="mobile_ui_fail.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
