
import os
import re

def check_file_content(filepath, patterns, missing_patterns=[]):
    if not os.path.exists(filepath):
        print(f"FAILED: {filepath} does not exist.")
        return False

    with open(filepath, 'r') as f:
        content = f.read()

    success = True
    for pattern in patterns:
        if pattern not in content and not re.search(pattern, content):
            print(f"FAILED: {filepath} missing pattern: {pattern}")
            success = False

    for pattern in missing_patterns:
        if pattern in content or re.search(pattern, content):
            print(f"FAILED: {filepath} should NOT have pattern: {pattern}")
            success = False

    if success:
        print(f"PASSED: {filepath}")
    return success

print("Verifying Offline Mode & Updates...")

# 1. App.tsx (Sync Fix & Prop Passing)
check_file_content('client/App.tsx', [
    'pushToBackend({', # Ensure push before refresh
    'refreshData();',
    'isOnline={isOnline}' # Ensure prop is passed to children
])

# 2. InventoryScreen (Offline Blocking & Modal)
check_file_content('client/components/InventoryScreen.tsx', [
    'if (!isOnline)',
    "addToast('Please connect to the internet",
    '{itemToDelete && (', # Modal existence
    'confirmDeleteProduct'
])

# 3. HistoryScreen (Offline Blocking & Modal)
check_file_content('client/components/HistoryScreen.tsx', [
    'if (!isOnline)',
    '{transactionToDelete && (', # Modal existence
    'confirmDelete'
])

# 4. SettingsScreen (Offline Blocking)
check_file_content('client/components/SettingsScreen.tsx', [
    'if (!isOnline)',
    "alert('You must be online",
    'isOnline: boolean'
])

# 5. ExpenditureScreen (Offline Blocking)
check_file_content('client/components/ExpenditureScreen.tsx', [
    'if (!isOnline)',
    "addToast('Please connect to the internet"
])

# 6. Analytics Fix (Backend)
check_file_content('server/src/routes/analytics.js', [
    'selectedUnit.multiplier',
    'itemCost = baseCost * multiplier'
])

# 7. Auth Fix (Login Block)
check_file_content('server/src/routes/auth.js', [
    'if (!business.emailVerified)',
    'requiresVerification: true'
])

# 8. Dashboard Local Fix
check_file_content('client/components/DashboardScreen.tsx', [
    'item.selectedUnit.multiplier',
    'cost = product.costPrice * item.selectedUnit.multiplier'
])

print("Verification Complete.")
