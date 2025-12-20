
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  PanelRightOpen
} from 'lucide-react';
import { InventoryState, UserRole, Product, Transaction, BusinessProfile, TabId, SaleItem, PaymentMethod } from './types';
import { INITIAL_PRODUCTS } from './constants';
import { saveState, loadState, syncWithBackend } from './services/storage';
import { login, registerBusiness, saveAuthToken, clearAuthToken, checkSyncAccess } from './services/api';
import SalesScreen from './components/SalesScreen';
import InventoryScreen from './components/InventoryScreen';
import DashboardScreen from './components/DashboardScreen';
import AuthScreen from './components/AuthScreen';
import SettingsScreen from './components/SettingsScreen';
import HistoryScreen from './components/HistoryScreen';
import RegistrationScreen from './components/RegistrationScreen';
import CurrentOrderSidebar from './components/CurrentOrderSidebar';
import ForgotPasswordScreen from './components/ForgotPasswordScreen';

const App: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [trialLocked, setTrialLocked] = useState(false);
  const [trialStatus, setTrialStatus] = useState<{ accessActive: boolean; isSubscribed: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('sales');
  const [isCartOpen, setIsCartOpen] = useState(window.innerWidth > 1024);
  const [view, setView] = useState<'main' | 'forgot-password'>('main');

  const [state, setState] = useState<InventoryState>(() => {
    const persisted = loadState();
    return persisted || {
      products: INITIAL_PRODUCTS,
      transactions: [],
      role: 'staff',
      isLoggedIn: false,
      isRegistered: false,
      business: {
        name: '', address: '', phone: '', email: '',
        theme: { primaryColor: '#4f46e5', fontFamily: "'Inter', sans-serif" },
        staffPermissions: ['sales']
      }
    };
  });

  // Cart State
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [customerName, setCustomerName] = useState('');
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

  const checkTrialStatus = useCallback(async () => {
    if (!navigator.onLine || trialLocked) return;
    try {
      const status = await checkSyncAccess();
      setTrialStatus({ accessActive: !!status.accessActive, isSubscribed: !!status.isSubscribed });
      if (!status.accessActive && !status.isSubscribed) {
        // Trial expired; allow billing only and prompt payment
        setTrialLocked(true);
        setActiveTab('history');
        alert('Your free trial is over. Please complete payment to continue using Ginvoice.');
        window.open('https://paystack.shop/pay/gti5s0lqks', '_blank');
      }
    } catch (err) {
      const status = (err as any)?.status;
      if (status === 402 && !trialLocked) {
        setTrialStatus({ accessActive: false, isSubscribed: false });
        setTrialLocked(true);
        setActiveTab('history');
        alert('Your free trial is over. Please complete payment to continue using Ginvoice.');
        window.open('https://paystack.shop/pay/gti5s0lqks', '_blank');
      }
    }
  }, [trialLocked]);

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
    const hO = () => { setIsOnline(true); checkTrialStatus(); triggerSync(); };
    const hF = () => setIsOnline(false);
    window.addEventListener('online', hO);
    window.addEventListener('offline', hF);
    return () => { window.removeEventListener('online', hO); window.removeEventListener('offline', hF); };
  }, [triggerSync, checkTrialStatus]);

  useEffect(() => {
    if (state.isLoggedIn) {
      checkTrialStatus();
    }
  }, [state.isLoggedIn, checkTrialStatus]);

  useEffect(() => { saveState(state); }, [state]);

  const handleRegister = async (details: any) => {
    try {
      if (navigator.onLine) {
        // Backend registration + token bootstrap for cross-device sync
        const response = await registerBusiness({
          name: details.name,
          email: details.email,
          phone: details.phone,
          address: details.address,
          ownerPassword: details.ownerPassword,
          staffPassword: details.staffPassword,
          logo: details.logo,
          theme: state.business.theme
        });
        saveAuthToken(response.token);
      }
    } catch (err) {
      console.error('Registration failed, continuing offline', err);
    }

    setState(prev => ({
      ...prev,
      isRegistered: true,
      isLoggedIn: true,
      role: 'owner',
      business: { ...prev.business, ...details }
    }));
  };

  const handleManualLogin = async (details: { email: string, pin: string }) => {
    try {
      if (navigator.onLine) {
        // Backend login for cloud-backed stores
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
      alert("No matching store found for this email/PIN on this device.");
    }
  };

  const handleLogin = async (pin: string, selectedRole: UserRole) => {
    try {
      if (navigator.onLine && state.business.email) {
        // Backend login to unlock cloud sync token
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
  
  const handleResetBusiness = () => {
    // Navigate back to setup/registration screen
    setState(prev => ({
      ...prev,
      isRegistered: false,
      isLoggedIn: false
    }));
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
    setCart([]); setCustomerName(''); setAmountPaid(0); setGlobalDiscount(0); setSignature(''); setIsLocked(false);
    if (window.innerWidth < 768) setIsCartOpen(false);
  };

  const allowedTabs = useMemo(() => {
    if (trialLocked) return ['history'] as TabId[];
    if (state.role === 'owner') return ['sales', 'inventory', 'history', 'dashboard', 'settings'] as TabId[];
    return Array.from(new Set(['sales', ...state.business.staffPermissions])) as TabId[];
  }, [state.role, state.business.staffPermissions, trialLocked]);

  useEffect(() => {
    if (trialLocked && activeTab !== 'history') {
      setActiveTab('history');
    }
  }, [trialLocked, activeTab]);

  if (!state.isRegistered) return <RegistrationScreen onRegister={handleRegister} onManualLogin={handleManualLogin} />;
  
  if (!state.isLoggedIn) {
    if (view === 'forgot-password') {
      return <ForgotPasswordScreen onBack={() => setView('main')} businessName={state.business.name} />;
    }
    return (
      <AuthScreen 
        onLogin={handleLogin} 
        onForgotPassword={() => setView('forgot-password')} 
        onResetBusiness={handleResetBusiness}
        business={state.business} 
      />
    );
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
          {activeTab === 'history' && <HistoryScreen transactions={state.transactions} business={state.business} onDeleteTransaction={id => setState({...state, transactions: state.transactions.filter(t => t.id !== id)})} onUpdateTransaction={t => setState({...state, transactions: state.transactions.map(prev => prev.id === t.id ? t : prev)})} />}
          {activeTab === 'dashboard' && state.role === 'owner' && <DashboardScreen transactions={state.transactions} products={state.products} />}
          {activeTab === 'settings' && state.role === 'owner' && <SettingsScreen business={state.business} onUpdateBusiness={b => setState({...state, business: b})} onManualSync={triggerSync} lastSynced={state.lastSyncedAt} isSyncing={isSyncing} />}
        </div>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden bg-white border-t flex justify-around p-2 shrink-0 z-50">
          <MobileNavLink active={activeTab === 'sales'} onClick={() => setActiveTab('sales')} icon={<ShoppingBag />} label="Sell" />
          <MobileNavLink active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package />} label="Stock" />
          <MobileNavLink active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History />} label="Bills" />
          <MobileNavLink active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings />} label="Store" />
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
