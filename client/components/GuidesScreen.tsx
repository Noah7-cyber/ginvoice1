import React, { useState } from 'react';
import { BookOpen, ArrowLeft, Info, X, Clock, Settings as SettingsIcon, Wallet, ShoppingBag, Package } from 'lucide-react';
import InventoryScreen from './InventoryScreen';
import SalesScreen from './SalesScreen';
import CurrentOrderSidebar from './CurrentOrderSidebar';
import HistoryScreen from './HistoryScreen';
import ExpenditureScreen from './ExpenditureScreen';
import SettingsScreen from './SettingsScreen';
import { SaleItem, Product, Transaction, Expenditure, BusinessProfile } from '../types';

// Dummy data for the guides
const DUMMY_PRODUCTS: Product[] = [
  { id: 'DUMMY-1', name: 'Premium Coffee Beans', sku: 'CF-100', category: 'Beverages', costPrice: 15, sellingPrice: 25, currentStock: 120, baseUnit: 'Bag', units: [] },
  { id: 'DUMMY-2', name: 'Espresso Machine', sku: 'EM-200', category: 'Equipment', costPrice: 400, sellingPrice: 599, currentStock: 3, baseUnit: 'Unit', units: [] },
  { id: 'DUMMY-3', name: 'Ceramic Mugs (Set of 4)', sku: 'MG-300', category: 'Accessories', costPrice: 10, sellingPrice: 20, currentStock: 45, baseUnit: 'Set', units: [] }
];

const DUMMY_CART_ITEMS: SaleItem[] = [
  { cartId: 'c1', productId: 'DUMMY-1', productName: 'Premium Coffee Beans', quantity: 2, unitPrice: 25, total: 50, discount: 0 },
  { cartId: 'c2', productId: 'DUMMY-2', productName: 'Espresso Machine', quantity: 1, unitPrice: 599, total: 599, discount: 50 },
  { cartId: 'c3', productId: 'DUMMY-3', productName: 'Ceramic Mugs', quantity: 4, unitPrice: 20, total: 80, discount: 0 }
];

const DUMMY_TRANSACTIONS: Transaction[] = [
  { id: 't1', transactionDate: new Date().toISOString(), customerName: 'John Doe', items: DUMMY_CART_ITEMS, subtotal: 729, globalDiscount: 0, totalAmount: 729, paymentMethod: 'cash', amountPaid: 729, balance: 0, staffId: 'owner' }
];

const DUMMY_EXPENSES: Expenditure[] = [
  { id: 'e1', date: new Date().toISOString(), amount: 50, category: 'Supplies', title: 'Napkins and cups', flowType: 'out', createdBy: 'owner' }
];

const DUMMY_BUSINESS: BusinessProfile = {
  name: 'Ginvoice Demo Shop', address: '123 Market St', phone: '08012345678', staffPermissions: { canGiveDiscount: true, canViewInventory: true, canEditInventory: true, canViewHistory: true, canEditHistory: true, canViewExpenditure: true, canViewDashboard: true }, settings: { currency: '$', taxRate: 0, lowStockThreshold: 10, enableSound: true, printReceipts: true, footerText: 'Thanks' }, theme: { primaryColor: '#4f46e5', fontFamily: 'Inter' }
};

export interface Hotspot { id: string; title: string; description: string; }

export const INVENTORY_HOTSPOTS: Hotspot[] = [
  { id: 'search', title: 'Search & Filters', description: 'Quickly find products by name or SKU.' },
  { id: 'add-product', title: 'Add New Products', description: 'Register new items, set prices and stock levels.' },
  { id: 'stock-status', title: 'Stock Indicators', description: 'A red dot indicates the item needs restocking.' }
];

export const SALES_HOTSPOTS: Hotspot[] = [
  { id: 'search', title: 'Find Products', description: 'Search items to add to the bill.' },
  { id: 'product-click', title: 'Add to Cart', description: 'Tap a product to instantly add it.' }
];

