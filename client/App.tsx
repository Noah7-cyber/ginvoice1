
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
  ShoppingCart
} from 'lucide-react';
import { InventoryState, UserRole, Product, Transaction, BusinessProfile, TabId, SaleItem, PaymentMethod } from './types';
import { INITIAL_PRODUCTS } from './constants';
import { saveState, loadState, syncWithBackend } from './services/storage';
import SalesScreen from './components/SalesScreen';
import InventoryScreen from './components/InventoryScreen';
import DashboardScreen from './components/DashboardScreen';
import AuthScreen from './components/AuthScreen';
import SettingsScreen from './components/SettingsScreen';
import HistoryScreen from './components/HistoryScreen';
import RegistrationScreen from './components/RegistrationScreen';
import CurrentOrderSidebar from './components/CurrentOrderSidebar';

const App: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('sales');
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

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

  // Cart State (Lifted)
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
    const hO = () => { setIsOnline(true); triggerSync(); };
    const hF = () => setIsOnline(false);
    window.addEventListener('online', hO);
    window.addEventListener('offline', hF);
    return () => { window.removeEventListener('online', hO); window.removeEventListener('offline', hF); };
  }, [triggerSync]);

  useEffect(() => { saveState(state); }, [state]);

  const handleRegister = (details: any) => setState(prev => ({ ...prev, isRegistered: true, business: { ...prev.business, ...details } }));
  const handleLogin = (role: UserRole) => { setState(prev => ({ ...prev, role, isLoggedIn: true })); setActiveTab('sales'); };
  const handleLogout = () => setState(prev => ({ ...prev, isLoggedIn: false }));

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
  };

  const handleCompleteSale = (transaction: Transaction) => {
    setState(prev => {
      const updatedProducts = prev.products.map(p => {
        const itemInSale = transaction.items.find(i => i.productId === p.id);
        return itemInSale ? { ...p, currentStock: Math.max(0, p.currentStock - itemInSale.quantity) } : p;
      });
      return { ...prev, products: updatedProducts, transactions: [transaction, ...prev.transactions] };
    });
    // Reset Cart
    setCart([]); setCustomerName(''); setAmountPaid(0); setGlobalDiscount(0); setSignature(''); setIsLocked(false);
    setIsMobileCartOpen(false);
  };

  const allowedTabs = useMemo(() => {
    if (state.role === 'owner') return ['sales', 'inventory', 'history', 'dashboard', 'settings'] as TabId[];
    return Array.from(new Set(['sales', ...state.business.staffPermissions])) as TabId[];
  }, [state.role, state.business.staffPermissions]);

  if (!state.isRegistered) return <RegistrationScreen onRegister={handleRegister} />;
  if (!state.isLoggedIn) return <AuthScreen onLogin={handleLogin} mode="standard" />;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row h-screen overflow-hidden">
      {/* Sidebar - Desktop Nav */}
      <aside className="hidden md:flex flex-col w-64 bg-primary text-white shrink-0">
        <div className="p-6">
          <h1 className="text-2xl font-black truncate">{state.business.name}</h1>
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
        <div className="p-4 border-t border-white/10">
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 hover:bg-white/10 rounded-lg transition-colors text-sm font-bold">
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="bg-white border-b p-4 flex justify-between items-center shrink-0 md:hidden">
          <h1 className="text-lg font-black text-primary truncate">{state.business.name}</h1>
          <button onClick={() => setIsMobileCartOpen(true)} className="relative p-2 text-primary">
            <ShoppingCart size={24} />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full animate-bounce">
                {cart.length}
              </span>
            )}
          </button>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {activeTab === 'sales' && <SalesScreen products={state.products} onAddToCart={addToCart} />}
          {activeTab === 'inventory' && <InventoryScreen products={state.products} onUpdateProducts={p => setState({...state, products: p})} isOwner={state.role === 'owner'} />}
          {activeTab === 'history' && <HistoryScreen transactions={state.transactions} business={state.business} onDeleteTransaction={id => setState({...state, transactions: state.transactions.filter(t => t.id !== id)})} onUpdateTransaction={t => setState({...state, transactions: state.transactions.map(prev => prev.id === t.id ? t : prev)})} />}
          {activeTab === 'dashboard' && state.role === 'owner' && <DashboardScreen transactions={state.transactions} products={state.products} />}
          {activeTab === 'settings' && state.role === 'owner' && <SettingsScreen business={state.business} onUpdateBusiness={b => setState({...state, business: b})} onManualSync={triggerSync} lastSynced={state.lastSyncedAt} isSyncing={isSyncing} />}
        </div>

        {/* Floating Mobile Cart Button */}
        {cart.length > 0 && !isMobileCartOpen && (
          <button 
            onClick={() => setIsMobileCartOpen(true)}
            className="md:hidden fixed bottom-24 right-6 w-16 h-16 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center z-40 animate-in zoom-in-50"
          >
            <ShoppingCart size={28} />
            <span className="absolute -top-1 -right-1 bg-red-600 text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-white">
              {cart.length}
            </span>
          </button>
        )}

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden bg-white border-t flex justify-around p-2 shrink-0 z-50">
          <MobileNavLink active={activeTab === 'sales'} onClick={() => setActiveTab('sales')} icon={<ShoppingBag />} label="Sell" />
          <MobileNavLink active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package />} label="Stock" />
          <MobileNavLink active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History />} label="Bills" />
          <MobileNavLink active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings />} label="Store" />
        </nav>
      </main>

      {/* Global Current Order Sidebar (Desktop Always, Mobile Toggle) */}
      <div className={`
        fixed inset-0 z-[60] transition-transform md:relative md:inset-auto md:translate-x-0 md:z-auto
        ${isMobileCartOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
      `}>
        {/* Mobile Backdrop */}
        {isMobileCartOpen && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm md:hidden" onClick={() => setIsMobileCartOpen(false)} />
        )}
        
        <div className="absolute right-0 top-0 h-full w-[90%] max-w-sm md:w-80 lg:w-96 bg-white border-l shadow-2xl md:shadow-none flex flex-col">
          <CurrentOrderSidebar 
            cart={cart}
            setCart={setCart}
            customerName={customerName}
            setCustomerName={setCustomerName}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            amountPaid={amountPaid}
            setAmountPaid={setAmountPaid}
            globalDiscount={globalDiscount}
            setGlobalDiscount={setGlobalDiscount}
            isGlobalDiscountPercent={isGlobalDiscountPercent}
            setIsGlobalDiscountPercent={setIsGlobalDiscountPercent}
            signature={signature}
            setSignature={setSignature}
            isLocked={isLocked}
            setIsLocked={setIsLocked}
            onCompleteSale={handleCompleteSale}
            onClose={() => setIsMobileCartOpen(false)}
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
