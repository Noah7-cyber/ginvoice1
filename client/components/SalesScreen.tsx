
import React, { useState } from 'react';
import { Search, Plus, Package, ShoppingCart } from 'lucide-react';
import { Product, ProductUnit } from '../types';
import { CURRENCY } from '../constants';
import { formatCurrency } from '../utils/currency';
import AlphabetScrubber from './AlphabetScrubber';

interface SalesScreenProps {
  products: Product[];
  onAddToCart: (product: Product, unit?: ProductUnit) => void;
  permissions?: any;
}

const SalesScreen: React.FC<SalesScreenProps> = ({ products, onAddToCart, permissions }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const categories = Array.from(new Set(products.map(p => p.category)));

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = categoryFilter === 'All' || p.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const handleProductClick = (p: Product) => {
    if (p.units && p.units.length > 0) {
      setSelectedProduct(p);
    } else {
      onAddToCart(p);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-900">Select Items</h2>
          <p className="text-sm text-gray-500">Tap to add products to the current bill</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              list="product-suggestions"
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary outline-none shadow-sm font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <datalist id="product-suggestions">
              {products.map(p => <option key={p.id} value={p.name} />)}
            </datalist>
          </div>
          <select 
            className="px-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary outline-none shadow-sm"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="All">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 pb-10">
        {filtered.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center text-gray-400">
            <Package size={48} className="opacity-20 mb-4" />
            <p className="font-bold">No products found</p>
          </div>
        ) : (
          filtered.sort((a, b) => a.name.localeCompare(b.name)).map((p, index, arr) => {
            const firstChar = p.name.charAt(0).toUpperCase();
            const prevChar = index > 0 ? arr[index - 1].name.charAt(0).toUpperCase() : null;
            const showHeader = firstChar !== prevChar;
            const isAlpha = /[A-Z]/.test(firstChar);
            const headerId = `section-${isAlpha ? firstChar : '#'}`;

            return (
              <React.Fragment key={p.id}>
                 {showHeader && (
                    <div id={headerId} className="col-span-full sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm py-2 px-4 -mx-4 sm:mx-0 sm:rounded-lg border-b border-gray-100 font-black text-gray-400 text-xs uppercase tracking-widest scroll-mt-40 md:hidden">
                        {isAlpha ? firstChar : '#'}
                    </div>
                 )}
            <button
              onClick={() => handleProductClick(p)}
              disabled={p.currentStock <= 0}
              className={`
                group flex items-center gap-4 p-4 bg-white border border-gray-50 rounded-2xl shadow-sm transition-all text-left
                ${p.currentStock <= 0 ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:border-primary hover:shadow-md active:scale-[0.98]'}
              `}
            >
              <div className={`
                w-12 h-12 rounded-xl flex items-center justify-center shrink-0
                ${p.currentStock < 10 ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}
              `}>
                <ShoppingCart size={24} />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest truncate">{p.category}</p>
                <div className="mb-1">
                    <h3 className="font-bold text-gray-900 truncate leading-tight">{p.name}</h3>
                    {(p.sku || p.id) && (
                        <p className="text-[10px] text-gray-400 font-medium font-mono">#{p.sku || p.id.slice(-5)}</p>
                    )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-black text-primary">{formatCurrency(p.sellingPrice)}</span>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                    p.currentStock < 10 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {p.currentStock} {p.baseUnit}s
                  </span>
                </div>
              </div>
              
              <div className="w-8 h-8 rounded-full bg-primary/5 text-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Plus size={18} />
              </div>
            </button>
            </React.Fragment>
          );
         })
        )}
      </div>

       {/* Mobile Invisible Scrubber */}
       <div className="md:hidden">
         <AlphabetScrubber
           onScrollTo={(letter) => {
              const el = document.getElementById(`section-${letter}`);
              if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' });
           }}
         />
       </div>

      {/* Unit Selection Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in">
                <div className="p-4 border-b bg-gray-50">
                    <h3 className="font-bold text-lg text-gray-900">Select Unit</h3>
                    <p className="text-xs text-gray-500">Sell {selectedProduct.name} as...</p>
                </div>
                <div className="p-4 space-y-2">
                    <button
                        onClick={() => { onAddToCart(selectedProduct); setSelectedProduct(null); }}
                        className="w-full flex justify-between items-center p-4 border rounded-xl hover:border-primary hover:bg-indigo-50 transition-all group"
                    >
                        <div className="text-left">
                            <p className="font-bold text-gray-900 group-hover:text-primary">{selectedProduct.baseUnit}</p>
                            <p className="text-xs text-gray-400">1 Unit</p>
                        </div>
                        <span className="font-black text-gray-900">{CURRENCY}{selectedProduct.sellingPrice.toLocaleString()}</span>
                    </button>
                    {selectedProduct.units?.map((u, i) => (
                        <button
                            key={i}
                            onClick={() => { onAddToCart(selectedProduct, u); setSelectedProduct(null); }}
                            className="w-full flex justify-between items-center p-4 border rounded-xl hover:border-primary hover:bg-indigo-50 transition-all group"
                        >
                            <div className="text-left">
                                <p className="font-bold text-gray-900 group-hover:text-primary">{u.name}</p>
                                <p className="text-xs text-gray-400">Contains {u.multiplier} {selectedProduct.baseUnit}s</p>
                            </div>
                            <span className="font-black text-gray-900">{CURRENCY}{u.sellingPrice.toLocaleString()}</span>
                        </button>
                    ))}
                </div>
                <button onClick={() => setSelectedProduct(null)} className="w-full p-4 bg-gray-50 font-bold text-gray-500 hover:bg-gray-100">Cancel</button>
            </div>
        </div>
      )}
    </div>
  );
};

export default SalesScreen;
