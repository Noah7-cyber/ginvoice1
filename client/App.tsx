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
import { login, registerBusiness, saveAuthToken, clearAuthToken, deleteTransaction, getEntitlements, initializePayment } from './services/api';
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
      products: INITIAL_PRODUCTS,
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
    if (!base.expenditures) (base as InventoryState).expenditures = [];
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
    const syncTime = await syncWithBackend(state);
    if (syncTime) setState(prev => ({ ...prev, lastSyncedAt: syncTime }));
    setIsSyncing(false);
  }, [state]);

  useEffect(() => {
    if (!navigator.onLine || !state.isLoggedIn) return;
    const timer = setTimeout(() => {
      triggerSync();
    }, 1500);
    return () => clearTimeout(timer);
  }, [state.products, state.transactions, state.business, state.expenditures, state.isLoggedIn, triggerSync]);

  const openPaymentLink = useCallback(async () => {
    if (!navigator.onLine) {
      addToast('Please connect to the internet to subscribe.', 'error');
      return;
    }
    if (!state.business.email) {
      addToast('Please add a business email in Settings before subscribing.', 'error');
      return;
    }
    try {
      const response = await initializePayment(2000, state.business.email);
      const url = response?.data?.authorization_url;
      if (url) {
        window.open(url, '_blank');
      } else {
        addToast('Payment initialization failed. Please try again.', 'error');
      }
    } catch (err) {
      addToast('Payment initialization failed. Please try again.', 'error');
    }
  }, [state.business.email, addToast]);

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
          addToast('Your subscription has expired. Please complete payment to continue using premium features.', 'error');
          openPaymentLink();
        }
      } else if (subscriptionLocked) {
        setSubscriptionLocked(false);
      }
    } catch (err) {
      console.error('Entitlements fetch failed', err);
    }
  }, [subscriptionLocked, openPaymentLink, addToast]);

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
      .bg-primary { background-color: var(--primary); }
      .text-primary { color: var(--primary); }
      .border-primary { border-color: var(--primary); }
    `;
  }, [state.business.theme]);

  useEffect(() => {
    const hO = () => { setIsOnline(true); fetchEntitlements(); triggerSync(); };
    const hF = () => setIsOnline(false);
    window.addEventListener('online', hO);
    window.addEventListener('offline', hF);
    return () => { window.removeEventListener('online', hO); window.removeEventListener('offline', hF); };
  }, [triggerSync, fetchEntitlements]);

  useEffect(() => {
    if (state.isLoggedIn) {
      fetchEntitlements();
    }
  }, [state.isLoggedIn, fetchEntitlements]);

  useEffect(() => { saveState(state); }, [state]);

  const updateExpenditures = (items: Expenditure[]) => {
    setState(prev => ({ ...prev, expenditures: items }));
  };

  const handleRegister = async (details: any) => {
    try {
      if (navigator.onLine) {
        const response = await registerBusiness({
          ...details,
          theme: state.business.theme
        });
        saveAuthToken(response.token);
        if (response?.business?.trialEndsAt) {
          details.trialEndsAt = response.business.trialEndsAt;
        }
      }
    } catch (err) {
      console.error('Registration failed, continuing offline', err);
    }

    setState(prev => ({
      ...prev,
      isRegistered: true,
      isLoggedIn: true,
      role: 'owner',
      business: { ...prev.business, ...details, trialEndsAt: details.trialEndsAt || new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString() }
    }));
  };

  const handleManualLogin = async (details: { email: string, pin: string }) => {
    try {
      if (navigator.onLine) {
        const response = await login(details.email, details.pin);
        saveAuthToken(response.token);
        setState(prev => ({
          ...prev,
          isLoggedIn: true,
          role: response.role,
          isRegistered: true,
          business: { ...prev.business, ...response.business }
        }));
        return;
      }
    } catch (err) {
      console.error('Remote login failed, falling back to local', err);
    }

    if (state.business.email === details.email && state.business.ownerPassword === details.pin) {
      setState(prev => ({ ...prev, isLoggedIn: true, role: 'owner', isRegistered: true }));
    } else {
      addToast('No matching store found for this email/PIN on this device.', 'error');
    }
  };

  const handleLogin = async (pin: string, selectedRole: UserRole) => {
    try {
      if (navigator.onLine && state.business.email) {
        const response = await login(state.business.email, pin);
        saveAuthToken(response.token);
        setState(prev => ({
          ...prev,
          role: response.role,
          isLoggedIn: true,
          business: { ...prev.business, ...response.business }
        }));
        setActiveTab('sales');
        return true;
      }
    } catch (err) {
      console.error('Remote login failed, using local pin', err);
    }

    const correctPassword = selectedRole === 'owner' ? state.business.ownerPassword : state.business.staffPassword;
    if (pin === correctPassword) {
      setState(prev => ({ ...prev, role: selectedRole, isLoggedIn: true }));
      setActiveTab('sales');
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    clearAuthToken();
    setState(prev => ({ ...prev, isLoggedIn: false }));
  };

  const handleDeleteTransaction = async (id: string, restockItems: boolean) => {
    if (!navigator.onLine) {
      addToast('Delete requires an internet connection.', 'error');
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
    } catch (err) {
      addToast('Delete failed. Please try again.', 'error');
    }
  };
  
  const handleResetBusiness = () => {
    setState(prev => ({ ...prev, isRegistered: false, isLoggedIn: false }));
  };

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
    if (window.innerWidth < 768) setIsCartOpen(true);
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
    const hasPro = entitlements?.plan === 'PRO';
    const trialActive = entitlements?.trialEndsAt ? new Date(entitlements.trialEndsAt) >= new Date() : state.business.trialEndsAt ? new Date(state.business.trialEndsAt) >= new Date() : true;
    
    if (entitlements && !hasPro && !trialActive) return ['history'] as TabId[];
    
    const ownerTabs: TabId[] = ['sales', 'inventory', 'history', 'dashboard', 'expenditure', 'settings'];
    if (state.role === 'owner') return ownerTabs;
    
    return Array.from(new Set(['sales', 'history', ...state.business.staffPermissions])) as TabId[];
  }, [state.role, state.business.staffPermissions, entitlements, state.business.trialEndsAt]);

  useEffect(() => {
    if (!allowedTabs.includes(activeTab)) {
      setActiveTab('history');
    }
  }, [allowedTabs, activeTab]);

  if (!state.isRegistered) return <RegistrationScreen onRegister={handleRegister} onManualLogin={handleManualLogin} onForgotPassword={() => setView('forgot-password')} />;
  
  if (!state.isLoggedIn) {
    if (view === 'forgot-password') {
      return <ForgotPasswordScreen onBack={() => setView('main')} businessName={state.business.name} />;
    }
    return <AuthScreen onLogin={handleLogin} onForgotPassword={() => setView('forgot-password')} onResetBusiness={handleResetBusiness} business={state.business} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row h-screen overflow-hidden">
      {/* Sidebar - Desktop Nav */}
      <aside className="hidden md:flex flex-col w-64 bg-primary text-white shrink-0">
        <div className="p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3 truncate">
              {state.business.logo ? (
                <img src={state.business.logo} alt="Logo" className="w-10 h-10 rounded-lg object-cover bg-white p-1" />
              ) : (
                <ShoppingBag size={32} className="text-white shrink-0" />
              )}
              <h1 className="text-2xl font-black truncate">{state.business.name}</h1>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase opacity-60">
              {isOnline ? <Wifi size={12} className="text-emerald-400" /> : <WifiOff size={12} className="text-orange-400" />}
              {isOnline ? 'Cloud Sync Active' : 'Offline Mode'}
            </div>
          </div>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1">
          {allowedTabs.includes('sales') && <SidebarLink active={activeTab === 'sales'} onClick={() => setActiveTab('sales')} icon={<ShoppingBag />} label="POS Sales" />}
          {allowedTabs.includes('inventory') && <SidebarLink active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package />} label="Inventory" />}
          {allowedTabs.includes('history') && <SidebarLink active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History />} label="Billing" />}
          {allowedTabs.includes('dashboard') && <SidebarLink active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<BarChart3 />} label="Analytics" />}
          {allowedTabs.includes('expenditure') && <SidebarLink active={activeTab === 'expenditure'} onClick={() => setActiveTab('expenditure')} icon={<Wallet />} label="Expenditure" />}
          {allowedTabs.includes('settings') && <SidebarLink active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings />} label="Store Settings" />}
        </nav>
        <div className="p-4 border-t border-white/10 space-y-2">
          <button 
            onClick={() => setIsCartOpen(!isCartOpen)} 
            className="w-full hidden lg:flex items-center gap-2 px-4 py-2 hover:bg-white/10 rounded-lg transition-colors text-xs font-bold"
          >
            {isCartOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            {isCartOpen ? 'Collapse Bill' : 'Expand Bill'}
          </button>
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 hover:bg-white/10 rounded-lg transition-colors text-sm font-bold">
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="bg-white border-b p-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 truncate">
            {state.business.logo && <img src={state.business.logo} alt="Logo" className="md:hidden w-8 h-8 rounded object-cover" />}
            <h1 className="text-lg font-black text-primary truncate md:hidden">{state.business.name}</h1>
            <div className="hidden md:flex items-center gap-2 text-gray-400 text-xs font-bold uppercase tracking-widest">
              <span className="capitalize">{state.role} Mode</span>
              <span className="opacity-30">/</span>
              <span>{activeTab}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleLogout} className="md:hidden flex flex-col items-center gap-0.5 text-gray-500 hover:text-red-600 transition-colors">
              <LogOut size={22} />
              <span className="text-[9px] font-black uppercase leading-none">Log Out</span>
            </button>
            <button 
              onClick={() => setIsCartOpen(!isCartOpen)} 
              className={`relative p-2 rounded-xl transition-all ${isCartOpen ? 'bg-primary text-white' : 'text-primary bg-indigo-50'}`}
            >
              <ShoppingCart size={24} />
              {cart.length > 0 && !isCartOpen && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full animate-bounce">
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {activeTab === 'sales' && <SalesScreen products={state.products} onAddToCart={addToCart} />}
          {activeTab === 'inventory' && <InventoryScreen products={state.products} onUpdateProducts={p => setState({...state, products: p})} isOwner={state.role === 'owner'} />}
          {activeTab === 'history' && <HistoryScreen transactions={state.transactions} business={state.business} onDeleteTransaction={handleDeleteTransaction} onUpdateTransaction={t => setState({...state, transactions: state.transactions.map(tx => tx.id === t.id ? t : tx)})} />}
          {activeTab === 'dashboard' && state.role === 'owner' && <DashboardScreen transactions={state.transactions} products={state.products} />}
          {activeTab === 'expenditure' && <ExpenditureScreen expenditures={state.expenditures} onUpdateExpenditures={updateExpenditures} />}
          {activeTab === 'settings' && state.role === 'owner' && <SettingsScreen business={state.business} onUpdateBusiness={b => setState({...state, business: b})} onManualSync={triggerSync} lastSyncedAt={state.lastSyncedAt} />}
        </div>

        {/* Mobile Bottom Nav - Dynamic */}
        <nav className="md:hidden bg-white border-t flex justify-around p-2 shrink-0 z-50">
          {allowedTabs.map(tab => {
            const mapIconLabel: Record<string, { icon: React.ReactNode; label: string }> = {
              sales: { icon: <ShoppingBag />, label: 'Sell' },
              inventory: { icon: <Package />, label: 'Stock' },
              history: { icon: <History />, label: 'Bills' },
              dashboard: { icon: <BarChart3 />, label: 'Analytics' },
              settings: { icon: <Settings />, label: 'Store' },
              expenditure: { icon: <Wallet />, label: 'Expend' }
            };
            const item = mapIconLabel[tab];
            if (!item) return null;
            return <MobileNavLink key={tab} active={activeTab === tab} onClick={() => setActiveTab(tab as TabId)} icon={item.icon} label={item.label} />;
          })}
        </nav>
      </main>

      {/* Cart Sidebar */}
      <div className={`
        fixed inset-y-0 right-0 z-[60] transition-all duration-300 ease-in-out md:relative md:inset-auto md:z-auto
        ${isCartOpen ? 'translate-x-0 w-full max-w-sm md:w-80 lg:w-96 border-l shadow-2xl md:shadow-none' : 'translate-x-full w-0 overflow-hidden border-none'}
      `}>
        {isCartOpen && window.innerWidth < 768 && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm -z-10" onClick={() => setIsCartOpen(false)} />
        )}
        <div className="h-full bg-white flex flex-col">
          <CurrentOrderSidebar 
            cart={cart} setCart={setCart}
            customerName={customerName} setCustomerName={setCustomerName}
            customerPhone={customerPhone} setCustomerPhone={setCustomerPhone}
            paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
            amountPaid={amountPaid} setAmountPaid={setAmountPaid}
            globalDiscount={globalDiscount} setGlobalDiscount={setGlobalDiscount}
            isGlobalDiscountPercent={isGlobalDiscountPercent} setIsGlobalDiscountPercent={setIsGlobalDiscountPercent}
            signature={signature} setSignature={setSignature}
            isLocked={isLocked} setIsLocked={setIsLocked}
            onCompleteSale={handleCompleteSale}
            onClose={() => setIsCartOpen(false)}
            products={state.products}
          />
        </div>
      </div>
      <SupportBot />
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