
import React, { useState } from 'react';
import { Search, Plus, Package, ShoppingCart } from 'lucide-react';
import { Product } from '../types';
import { CURRENCY } from '../constants';

interface SalesScreenProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
}

const SalesScreen: React.FC<SalesScreenProps> = ({ products, onAddToCart }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  const categories = Array.from(new Set(products.map(p => p.category)));

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = categoryFilter === 'All' || p.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

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
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-primary outline-none shadow-sm font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
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

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center text-gray-400">
            <Package size={48} className="opacity-20 mb-4" />
            <p className="font-bold">No products found</p>
          </div>
        ) : (
          filtered.map(p => (
            <button
              key={p.id}
              onClick={() => onAddToCart(p)}
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
                <h3 className="font-bold text-gray-900 truncate leading-tight mb-1">{p.name}</h3>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-black text-primary">{CURRENCY}{p.sellingPrice.toLocaleString()}</span>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                    p.currentStock < 10 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {p.currentStock} {p.unit}s
                  </span>
                </div>
              </div>
              
              <div className="w-8 h-8 rounded-full bg-primary/5 text-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Plus size={18} />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default SalesScreen;
