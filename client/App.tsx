import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  ShoppingBag, 
  Package, 
  BarChart3, 
  LogOut, 
  Wifi, 
  WifiOff, 
  Settings, 
  History, 
  RefreshCw,
  ChevronRight,
  ShoppingCart,
  PanelRightClose,
  PanelRightOpen,
  Wallet,
  Loader2,
  Bell,
  AlertCircle,
  X
} from 'lucide-react';
import { InventoryState, UserRole, Product, ProductUnit, Transaction, BusinessProfile, TabId, SaleItem, PaymentMethod, Expenditure, ActivityLog, Shop } from './types';
import useTabRouting from './hooks/useTabRouting';
import { useStockVerification } from './hooks/useStockVerification';
import { useTimeDrift } from './hooks/useTimeDrift';
import { INITIAL_PRODUCTS } from './constants';
import { safeCalculate } from './utils/math';
import { saveState, loadState, pushToBackend, getDataVersion, saveDataVersion, getLastSync, saveLastSync, clearLocalData } from './services/storage';
import { login, registerBusiness, saveAuthToken, clearAuthToken, getEntitlements, initializePayment, fetchRemoteState, deleteExpenditure, snoozeStockVerification, dismissNotification, checkServerVersion, createShop, renameShop, getShopsOverview, deleteShop } from './services/api';
import { useToast } from './components/ToastProvider';
import SalesScreen from './components/SalesScreen';
import InventoryScreen from './components/InventoryScreen';
import DashboardScreen from './components/DashboardScreen';
import AuthScreen from './components/AuthScreen';
import SettingsScreen from './components/SettingsScreen';
import HistoryScreen from './components/HistoryScreen';
import ExpenditureScreen from './components/ExpenditureScreen';
import RegistrationScreen from './components/RegistrationScreen';
import CurrentOrderSidebar from './components/CurrentOrderSidebar';
import ForgotPasswordScreen from './components/ForgotPasswordScreen';
import VerifyEmailScreen from './components/VerifyEmailScreen';
import SupportBot from './components/SupportBot';
import useServerWakeup from './services/useServerWakeup';
import NotificationCenter from './components/NotificationCenter';
import WelcomeScreen from './components/WelcomeScreen';
import AdminDashboard from './components/AdminDashboard';
import AdminLogin from './components/AdminLogin';
import { loadAdminToken, clearAdminToken } from './services/api';

