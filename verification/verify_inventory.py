
from playwright.sync_api import sync_playwright

def verify_inventory_scroll():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Emulate mobile
        context = browser.new_context(
            viewport={'width': 375, 'height': 812},
            is_mobile=True,
            has_touch=True
        )
        page = context.new_page()

        try:
            print("Navigating to app...")
            page.goto("http://localhost:3000")

            # Wait for app to load
            print("Waiting for load...")
            page.wait_for_timeout(5000)

            # Check if we are on login screen or dashboard
            # Assuming we need to login or we might be in initial state.
            # The app starts with isRegistered=false (default state in App.tsx) -> RegistrationScreen

            if page.get_by_text("Create Business Account").is_visible():
                print("On Registration Screen. Registering...")
                page.get_by_placeholder("Business Name").fill("Test Shop")
                page.get_by_placeholder("Email Address").fill("test@example.com")
                page.get_by_placeholder("Phone Number").fill("1234567890")
                page.get_by_placeholder("Create a 4-8 digit PIN").fill("1234")
                page.get_by_role("button", name="Create Account").click()

                # Now on Verify Email Screen
                print("On Verify Email Screen. Clicking continue (simulating verification skipped for now)...")
                # Wait, VerifyEmailScreen has "Continue" button?
                # Looking at App.tsx: setPendingVerificationEmail(details.email);
                # VerifyEmailScreen code not read, but assuming it blocks.
                # Actually, the task is about scrolling, so we need to get to Inventory.
                # If we are stuck on verify, we can't test.
                # But VerifyEmailScreen usually has a "I've verified" or similar if we use "onContinue".
                # Let's check if we can simulate verification or bypass.
                # In App.tsx:
                # if (pendingVerificationEmail) return <VerifyEmailScreen ... />

                # We can't easily bypass unless we mock the backend or state.
                # BUT, we can use local storage to inject state!

            # Inject state to bypass login
            print("Injecting logged-in state...")
            page.evaluate("""() => {
                const state = {
                    products: [
                        {id: '1', name: 'Apple', category: 'Fruits', currentStock: 10, sellingPrice: 100, baseUnit: 'Piece', units: []},
                        {id: '2', name: 'Banana', category: 'Fruits', currentStock: 20, sellingPrice: 50, baseUnit: 'Piece', units: []},
                        {id: '3', name: 'Carrot', category: 'Vegetables', currentStock: 15, sellingPrice: 30, baseUnit: 'Piece', units: []},
                        {id: '4', name: 'Dog Food', category: 'Pets', currentStock: 5, sellingPrice: 500, baseUnit: 'Bag', units: []},
                        {id: '5', name: 'Elephant Toy', category: 'Toys', currentStock: 2, sellingPrice: 1000, baseUnit: 'Piece', units: []},
                        {id: '6', name: 'Fish', category: 'Seafood', currentStock: 8, sellingPrice: 200, baseUnit: 'kg', units: []},
                        {id: '7', name: 'Grapes', category: 'Fruits', currentStock: 50, sellingPrice: 80, baseUnit: 'kg', units: []},
                        {id: '8', name: 'Honey', category: 'Sweets', currentStock: 12, sellingPrice: 300, baseUnit: 'Jar', units: []},
                        {id: '9', name: 'Ice Cream', category: 'Frozen', currentStock: 25, sellingPrice: 150, baseUnit: 'Tub', units: []},
                        {id: '10', name: 'Juice', category: 'Beverages', currentStock: 40, sellingPrice: 60, baseUnit: 'Bottle', units: []},
                        {id: '11', name: 'Kiwi', category: 'Fruits', currentStock: 30, sellingPrice: 40, baseUnit: 'Piece', units: []},
                        {id: '12', name: 'Lemon', category: 'Fruits', currentStock: 35, sellingPrice: 10, baseUnit: 'Piece', units: []},
                        {id: '13', name: 'Mango', category: 'Fruits', currentStock: 18, sellingPrice: 120, baseUnit: 'Piece', units: []},
                        {id: '14', name: 'Nectarine', category: 'Fruits', currentStock: 22, sellingPrice: 90, baseUnit: 'Piece', units: []},
                        {id: '15', name: 'Orange', category: 'Fruits', currentStock: 28, sellingPrice: 20, baseUnit: 'Piece', units: []},
                        {id: '16', name: 'Papaya', category: 'Fruits', currentStock: 10, sellingPrice: 150, baseUnit: 'Piece', units: []},
                        {id: '17', name: 'Quinoa', category: 'Grains', currentStock: 14, sellingPrice: 400, baseUnit: 'Pack', units: []},
                        {id: '18', name: 'Rice', category: 'Grains', currentStock: 100, sellingPrice: 1200, baseUnit: 'Bag', units: []},
                        {id: '19', name: 'Spinach', category: 'Vegetables', currentStock: 20, sellingPrice: 40, baseUnit: 'Bunch', units: []},
                        {id: '20', name: 'Tomato', category: 'Vegetables', currentStock: 45, sellingPrice: 30, baseUnit: 'kg', units: []},
                        {id: '21', name: 'Umbrella', category: 'General', currentStock: 7, sellingPrice: 500, baseUnit: 'Piece', units: []},
                        {id: '22', name: 'Vanilla', category: 'Spices', currentStock: 50, sellingPrice: 20, baseUnit: 'Pod', units: []},
                        {id: '23', name: 'Water', category: 'Beverages', currentStock: 200, sellingPrice: 50, baseUnit: 'Bottle', units: []},
                        {id: '24', name: 'Xylophone', category: 'Toys', currentStock: 3, sellingPrice: 800, baseUnit: 'Piece', units: []},
                        {id: '25', name: 'Yam', category: 'Vegetables', currentStock: 12, sellingPrice: 200, baseUnit: 'Tuber', units: []},
                        {id: '26', name: 'Zucchini', category: 'Vegetables', currentStock: 18, sellingPrice: 60, baseUnit: 'Piece', units: []}
                    ],
                    isLoggedIn: true,
                    isRegistered: true,
                    role: 'owner',
                    business: {
                        name: 'Test Shop',
                        email: 'test@example.com',
                        theme: { primaryColor: '#4f46e5', fontFamily: "'Inter', sans-serif" },
                        staffPermissions: {}
                    },
                    transactions: [],
                    expenditures: [],
                    categories: []
                };
                localStorage.setItem('ginvoice_v1', JSON.stringify(state));
            }""")

            print("Reloading to apply state...")
            page.reload()
            page.wait_for_timeout(2000)

            # Go to Inventory Tab
            print("Navigating to Inventory...")
            # Mobile nav button with label 'My Stock'
            page.get_by_text("My Stock").click()
            page.wait_for_timeout(1000)

            # Take initial screenshot
            page.screenshot(path="verification/inventory_top.png")
            print("Captured inventory_top.png")

            # Check for Scrubber
            # We can try to click on the scrubber area corresponding to 'Z'
            # The scrubber is fixed right, top 20 to bottom 24.
            # Letter Z is near the bottom.
            # We can simply evaluate scrolling via the hook? No, we must interact with UI.

            # Simulate click on right edge near bottom (Z)
            # Viewport height 812. Bottom 24 is reserved.
            # Let's tap at x=370, y=700 (approx Z)
            print("Tapping scrubber at Z...")
            page.mouse.click(370, 700)
            page.wait_for_timeout(1000)

            page.screenshot(path="verification/inventory_scrolled_Z.png")
            print("Captured inventory_scrolled_Z.png")

            # Verify we scrolled
            # Check if 'Zucchini' is visible
            # Note: With sticky headers, we might see the header 'Z'

            # Let's tap near top (A)
            print("Tapping scrubber at A...")
            page.mouse.click(370, 100) # top 20 + some padding
            page.wait_for_timeout(1000)
            page.screenshot(path="verification/inventory_scrolled_A.png")
            print("Captured inventory_scrolled_A.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
            raise e
        finally:
            browser.close()

if __name__ == "__main__":
    verify_inventory_scroll()
