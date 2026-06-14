import React, { useState } from 'react';
import { BookOpen, ArrowLeft, Info, X } from 'lucide-react';
import InventoryScreen from './InventoryScreen';
import SalesScreen from './SalesScreen';
import CurrentOrderSidebar from './CurrentOrderSidebar';
import { SaleItem } from '../types';
import { Product } from '../types';

// Dummy data for the Inventory guide
const DUMMY_PRODUCTS: Product[] = [
  {
    id: 'DUMMY-1',
    name: 'Premium Coffee Beans',
    sku: 'CF-100',
    category: 'Beverages',
    costPrice: 15,
    sellingPrice: 25,
    currentStock: 120,
    baseUnit: 'Bag',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'DUMMY-2',
    name: 'Espresso Machine',
    sku: 'EM-200',
    category: 'Equipment',
    costPrice: 400,
    sellingPrice: 599,
    currentStock: 3, // Low stock to show the red indicator
    baseUnit: 'Unit',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'DUMMY-3',
    name: 'Ceramic Mugs (Set of 4)',
    sku: 'MG-300',
    category: 'Accessories',
    costPrice: 10,
    sellingPrice: 20,
    currentStock: 45,
    baseUnit: 'Set',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

const DUMMY_CART_ITEMS: SaleItem[] = [
  {
    cartId: 'c1',
    productId: 'DUMMY-1',
    productName: 'Premium Coffee Beans',
    quantity: 2,
    unitPrice: 25,
    total: 50,
    discount: 0,
    originalStock: 120,
    isDeleted: false
  },
  {
    cartId: 'c2',
    productId: 'DUMMY-2',
    productName: 'Espresso Machine',
    quantity: 1,
    unitPrice: 599,
    total: 599,
    discount: 50,
    originalStock: 3,
    isDeleted: false
  },
  {
    cartId: 'c3',
    productId: 'DUMMY-3',
    productName: 'Ceramic Mugs (Set of 4)',
    quantity: 4,
    unitPrice: 20,
    total: 80,
    discount: 0,
    originalStock: 45,
    isDeleted: false
  },
  {
    cartId: 'c4',
    productId: 'DUMMY-4',
    productName: 'Milk Pitcher',
    quantity: 1,
    unitPrice: 15,
    total: 15,
    discount: 0,
    originalStock: 20,
    isDeleted: false
  },
  {
    cartId: 'c5',
    productId: 'DUMMY-5',
    productName: 'Tamper',
    quantity: 1,
    unitPrice: 35,
    total: 35,
    discount: 0,
    originalStock: 15,
    isDeleted: false
  }
];

export interface Hotspot {
  id: string;
  title: string;
  description: string;
}

export const SALES_HOTSPOTS: Hotspot[] = [
  {
    id: 'search',
    title: 'Find Products',
    description: 'Use the search bar to quickly find items to add to the bill.'
  },
  {
    id: 'filter',
    title: 'Filter by Category',
    description: 'Narrow down products by selecting a specific category here.'
  },
  {
    id: 'product-click',
    title: 'Add to Cart',
    description: 'Tap on a product to instantly add it to the current customer\'s bill.'
  }
];

export const CART_HOTSPOTS: Hotspot[] = [
  {
    id: 'customer-name',
    title: 'Customer Details',
    description: 'Optionally link a sale to a customer by entering their name or selecting from past customers.'
  },
  {
    id: 'cart-item',
    title: 'Adjust Quantities',
    description: 'Increase or decrease item quantities, or apply specific discounts directly from the cart.'
  },
  {
    id: 'discount',
    title: 'Global Discounts',
    description: 'Apply a flat amount or percentage discount to the entire bill.'
  },
  {
    id: 'payment-methods',
    title: 'Payment Options',
    description: 'Select Cash, Transfer, POS, or Debt. If a customer owes a balance, they will automatically be added to your Debtors list.'
  },
  {
    id: 'checkout',
    title: 'Confirm & Pay',
    description: 'Complete the sale to process payment and print or share a receipt.'
  }
];

export const INVENTORY_HOTSPOTS: Hotspot[] = [
  {
    id: 'search',
    title: 'Search & Filters',
    description: 'Use this bar to quickly find products by name or SKU. Click the sliders icon on mobile to access category and price filters.',
  },
  {
    id: 'add-product',
    title: 'Add New Products',
    description: 'Click here to register new items. You can set prices, stock levels, and alternative units (like selling by carton instead of piece). It helps you organize what you sell.',
  },
  {
    id: 'categories',
    title: 'Manage Categories',
    description: 'Categories help group similar items (like "Beverages" or "Equipment"). Create categories here to organize your products and make them easier to find and manage.',
  },
  {
    id: 'import-csv',
    title: 'Bulk Import',
    description: 'Save time by importing hundreds of products at once using a CSV file template.',
  },
  {
    id: 'verify-stock',
    title: 'Verify Stock',
    description: 'Periodically check your physical items against your digital records. Click here to go through a guided physical count of your current inventory to prevent discrepancies.',
  },
  {
    id: 'stock-status',
    title: 'Stock Indicators',
    description: 'A green dot means you have healthy stock. A pulsing red dot indicates the item is running low and needs to be restocked.',
  },
  {
    id: 'quick-edit',
    title: 'Quick Actions',
    description: 'Click the pencil icon for a quick inline edit of price and stock, or the expand icon for a full edit.',
  }
];

const GuidesScreen: React.FC = () => {
  const [activeGuide, setActiveGuide] = useState<'inventory' | 'sales' | null>(null);
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);

  // Global CSS to protect dummy app from interactions while allowing scrolling
  const guideStyles = (
    <style>{`
      .guide-protected { pointer-events: auto; }
      .guide-protected button:not(.guide-hotspot),
      .guide-protected input,
      .guide-protected select,
      .guide-protected textarea {
        pointer-events: none !important;
      }
      .guide-protected .guide-hotspot {
        pointer-events: auto !important;
      }
    `}</style>
  );

  if (activeGuide === 'inventory') {
    return (
      <div className="relative h-full flex flex-col bg-gray-50 overflow-hidden">
        {guideStyles}
        {/* Header for the Guide View */}
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0 z-30 shadow-sm relative">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setActiveGuide(null); setActiveHotspot(null); }}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <BookOpen size={18} className="text-primary" /> Inventory Guide
              </h2>
              <p className="text-xs text-gray-500">Interactive Walkthrough</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg font-medium">
            <Info size={16} />
            Click the pulsing dots to learn more
          </div>
        </div>

        {/* The "Dummy" App Area with the Hotspot Overlay */}
        <div className="flex-1 relative overflow-hidden select-none bg-gray-50/50">
            {/* We enable pointer-events so clicks go to the child components to hit hotspots */}
            <div className="guide-protected absolute inset-0 p-4 md:p-8 opacity-90 overflow-auto">
                <InventoryScreen
                    products={DUMMY_PRODUCTS}
                    onUpdateProducts={() => {}}
                    isOwner={true}
                    isReadOnly={true}
                    isOnline={false} // pass false to avoid triggering network logic in dummy mode if any
                    refreshData={async () => {}}
                    isGuideMode={true}
                    activeHotspotId={activeHotspot?.id}
                    onHotspotClick={(id) => {
                      const h = INVENTORY_HOTSPOTS.find((h) => h.id === id);
                      if (h) setActiveHotspot(h);
                    }}
                />
            </div>

            {/* Hotspot Tooltip Modal */}
            {activeHotspot && (
                <div className="absolute inset-0 z-40 flex items-center justify-center p-4 pointer-events-auto bg-black/20 backdrop-blur-[1px]" onClick={() => setActiveHotspot(null)}>
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-primary p-4 flex justify-between items-center text-white">
                            <h3 className="font-bold flex items-center gap-2">
                                <Info size={18} /> {activeHotspot.title}
                            </h3>
                            <button onClick={() => setActiveHotspot(null)} className="text-white/70 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-5">
                            <p className="text-gray-600 leading-relaxed text-sm">
                                {activeHotspot.description}
                            </p>
                            <div className="mt-6 flex justify-end">
                                <button
                                    onClick={() => setActiveHotspot(null)}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold transition-colors"
                                >
                                    Got it
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    );
  }

  if (activeGuide === 'cart') {
    return (
      <div className="relative h-full flex flex-col bg-gray-50 overflow-hidden">
        {guideStyles}
        {/* Header for the Guide View */}
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0 z-30 shadow-sm relative">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setActiveGuide(null); setActiveHotspot(null); }}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <BookOpen size={18} className="text-primary" /> Cart & Checkout Guide
              </h2>
              <p className="text-xs text-gray-500">Interactive Walkthrough</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg font-medium">
            <Info size={16} />
            Click the pulsing dots to learn more
          </div>
        </div>

        {/* The "Dummy" App Area with the Hotspot Overlay */}
        <div className="flex-1 relative overflow-hidden select-none bg-gray-50/50 flex flex-col md:flex-row items-center justify-center p-4">
            {/* Open Cart Sidebar Side */}
            <div className="guide-protected w-full max-w-md border shadow-2xl opacity-95 h-full max-h-[800px] rounded-2xl flex flex-col bg-white overflow-hidden relative">
              <CurrentOrderSidebar
                cart={DUMMY_CART_ITEMS}
                setCart={() => {}}
                customerName=""
                setCustomerName={() => {}}
                customerPhone=""
                setCustomerPhone={() => {}}
                paymentMethod="Cash"
                setPaymentMethod={() => {}}
                amountPaid={50}
                setAmountPaid={() => {}}
                globalDiscount={0}
                setGlobalDiscount={() => {}}
                isGlobalDiscountPercent={false}
                setIsGlobalDiscountPercent={() => {}}
                signature=""
                setSignature={() => {}}
                isLocked={true}
                setIsLocked={() => {}}
                onCompleteSale={() => {}}
                onClose={() => {}}
                products={DUMMY_PRODUCTS}
                permissions={{ canGiveDiscount: true }}
                isGuideMode={true}
                activeHotspotId={activeHotspot?.id}
                onHotspotClick={(id) => {
                  const h = CART_HOTSPOTS.find((h) => h.id === id);
                  if (h) setActiveHotspot(h);
                }}
              />
            </div>

            {/* Floating Back Button */}
            <div className="absolute bottom-8 left-4 md:left-8 z-20 pointer-events-auto">
                <button
                  onClick={() => { setActiveGuide('sales'); setActiveHotspot(null); }}
                  className="bg-white text-gray-900 border px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 hover:bg-gray-50 transition-all"
                >
                  <ArrowLeft size={16} /> Back to Sales Guide
                </button>
            </div>

            {/* Hotspot Tooltip Modal */}
            {activeHotspot && (
                <div className="absolute inset-0 z-40 flex items-center justify-center p-4 pointer-events-auto bg-black/20 backdrop-blur-[1px]" onClick={() => setActiveHotspot(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                        <div className="bg-primary p-4 flex justify-between items-center text-white">
                            <h3 className="font-bold flex items-center gap-2"><Info size={18} /> {activeHotspot.title}</h3>
                            <button onClick={() => setActiveHotspot(null)} className="text-white/70 hover:text-white transition-colors"><X size={20} /></button>
                        </div>
                        <div className="p-5">
                            <p className="text-gray-600 leading-relaxed text-sm">{activeHotspot.description}</p>
                            <div className="mt-6 flex justify-end"><button onClick={() => setActiveHotspot(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold transition-colors">Got it</button></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    );
  }

  if (activeGuide === 'sales') {
    return (
      <div className="relative h-full flex flex-col bg-gray-50 overflow-hidden">
        {guideStyles}
        {/* Header for the Guide View */}
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0 z-30 shadow-sm relative">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setActiveGuide(null); setActiveHotspot(null); }}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <BookOpen size={18} className="text-primary" /> Sales & Cart Guide
              </h2>
              <p className="text-xs text-gray-500">Interactive Walkthrough</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg font-medium">
            <Info size={16} />
            Click the pulsing dots to learn more
          </div>
        </div>

        {/* The "Dummy" App Area with the Hotspot Overlay */}
        <div className="flex-1 relative overflow-hidden select-none bg-gray-50/50 flex flex-col md:flex-row">
            {/* Sales Screen Side */}
            <div className="guide-protected flex-1 overflow-auto p-4 md:p-8 opacity-90 relative pb-32">
              <SalesScreen
                 products={DUMMY_PRODUCTS}
                 onAddToCart={() => {}}
                 isReadOnly={true}
                 isGuideMode={true}
                 activeHotspotId={activeHotspot?.id}
                 onHotspotClick={(id) => {
                   const h = SALES_HOTSPOTS.find((h) => h.id === id);
                   if (h) setActiveHotspot(h);
                 }}
              />
            </div>

            {/* Floating Next Button */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
                <button
                  onClick={() => { setActiveGuide('cart'); setActiveHotspot(null); }}
                  className="bg-gray-900 text-white px-8 py-4 rounded-full font-black shadow-2xl flex items-center gap-2 hover:bg-black hover:scale-105 transition-all"
                >
                  Next: Cart Walkthrough <ArrowLeft size={20} className="rotate-180" />
                </button>
            </div>

            {/* Hotspot Tooltip Modal */}
            {activeHotspot && (
                <div className="absolute inset-0 z-40 flex items-center justify-center p-4 pointer-events-auto bg-black/20 backdrop-blur-[1px]" onClick={() => setActiveHotspot(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                        <div className="bg-primary p-4 flex justify-between items-center text-white">
                            <h3 className="font-bold flex items-center gap-2"><Info size={18} /> {activeHotspot.title}</h3>
                            <button onClick={() => setActiveHotspot(null)} className="text-white/70 hover:text-white transition-colors"><X size={20} /></button>
                        </div>
                        <div className="p-5">
                            <p className="text-gray-600 leading-relaxed text-sm">{activeHotspot.description}</p>
                            <div className="mt-6 flex justify-end"><button onClick={() => setActiveHotspot(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold transition-colors">Got it</button></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    );
  }

  // Main Guides Menu
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
          <BookOpen className="text-primary" size={28} /> App Guides
        </h1>
        <p className="text-gray-500 mt-2">Learn how to use Ginvoice Market OS with these interactive walkthroughs.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Inventory Guide Card */}
        <button
            onClick={() => setActiveGuide('inventory')}
            className="group bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 text-left flex flex-col"
        >
            <div className="h-32 bg-indigo-50 border-b border-indigo-100 flex items-center justify-center relative overflow-hidden">
                 <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-100/50 via-transparent to-transparent"></div>
                 <div className="relative bg-white p-4 rounded-xl shadow-sm border border-indigo-100 rotate-[-5deg] group-hover:rotate-0 transition-transform duration-300">
                     <div className="w-16 h-2 bg-gray-200 rounded-full mb-2"></div>
                     <div className="w-24 h-2 bg-indigo-100 rounded-full"></div>
                 </div>
                 <div className="absolute right-4 bottom-4 w-6 h-6 bg-primary rounded-full animate-pulse border-2 border-white shadow-md"></div>
            </div>
            <div className="p-5 flex-1">
                <h3 className="font-bold text-gray-900 text-lg mb-2 group-hover:text-primary transition-colors">Inventory Walkthrough</h3>
                <p className="text-sm text-gray-500 line-clamp-2">Learn how to add products, manage stock levels, and use filters.</p>
            </div>
            <div className="px-5 py-3 border-t bg-gray-50 text-xs font-bold text-primary flex items-center justify-between">
                <span>Start Guide</span>
                <ArrowLeft size={16} className="rotate-180" />
            </div>
        </button>

        {/* Sales Guide Card */}
        <button
            onClick={() => setActiveGuide('sales')}
            className="group bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 text-left flex flex-col"
        >
            <div className="h-32 bg-indigo-50 border-b border-indigo-100 flex items-center justify-center relative overflow-hidden">
                 <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-100/50 via-transparent to-transparent"></div>
                 <div className="relative bg-white p-4 rounded-xl shadow-sm border border-indigo-100 rotate-[-5deg] group-hover:rotate-0 transition-transform duration-300">
                     <div className="w-16 h-2 bg-gray-200 rounded-full mb-2"></div>
                     <div className="w-24 h-2 bg-indigo-100 rounded-full"></div>
                 </div>
                 <div className="absolute right-4 bottom-4 w-6 h-6 bg-primary rounded-full animate-pulse border-2 border-white shadow-md"></div>
            </div>
            <div className="p-5 flex-1">
                <h3 className="font-bold text-gray-900 text-lg mb-2 group-hover:text-primary transition-colors">Sales & Cart Walkthrough</h3>
                <p className="text-sm text-gray-500 line-clamp-2">Learn how to select items, view the bill, and process checkout.</p>
            </div>
            <div className="px-5 py-3 border-t bg-gray-50 text-xs font-bold text-primary flex items-center justify-between">
                <span>Start Guide</span>
                <ArrowLeft size={16} className="rotate-180" />
            </div>
        </button>

        {/* Placeholder for future guides */}
        <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-300 flex flex-col items-center justify-center p-8 text-center opacity-70">
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mb-3">
                <BookOpen size={20} className="text-gray-400" />
            </div>
            <h3 className="font-bold text-gray-500 mb-1">More guides coming soon</h3>
            <p className="text-xs text-gray-400">Dashboard, and Settings walkthroughs will appear here.</p>
        </div>
      </div>
    </div>
  );
};

export default GuidesScreen;