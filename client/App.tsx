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
  Loader2
} from 'lucide-react';
import { InventoryState, UserRole, Product, ProductUnit, Transaction, BusinessProfile, TabId, SaleItem, PaymentMethod, Expenditure } from './types';
import { INITIAL_PRODUCTS } from './constants';
import { saveState, loadState, pushToBackend, getDataVersion, saveDataVersion, getLastSync, saveLastSync } from './services/storage';
import { login, registerBusiness, saveAuthToken, clearAuthToken, deleteTransaction, getEntitlements, initializePayment, fetchRemoteState, deleteExpenditure } from './services/api';
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
  const [isLoading, setIsLoading] = useState(false);
  const wasOnlineRef = useRef(navigator.onLine);
  
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
  const [isCartOpen, setIsCartOpen] = useState(window.innerWidth > 1024);
  const [view, setView] = useState<'main' | 'forgot-password'>('main');
  const [recoveryEmail, setRecoveryEmail] = useState<string | undefined>(undefined);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);

  const { status: wakeStatus } = useServerWakeup();
  const wakeToastShownRef = useRef(false);

  useEffect(() => {
    if (wakeStatus === 'waking' && !wakeToastShownRef.current) {
      addToast('Waking up cloud sync server...', 'info');
      wakeToastShownRef.current = true;
    } else if (wakeStatus !== 'waking') {
      wakeToastShownRef.current = false;
    }
  }, [wakeStatus, addToast]);

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
      expenditures: []
    };
    if (!base.expenditures) base.expenditures = [];
    return base as InventoryState;
  });

  const [cart, setCart] = useState<SaleItem[]>([]);
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

  const refreshData = useCallback(async (overrideState?: InventoryState) => {
    if (!navigator.onLine) return;

    // Check login status from override or current state
    const currentState = overrideState || stateRef.current;
    if (!currentState.isLoggedIn) return;

    setIsSyncing(true);
    try {
      // TRUE = Force Full Fetch (Ignore versions)
      const response = await fetchRemoteState(true);

      if (response.status === 200 && response.data) {
         const { products, transactions, categories, expenditures, business } = response.data;

         const nextState: InventoryState = {
           ...currentState,
           // DIRECT STATE REPLACEMENT (No merging)
           products: products || [],
           transactions: transactions || [],
           categories: categories || [],
           expenditures: expenditures || [],
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

  const handleLogout = useCallback(() => {
    clearAuthToken();
    setState(prev => ({ ...prev, isLoggedIn: false }));
  }, []);

  const handleDeleteAccount = useCallback(() => {
    localStorage.clear(); // Wipe all data
    setState(prev => ({
      ...prev,
      isLoggedIn: false,
      isRegistered: false,
      business: { ...prev.business, name: '', email: '' }
    }));
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
      const trialExpired = data.trialEndsAt ? new Date(data.trialEndsAt) < new Date() : false;
      if (data.plan === 'FREE' && trialExpired) {
        if (!subscriptionLocked) {
          setSubscriptionLocked(true);
          addToast('Your subscription has expired. Session ended for security.', 'error');
          handleLogout();
        }
      } else if (subscriptionLocked) {
        setSubscriptionLocked(false);
      }
    } catch (err) {
      console.error('Entitlements fetch failed', err);
    }
  }, [subscriptionLocked, addToast, handleLogout]);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      if (!wasOnlineRef.current && state.isLoggedIn) {
        await refreshData();
      }
      await fetchEntitlements();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [state.isLoggedIn, fetchEntitlements, refreshData]);

  useEffect(() => {
    wasOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    if (state.isLoggedIn && navigator.onLine) {
       // Initial load data refresh
       refreshData();
       fetchEntitlements();
    }
  }, [state.isLoggedIn, refreshData, fetchEntitlements]);

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
  }, [state.business.theme]);

  useEffect(() => { saveState(state); }, [state]);

  const handleAddExpenditure = (newExpenditure: Expenditure) => {
    setState(prev => {
      const updated = [newExpenditure, ...prev.expenditures];
      if (navigator.onLine) pushToBackend({ expenditures: [newExpenditure] });
      return { ...prev, expenditures: updated };
    });
  };

  const handleDeleteExpenditure = async (id: string) => {
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
      setState(prev => {
          const newExp = prev.expenditures.map(e => e.id === updated.id ? updated : e);
          if (navigator.onLine) pushToBackend({ expenditures: [updated] });
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
        expenditures: []
      };

      setState(newState);

      // Pass the new state directly to refreshData
      await refreshData(newState);

      setIsLoading(false);

    } catch (err: any) {
      console.error('Manual login failed', err);
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
          business: { ...state.business, ...response.business }
        };

        setState(newState);
        setActiveTab('history');

        // Pass the new state directly to refreshData
        refreshData(newState);

        return true;
      }
    } catch (err) {
      console.error('Login failed', err);
    }
    return false;
  };

  const handleDeleteTransaction = async (id: string, restockItems: boolean) => {
    if (!navigator.onLine) {
      addToast('Delete requires internet.', 'error');
      return;
    }
    try {
      // If restockItems is true, we assume the backend (new API) handled it OR the old API handled it.
      // However, with the new flow in HistoryScreen, this function is called with restockItems=false
      // primarily to update the local state after the API call succeeds there.
      // If this function is called from elsewhere (legacy), we might still want the old behavior.
      // For now, we'll keep the optimistic local update for stock if requested,
      // but if the caller already handled the API (like HistoryScreen), we skip the API call here.

      // NOTE: HistoryScreen now calls api.delete directly.
      // To prevent double API calls, we rely on the caller to manage the API interaction
      // OR we check if the caller intends for us to do it.
      // Given the refactor, we will assume this function is now primarily for State Update.
      // But to be safe for other callers, we only skip API if we detect it's already done? No easy way.
      // Let's rely on the fact that HistoryScreen passes restockItems=false,
      // and we will REMOVE the deleteTransaction() call to avoid double deletes.

      // Wait, if we remove deleteTransaction(), other callers might break.
      // But currently HistoryScreen is the main caller.
      // We will perform the local state update. The API call responsibility is shifting to the caller (HistoryScreen).
      // If there are other callers, they need to be updated. (Searching codebase... only HistoryScreen calls this usually).

      setState(prev => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== id) }));

      // We also verify if we need to locally restore stock (Optimistic UI)
      if (restockItems) {
         // This block handles local stock restoration if the caller indicates it wasn't done yet?
         // Actually, since HistoryScreen calls the API which does the work, we should probably fetch fresh data
         // OR optimistically update.
         // Let's keep optimistic update for responsiveness.
         setState(prev => {
          const tx = prev.transactions.find(t => t.id === id);
          if (!tx) return prev;
          const updatedProducts = prev.products.map(p => {
            const item = tx.items.find(i => i.productId === p.id);
            // Re-calculate with multiplier
            const mult = item?.multiplier || (item?.selectedUnit ? item.selectedUnit.multiplier : 1);
            return item ? { ...p, currentStock: p.currentStock + (item.quantity * mult) } : p;
          });
          return { ...prev, products: updatedProducts };
        });
      }

    } catch (err) { addToast('Delete failed.', 'error'); }
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
    // 1. Calculate new state first
    const updatedProducts = state.products.map(p => {
      const itemsInSale = transaction.items.filter(i => i.productId === p.id);
      if (itemsInSale.length === 0) return p;

      const totalDeduction = itemsInSale.reduce((sum, item) => {
          const multiplier = item.selectedUnit ? item.selectedUnit.multiplier : 1;
          return sum + (item.quantity * multiplier);
      }, 0);

      return { ...p, currentStock: Math.max(0, p.currentStock - totalDeduction) };
    });

    const nextState = {
      ...state,
      products: updatedProducts,
      transactions: [transaction, ...state.transactions]
    };

    // 2. Update UI
    setState(nextState);
    setCart([]); setCustomerName(''); setCustomerPhone(''); setAmountPaid(0); setGlobalDiscount(0); setSignature(''); setIsLocked(false);
    if (window.innerWidth < 768) setIsCartOpen(false);

    // 3. PUSH to Server immediately
    if (navigator.onLine) {
      pushToBackend({ transactions: [transaction], products: updatedProducts })
        .catch(err => {
            console.error("Instant sync failed:", err);
            addToast("Sale saved locally. Connect to internet to back up.", "warning");
        });
    }
  };

  const handleUpdateProducts = (products: Product[]) => {
    const nextState = { ...state, products };
    setState(nextState);
    if (navigator.onLine) {
      pushToBackend({ products }).catch(err => console.error("Instant sync failed:", err));
    }
  };

  const perms = (state.business.staffPermissions as any) || {};
  const canManageStock = state.role === 'owner' || perms.canEditInventory;
  const canManageHistory = state.role === 'owner' || perms.canEditHistory;

  const allowedTabs = useMemo(() => {
    const hasPro = entitlements?.plan === 'PRO' || state.business.isSubscribed;
    const entitlementTrial = entitlements?.trialEndsAt ? new Date(entitlements.trialEndsAt) : null;
    const businessTrial = state.business.trialEndsAt ? new Date(state.business.trialEndsAt) : null;
    const trialEndDate = entitlementTrial || businessTrial;
    const trialActive = trialEndDate ? trialEndDate >= new Date() : false;

    if (!hasPro && !trialActive) return ['history'] as TabId[];
    
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
    if (allowedTabs.length > 0 && !allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0]);
    }
  }, [allowedTabs, activeTab]);

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

  if (!state.isRegistered) return <RegistrationScreen onRegister={handleRegister} onManualLogin={handleManualLogin} onForgotPassword={() => setView('forgot-password')} />;
  if (!state.isLoggedIn) return <AuthScreen onLogin={handleLogin} onForgotPassword={(email) => { setRecoveryEmail(email); setView('forgot-password'); }} onResetBusiness={() => setState(prev => ({...prev, isRegistered: false}))} business={state.business} email={state.business.email} />;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-primary text-white shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-3 truncate">
            {state.business.logo ? <img src={state.business.logo} alt="Logo" className="w-10 h-10 rounded-lg bg-white p-1" /> : <ShoppingBag size={32} />}
            <h1 className="text-2xl font-black truncate">{state.business.name}</h1>
          </div>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase opacity-60">
            {isOnline ? <Wifi size={12} className="text-emerald-400" /> : <WifiOff size={12} className="text-orange-400" />}
            {isOnline ? (isSyncing ? <RefreshCw size={12} className="animate-spin text-white" /> : 'Backup Active') : 'No Internet'}
          </div>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1">
          {allowedTabs.map(tab => (
            <SidebarLink key={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)} icon={
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
             <h1 className="text-lg font-black text-primary truncate">{state.business.name}</h1>
          </div>
          <div className="hidden md:flex items-center gap-2 text-gray-400 text-xs font-bold uppercase tracking-widest">
            <span>{state.role} Mode</span> <span className="opacity-30">/</span> <span>{activeTab}</span>
          </div>
          <div className="flex items-center gap-2">
            {isSyncing && <RefreshCw className="animate-spin text-gray-400 mr-2" size={20} />}
            <button onClick={handleLogout} className="md:hidden p-2 text-gray-400 hover:text-red-500">
              <LogOut size={24} />
            </button>
            <button onClick={() => setIsCartOpen(!isCartOpen)} className={`relative p-2 rounded-xl transition-all ${isCartOpen ? 'bg-primary text-white' : 'text-primary bg-indigo-50'}`}>
              <ShoppingCart size={24} />
              {cart.length > 0 && !isCartOpen && <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full animate-bounce">{cart.length}</span>}
            </button>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {activeTab === 'sales' && <SalesScreen products={state.products} onAddToCart={addToCart} />}
          {activeTab === 'inventory' && (
            <InventoryScreen
              products={state.products}
              onUpdateProducts={handleUpdateProducts}
              isOwner={state.role === 'owner'}
              isReadOnly={!canManageStock}
            />
          )}
          {activeTab === 'history' && (
            <HistoryScreen
              transactions={state.transactions}
              business={state.business}
              onDeleteTransaction={handleDeleteTransaction}
              onUpdateTransaction={t => {
                setState(prev => ({
                  ...prev,
                  transactions: prev.transactions.map(tx => tx.id === t.id ? { ...t, updatedAt: new Date().toISOString() } : tx)
                }));
                if (navigator.onLine) {
                  pushToBackend({ transactions: [t] }).catch(err => console.error("Failed to sync edit", err));
                }
              }}
              isSubscriptionExpired={subscriptionLocked}
              onRenewSubscription={openPaymentLink}
              isReadOnly={!canManageHistory}
            />
          )}
          {activeTab === 'dashboard' && (state.role === 'owner' || state.business.staffPermissions.includes('dashboard')) && <DashboardScreen transactions={state.transactions} products={state.products} />}
          {activeTab === 'expenditure' && (
            <ExpenditureScreen
              expenditures={state.expenditures}
              onAddExpenditure={handleAddExpenditure}
              onDeleteExpenditure={handleDeleteExpenditure}
              onEditExpenditure={handleEditExpenditure}
            />
          )}
          {activeTab === 'settings' && state.role === 'owner' && <SettingsScreen business={state.business} onUpdateBusiness={b => setState(prev => ({ ...prev, business: b }))} onManualSync={() => refreshData()} lastSyncedAt={state.lastSyncedAt} onLogout={handleLogout} onDeleteAccount={handleDeleteAccount} />}
        </div>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden bg-white border-t flex justify-around p-2 shrink-0 z-50">
          {allowedTabs.map(tab => (
            <MobileNavLink key={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)} icon={
              tab === 'sales' ? <ShoppingBag /> : tab === 'inventory' ? <Package /> : tab === 'history' ? <History /> : 
              tab === 'dashboard' ? <BarChart3 /> : tab === 'expenditure' ? <Wallet /> : <Settings />
            } label={TAB_LABELS[tab] || tab.charAt(0).toUpperCase() + tab.slice(1)} />
          ))}
        </nav>
      </main>

      {/* Cart Sidebar */}
      <div className={`fixed inset-y-0 right-0 z-[60] transition-all duration-300 ease-in-out md:relative md:inset-auto md:z-auto ${isCartOpen ? 'translate-x-0 w-full max-w-sm md:w-80 lg:w-96 border-l shadow-2xl md:shadow-none' : 'translate-x-full w-0 overflow-hidden'}`}>
        {isCartOpen && window.innerWidth < 768 && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm -z-10" onClick={() => setIsCartOpen(false)} />}
        <div className="h-full bg-white flex flex-col">
          <CurrentOrderSidebar cart={cart} setCart={setCart} customerName={customerName} setCustomerName={setCustomerName} customerPhone={customerPhone} setCustomerPhone={setCustomerPhone} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} amountPaid={amountPaid} setAmountPaid={setAmountPaid} globalDiscount={globalDiscount} setGlobalDiscount={setGlobalDiscount} isGlobalDiscountPercent={isGlobalDiscountPercent} setIsGlobalDiscountPercent={setIsGlobalDiscountPercent} signature={signature} setSignature={setSignature} isLocked={isLocked} setIsLocked={setIsLocked} onCompleteSale={handleCompleteSale} onClose={() => setIsCartOpen(false)} products={state.products} permissions={state.business.staffPermissions} isOwner={state.role === 'owner'} pastCustomers={pastCustomers} />
        </div>
      </div>

      {/* SupportBot only visible in Settings tab */}
      {activeTab === 'settings' && <SupportBot />}
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