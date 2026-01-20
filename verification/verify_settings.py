import sys
import json
from playwright.sync_api import sync_playwright

def verify_settings():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a large viewport to ensure sidebar is visible
        page = browser.new_page(viewport={'width': 1280, 'height': 800})

        # Inject initial state with owner role to access settings
        initial_state = {
            "products": [],
            "transactions": [],
            "role": "owner",
            "isLoggedIn": True,
            "isRegistered": True,
            "business": {
                "name": "Test Business",
                "address": "123 Test St",
                "phone": "+2348000000000",
                "email": "test@business.com",
                "isSubscribed": False,
                "theme": { "primaryColor": "#4f46e5", "fontFamily": "'Inter', sans-serif" },
                "staffPermissions": {}
            },
            "expenditures": []
        }

        state_json = json.dumps(initial_state)

        # Function to inject state into localStorage
        # key is ginvoice_v1_state
        page.add_init_script(f"""
            localStorage.setItem('ginvoice_v1_state', '{state_json}');
        """)

        try:
            # 1. Load the app
            print("Loading app...")
            page.goto("http://localhost:5173")
            page.wait_for_load_state("networkidle")

            # 2. Navigate to Settings
            print("Navigating to Settings...")
            # The sidebar link for settings contains the text "Settings" or icon
            # Let's try finding by role button and text "Settings"
            settings_link = page.get_by_role("button", name="Settings").first
            settings_link.wait_for(state="visible", timeout=10000)
            settings_link.click()

            # Wait for Settings header
            page.wait_for_selector("h1:has-text('Settings')", timeout=5000)
            print("Successfully navigated to Settings.")

            # 3. Verify Billing Tab content
            print("Verifying Billing Tab...")
            # Click Billing tab
            page.get_by_role("button", name="Billing").click()

            # Check for Payment Troubleshooting section
            if page.get_by_text("Payment Troubleshooting").is_visible():
                print("PASS: Payment Troubleshooting section found.")
            else:
                print("FAIL: Payment Troubleshooting section NOT found.")
                page.screenshot(path="verification/billing_fail.png")
                sys.exit(1)

            # Check for input and button
            if page.get_by_placeholder("Enter Paystack Reference Code").is_visible():
                print("PASS: Reference input found.")
            else:
                 print("FAIL: Reference input NOT found.")

            if page.get_by_role("button", name="Verify Payment").is_visible():
                 print("PASS: Verify Payment button found.")
            else:
                 print("FAIL: Verify Payment button NOT found.")

            # 4. Verify Save Changes Button logic
            print("Verifying Save Changes Button...")
            # Go back to Shop tab
            page.get_by_role("button", name="Shop").click()

            # Ensure "Save Changes" is NOT visible initially
            if not page.get_by_role("button", name="Save Changes").is_visible():
                print("PASS: Save Changes button is initially hidden.")
            else:
                print("FAIL: Save Changes button should be hidden initially.")

            # Modify Business Name
            print("Modifying Business Name...")
            # Find the input that has the current value "Test Business"
            name_input = page.get_by_display_value("Test Business")
            name_input.fill("Test Business Updated")

            # Check if "Save Changes" appears
            save_btn = page.get_by_role("button", name="Save Changes")
            try:
                save_btn.wait_for(state="visible", timeout=2000)
                print("PASS: Save Changes button appeared after modification.")
                save_btn.screenshot(path="verification/save_btn_success.png")
            except:
                print("FAIL: Save Changes button did NOT appear after modification.")
                page.screenshot(path="verification/save_btn_fail.png")
                sys.exit(1)

            print("All Settings verification steps passed!")

        except Exception as e:
            print(f"Verification failed: {e}")
            page.screenshot(path="verification/settings_error.png")
            sys.exit(1)
        finally:
            browser.close()

if __name__ == "__main__":
    verify_settings()