// Helper to check for active alerts (duplicated from NotificationCenter to avoid circular deps or complex state lifting)
const hasActiveAlerts = (products: Product[], business: BusinessProfile, lowStockThreshold: number) => {
   const hasLowStock = products.some(p => !p.isDeleted && p.currentStock < lowStockThreshold);

   // Trial Check
   let hasTrialAlert = false;
   if (!business.isSubscribed && business.trialEndsAt) {
      const daysLeft = Math.ceil((new Date(business.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 7 && daysLeft >= 0) { // Alert in last 7 days
          // Check if already notified today
          const lastChecked = localStorage.getItem('ginvoice_trial_notified_date');
          const today = new Date().toDateString();
          if (lastChecked !== today) {
              hasTrialAlert = true;
          }
      }
   }

   return hasLowStock || hasTrialAlert;
};

const ALL_SHOPS_ID = 'all';

const TAB_LABELS: Record<string, string> = {
  sales: 'Sales',
  inventory: 'My Stock',
  history: 'Past Sales',
  dashboard: 'Dashboard',
  expenditure: 'Expenses',
  settings: 'Settings'
};

const App: React.FC = () => {
  const { addToast } = useToast();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
  const [isLoading, setIsLoading] = useState(false);
  const wasOnlineRef = useRef(navigator.onLine);
  const syncInFlightRef = useRef(false);
  
  const [subscriptionLocked, setSubscriptionLocked] = useState(false);

  const [entitlements, setEntitlements] = useState<{
    plan: 'FREE' | 'PRO';
    expiresAt?: string | null;
    trialEndsAt?: string | null;
    subscriptionExpiresAt?: string | null;
  } | null>(() => {
    try {
      const cached = localStorage.getItem('ginvoice_entitlements_v1');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<TabId>('sales');
  // Lazy Keep-Alive Tabs: Track which tabs have been visited
  const [visitedTabs, setVisitedTabs] = useState<Set<TabId>>(new Set(['sales']));

  const [deepLinkParams, setDeepLinkParams] = useState<any>({});
  const [isCartOpen, setIsCartOpen] = useState(window.innerWidth > 1024);
  const [view, setView] = useState<'main' | 'forgot-password'>('main');
  const [recoveryEmail, setRecoveryEmail] = useState<string | undefined>(undefined);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);

  // Welcome Screen State
  // PWA Standalone check
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
  const [showWelcome, setShowWelcome] = useState<boolean>(!isStandalone);
  const [loginMode, setLoginMode] = useState(false);

  const { status: wakeStatus, showWakeupUI } = useServerWakeup();
  const wakeToastShownRef = useRef(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [shopModalMode, setShopModalMode] = useState<'menu' | 'create' | 'rename' | 'switch' | 'delete' | null>(null);
  const [shopNameInput, setShopNameInput] = useState('');
  const [shopInitMode, setShopInitMode] = useState<'fresh' | 'copy_inventory' | 'share_catalog'>('fresh');
  const [shopSourceId, setShopSourceId] = useState('');
  const [isSavingShop, setIsSavingShop] = useState(false);
  const [isSwitchingShop, setIsSwitchingShop] = useState(false);
  const [hubOverview, setHubOverview] = useState<{ rows: any[]; totals: any } | null>(null);
  const [deleteReplacementShopId, setDeleteReplacementShopId] = useState('');
  const isTimeBlocked = useTimeDrift();

  /* // TEMPORARILY DISABLED TO FIX CRASH
  useEffect(() => {
    if (!state.business.settings?.enableLowStockAlerts) return;
    // ... (Low stock logic) ...
  }, [state.products, state.business.settings?.enableLowStockAlerts]);
  */

  const { handleTabChange, handleBotNavigate } = useTabRouting({
    setActiveTab,
    setVisitedTabs,
    setDeepLinkParams,
    tabLabels: TAB_LABELS
  });

  // Email Verification Feedback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('verified') === 'true') {
      addToast('Email verified successfully! You can now login.', 'success');

      const email = params.get('email');
      if (email) {
          setState(prev => ({
              ...prev,
              isRegistered: true,
              isLoggedIn: false,
              business: { ...prev.business, email: decodeURIComponent(email) }
          }));
      }

      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('error') === 'invalid_token') {
      addToast('Verification link invalid or expired.', 'error');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [addToast]);

  useEffect(() => {
    if (!showWakeupUI) return;
    if (wakeStatus === 'waking' && !wakeToastShownRef.current) {
      addToast('Checking connection...', 'info');
      wakeToastShownRef.current = true;
    } else if (wakeStatus !== 'waking') {
      wakeToastShownRef.current = false;
    }
  }, [wakeStatus, addToast, showWakeupUI]);

  useEffect(() => {
    const onUpdateReady = () => addToast('New version ready. Reloading now…', 'info');
    window.addEventListener('app:update-ready', onUpdateReady);
    return () => window.removeEventListener('app:update-ready', onUpdateReady);
  }, [addToast]);

  // Global Auth/Permission Handler
  useEffect(() => {
    const handleForceReload = (e: Event) => {
        const detail = (e as CustomEvent).detail || {};
        const scope = detail?.scope as 'admin' | 'user' | undefined;

        if (scope === 'admin') {
          clearAdminToken();
          addToast(detail?.message || 'Admin session expired. Please log in again.', 'error');
        } else {
          clearAuthToken();
          clearAdminToken();
          clearLocalData();
          setState(prev => ({ ...prev, isLoggedIn: false }));
          addToast(detail?.message || 'Session expired. Please log in again.', 'error');
        }

        // Small delay to let toast show
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    };

    window.addEventListener('auth:force-reload', handleForceReload);
    return () => window.removeEventListener('auth:force-reload', handleForceReload);
  }, [addToast]);

  const [state, setState] = useState<InventoryState>(() => {
    const persisted = loadState();
    const base = persisted || {
      products: INITIAL_PRODUCTS.slice(0, 1), // Keep 1 sample product
      transactions: [],
      role: 'staff',
      isLoggedIn: false,
      isRegistered: false,
      business: {
        name: '', address: '', phone: '', email: '',
        theme: { primaryColor: '#4f46e5', fontFamily: "'Inter', sans-serif" },
        staffPermissions: { canGiveDiscount: false, canViewInventory: false, canEditInventory: false, canViewHistory: false, canViewDashboard: false, canViewExpenditure: false }
      },
      expenditures: [],
      activities: [],
      notifications: [],
      shops: [],
      activeShopId: undefined,
      allShopsMode: false
    };
    if (!base.expenditures) base.expenditures = [];
    if (!base.activities) base.activities = [];
    if (!base.notifications) base.notifications = [];
    return base as InventoryState;
  });

  const [cart, setCart] = useState<SaleItem[]>([]);
  const [historySelectedInvoice, setHistorySelectedInvoice] = useState<Transaction | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [globalDiscount, setGlobalDiscount] = useState<number>(0);
  const [isGlobalDiscountPercent, setIsGlobalDiscountPercent] = useState(false);
  const [signature, setSignature] = useState<string>('');
  const [isLocked, setIsLocked] = useState(false);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const pastCustomers = useMemo(() => {
    const names = new Set(state.transactions.map(t => t.customerName).filter(Boolean));
    return Array.from(names).sort();
  }, [state.transactions]);

  const DEAD_STOCK_WINDOW_DAYS = 45;

  const inventorySalesSnapshot = useMemo(() => {
    const totalSoldMap = new Map<string, number>();
    const recentSoldMap = new Map<string, number>();
    const lastSoldAtMap = new Map<string, string>();
    const cutoff = Date.now() - (DEAD_STOCK_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    state.transactions.forEach((tx) => {
      const txTs = new Date(tx.transactionDate || tx.updatedAt || '').getTime();
      const inDeadStockWindow = Number.isFinite(txTs) && txTs >= cutoff;

      (tx.items || []).forEach((item) => {
        const key = item.productId || item.productName;
        if (!key) return;

        const qty = Number(item.quantity || 0);
        totalSoldMap.set(key, (totalSoldMap.get(key) || 0) + qty);

        if (inDeadStockWindow) {
          recentSoldMap.set(key, (recentSoldMap.get(key) || 0) + qty);
        }

        const soldAtIso = tx.transactionDate || tx.updatedAt;
        if (soldAtIso) {
          const prev = lastSoldAtMap.get(key);
          if (!prev || new Date(soldAtIso).getTime() > new Date(prev).getTime()) {
            lastSoldAtMap.set(key, soldAtIso);
          }
        }
      });
    });

    return { totalSoldMap, recentSoldMap, lastSoldAtMap };
  }, [state.transactions]);

  const topSellingPreview = useMemo(() => {
    return state.products
      .map((product) => ({
        id: product.id,
        name: product.name,
        category: product.category || 'Uncategorized',
        sold: Number(inventorySalesSnapshot.totalSoldMap.get(product.id) || 0)
      }))
      .filter((item) => item.sold > 0)
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 8);
  }, [state.products, inventorySalesSnapshot]);

  const recentTransactionsPreview = useMemo(() => {
    return state.transactions
      .slice()
      .sort((a, b) => new Date(b.transactionDate || b.updatedAt || '').getTime() - new Date(a.transactionDate || a.updatedAt || '').getTime())
      .slice(0, 8)
      .map((tx) => ({
        id: tx.id,
        customerName: tx.customerName,
        totalAmount: tx.totalAmount,
        balance: tx.balance,
        paymentStatus: tx.paymentStatus,
        transactionDate: tx.transactionDate
      }));
  }, [state.transactions]);

  const isAllShopsMode = state.activeShopId === ALL_SHOPS_ID || Boolean(state.allShopsMode);

  const botUiContext = useMemo(() => {
    const baseShopContext = {
      activeShopId: state.activeShopId || state.business.defaultShopId || null,
      allShopsMode: isAllShopsMode
    };

    if (activeTab === 'sales') {
      const cartSubtotal = cart.reduce((sum, item) => sum + (item.total || 0), 0);
      return {
        ...baseShopContext,
        tab: 'sales',
        cart: {
          itemCount: cart.length,
          subtotal: Number(cartSubtotal.toFixed(2)),
          customerName: customerName || undefined,
          items: cart.slice(0, 8).map(item => ({
            name: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total
          }))
        }
      };
    }

    if (activeTab === 'inventory') {
      const lowStockThreshold = state.business.settings?.lowStockThreshold || 10;
      const activeProducts = state.products.filter(p => !p.isDeleted);
      const lowStockCount = activeProducts.filter(p => p.currentStock < lowStockThreshold).length;
      // Estimate value using Cost Price if available, else 0.
      const totalValue = activeProducts.reduce((sum, p) => sum + (p.currentStock * (p.costPrice || 0)), 0);

      const outOfStockCount = activeProducts.filter(p => Number(p.currentStock || 0) <= 0).length;
      const deadStockCount = state.products.filter((p) => {
        const soldRecently = Number(inventorySalesSnapshot.recentSoldMap.get(p.id) || 0);
        return Number(p.currentStock || 0) > 0 && soldRecently <= 0;
      }).length;

      return {
        ...baseShopContext,
        tab: 'inventory',
        inventory: {
            totalProducts: state.products.length,
            lowStockCount,
            outOfStockCount,
            deadStockCount,
            totalValue,
            lowStockPreview: activeProducts
              .filter(p => Number(p.currentStock || 0) < lowStockThreshold)
              .slice(0, 8)
              .map(p => ({ id: p.id, name: p.name, stock: Number(p.currentStock || 0), category: p.category || 'Uncategorized' })),
            topSellingPreview,
            deadStockWindowDays: DEAD_STOCK_WINDOW_DAYS,
            deadStockPreview: state.products
              .filter((p) => Number(p.currentStock || 0) > 0 && Number(inventorySalesSnapshot.recentSoldMap.get(p.id) || 0) <= 0)
              .slice(0, 8)
              .map((p) => ({
                id: p.id,
                name: p.name,
                stock: Number(p.currentStock || 0),
                category: p.category || 'Uncategorized',
                lastSoldAt: inventorySalesSnapshot.lastSoldAtMap.get(p.id) || null
              }))
        }
      };
    }

    if (activeTab === 'expenditure') {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const thisMonthExpenses = state.expenditures.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });
        const thisMonthTotal = thisMonthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

        return {
            ...baseShopContext,
            tab: 'expenditure',
            expenditure: {
                totalCount: state.expenditures.length,
                thisMonthTotal
            }
        };
    }

    if (activeTab === 'dashboard') {
        const totalRevenue = state.transactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
        return {
            ...baseShopContext,
            tab: 'dashboard',
            dashboard: {
                totalRevenue,
                totalProfit: 0, // Placeholder as costly to calc here
                topProduct: topSellingPreview[0]?.name || ''
            }
        };
    }

    if (activeTab === 'settings') {
        return {
            ...baseShopContext,
            tab: 'settings',
            settings: {
                plan: entitlements?.plan || (state.business.isSubscribed ? 'PRO' : 'FREE'),
                businessName: state.business.name
            }
        };
    }

    if (activeTab === 'history') {
      return {
        ...baseShopContext,
        tab: 'history',
        selectedInvoice: historySelectedInvoice
          ? {
              id: historySelectedInvoice.id,
              customerName: historySelectedInvoice.customerName,
              transactionDate: historySelectedInvoice.transactionDate,
              totalAmount: historySelectedInvoice.totalAmount,
              amountPaid: historySelectedInvoice.amountPaid,
              balance: historySelectedInvoice.balance,
              paymentStatus: historySelectedInvoice.paymentStatus,
              itemCount: historySelectedInvoice.items?.length || 0
            }
          : null,
        recentTransactions: recentTransactionsPreview
      };
    }

    return { ...baseShopContext, tab: activeTab };
  }, [activeTab, cart, historySelectedInvoice, customerName, state.products, state.transactions, state.expenditures, state.business, entitlements, topSellingPreview, recentTransactionsPreview, inventorySalesSnapshot, isAllShopsMode]);

  const refreshData = useCallback(async (overrideState?: InventoryState) => {
    if (!navigator.onLine) return;

    // Check login status from override or current state
    const currentState = overrideState || stateRef.current;
    if (!currentState.isLoggedIn) return;

    setIsSyncing(true);
    try {
      // TRUE = Force Full Fetch (Ignore versions)
      const requestedShopId = currentState.activeShopId;
      const response = await fetchRemoteState(true, {
        shopId: requestedShopId && requestedShopId !== ALL_SHOPS_ID ? requestedShopId : undefined,
        allShops: requestedShopId === ALL_SHOPS_ID
      });

      if (response.status === 200 && response.data) {
         const { products, transactions, categories, expenditures, business, notifications, shops, activeShopId, allShopsMode } = response.data;

         const nextState: InventoryState = {
           ...currentState,
           // DIRECT STATE REPLACEMENT (No merging)
           products: products || [],
           transactions: transactions || [],
           categories: categories || [],
           expenditures: expenditures || [],
           notifications: notifications || [],
           shops: shops || currentState.shops || [],
           activeShopId: activeShopId || currentState.activeShopId || business?.defaultShopId,
           allShopsMode: Boolean(allShopsMode),
           business: business ? { ...currentState.business, ...business } : currentState.business,
           lastSyncedAt: new Date().toISOString(),
           isLoggedIn: true
         };

         if (business) {
             const current = loadState();
             if (current) saveState({ ...current, business: { ...current.business, ...business } });
         }

         setState(nextState);
         // Note: We deliberately do NOT save data version here as we always force full fetch
         saveLastSync(new Date());
      }
    } catch (err) {
      console.error("Data refresh failed", err);
      addToast("Could not load data from server", "error");
    } finally {
      setIsSyncing(false);
    }
  }, [addToast]);

  const safeSyncWithServer = useCallback(async (source: 'online-event' | 'initial-load' | 'heartbeat' | 'manual') => {
    if (!navigator.onLine) return;

    const currentState = stateRef.current;
    if (!currentState.isLoggedIn) return;

    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;

    try {
      try {
        await pushToBackend({
          transactions: currentState.transactions,
          products: currentState.products,
          expenditures: currentState.expenditures,
          shopId: currentState.activeShopId && currentState.activeShopId !== ALL_SHOPS_ID ? currentState.activeShopId : undefined
        });
      } catch (err) {
        console.error(`[Safe Sync] Pre-sync push failed (${source})`, err);
        addToast('Sync failed for now. Local data is safe; retrying shortly.', 'warning');
        return;
      }

      await refreshData(currentState);
    } finally {
      syncInFlightRef.current = false;
    }
  }, [addToast, refreshData]);

  const handleLogout = useCallback(() => {
    clearAuthToken();
    clearAdminToken();
    clearLocalData();
    localStorage.clear();
    sessionStorage.clear();

    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          caches.delete(name);
        });
      });
    }

    setState(prev => ({ ...prev, isLoggedIn: false }));
    window.location.reload();
  }, []);

  const handleDeleteAccount = useCallback(() => {
    localStorage.clear(); // Wipe all data
    window.location.reload(); // Strict force logout
  }, []);

  const fetchEntitlements = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const data = await getEntitlements();
      const next = {
        plan: data.plan,
        expiresAt: data.expiresAt,
        trialEndsAt: data.trialEndsAt,
        subscriptionExpiresAt: data.subscriptionExpiresAt
      };
      setEntitlements(next);
      localStorage.setItem('ginvoice_entitlements_v1', JSON.stringify(next));
    } catch (err) {
      console.error('Entitlements fetch failed', err);
    }
  }, [addToast, handleLogout]);

  // Enforce subscription lock based on entitlements
  useEffect(() => {
      if (entitlements) {
          const trialEndsAt = entitlements.trialEndsAt ? new Date(entitlements.trialEndsAt) : null;
          const trialExpired = trialEndsAt ? trialEndsAt < new Date() : false;
          const isFree = entitlements.plan === 'FREE';

          if (isFree && trialExpired) {
              if (!subscriptionLocked) {
                  setSubscriptionLocked(true);
                  // We avoid toast on mount to not annoy user, but maybe needed?
                  // addToast('Your subscription has expired. Read-only mode active.', 'error');
              }
          } else {
              if (subscriptionLocked) setSubscriptionLocked(false);
          }
      }
  }, [entitlements, subscriptionLocked]);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      if (!wasOnlineRef.current) {
        addToast('Back online. Syncing latest changes...', 'info');
      }
      if (!wasOnlineRef.current && state.isLoggedIn) {
        await safeSyncWithServer('online-event');
      }
      await fetchEntitlements();
    };
    const handleOffline = () => {
      setIsOnline(false);
      addToast('You are offline. Sales continue locally; sync resumes when connected.', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [state.isLoggedIn, fetchEntitlements, safeSyncWithServer, addToast]);

  useEffect(() => {
    wasOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    const onResize = () => setIsMobileView(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (state.isLoggedIn && navigator.onLine) {
       // Initial load safe sync (push local first, then pull)
       safeSyncWithServer('initial-load');
       fetchEntitlements();
    }
  }, [state.isLoggedIn, safeSyncWithServer, fetchEntitlements]);

  // SMART SYNC HEARTBEAT (Every 10s)
  useEffect(() => {
      if (!isOnline || !state.isLoggedIn) return;

      const interval = setInterval(async () => {
         try {
             const serverVersion = Number(checkServerVersion ? await checkServerVersion() : 0).valueOf();
             const localVersion = getDataVersion();
             const safeServerVersion = Number.isFinite(serverVersion) ? Number(serverVersion.toFixed(3)) : 0;
             const safeLocalVersion = Number.isFinite(localVersion) ? Number(localVersion.toFixed(3)) : 0;

             if (safeServerVersion > safeLocalVersion) {
                 console.log(`[Smart Sync] Update found! Server: ${safeServerVersion.toFixed(3)} > Local: ${safeLocalVersion.toFixed(3)}`);
                 await safeSyncWithServer('heartbeat');
                 // Update local version match to prevent loops (refreshData should ideally return the new version,
                 // but simpler to just trust it for now or rely on next refreshData saving it)
                 // NOTE: refreshData logic below needs to handle version saving if we want this perfect.
                 // For now, let's manually update the version marker to match server so we don't spam.
                 saveDataVersion(safeServerVersion);
             }
         } catch (err) {
             console.warn('Smart Sync check failed', err);
         }
      }, 10000);

      return () => clearInterval(interval);
  }, [isOnline, state.isLoggedIn, safeSyncWithServer]);

  const openPaymentLink = useCallback(async () => {
    if (!navigator.onLine) {
      addToast('Please connect to the internet to subscribe.', 'error');
      return;
    }
    try {
      const response = await initializePayment(2000, state.business.email);
      const url = response?.data?.authorization_url;
      if (url) window.open(url, '_blank');
    } catch (err) {
      addToast('Payment initialization failed.', 'error');
    }
  }, [state.business.email, addToast]);

  useEffect(() => {
    const styleId = 'dynamic-theme';
    let styleTag = document.getElementById(styleId);
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = styleId;
      document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = `
      :root { --primary: ${state.business.theme.primaryColor}; --primary-bg: ${state.business.theme.primaryColor}15; }
      body { font-family: ${state.business.theme.fontFamily}; }
    `;

    const themeMeta = document.getElementById('theme-color-meta') as HTMLMetaElement | null;
    if (themeMeta) {
      themeMeta.content = state.business.theme.primaryColor;
    }
  }, [state.business.theme]);

  useEffect(() => { saveState(state); }, [state]);

  const handleAddExpenditure = (newExpenditure: Expenditure) => {
    if (!isOnline) {
        addToast('Please connect to the internet to perform this action.', 'error');
        return;
    }
    if (stateRef.current.activeShopId === ALL_SHOPS_ID) {
      addToast('Select a specific shop to add an expense.', 'warning');
      return;
    }

    const payload = {
      ...newExpenditure,
      shopId: stateRef.current.activeShopId || stateRef.current.business.defaultShopId
    };

    setState(prev => {
      const updated = [payload, ...prev.expenditures];
      if (navigator.onLine) pushToBackend({ expenditures: [payload], shopId: payload.shopId });
      return { ...prev, expenditures: updated };
    });
  };

  const handleDeleteExpenditure = async (id: string) => {
     if (!isOnline) {
        addToast('Please connect to the internet to perform this action.', 'error');
        return;
    }
    setState(prev => ({ ...prev, expenditures: prev.expenditures.filter(e => e.id !== id) }));
    if (navigator.onLine) {
        try {
            await deleteExpenditure(id);
        } catch (err) {
            console.error(err);
        }
    }
  };

  const handleEditExpenditure = (updated: Expenditure) => {
      if (!isOnline) {
        addToast('Please connect to the internet to perform this action.', 'error');
        return;
    }
      if (stateRef.current.activeShopId === ALL_SHOPS_ID) {
        addToast('Select a specific shop to edit expenses.', 'warning');
        return;
      }
      const payload = { ...updated, shopId: updated.shopId || stateRef.current.activeShopId || stateRef.current.business.defaultShopId };
      setState(prev => {
          const newExp = prev.expenditures.map(e => e.id === payload.id ? payload : e);
          if (navigator.onLine) pushToBackend({ expenditures: [payload], shopId: payload.shopId });
          return { ...prev, expenditures: newExp };
      });
  };

  const handleRegister = async (details: any) => {
    try {
      if (navigator.onLine) {
        const response = await registerBusiness({ ...details, theme: state.business.theme });
        saveAuthToken(response.token);
        if (response?.business?.trialEndsAt) details.trialEndsAt = response.business.trialEndsAt;
      }
    } catch (err) { console.error('Registration error', err); }

    // Instead of logging in, we show verification screen
    setPendingVerificationEmail(details.email);

    // We update business details but keep isLoggedIn false
    setState(prev => ({
      ...prev,
      isRegistered: true,
      isLoggedIn: false, // Ensure they are not logged in yet
      role: 'owner',
      business: { ...prev.business, ...details, trialEndsAt: details.trialEndsAt || new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString() }
    }));
  };

  const handleManualLogin = async (credentials: { email: string, pin: string }) => {
    if (!navigator.onLine) {
      addToast('Login requires internet connection.', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const response = await login(credentials.email, credentials.pin);
      saveAuthToken(response.token);

      const newState: InventoryState = {
        ...state,
        isRegistered: true,
        isLoggedIn: true,
        role: response.role,
        business: { ...state.business, ...response.business },
        products: [],
        transactions: [],
        categories: [],
        expenditures: [],
        notifications: [],
        shops: [],
        activeShopId: response.business?.defaultShopId,
        allShopsMode: false
      };

      setState(newState);

      // Pass the new state directly to refreshData
      await refreshData(newState);

      setIsLoading(false);

    } catch (err: any) {
      console.error('Manual login failed', err);

      if (err.status === 403 && err.data?.requiresVerification) {
        setPendingVerificationEmail(credentials.email);
        addToast('Please verify your email to continue. We have sent you a code.', 'info');
        setIsLoading(false);
        return;
      }

      addToast(err.message || 'Login failed. Check your credentials.', 'error');
      setIsLoading(false);
      setState(prev => ({ ...prev, isLoggedIn: false }));
    }
  };

  const handleLogin = async (pin: string, selectedRole: UserRole) => {
    if (!navigator.onLine) {
      addToast('Login requires internet connection.', 'error');
      return false;
    }

    try {
      if (state.business.email) {
        const response = await login(state.business.email, pin, selectedRole);
        saveAuthToken(response.token);

        const newState = {
          ...state,
          role: response.role,
          isLoggedIn: true,
          business: { ...state.business, ...response.business },
          activeShopId: response.business?.defaultShopId || state.activeShopId,
          allShopsMode: false
        };

        setState(newState);
        setActiveTab('history');

        // Pass the new state directly to refreshData
        refreshData(newState);

        return true;
      }
    } catch (err: any) {
      console.error('Login failed', err);

      if ((err.status === 403 && err.data?.requiresVerification) || err.message?.toLowerCase().includes('verify')) {
          setPendingVerificationEmail(state.business.email);
          addToast('Please verify your email to continue. We have sent you a code.', 'info');
          return false;
      }
    }
    return false;
  };

  const handleDeleteTransaction = async (id: string, restockItems: boolean) => {
    if (!navigator.onLine) {
      addToast('Delete requires internet.', 'error');
      return;
    }

    try {
      const current = stateRef.current;
      const tx = current.transactions.find(t => t.id === id);
      if (!tx) return;

      const deleteLog: ActivityLog = {
        id: `LOG-${Date.now()}`,
        type: 'delete',
        title: 'Transaction Deleted',
        description: `Order #${id} removed by ${current.role}`,
        actor: current.role,
        timestamp: new Date().toISOString()
      };

      const nextProducts = restockItems
        ? current.products.map(p => {
            const item = tx.items.find(i => i.productId === p.id);
            const mult = item?.multiplier || (item?.selectedUnit ? item.selectedUnit.multiplier : 1);
            return item ? { ...p, currentStock: p.currentStock + (item.quantity * mult) } : p;
          })
        : current.products;

      const nextState = {
        ...current,
        products: nextProducts,
        transactions: current.transactions.filter(t => t.id !== id),
        activities: [deleteLog, ...(current.activities || [])]
      };

      stateRef.current = nextState;
      setState(nextState);

      await refreshData(nextState);
    } catch (err) {
      addToast('Delete failed.', 'error');
    }
  };

  const addToCart = (product: Product, unit?: ProductUnit) => {
    const multiplier = unit ? unit.multiplier : 1;
    // Basic check for at least 1 unit availability
    if (product.currentStock < multiplier) return;

    setCart(prev => {
      // 1. Check if item exists (matching Product ID AND Unit)
      const existingItemIndex = prev.findIndex(item =>
        item.productId === product.id &&
        ((!item.selectedUnit && !unit) || (item.selectedUnit?.name === unit?.name))
      );

      if (existingItemIndex !== -1) {
        // 2. If exists, just increment quantity (KEEP the old row)
        const newCart = [...prev];
        const item = newCart[existingItemIndex];
        const newQuantity = item.quantity + 1;

        newCart[existingItemIndex] = {
           ...item,
           quantity: newQuantity,
           // Update total as well to keep data consistent
           total: safeCalculate(item.unitPrice, newQuantity)
        };
        return newCart;
      } else {
        // 3. If new, add to cart with quantity 1
        return [...prev, {
          cartId: crypto.randomUUID(),
          productId: product.id,
          productName: unit ? `${product.name} (${unit.name})` : product.name,
          category: product.category,
          quantity: 1,
          unitPrice: unit ? (unit.sellingPrice || 0) : (product.sellingPrice || 0),
          discount: 0,
          total: unit ? (unit.sellingPrice || 0) : (product.sellingPrice || 0),
          selectedUnit: unit
        }];
      }
    });
    addToast("Added", "success", 1500);
  };

  const handleCompleteSale = (transaction: Transaction) => {
    if (state.activeShopId === ALL_SHOPS_ID) {
      addToast('Select a specific shop to record sales.', 'warning');
      return;
    }

    const txWithShop: Transaction = {
      ...transaction,
      shopId: state.activeShopId || state.business.defaultShopId
    };

    // 1. Calculate new state first (with Delta Accumulation)
    const updatedProducts = state.products.map(p => {
      const itemsInSale = txWithShop.items.filter(i => i.productId === p.id);
      if (itemsInSale.length === 0) return p;

      const totalDeduction = itemsInSale.reduce((sum, item) => {
          const multiplier = item.selectedUnit ? item.selectedUnit.multiplier : 1;
          return sum + (item.quantity * multiplier);
      }, 0);

      return {
          ...p,
          currentStock: Math.max(0, p.currentStock - totalDeduction),
          stockDelta: (p.stockDelta || 0) - totalDeduction,
          updatedAt: new Date().toISOString() // Update timestamp immediately
      };
    });

    // Create activity log
    const saleLog: ActivityLog = {
      id: `LOG-${Date.now()}`,
      type: 'sale',
      title: 'Sale Recorded',
      description: `Invoice #${transaction.id}`,
      actor: txWithShop.createdByRole || state.role, // Use role from transaction
      timestamp: new Date().toISOString()
    };

    const nextState = {
      ...state,
      products: updatedProducts,
      transactions: [txWithShop, ...state.transactions],
      activities: [saleLog, ...(state.activities || [])]
    };

    // 2. Update UI
    setState(nextState);
    setCart([]); setCustomerName(''); setCustomerPhone(''); setAmountPaid(0); setGlobalDiscount(0); setSignature(''); setIsLocked(false);
    if (window.innerWidth < 768) setIsCartOpen(false);

    // 3. PUSH to Server immediately
    if (navigator.onLine) {
      // Use the stable timestamp from state, don't generate new one on retry
      pushToBackend({ transactions: [txWithShop], products: updatedProducts, shopId: txWithShop.shopId })
        .then(() => {
             // CRITICAL: On success, subtract the sent delta to prevent double-counting but keep new offline changes
             setState(prev => ({
                 ...prev,
                 products: prev.products.map(p => {
                    const sent = updatedProducts.find(s => s.id === p.id);
                    if (sent && typeof sent.stockDelta === 'number') {
                        return { ...p, stockDelta: (p.stockDelta || 0) - sent.stockDelta };
                    }
                    return p;
                 })
             }));
        })
        .catch(err => {
            console.error("Instant sync failed:", err);
            addToast("Sale saved locally. Connect to internet to back up.", "warning");
        });
    }
  };

  const handleUpdateProducts = (products: Product[]) => {
    // Ensure products have updatedAt set by the caller (InventoryScreen)
    // If not, we should set it here? Ideally InventoryScreen sets it.
    // Let's enforce it here just in case, but InventoryScreen should do it to be precise.
    const stampedProducts = products.map(p => p.updatedAt ? p : { ...p, updatedAt: new Date().toISOString() });

    const nextState = { ...stateRef.current, products: stampedProducts };
    stateRef.current = nextState;
    setState(nextState);
    if (navigator.onLine) {
      pushToBackend({ products: stampedProducts, shopId: stateRef.current.activeShopId && stateRef.current.activeShopId !== ALL_SHOPS_ID ? stateRef.current.activeShopId : undefined })
        .then(() => {
            // Clear accumulated deltas on success (Subtract sent delta)
            setState(prev => ({
                ...prev,
                products: prev.products.map(p => {
                    const sent = stampedProducts.find(s => s.id === p.id);
                    if (sent && typeof sent.stockDelta === 'number') {
                        return { ...p, stockDelta: (p.stockDelta || 0) - sent.stockDelta };
                    }
                    return p;
                })
            }));
        })
        .catch(err => console.error("Instant sync failed:", err));
    }
  };

  const perms = (state.business.staffPermissions as any) || {};
  const canManageStock = state.role === 'owner' || perms.canEditInventory;
  const canManageHistory = state.role === 'owner' || perms.canEditHistory;

  const visibleTransactions = useMemo(() => {
    if (isAllShopsMode) return state.transactions;
    if (!state.activeShopId) return state.transactions;
    return state.transactions.filter((tx) => !tx.shopId || tx.shopId === state.activeShopId);
  }, [state.transactions, state.activeShopId, isAllShopsMode]);

  const visibleExpenditures = useMemo(() => {
    if (isAllShopsMode) return state.expenditures;
    if (!state.activeShopId) return state.expenditures;
    return (state.expenditures || []).filter((exp) => !exp.shopId || exp.shopId === state.activeShopId);
  }, [state.expenditures, state.activeShopId, isAllShopsMode]);

  const visibleNotifications = useMemo(() => {
    const notes = state.notifications || [];
    if (isAllShopsMode) return notes;
    if (!state.activeShopId) return notes;
    return notes.filter((n: any) => {
      const noteShopId = n.shopId || n?.payload?.shopId;
      if (!noteShopId) return true;
      return String(noteShopId) === String(state.activeShopId);
    });
  }, [state.notifications, state.activeShopId, isAllShopsMode]);

  const handleShopSwitch = async (nextShopId: string) => {
    if (isSwitchingShop) return;
    if (nextShopId === stateRef.current.activeShopId) {
      closeShopModal();
      return;
    }
    setIsSwitchingShop(true);
    const nextState = { ...stateRef.current, activeShopId: nextShopId, allShopsMode: nextShopId === ALL_SHOPS_ID };
    stateRef.current = nextState;
    setState(nextState);
    try {
      await refreshData(nextState);
    } finally {
      setIsSwitchingShop(false);
    }
  };

  const openShopSwitcherModal = () => {
    setShopModalMode('switch');
  };

  const openShopManagementMenu = () => {
    setShopModalMode('menu');
  };


  const handleCreateShop = async () => {
    setShopNameInput('');
    setShopInitMode('fresh');
    setShopSourceId(state.activeShopId && state.activeShopId !== ALL_SHOPS_ID ? state.activeShopId : state.business.defaultShopId || '');
    setShopModalMode('create');
  };

  const handleRenameActiveShop = async () => {
    const targetId = state.activeShopId;
    if (!targetId || targetId === ALL_SHOPS_ID) return;
    const currentName = (state.shops || []).find((s: Shop) => s.id === targetId)?.name || 'Shop';
    setShopNameInput(currentName);
    setShopModalMode('rename');
  };

  const handleDeleteActiveShop = () => {
    const targetId = state.activeShopId;
    if (!targetId || targetId === ALL_SHOPS_ID) return;
    setDeleteReplacementShopId(((state.shops || []).find((s) => s.id !== targetId)?.id) || '');
    setShopModalMode('delete');
  };

  const closeShopModal = () => {
    if (isSavingShop) return;
    setShopModalMode(null);
    setShopNameInput('');
    setShopInitMode('fresh');
    setShopSourceId('');
    setDeleteReplacementShopId('');
  };

  const handleSubmitShopModal = async () => {
    if (isSavingShop) return;
    if (shopModalMode === 'switch' || shopModalMode === 'menu') return;

    if (shopModalMode === 'delete') {
      const targetId = state.activeShopId;
      if (!targetId || targetId === ALL_SHOPS_ID) return;
      setIsSavingShop(true);
      try {
        await deleteShop(targetId, deleteReplacementShopId || undefined);
        const fallbackShopId = deleteReplacementShopId || state.business.defaultShopId;
        const nextState = { ...stateRef.current, activeShopId: fallbackShopId, allShopsMode: false };
        stateRef.current = nextState;
        setState(nextState);
        await refreshData(nextState);
        addToast('Shop deleted.', 'success');
        closeShopModal();
      } catch (err: any) {
        addToast(err?.message || 'Could not delete shop', 'error');
      } finally {
        setIsSavingShop(false);
      }
      return;
    }

    const name = shopNameInput.trim();
    if (!name || !isOnline) return;

    const targetId = state.activeShopId;
    const currentName = (state.shops || []).find((s: Shop) => s.id === targetId)?.name || '';
    if (shopModalMode === 'rename' && (!targetId || targetId === ALL_SHOPS_ID || name === currentName)) {
      closeShopModal();
      return;
    }

    setIsSavingShop(true);
    try {
      if (shopModalMode === 'create') {
        await createShop({ name, initializationMode: shopInitMode, sourceShopId: shopInitMode === 'copy_inventory' ? shopSourceId : undefined });
      } else if (shopModalMode === 'rename' && targetId) {
        await renameShop(targetId, name);
      }
      await refreshData();
      addToast(shopModalMode === 'create' ? 'Shop created.' : 'Shop renamed.', 'success');
      closeShopModal();
    } catch (err: any) {
      addToast(err?.message || `Could not ${shopModalMode === 'create' ? 'create' : 'rename'} shop`, 'error');
    } finally {
      setIsSavingShop(false);
    }
  };

  const hasMultipleShops = (state.shops || []).length > 1;

  useEffect(() => {
    if (!state.isLoggedIn || !isOnline || !isAllShopsMode) return;
    let active = true;
    getShopsOverview()
      .then((data) => {
        if (active) setHubOverview(data);
      })
      .catch((err) => {
        console.error('Shops overview failed', err);
      });
    return () => {
      active = false;
    };
  }, [state.isLoggedIn, isOnline, isAllShopsMode, state.transactions, state.expenditures, state.products]);

  const allowedTabs = useMemo(() => {
    const hasPro = entitlements?.plan === 'PRO' || state.business.isSubscribed;
    const entitlementTrial = entitlements?.trialEndsAt ? new Date(entitlements.trialEndsAt) : null;
    const businessTrial = state.business.trialEndsAt ? new Date(state.business.trialEndsAt) : null;
    const trialEndDate = entitlementTrial || businessTrial;
    const trialActive = trialEndDate ? trialEndDate >= new Date() : false;

    const PAGE_IDS: TabId[] = ['sales', 'inventory', 'history', 'expenditure', 'dashboard', 'settings'];
    const ownerTabs = PAGE_IDS;

    if (state.role === 'owner') return ownerTabs;

    const staffTabs: string[] = ['sales'];
    const perms = (state.business.staffPermissions as any) || {};
    if (perms.canViewInventory || perms.canEditInventory) staffTabs.push('inventory');
    if (perms.canViewHistory || perms.canEditHistory) staffTabs.push('history');
    if (perms.canViewExpenditure) staffTabs.push('expenditure');
    if (perms.canViewDashboard) staffTabs.push('dashboard');

    return Array.from(new Set(staffTabs)) as TabId[];
  }, [state.role, state.business.staffPermissions, entitlements, state.business.trialEndsAt, state.business.isSubscribed]);

  useEffect(() => {
    if (activeTab === 'admin-portal') return;

    if (allowedTabs.length > 0 && !allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0]);
    }
  }, [allowedTabs, activeTab]);

  // Call hooks BEFORE any conditional returns to prevent "Rendered fewer hooks than expected"
  const {
    startStockVerification,
    snoozeVerification,
    dismissVerification
  } = useStockVerification({
    handleBotNavigate,
    addToast,
    refreshData,
    setIsNotificationOpen
  });

  // SPECIAL ROUTE: Admin Portal (Bypasses Main App Auth)
  if (isTimeBlocked) {
      return (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur flex flex-col items-center justify-center p-8 text-white text-center animate-in fade-in">
             <AlertCircle size={64} className="text-red-500 mb-6 animate-pulse" />
             <h1 className="text-3xl font-black mb-4">Security Alert: Time Mismatch</h1>
             <p className="text-gray-300 max-w-md mb-8 leading-relaxed">
                Your device clock appears to be significantly incorrect or has been modified.
                Please set your device to the correct time automatically to continue using GInvoice.
             </p>
             <div className="bg-white/10 p-4 rounded-xl border border-white/20">
                <p className="font-mono text-sm text-yellow-400">Current Device Time: {new Date().toLocaleTimeString()}</p>
             </div>
             <button
               onClick={() => window.location.reload()}
               className="mt-8 px-8 py-3 bg-white text-black font-bold rounded-xl hover:scale-105 transition-transform"
             >
                Check Again
             </button>
        </div>
      );
  }

  // SPECIAL ROUTE: Admin Portal (Bypasses Main App Auth)
  if (activeTab === 'admin-portal') {
      return (
         <div className="absolute inset-0 overflow-y-auto bg-gray-50 z-50">
             {loadAdminToken() ? (
                <AdminDashboard onLogout={() => window.location.reload()} />
             ) : (
                <AdminLogin onLoginSuccess={() => window.location.reload()} />
             )}
         </div>
      );
  }

  if (view === 'forgot-password') {
    return (
      <ForgotPasswordScreen
        onBack={() => setView('main')}
        businessName={state.business.name}
        email={recoveryEmail || state.business.email}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <h2 className="text-xl font-bold text-gray-800">Syncing your shop data...</h2>
        <p className="text-gray-500 text-sm mt-2">This may take a few seconds.</p>
      </div>
    );
  }

  if (pendingVerificationEmail) {
    return <VerifyEmailScreen
      email={pendingVerificationEmail}
      onContinue={() => {
         setPendingVerificationEmail(null);
         // Redirect to login by ensuring they are registered but not logged in (which is already set in handleRegister)
      }}
    />;
  }


  if (!state.isRegistered && showWelcome) {
    return (
      <WelcomeScreen
        onRegister={() => setShowWelcome(false)}
        onLogin={() => {
          setLoginMode(true);
          setShowWelcome(false);
        }}
      />
    );
  }

  if (!state.isRegistered) return <RegistrationScreen onRegister={handleRegister} onManualLogin={handleManualLogin} onForgotPassword={() => setView('forgot-password')} defaultMode={loginMode ? 'login' : 'register'} />;
  if (!state.isLoggedIn) return <AuthScreen onLogin={handleLogin} onForgotPassword={(email) => { setRecoveryEmail(email); setView('forgot-password'); }} onResetBusiness={() => setState(prev => ({...prev, isRegistered: false}))} business={state.business} email={state.business.email} />;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-primary text-white shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-3 truncate">
            {state.business.logo ? <img src={state.business.logo} alt="Logo" className="w-10 h-10 rounded-lg bg-white p-1" /> : <ShoppingBag size={32} />}
            <div className="min-w-0">
              <h1 className="text-2xl font-black truncate">{state.business.name}</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 truncate">{isAllShopsMode ? 'All Shops' : ((state.shops || []).find((s) => s.id === state.activeShopId)?.name || 'Main Shop')}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase opacity-60">
            {isOnline ? <Wifi size={12} className="text-emerald-400" /> : <WifiOff size={12} className="text-orange-400" />}
            {isOnline ? (isSyncing ? <RefreshCw size={12} className="animate-spin text-white" /> : 'Backup Active') : 'No Internet'}
          </div>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1">
          {allowedTabs.map(tab => (
            <SidebarLink key={tab} active={activeTab === tab} onClick={() => handleTabChange(tab)} icon={
              tab === 'sales' ? <ShoppingBag /> : tab === 'inventory' ? <Package /> : tab === 'history' ? <History /> : 
              tab === 'dashboard' ? <BarChart3 /> : tab === 'expenditure' ? <Wallet /> : <Settings />
            } label={TAB_LABELS[tab] || tab.charAt(0).toUpperCase() + tab.slice(1)} />
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 hover:bg-white/10 rounded-lg text-sm font-bold">
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="bg-white border-b p-4 flex justify-between items-center shrink-0">
          <div className="md:hidden flex items-center gap-2 overflow-hidden">
             {state.business.logo && <img src={state.business.logo} alt="Logo" className="w-8 h-8 rounded-lg bg-white p-0.5 border shrink-0" />}
             <div className="min-w-0">
               <h1 className="text-lg font-black text-primary truncate">{state.business.name}</h1>
               <p className="text-[10px] font-bold text-gray-400 truncate">{isAllShopsMode ? 'All Shops' : ((state.shops || []).find((s) => s.id === state.activeShopId)?.name || 'Main Shop')}</p>
             </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-gray-400 text-xs font-bold uppercase tracking-widest">
            <span>{state.role} Mode</span> <span className="opacity-30">/</span> <span>{activeTab}</span>
          </div>
          <div className="flex items-center gap-2">
            {state.role === 'owner' && (
              <>
                {(state.shops || []).length > 0 && (
                  <button
                    onClick={openShopSwitcherModal}
                    className="md:hidden text-[11px] font-black px-2 py-1.5 rounded-lg border bg-white hover:bg-gray-50"
                  >
                    {isAllShopsMode ? 'All Shops' : ((state.shops || []).find((s) => s.id === state.activeShopId)?.name || 'Shop')}
                  </button>
                )}
                {hasMultipleShops && (
                  <select
                    value={state.activeShopId || state.business.defaultShopId || ''}
                    onChange={(e) => handleShopSwitch(e.target.value)}
                    disabled={isSwitchingShop}
                    className="hidden md:block text-xs font-bold border rounded-lg px-2 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {(state.shops || []).map((shop) => (
                      <option key={shop.id} value={shop.id}>{shop.name}</option>
                    ))}
                    <option value={ALL_SHOPS_ID}>All Shops (read-only)</option>
                  </select>
                )}
              </>
            )}
            {isSwitchingShop && <span className="text-[10px] font-bold text-indigo-600">Switching…</span>}
            {isSyncing && <RefreshCw className="animate-spin text-gray-400 mr-2" size={20} />}
            <button onClick={handleLogout} className="md:hidden p-2 text-gray-400 hover:text-red-500">
              <LogOut size={24} />
            </button>
            <button
              onClick={() => setIsNotificationOpen(true)}
              className="relative p-2 rounded-xl text-primary bg-indigo-50 hover:bg-indigo-100 transition-all"
            >
               <Bell size={24} />
               {/* Show red dot if there are notifications */}
               {hasActiveAlerts(state.products, state.business, state.business.settings?.lowStockThreshold || 10) && (
                 <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>
               )}
            </button>
            <button onClick={() => setIsCartOpen(!isCartOpen)} className={`relative p-2 rounded-xl transition-all ${isCartOpen ? 'bg-primary text-white' : 'text-primary bg-indigo-50'}`}>
              <ShoppingCart size={24} />
              {cart.length > 0 && !isCartOpen && <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full animate-bounce">{cart.length}</span>}
            </button>
          </div>
        </header>
        
        {subscriptionLocked && activeTab !== 'settings' && (
          <div className="bg-red-50 border-b border-red-100 p-3 flex justify-between items-center text-sm shrink-0 animate-in slide-in-from-top-2">
              <span className="font-bold text-red-700 flex items-center gap-2">
                 <AlertCircle size={16} /> Subscription Expired. Read-Only Mode.
              </span>
              <button onClick={openPaymentLink} className="text-red-700 underline font-bold text-xs bg-white px-3 py-1.5 rounded-lg border border-red-100 hover:bg-red-50">
                 Renew Now
              </button>
          </div>
        )}

        {isAllShopsMode && (
          <div className="bg-blue-50 border-b border-blue-100 p-3 text-sm shrink-0 space-y-2">
            <span className="font-bold text-blue-700 block">All Shops mode is read-only for writes. Select a specific shop to sell or edit stock/expenses.</span>
            {hubOverview?.rows?.length ? (
              <div className="bg-white border border-blue-100 rounded-xl overflow-hidden">
                <div className="px-3 py-2 text-xs font-black text-blue-700 border-b bg-blue-50/60">Hub Overview</div>
                <div className="max-h-44 overflow-auto">
                  {hubOverview.rows.map((row: any) => (
                    <button key={row.shopId} onClick={() => handleShopSwitch(row.shopId)} className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-b-0">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-gray-800">{row.name}</span>
                        <span className="text-gray-500">Profit: {Number(row.profit || 0).toLocaleString()}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Content Area - Independent Scrolling for Performance */}
        <div className="flex-1 relative overflow-hidden">

          {visitedTabs.has('sales') && (
            <div
               className="absolute inset-0 overflow-y-auto p-4 md:p-8"
               style={{ display: activeTab === 'sales' ? 'block' : 'none' }}
            >
               <SalesScreen products={state.products} onAddToCart={addToCart} isReadOnly={subscriptionLocked || isAllShopsMode} />
            </div>
          )}

          {visitedTabs.has('inventory') && (
            <div
               className="absolute inset-0 overflow-y-auto p-4 md:p-8"
               style={{ display: activeTab === 'inventory' ? 'block' : 'none' }}
            >
               <InventoryScreen
                products={state.products}
                onUpdateProducts={handleUpdateProducts}
                isOwner={state.role === 'owner'}
                isReadOnly={!canManageStock || subscriptionLocked || isAllShopsMode}
                isOnline={isOnline}
                activeShopId={state.activeShopId}
                initialParams={deepLinkParams}
              />
            </div>
          )}

          {visitedTabs.has('history') && (
            <div
               className="absolute inset-0 overflow-y-auto p-4 md:p-8"
               style={{ display: activeTab === 'history' ? 'block' : 'none' }}
            >
               <HistoryScreen
                transactions={visibleTransactions}
                products={state.products}
                business={state.business}
                onDeleteTransaction={handleDeleteTransaction}
                onUpdateTransaction={(t, options) => {
                  const payload = { ...t, shopId: t.shopId || stateRef.current.activeShopId || stateRef.current.business.defaultShopId, updatedAt: new Date().toISOString() };
                  setState(prev => ({
                    ...prev,
                    transactions: prev.transactions.map(tx => tx.id === t.id ? payload : tx)
                  }));
                  if (navigator.onLine && !options?.skipSync) {
                    pushToBackend({ transactions: [payload], shopId: payload.shopId }).catch(err => console.error("Failed to sync edit", err));
                  }
                }}
                onCreatePreviousDebt={(t) => {
                  const created = { ...t, shopId: t.shopId || stateRef.current.activeShopId || stateRef.current.business.defaultShopId, updatedAt: new Date().toISOString(), isPreviousDebt: true };
                  setState(prev => ({
                    ...prev,
                    transactions: [created, ...prev.transactions]
                  }));
                  if (navigator.onLine) {
                    pushToBackend({ transactions: [created], shopId: created.shopId }).catch(err => console.error('Failed to sync opening debt', err));
                  }
                }}
                isSubscriptionExpired={subscriptionLocked}
                onRenewSubscription={openPaymentLink}
               isReadOnly={!canManageHistory || subscriptionLocked || isAllShopsMode}
               isOnline={isOnline}
               initialParams={deepLinkParams}
               onSelectedInvoiceChange={setHistorySelectedInvoice}
              />
            </div>
          )}

          {visitedTabs.has('dashboard') && (
             (state.role === 'owner' || (state.business.staffPermissions as any)?.canViewDashboard) ? (
                <div
                   className="absolute inset-0 overflow-y-auto p-4 md:p-8"
                   style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}
                >
                  <DashboardScreen
                    transactions={visibleTransactions}
                    products={state.products}
                    expenditures={visibleExpenditures}
                    business={state.business}
                    activeShopId={state.activeShopId}
                    allShopsMode={isAllShopsMode}
                    hubOverview={hubOverview}
                    onSelectShop={(shopId) => handleShopSwitch(shopId)}
                    onUpdateBusiness={b => setState(prev => ({ ...prev, business: { ...prev.business, ...b } }))}
                  />
                </div>
             ) : null
          )}

          {visitedTabs.has('expenditure') && (
             <div
               className="absolute inset-0 overflow-y-auto p-4 md:p-8"
               style={{ display: activeTab === 'expenditure' ? 'block' : 'none' }}
            >
               <ExpenditureScreen
                expenditures={visibleExpenditures}
                onAddExpenditure={handleAddExpenditure}
                onDeleteExpenditure={handleDeleteExpenditure}
                onEditExpenditure={handleEditExpenditure}
                isOnline={isOnline}
                isReadOnly={subscriptionLocked || isAllShopsMode}
              />
            </div>
          )}

          {visitedTabs.has('settings') && state.role === 'owner' && (
             <div
               className="absolute inset-0 overflow-y-auto p-4 md:p-8"
               style={{ display: activeTab === 'settings' ? 'block' : 'none' }}
            >
               <SettingsScreen
                business={state.business}
                onUpdateBusiness={b => setState(prev => ({ ...prev, business: b }))}
                shops={state.shops || []}
                activeShopId={state.activeShopId}
                isShopSwitching={isSwitchingShop}
                onOpenShopManager={openShopManagementMenu}
                onManualSync={() => safeSyncWithServer('manual')}
                lastSyncedAt={state.lastSyncedAt}
                onLogout={handleLogout}
                onDeleteAccount={handleDeleteAccount}
                isOnline={isOnline}
                onSubscribe={openPaymentLink}
              />
            </div>
          )}


        </div>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden bg-white border-t flex justify-around p-2 shrink-0 z-50">
          {allowedTabs.map(tab => (
            <MobileNavLink key={tab} active={activeTab === tab} onClick={() => handleTabChange(tab)} icon={
              tab === 'sales' ? <ShoppingBag /> : tab === 'inventory' ? <Package /> : tab === 'history' ? <History /> : 
              tab === 'dashboard' ? <BarChart3 /> : tab === 'expenditure' ? <Wallet /> : <Settings />
            } label={TAB_LABELS[tab] || tab.charAt(0).toUpperCase() + tab.slice(1)} />
          ))}
        </nav>
      </main>

      <NotificationCenter
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        transactions={visibleTransactions}
        activities={state.activities}
        notifications={visibleNotifications}
        activeShopId={state.activeShopId}
        allShopsMode={isAllShopsMode}
        products={state.products}
        business={state.business}
        lowStockThreshold={state.business.settings?.lowStockThreshold || 10}
        onStartVerification={startStockVerification}
        onSnoozeVerification={snoozeVerification}
        onDismissVerification={dismissVerification}
      />

      {shopModalMode && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeShopModal}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-black text-gray-900">{shopModalMode === 'menu' ? 'Manage Shops' : shopModalMode === 'create' ? 'Create Shop' : shopModalMode === 'rename' ? 'Rename Shop' : shopModalMode === 'delete' ? 'Delete Shop' : 'Switch Shop'}</h3>
              <button onClick={closeShopModal} disabled={isSavingShop} className="text-gray-400 hover:text-gray-600 disabled:opacity-50"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              {shopModalMode === 'menu' ? (
                <div className="space-y-2">
                  <button onClick={handleCreateShop} className="w-full px-3 py-2 rounded-xl border text-left hover:bg-gray-50 font-semibold">Create Shop</button>
                  <button onClick={handleRenameActiveShop} disabled={!state.activeShopId || state.activeShopId === ALL_SHOPS_ID} className="w-full px-3 py-2 rounded-xl border text-left hover:bg-gray-50 font-semibold disabled:opacity-50">Rename Active Shop</button>
                  <button onClick={handleDeleteActiveShop} disabled={!state.activeShopId || state.activeShopId === ALL_SHOPS_ID || !hasMultipleShops} className="w-full px-3 py-2 rounded-xl border text-left hover:bg-red-50 text-red-600 font-semibold disabled:opacity-50">Delete Active Shop</button>
                  <button onClick={openShopSwitcherModal} className="w-full px-3 py-2 rounded-xl border text-left hover:bg-gray-50 font-semibold">Switch Shop</button>
                </div>
              ) : shopModalMode === 'switch' ? (
                <div className="space-y-2 max-h-80 overflow-auto">
                  {(state.shops || []).map((shop) => (
                    <button key={shop.id} onClick={async () => { await handleShopSwitch(shop.id); closeShopModal(); }} className="w-full px-3 py-2 rounded-xl border text-left hover:bg-gray-50 font-semibold">
                      {shop.name}
                    </button>
                  ))}
                  {hasMultipleShops && (
                    <button onClick={async () => { await handleShopSwitch(ALL_SHOPS_ID); closeShopModal(); }} className="w-full px-3 py-2 rounded-xl border text-left hover:bg-gray-50 font-semibold">
                      All Shops (read-only)
                    </button>
                  )}
                </div>
              ) : shopModalMode === 'delete' ? (
                <>
                  <p className="text-sm text-gray-700">This removes the shop and archives its operational data. Other shops will remain unchanged.</p>
                  <label className="block text-sm font-bold text-gray-700">
                    Replacement default shop
                    <select value={deleteReplacementShopId} onChange={(e) => setDeleteReplacementShopId(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {(state.shops || []).filter((shop) => shop.id !== state.activeShopId).map((shop) => (
                        <option key={shop.id} value={shop.id}>{shop.name}</option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <label className="block text-sm font-bold text-gray-700">
                    Shop name
                    <input
                      type="text"
                      value={shopNameInput}
                      onChange={(e) => setShopNameInput(e.target.value)}
                      maxLength={60}
                      autoFocus
                      disabled={isSavingShop}
                      className="mt-2 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-gray-100"
                      placeholder="e.g. Island Branch"
                    />
                  </label>
                  {shopModalMode === 'create' && (
                    <>
                      <label className="block text-sm font-bold text-gray-700">
                        New shop setup
                        <select value={shopInitMode} onChange={(e) => setShopInitMode(e.target.value as any)} className="mt-2 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                          <option value="fresh">Start Fresh (clean stock/history)</option>
                          <option value="copy_inventory">Copy Inventory from Existing Shop</option>
                          <option value="share_catalog">Share Product Catalog Only (stock 0)</option>
                        </select>
                      </label>
                      {shopInitMode === 'copy_inventory' && (
                        <label className="block text-sm font-bold text-gray-700">
                          Copy from shop
                          <select value={shopSourceId} onChange={(e) => setShopSourceId(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                            {(state.shops || []).map((shop) => (
                              <option key={shop.id} value={shop.id}>{shop.name}</option>
                            ))}
                          </select>
                        </label>
                      )}
                    </>
                  )}
                </>
              )}
              {!isOnline && <p className="text-xs font-semibold text-orange-600">You need internet connection to manage shops.</p>}
            </div>
            <div className="px-6 pb-6 flex items-center justify-end gap-2">
              <button onClick={closeShopModal} disabled={isSavingShop} className="px-4 py-2 text-sm font-bold rounded-xl border text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
              {(shopModalMode !== 'switch' && shopModalMode !== 'menu') && (
                <button
                  onClick={handleSubmitShopModal}
                  disabled={isSavingShop || !isOnline || ((shopModalMode === 'create' || shopModalMode === 'rename') && !shopNameInput.trim()) || (shopModalMode === 'create' && shopInitMode === 'copy_inventory' && !shopSourceId) || (shopModalMode === 'delete' && !deleteReplacementShopId)}
                  className="px-4 py-2 text-sm font-bold rounded-xl bg-primary text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSavingShop && <Loader2 size={14} className="animate-spin" />}
                  {shopModalMode === 'create' ? 'Create Shop' : shopModalMode === 'rename' ? 'Save Name' : 'Delete Shop'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cart Sidebar */}
      <div className={`fixed inset-y-0 right-0 z-[60] transition-all duration-300 ease-in-out md:relative md:inset-auto md:z-auto ${isCartOpen ? 'translate-x-0 w-full max-w-sm md:w-80 lg:w-96 border-l shadow-2xl md:shadow-none' : 'translate-x-full w-0 overflow-hidden'}`}>
        {isCartOpen && window.innerWidth < 768 && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm -z-10" onClick={() => setIsCartOpen(false)} />}
        <div className="h-full bg-white flex flex-col">
          <CurrentOrderSidebar cart={cart} setCart={setCart} customerName={customerName} setCustomerName={setCustomerName} customerPhone={customerPhone} setCustomerPhone={setCustomerPhone} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} amountPaid={amountPaid} setAmountPaid={setAmountPaid} globalDiscount={globalDiscount} setGlobalDiscount={setGlobalDiscount} isGlobalDiscountPercent={isGlobalDiscountPercent} setIsGlobalDiscountPercent={setIsGlobalDiscountPercent} signature={signature} setSignature={setSignature} isLocked={isLocked} setIsLocked={setIsLocked} onCompleteSale={handleCompleteSale} onClose={() => setIsCartOpen(false)} products={state.products} permissions={state.business.staffPermissions} isOwner={state.role === 'owner'} pastCustomers={pastCustomers} />
        </div>
      </div>

      {/* Hide gBot on Inventory and Expenditure screens in mobile view so it doesn't block the Plus button */}
      {!(['expenditure', 'inventory'].includes(activeTab) && isMobileView) && (
        <SupportBot onNavigate={handleBotNavigate} uiContext={botUiContext} />
      )}

      {isSwitchingShop && (
        <div className="fixed inset-0 z-[90] bg-white/50 backdrop-blur-[1px] flex items-center justify-center">
          <div className="bg-white border rounded-xl px-4 py-3 shadow-lg flex items-center gap-2 text-sm font-bold text-gray-700">
            <Loader2 size={16} className="animate-spin text-primary" /> Switching shop...
          </div>
        </div>
      )}
    </div>
  );
};

const SidebarLink: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${active ? 'bg-white text-primary shadow-lg' : 'text-white/70 hover:bg-white/10'}`}>
    <div className="flex items-center gap-3">
      {React.cloneElement(icon as React.ReactElement<any>, { size: 18 })}
      <span className="font-bold text-sm">{label}</span>
    </div>
    {active && <ChevronRight size={14} />}
  </button>
);

const MobileNavLink: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 flex-1 py-1 ${active ? 'text-primary' : 'text-gray-400'}`}>
    {React.cloneElement(icon as React.ReactElement<any>, { size: 20 })}
    <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
  </button>
);

export default App;
