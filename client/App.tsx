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
  Wallet
} from 'lucide-react';
import { InventoryState, UserRole, Product, Transaction, BusinessProfile, TabId, SaleItem, PaymentMethod, Expenditure } from './types';
import { INITIAL_PRODUCTS } from './constants';
import { saveState, loadState, syncWithBackend } from './services/storage';
import { login, registerBusiness, saveAuthToken, clearAuthToken, deleteTransaction, getEntitlements, initializePayment, fetchRemoteState } from './services/api';
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
import SupportBot from './components/SupportBot';
import useServerWakeup from './services/useServerWakeup';

const App: React.FC = () => {
  const { addToast } = useToast();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const wasOnlineRef = useRef(navigator.onLine);
  
  const [subscriptionLocked, setSubscriptionLocked] = useState(() => {
    try {
      const cached = localStorage.getItem('ginvoice_entitlements_v1');
      if (!cached) return false;
      const parsed = JSON.parse(cached);
      const trialExpired = parsed?.trialEndsAt ? new Date(parsed.trialEndsAt) < new Date() : false;
      const isFree = parsed?.plan === 'FREE';
      return Boolean(isFree && trialExpired);
    } catch {
      return false;
    }
  });

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
        staffPermissions: ['sales']
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

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine) return;
    setIsSyncing(true);
    const result = await syncWithBackend(state);
    if (result) {
      if (typeof result === 'string') {
        // Legacy handling if backend only returned string (timestamp)
        setState(prev => ({ ...prev, lastSyncedAt: result }));
      } else {
        // New full sync response
        setState(prev => ({
          ...prev,
          lastSyncedAt: result.lastSyncedAt,
          products: result.products || prev.products,
          transactions: result.transactions || prev.transactions,
          expenditures: result.expenditures || prev.expenditures
        }));
      }
    }
    setIsSyncing(false);
  }, [state]);

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
          setActiveTab('history');
          addToast('Your subscription has expired. Please complete payment to continue.', 'error');
          openPaymentLink();
        }
      } else if (subscriptionLocked) {
        setSubscriptionLocked(false);
      }
    } catch (err) {
      console.error('Entitlements fetch failed', err);
    }
  }, [subscriptionLocked, addToast]);

  // Sync optimization: Only sync when transitioning from offline to online
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      if (!wasOnlineRef.current && state.isLoggedIn) {
        setIsSyncing(true);
        const result = await syncWithBackend(state);
        if (result) {
          if (typeof result === 'string') {
            setState(prev => ({ ...prev, lastSyncedAt: result }));
          } else {
             setState(prev => ({
              ...prev,
              lastSyncedAt: result.lastSyncedAt,
              products: result.products || prev.products,
              transactions: result.transactions || prev.transactions,
              expenditures: result.expenditures || prev.expenditures
            }));
          }
        }
        setIsSyncing(false);
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
  }, [state, fetchEntitlements]);

  useEffect(() => {
    wasOnlineRef.current = isOnline;
  }, [isOnline]);

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

  // Auto-sync every 10 minutes
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (state.isLoggedIn) {
        triggerSync();
      }
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(intervalId);
  }, [state.isLoggedIn, triggerSync]);

  const updateExpenditures = (items: Expenditure[]) => {
    setState(prev => ({ ...prev, expenditures: items }));
  };

  const handleRegister = async (details: any) => {
    try {
      if (navigator.onLine) {
        const response = await registerBusiness({ ...details, theme: state.business.theme });
        saveAuthToken(response.token);
        if (response?.business?.trialEndsAt) details.trialEndsAt = response.business.trialEndsAt;
      }
    } catch (err) { console.error('Registration error', err); }

    setState(prev => ({
      ...prev,
      isRegistered: true, isLoggedIn: true, role: 'owner',
      business: { ...prev.business, ...details, trialEndsAt: details.trialEndsAt || new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString() }
    }));
  };

  const handleManualLogin = async (credentials: { email: string, pin: string }) => {
    if (!navigator.onLine) {
      addToast('Login requires internet connection.', 'error');
      return;
    }

    try {
      const response = await login(credentials.email, credentials.pin);
      saveAuthToken(response.token);

      // Attempt to restore data from server
      let restoredData: Partial<InventoryState> = {};
      try {
        const remoteData = await fetchRemoteState();
        if (remoteData) {
          restoredData = {
            products: remoteData.products || [],
            transactions: remoteData.transactions || [],
            expenditures: remoteData.expenditures || []
          };
        }
      } catch (syncErr) {
        console.warn('Failed to restore data during login', syncErr);
        addToast('Logged in, but failed to load data. Please sync manually.', 'info');
      }

      setState(prev => ({
        ...prev,
        isRegistered: true,
        isLoggedIn: true,
        role: response.role,
        business: { ...prev.business, ...response.business },
        ...restoredData
      }));

    } catch (err: any) {
      console.error('Manual login failed', err);
      addToast(err.message || 'Login failed. Check your credentials.', 'error');
    }
  };

  const handleLogin = async (pin: string, selectedRole: UserRole) => {
    // Strictly enforce online login as requested
    if (!navigator.onLine) {
      addToast('Login requires internet connection.', 'error');
      return false;
    }

    try {
      if (state.business.email) {
        // Pass selectedRole to login to prevent privilege escalation
        const response = await login(state.business.email, pin, selectedRole);
        saveAuthToken(response.token);
        setState(prev => ({ ...prev, role: response.role, isLoggedIn: true, business: { ...prev.business, ...response.business } }));
        setActiveTab('sales');
        return true;
      }
    } catch (err) {
      console.error('Login failed', err);
    }
    return false;
  };

  const handleLogout = () => {
    clearAuthToken();
    setState(prev => ({ ...prev, isLoggedIn: false }));
  };

  const handleDeleteTransaction = async (id: string, restockItems: boolean) => {
    if (!navigator.onLine) {
      addToast('Delete requires internet.', 'error');
      return;
    }
    try {
      if (restockItems) {
        setState(prev => {
          const tx = prev.transactions.find(t => t.id === id);
          if (!tx) return prev;
          const updatedProducts = prev.products.map(p => {
            const item = tx.items.find(i => i.productId === p.id);
            return item ? { ...p, currentStock: p.currentStock + item.quantity } : p;
          });
          return { ...prev, products: updatedProducts };
        });
      }
      await deleteTransaction(id);
      setState(prev => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== id) }));
    } catch (err) { addToast('Delete failed.', 'error'); }
  };

  // POS UX fix: No auto-open on mobile
  const addToCart = (product: Product) => {
    if (product.currentStock <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.currentStock) return prev;
        return prev.map(item => item.productId === product.id 
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unitPrice - item.discount }
          : item
        );
      }
      return [...prev, {
        productId: product.id, productName: product.name, quantity: 1,
        unitPrice: product.sellingPrice, discount: 0, total: product.sellingPrice
      }];
    });
    // Explicit manual toggle only on mobile now
  };

  const handleCompleteSale = (transaction: Transaction) => {
    setState(prev => {
      const updatedProducts = prev.products.map(p => {
        const itemInSale = transaction.items.find(i => i.productId === p.id);
        return itemInSale ? { ...p, currentStock: Math.max(0, p.currentStock - itemInSale.quantity) } : p;
      });
      return { ...prev, products: updatedProducts, transactions: [transaction, ...prev.transactions] };
    });
    setCart([]); setCustomerName(''); setCustomerPhone(''); setAmountPaid(0); setGlobalDiscount(0); setSignature(''); setIsLocked(false);
    if (window.innerWidth < 768) setIsCartOpen(false);
  };

  const allowedTabs = useMemo(() => {
    // Robust check for subscription status using both entitlements and persisted state
    const hasPro = entitlements?.plan === 'PRO' || state.business.isSubscribed;

    // Check trial status from multiple sources, defaulting to strict check if offline
    const entitlementTrial = entitlements?.trialEndsAt ? new Date(entitlements.trialEndsAt) : null;
    const businessTrial = state.business.trialEndsAt ? new Date(state.business.trialEndsAt) : null;

    // Use the latest valid date we have
    const trialEndDate = entitlementTrial || businessTrial;
    const trialActive = trialEndDate ? trialEndDate >= new Date() : false;

    if (!hasPro && !trialActive) return ['history'] as TabId[];
    
    const ownerTabs: TabId[] = ['sales', 'inventory', 'history', 'dashboard', 'expenditure', 'settings'];
    return state.role === 'owner' ? ownerTabs : Array.from(new Set(['sales', 'history', ...state.business.staffPermissions])) as TabId[];
  }, [state.role, state.business.staffPermissions, entitlements, state.business.trialEndsAt, state.business.isSubscribed]);

  if (!state.isRegistered) return <RegistrationScreen onRegister={handleRegister} onManualLogin={handleManualLogin} onForgotPassword={() => setView('forgot-password')} />;
  if (!state.isLoggedIn) return <AuthScreen onLogin={handleLogin} onForgotPassword={() => setView('forgot-password')} onResetBusiness={() => setState(prev => ({...prev, isRegistered: false}))} business={state.business} />;

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
            {isOnline ? 'Cloud Sync Active' : 'Offline Mode'}
          </div>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1">
          {allowedTabs.map(tab => (
            <SidebarLink key={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)} icon={
              tab === 'sales' ? <ShoppingBag /> : tab === 'inventory' ? <Package /> : tab === 'history' ? <History /> : 
              tab === 'dashboard' ? <BarChart3 /> : tab === 'expenditure' ? <Wallet /> : <Settings />
            } label={tab.charAt(0).toUpperCase() + tab.slice(1)} />
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
          <h1 className="text-lg font-black text-primary md:hidden">{state.business.name}</h1>
          <div className="hidden md:flex items-center gap-2 text-gray-400 text-xs font-bold uppercase tracking-widest">
            <span>{state.role} Mode</span> <span className="opacity-30">/</span> <span>{activeTab}</span>
          </div>
          <button onClick={() => setIsCartOpen(!isCartOpen)} className={`relative p-2 rounded-xl transition-all ${isCartOpen ? 'bg-primary text-white' : 'text-primary bg-indigo-50'}`}>
            <ShoppingCart size={24} />
            {cart.length > 0 && !isCartOpen && <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full animate-bounce">{cart.length}</span>}
          </button>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {activeTab === 'sales' && <SalesScreen products={state.products} onAddToCart={addToCart} />}
          {activeTab === 'inventory' && <InventoryScreen products={state.products} onUpdateProducts={p => setState(prev => ({ ...prev, products: p }))} isOwner={state.role === 'owner'} />}
          {activeTab === 'history' && <HistoryScreen transactions={state.transactions} business={state.business} onDeleteTransaction={handleDeleteTransaction} onUpdateTransaction={t => setState(prev => ({ ...prev, transactions: prev.transactions.map(tx => tx.id === t.id ? t : tx) }))} />}
          {activeTab === 'dashboard' && state.role === 'owner' && <DashboardScreen transactions={state.transactions} products={state.products} />}
          {activeTab === 'expenditure' && <ExpenditureScreen expenditures={state.expenditures} onUpdateExpenditures={updateExpenditures} isOwner={state.role === 'owner'} />}
          {activeTab === 'settings' && state.role === 'owner' && <SettingsScreen business={state.business} onUpdateBusiness={b => setState(prev => ({ ...prev, business: b }))} onManualSync={triggerSync} lastSyncedAt={state.lastSyncedAt} onLogout={handleLogout} />}
        </div>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden bg-white border-t flex justify-around p-2 shrink-0 z-50">
          {allowedTabs.map(tab => (
            <MobileNavLink key={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)} icon={
              tab === 'sales' ? <ShoppingBag /> : tab === 'inventory' ? <Package /> : tab === 'history' ? <History /> : 
              tab === 'dashboard' ? <BarChart3 /> : tab === 'expenditure' ? <Wallet /> : <Settings />
            } label={tab === 'expenditure' ? 'Expend' : tab.charAt(0).toUpperCase() + tab.slice(1, 4)} />
          ))}
        </nav>
      </main>

      {/* Cart Sidebar */}
      <div className={`fixed inset-y-0 right-0 z-[60] transition-all duration-300 ease-in-out md:relative md:inset-auto md:z-auto ${isCartOpen ? 'translate-x-0 w-full max-w-sm md:w-80 lg:w-96 border-l shadow-2xl md:shadow-none' : 'translate-x-full w-0 overflow-hidden'}`}>
        {isCartOpen && window.innerWidth < 768 && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm -z-10" onClick={() => setIsCartOpen(false)} />}
        <div className="h-full bg-white flex flex-col">
          <CurrentOrderSidebar cart={cart} setCart={setCart} customerName={customerName} setCustomerName={setCustomerName} customerPhone={customerPhone} setCustomerPhone={setCustomerPhone} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} amountPaid={amountPaid} setAmountPaid={setAmountPaid} globalDiscount={globalDiscount} setGlobalDiscount={setGlobalDiscount} isGlobalDiscountPercent={isGlobalDiscountPercent} setIsGlobalDiscountPercent={setIsGlobalDiscountPercent} signature={signature} setSignature={setSignature} isLocked={isLocked} setIsLocked={setIsLocked} onCompleteSale={handleCompleteSale} onClose={() => setIsCartOpen(false)} products={state.products} />
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