export const CART_HOTSPOTS: Hotspot[] = [
  { id: 'cart-item', title: 'Adjust Quantities', description: 'Increase or decrease item quantities directly.' },
  { id: 'checkout', title: 'Confirm & Pay', description: 'Complete the sale to process payment.' }
];

export const HISTORY_HOTSPOTS: Hotspot[] = [
  { id: 'search', title: 'Search Sales', description: 'Find past sales by receipt number or customer.' },
  { id: 'transaction-card', title: 'View Details', description: 'Click any receipt to reprint or refund.' }
];

export const EXPENDITURE_HOTSPOTS: Hotspot[] = [
  { id: 'add-expense', title: 'Record Expense', description: 'Log money leaving your business.' }
];

export const SETTINGS_HOTSPOTS: Hotspot[] = [
  { id: 'receipt-settings', title: 'Receipt Customization', description: 'Add your logo and custom footer text.' },
  { id: 'staff-management', title: 'Staff Roles', description: 'Control what your cashiers can see and do.' }
];

const GuidesScreen: React.FC = () => {
  const [activeGuide, setActiveGuide] = useState<'inventory' | 'sales' | 'history' | 'expenditure' | 'settings' | null>(null);
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const guideStyles = (
    <style>{`
      .guide-protected { pointer-events: auto; }
      .guide-protected button:not(.guide-hotspot),
      .guide-protected input,
      .guide-protected select,
      .guide-protected textarea { pointer-events: none !important; }
      .guide-protected .guide-hotspot { pointer-events: auto !important; }
    `}</style>
  );

  const renderTooltip = () => {
    if (!activeHotspot) return null;
    return (
      <div className="absolute inset-0 z-[100] flex items-center justify-center p-4 pointer-events-auto bg-black/20 backdrop-blur-[1px]" onClick={() => setActiveHotspot(null)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
          <div className="bg-primary p-4 flex justify-between items-center text-white">
            <h3 className="font-bold flex items-center gap-2"><Info size={18} /> {activeHotspot.title}</h3>
            <button onClick={() => setActiveHotspot(null)} className="text-white/70 hover:text-white transition-colors"><X size={20} /></button>
          </div>
          <div className="p-5">
            <p className="text-gray-600 leading-relaxed text-sm">{activeHotspot.description}</p>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setActiveHotspot(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold transition-colors">Got it</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderHeader = (title: string) => (
    <div className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0 z-30 shadow-sm relative">
      <div className="flex items-center gap-3">
        <button onClick={() => { setActiveGuide(null); setActiveHotspot(null); }} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="font-bold text-gray-900 flex items-center gap-2"><BookOpen size={18} className="text-primary" /> {title}</h2>
          <p className="text-xs text-gray-500">Interactive Walkthrough</p>
        </div>
      </div>
      <div className="hidden md:flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg font-medium">
        <Info size={16} /> Click pulsing dots to learn
      </div>
    </div>
  );

  if (activeGuide === 'inventory') {
    return (
      <div className="relative h-full flex flex-col bg-gray-50 overflow-hidden">
        {guideStyles}
        {renderHeader('Inventory Guide')}
        <div className="flex-1 relative overflow-hidden select-none bg-gray-50/50">
          <div className="guide-protected absolute inset-0 p-4 md:p-8 opacity-90 overflow-auto">
            <InventoryScreen products={DUMMY_PRODUCTS} onUpdateProducts={() => {}} isOwner={true} isReadOnly={true} isOnline={false} refreshData={async () => {}} isGuideMode={true} activeHotspotId={activeHotspot?.id} onHotspotClick={(id) => setActiveHotspot(INVENTORY_HOTSPOTS.find(h => h.id === id) || null)} />
          </div>
          {renderTooltip()}
        </div>
      </div>
    );
  }

  if (activeGuide === 'sales') {
    return (
      <div className="relative h-full flex flex-col bg-gray-50 overflow-hidden">
        {guideStyles}
        {renderHeader('Sales & Cart Guide')}
        <div className="flex-1 relative overflow-hidden select-none bg-gray-50/50 flex">
          <div className="guide-protected flex-1 overflow-auto p-4 md:p-8 opacity-90 relative pb-32">
            <SalesScreen products={DUMMY_PRODUCTS} onAddToCart={() => {}} isReadOnly={true} isGuideMode={true} activeHotspotId={activeHotspot?.id} onHotspotClick={(id) => setActiveHotspot(SALES_HOTSPOTS.find(h => h.id === id) || null)} />
          </div>
          <div className={`fixed inset-y-0 right-0 z-[60] transition-all duration-300 ease-in-out md:relative md:inset-auto md:z-auto ${isCartOpen ? 'translate-x-0 w-full max-w-sm md:w-80 lg:w-96 border-l shadow-2xl md:shadow-none' : 'translate-x-full w-0 overflow-hidden'}`}>
             {isCartOpen && window.innerWidth < 768 && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm -z-10" onClick={() => setIsCartOpen(false)} />}
             <div className="guide-protected h-full bg-white flex flex-col relative pointer-events-auto">
               <CurrentOrderSidebar cart={DUMMY_CART_ITEMS} setCart={() => {}} customerName="" setCustomerName={() => {}} customerPhone="" setCustomerPhone={() => {}} paymentMethod="cash" setPaymentMethod={() => {}} amountPaid={0} setAmountPaid={() => {}} globalDiscount={0} setGlobalDiscount={() => {}} isGlobalDiscountPercent={false} setIsGlobalDiscountPercent={() => {}} signature="" setSignature={() => {}} isLocked={true} setIsLocked={() => {}} onCompleteSale={() => {}} onClose={() => setIsCartOpen(false)} products={DUMMY_PRODUCTS} permissions={{canGiveDiscount:true, canViewInventory: true, canEditInventory: true, canViewHistory: true, canEditHistory: true, canViewExpenditure: true, canViewDashboard: true}} isOwner={true} activeShopName="Shop" business={DUMMY_BUSINESS} isGuideMode={true} activeHotspotId={activeHotspot?.id} onHotspotClick={(id) => setActiveHotspot(CART_HOTSPOTS.find(h => h.id === id) || null)} />
             </div>
          </div>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
            <button onClick={() => { setIsCartOpen(!isCartOpen); setActiveHotspot(null); }} className="bg-gray-900 text-white px-8 py-4 rounded-full font-black shadow-2xl flex items-center gap-2 hover:bg-black hover:scale-105 transition-all">
              {isCartOpen ? <><ArrowLeft size={20} /> Back to Sales</> : <>View Cart <ArrowLeft size={20} className="rotate-180" /></>}
            </button>
          </div>
          {renderTooltip()}
        </div>
      </div>
    );
  }

  if (activeGuide === 'history') {
    return (
      <div className="relative h-full flex flex-col bg-gray-50 overflow-hidden">
        {guideStyles}
        {renderHeader('Past Sales Guide')}
        <div className="flex-1 relative overflow-hidden select-none bg-gray-50/50">
          <div className="guide-protected absolute inset-0 p-4 md:p-8 opacity-90 overflow-auto">
            <HistoryScreen transactions={DUMMY_TRANSACTIONS} products={DUMMY_PRODUCTS} business={DUMMY_BUSINESS} onDeleteTransaction={async () => {}} onUpdateTransaction={async () => {}} onCreatePreviousDebt={async () => {}} isOwner={true} isOnline={false} isGuideMode={true} activeHotspotId={activeHotspot?.id} onHotspotClick={(id) => setActiveHotspot(HISTORY_HOTSPOTS.find(h => h.id === id) || null)} />
          </div>
          {renderTooltip()}
        </div>
      </div>
    );
  }

  if (activeGuide === 'expenditure') {
    return (
      <div className="relative h-full flex flex-col bg-gray-50 overflow-hidden">
        {guideStyles}
        {renderHeader('Expenses Guide')}
        <div className="flex-1 relative overflow-hidden select-none bg-gray-50/50">
          <div className="guide-protected absolute inset-0 p-4 md:p-8 opacity-90 overflow-auto">
            <ExpenditureScreen expenditures={DUMMY_EXPENSES} products={DUMMY_PRODUCTS} business={DUMMY_BUSINESS} onAddExpenditure={async () => {}} onDeleteExpenditure={async () => {}} isOwner={true} isOnline={false} isGuideMode={true} activeHotspotId={activeHotspot?.id} onHotspotClick={(id) => setActiveHotspot(EXPENDITURE_HOTSPOTS.find(h => h.id === id) || null)} />
          </div>
          {renderTooltip()}
        </div>
      </div>
    );
  }

  if (activeGuide === 'settings') {
    return (
      <div className="relative h-full flex flex-col bg-gray-50 overflow-hidden">
        {guideStyles}
        {renderHeader('Settings Guide')}
        <div className="flex-1 relative overflow-hidden select-none bg-gray-50/50">
          <div className="guide-protected absolute inset-0 p-4 md:p-8 opacity-90 overflow-auto">
            <SettingsScreen business={DUMMY_BUSINESS} onUpdateSettings={async () => {}} onLogout={() => {}} isOnline={false} onManageStaff={async () => {}} entitlements={null} onRefreshEntitlements={async () => {}} isGuideMode={true} activeHotspotId={activeHotspot?.id} onHotspotClick={(id) => setActiveHotspot(SETTINGS_HOTSPOTS.find(h => h.id === id) || null)} />
          </div>
          {renderTooltip()}
        </div>
      </div>
    );
  }

  const GuideCard = ({ id, icon: Icon, title, desc }: { id: string, icon: any, title: string, desc: string }) => (
    <button onClick={() => setActiveGuide(id as any)} className="group bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 text-left flex flex-col">
      <div className="h-32 bg-indigo-50 border-b border-indigo-100 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-100/50 via-transparent to-transparent"></div>
        <div className="relative bg-white p-4 rounded-xl shadow-sm border border-indigo-100 rotate-[-5deg] group-hover:rotate-0 transition-transform duration-300 flex items-center justify-center text-primary">
          <Icon size={40} />
        </div>
        <div className="absolute right-4 bottom-4 w-6 h-6 bg-primary rounded-full animate-pulse border-2 border-white shadow-md"></div>
      </div>
      <div className="p-5 flex-1">
        <h3 className="font-bold text-gray-900 text-lg mb-2 group-hover:text-primary transition-colors">{title}</h3>
        <p className="text-sm text-gray-500 line-clamp-2">{desc}</p>
      </div>
      <div className="px-5 py-3 border-t bg-gray-50 text-xs font-bold text-primary flex items-center justify-between">
        <span>Start Guide</span><ArrowLeft size={16} className="rotate-180" />
      </div>
    </button>
  );

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3"><BookOpen className="text-primary" size={28} /> App Guides</h1>
        <p className="text-gray-500 mt-2">Learn how to use Ginvoice Market OS with these interactive walkthroughs.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <GuideCard id="inventory" icon={Package} title="Inventory Walkthrough" desc="Learn how to add products, manage stock levels, and use filters." />
        <GuideCard id="sales" icon={ShoppingBag} title="Sales & Cart Walkthrough" desc="Learn how to select items, view the bill, and process checkout." />
        <GuideCard id="history" icon={Clock} title="Past Sales Walkthrough" desc="Learn how to reprint receipts, refund items, and track past sales." />
        <GuideCard id="expenditure" icon={Wallet} title="Expenses Walkthrough" desc="Learn how to log operational expenses and track money out." />
        <GuideCard id="settings" icon={SettingsIcon} title="Settings Walkthrough" desc="Learn how to configure receipt settings and staff roles." />
      </div>
    </div>
  );
};

export default GuidesScreen;