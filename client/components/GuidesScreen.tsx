import React, { useState } from 'react';
import { BookOpen, ArrowLeft, Info, X } from 'lucide-react';
import InventoryScreen from './InventoryScreen';
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

interface Hotspot {
  id: string;
  top: string;
  left: string;
  title: string;
  description: string;
}

const INVENTORY_HOTSPOTS: Hotspot[] = [
  {
    id: 'search',
    top: '25%',
    left: '20%',
    title: 'Search & Filters',
    description: 'Use this bar to quickly find products by name or SKU. Click the sliders icon on mobile to access category and price filters.',
  },
  {
    id: 'add-product',
    top: '15%',
    left: '85%',
    title: 'Add New Products',
    description: 'Click here to register new items. You can set prices, stock levels, and alternative units (like selling by carton instead of piece).',
  },
  {
    id: 'stock-status',
    top: '60%',
    left: '50%',
    title: 'Stock Indicators',
    description: 'A green dot means you have healthy stock. A pulsing red dot indicates the item is running low and needs to be restocked.',
  },
  {
    id: 'quick-edit',
    top: '60%',
    left: '85%',
    title: 'Quick Actions',
    description: 'Click the pencil icon for a quick inline edit of price and stock, or the expand icon for a full edit.',
  }
];

const GuidesScreen: React.FC = () => {
  const [activeGuide, setActiveGuide] = useState<'inventory' | null>(null);
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);

  if (activeGuide === 'inventory') {
    return (
      <div className="relative h-full flex flex-col bg-gray-50 overflow-hidden">
        {/* Header for the Guide View */}
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0 z-30 shadow-sm relative">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveGuide(null)}
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
        <div className="flex-1 relative overflow-hidden pointer-events-none select-none">
            {/* We scale it slightly down and make it unclickable to simulate a sandbox */}
            <div className="absolute inset-0 p-4 md:p-8 opacity-80 pointer-events-none">
                <InventoryScreen
                    products={DUMMY_PRODUCTS}
                    onUpdateProducts={() => {}}
                    isOwner={true}
                    isReadOnly={true}
                    isOnline={true}
                    refreshData={async () => {}}
                />
            </div>

            {/* Hotspots Overlay - Pointer events must be auto here to catch clicks */}
            <div className="absolute inset-0 z-20 pointer-events-auto">
                {INVENTORY_HOTSPOTS.map((hotspot) => (
                    <div
                        key={hotspot.id}
                        className="absolute"
                        style={{ top: hotspot.top, left: hotspot.left, transform: 'translate(-50%, -50%)' }}
                    >
                        {/* The Pulsing Dot */}
                        <button
                            className="relative flex items-center justify-center w-8 h-8 group"
                            onClick={() => setActiveHotspot(hotspot)}
                            aria-label={`Learn about ${hotspot.title}`}
                        >
                            <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75 animate-ping"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-primary border-2 border-white shadow-lg group-hover:scale-125 transition-transform"></span>
                        </button>
                    </div>
                ))}
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

        {/* Placeholder for future guides */}
        <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-300 flex flex-col items-center justify-center p-8 text-center opacity-70">
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mb-3">
                <BookOpen size={20} className="text-gray-400" />
            </div>
            <h3 className="font-bold text-gray-500 mb-1">More guides coming soon</h3>
            <p className="text-xs text-gray-400">Sales, Dashboard, and Settings walkthroughs will appear here.</p>
        </div>
      </div>
    </div>
  );
};

export default GuidesScreen;