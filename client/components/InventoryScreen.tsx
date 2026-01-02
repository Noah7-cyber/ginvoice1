
import React, { useState } from 'react';
import { Plus, Search, Edit3, Trash2, CheckCircle2, X, ListTodo, Layers, Tag, DollarSign, ArrowUp } from 'lucide-react';
import { Product } from '../types';
import { CURRENCY, CATEGORIES } from '../constants';
import { formatCurrency } from '../utils/currency';
import { deleteProduct } from '../services/api';
import { useToast } from './ToastProvider';

interface InventoryScreenProps {
  products: Product[];
  onUpdateProducts: (products: Product[]) => void;
  isOwner: boolean;
}

const InventoryScreen: React.FC<InventoryScreenProps> = ({ products, onUpdateProducts, isOwner }) => {
  const { addToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Bulk Edit Panel States
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkPriceChange, setBulkPriceChange] = useState<number | ''>('');
  const [bulkStockAdd, setBulkStockAdd] = useState<number | ''>('');
  const [bulkStockReduce, setBulkStockReduce] = useState<number | ''>('');

  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '',
    category: CATEGORIES[0],
    costPrice: 0,
    sellingPrice: 0,
    currentStock: 0,
    baseUnit: 'Piece',
    units: []
  });

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const applyBulkUpdates = () => {
    const updatedProducts = products.map(p => {
      if (selectedIds.has(p.id)) {
        let updated = { ...p };
        if (bulkCategory) updated.category = bulkCategory;
        if (typeof bulkPriceChange === 'number') {
          updated.sellingPrice = Math.max(0, updated.sellingPrice + (updated.sellingPrice * (bulkPriceChange / 100)));
        }
        if (typeof bulkStockAdd === 'number') {
          updated.currentStock = Math.max(0, updated.currentStock + bulkStockAdd);
        }
        if (typeof bulkStockReduce === 'number') {
          updated.currentStock = Math.max(0, updated.currentStock - bulkStockReduce);
        }
        return updated;
      }
      return p;
    });
    onUpdateProducts(updatedProducts);
    setSelectedIds(new Set());
    setIsBulkEditOpen(false);
    resetBulkFields();
  };

  const resetBulkFields = () => {
    setBulkCategory('');
    setBulkPriceChange('');
    setBulkStockAdd('');
    setBulkStockReduce('');
  };

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProductId) {
      const updatedProducts = products.map(p => p.id === editingProductId ? { ...(newProduct as Product), id: p.id } : p);
      onUpdateProducts(updatedProducts);
    } else {
      const product: Product = { ...(newProduct as Product), id: `PRD-${Date.now()}` };
      onUpdateProducts([...products, product]);
    }
    setIsModalOpen(false);
    setNewProduct({ name: '', category: CATEGORIES[0], costPrice: 0, sellingPrice: 0, currentStock: 0, baseUnit: 'Piece', units: [] });
    setEditingProductId(null);
  };

  const handleAddUnit = () => {
    const currentUnits = newProduct.units || [];
    setNewProduct({ ...newProduct, units: [...currentUnits, { name: '', multiplier: 12, sellingPrice: 0 }] });
  };

  const handleRemoveUnit = (index: number) => {
    const currentUnits = newProduct.units || [];
    setNewProduct({ ...newProduct, units: currentUnits.filter((_, i) => i !== index) });
  };

  const handleUpdateUnit = (index: number, field: keyof typeof newProduct.units[0], value: any) => {
    const currentUnits = [...(newProduct.units || [])];
    currentUnits[index] = { ...currentUnits[index], [field]: value };
    setNewProduct({ ...newProduct, units: currentUnits });
  };

  const handleDeleteProduct = async (id: string) => {
    if (!navigator.onLine) {
      addToast('Delete requires an internet connection.', 'error');
      return;
    }
    if (confirm('Are you sure you want to delete this item?')) {
      try {
        await deleteProduct(id);
        onUpdateProducts(products.filter(p => p.id !== id));
      } catch (err) {
        addToast('Delete failed. Please try again.', 'error');
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-500">Track and manage your warehouse stock</p>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && isOwner && (
            <button 
              onClick={() => setIsBulkEditOpen(true)}
              className="bg-indigo-50 text-indigo-700 px-6 py-3 rounded-xl flex items-center gap-2 font-bold border border-indigo-200 hover:bg-indigo-100 transition-all"
            >
              <ListTodo size={20} /> Bulk Update ({selectedIds.size})
            </button>
          )}
          {isOwner && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-primary text-white px-6 py-3 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-indigo-100 hover:opacity-90 transition-all active:scale-95"
            >
              <Plus size={20} /> Add New
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border mb-6 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder="Search products..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-primary outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          className="bg-gray-50 border-none rounded-lg px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="All">All Categories</option>
          {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        {/* Mobile Select All Toggle */}
        <button
           onClick={selectAll}
           className="md:hidden px-4 py-2 bg-gray-100 rounded-lg text-sm font-bold text-gray-600"
        >
          {selectedIds.size === filteredProducts.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 w-12">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    checked={selectedIds.size > 0 && selectedIds.size === filteredProducts.length}
                    onChange={selectAll}
                  />
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Product</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase hidden sm:table-cell">Category</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Stock</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Price</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredProducts.map(product => (
                <tr key={product.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(product.id) ? 'bg-indigo-50/50' : ''}`}>
                  <td className="px-6 py-4">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                      checked={selectedIds.has(product.id)}
                      onChange={() => toggleSelection(product.id)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">{product.name}</div>
                    <div className="text-[10px] text-gray-400 font-medium">#{product.id.slice(-5)}</div>
                  </td>
                  <td className="px-6 py-4 hidden sm:table-cell">
                    <span className="px-2 py-1 bg-white border rounded text-[10px] font-bold uppercase text-gray-500">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${product.currentStock < 10 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></span>
                      <span className="font-bold text-gray-800">{product.currentStock} {product.baseUnit}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-black text-gray-900">{formatCurrency(product.sellingPrice)}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingProductId(product.id);
                          setNewProduct({ ...product });
                          setIsModalOpen(true);
                        }}
                        className="p-2 text-gray-400 hover:text-primary"
                      >
                        <Edit3 size={18} />
                      </button>
                      {isOwner && <button onClick={() => handleDeleteProduct(product.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={18} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {filteredProducts.map(product => (
          <div
             key={product.id}
             className={`bg-white p-4 rounded-2xl shadow-sm border flex flex-col gap-3 transition-colors ${selectedIds.has(product.id) ? 'ring-2 ring-primary bg-indigo-50/30' : ''}`}
             onClick={() => toggleSelection(product.id)}
          >
             <div className="flex justify-between items-start">
                <div className="flex gap-3 items-start">
                   <input
                      type="checkbox"
                      className="mt-1 w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                      checked={selectedIds.has(product.id)}
                      onChange={(e) => { e.stopPropagation(); toggleSelection(product.id); }}
                    />
                    <div>
                      <h3 className="font-bold text-gray-900">{product.name}</h3>
                      <p className="text-xs text-gray-400">#{product.id.slice(-5)}</p>
                    </div>
                </div>
                <span className="px-2 py-1 bg-gray-100 rounded text-[10px] font-bold uppercase text-gray-500">
                  {product.category}
                </span>
             </div>

             <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                 <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-gray-400">Stock</span>
                    <span className={`font-bold ${product.currentStock < 10 ? 'text-red-500' : 'text-gray-900'}`}>{product.currentStock} {product.baseUnit}</span>
                 </div>
                 <div className="flex flex-col text-right">
                    <span className="text-[10px] uppercase font-bold text-gray-400">Price</span>
                    <span className="font-black text-gray-900">{formatCurrency(product.sellingPrice)}</span>
                 </div>
             </div>

             <div className="flex justify-end gap-2 border-t pt-3 mt-1">
                 <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingProductId(product.id);
                      setNewProduct({ ...product });
                      setIsModalOpen(true);
                    }}
                    className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-gray-200"
                  >
                    <Edit3 size={14} /> Edit
                  </button>
                  {isOwner && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id); }}
                      className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-red-100"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  )}
             </div>
          </div>
        ))}
      </div>

      {/* Bulk Edit Panel */}
      {isBulkEditOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10">
            <div className="p-6 border-b flex justify-between items-center bg-indigo-600 text-white">
              <h2 className="text-xl font-bold flex items-center gap-2"><Layers size={24} /> Bulk Edit Items</h2>
              <button onClick={() => setIsBulkEditOpen(false)}><X size={24} /></button>
            </div>
            <div className="p-6 space-y-6">
              <p className="text-sm text-gray-500 font-medium">Updating {selectedIds.size} selected products simultaneously.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase mb-2 block">Set Category</label>
                  <select 
                    className="w-full p-3 bg-gray-50 border rounded-xl"
                    value={bulkCategory}
                    onChange={(e) => setBulkCategory(e.target.value)}
                  >
                    <option value="">No Change</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-black text-gray-400 uppercase mb-2 block">Price Adjustment (%)</label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input 
                        type="number" 
                        placeholder="e.g. 10 or -5"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border rounded-xl"
                        value={bulkPriceChange}
                        onChange={(e) => setBulkPriceChange(e.target.value ? Number(e.target.value) : '')}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-black text-gray-400 uppercase mb-2 block">Add Stock (Qty)</label>
                    <div className="relative">
                      <ArrowUp className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input 
                        type="number" 
                        placeholder="e.g. 50"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border rounded-xl"
                        value={bulkStockAdd}
                        onChange={(e) => setBulkStockAdd(e.target.value ? Number(e.target.value) : '')}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black text-gray-400 uppercase mb-2 block">Reduce Stock (Qty)</label>
                  <div className="relative">
                    <ArrowUp className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 rotate-180" size={16} />
                    <input 
                      type="number" 
                      placeholder="e.g. 10"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border rounded-xl"
                      value={bulkStockReduce}
                      onChange={(e) => setBulkStockReduce(e.target.value ? Number(e.target.value) : '')}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => { setIsBulkEditOpen(false); resetBulkFields(); }}
                  className="flex-1 py-4 border rounded-2xl font-bold text-gray-500 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={applyBulkUpdates}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={20} /> Apply Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center bg-primary text-white">
              <h2 className="text-xl font-bold">Register New Product</h2>
              <button onClick={() => setIsModalOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleAddProduct} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Product Name</label>
                <input required type="text" className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary outline-none" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} placeholder="e.g. OMO Detergent" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
                  <select className="w-full px-4 py-3 rounded-xl border" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})}>
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Base Unit</label>
                  <input type="text" className="w-full px-4 py-3 rounded-xl border" value={newProduct.baseUnit} onChange={e => setNewProduct({...newProduct, baseUnit: e.target.value})} placeholder="e.g. Bottle" />
                </div>
              </div>

              {/* Alternative Units Section */}
              <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-500 uppercase">Alternative Units (e.g. Carton)</label>
                  <button type="button" onClick={handleAddUnit} className="text-primary text-xs font-bold flex items-center gap-1 hover:underline">
                    <Plus size={14} /> Add Unit
                  </button>
                </div>
                {newProduct.units?.length === 0 && <p className="text-xs text-gray-400 italic">No extra units added.</p>}
                <div className="space-y-2">
                  {newProduct.units?.map((u, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        placeholder="Name (e.g. Box)"
                        className="flex-1 px-3 py-2 text-sm rounded-lg border"
                        value={u.name}
                        onChange={e => handleUpdateUnit(idx, 'name', e.target.value)}
                      />
                      <input
                        type="number"
                        placeholder="Qty"
                        title="Items in this unit"
                        className="w-16 px-3 py-2 text-sm rounded-lg border text-center"
                        value={u.multiplier}
                        onChange={e => handleUpdateUnit(idx, 'multiplier', Number(e.target.value))}
                      />
                      <input
                        type="number"
                        placeholder="Price"
                        className="w-24 px-3 py-2 text-sm rounded-lg border text-right"
                        value={u.sellingPrice}
                        onChange={e => handleUpdateUnit(idx, 'sellingPrice', Number(e.target.value))}
                      />
                      <button type="button" onClick={() => handleRemoveUnit(idx)} className="text-red-400 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cost Price ({CURRENCY})</label>
                  <input required type="number" className="w-full px-4 py-3 rounded-xl border" value={newProduct.costPrice} onChange={e => setNewProduct({...newProduct, costPrice: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Selling Price ({CURRENCY})</label>
                  <input required type="number" className="w-full px-4 py-3 rounded-xl border" value={newProduct.sellingPrice} onChange={e => setNewProduct({...newProduct, sellingPrice: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Stock Quantity</label>
                  <input required type="number" className="w-full px-4 py-3 rounded-xl border" value={newProduct.currentStock} onChange={e => setNewProduct({...newProduct, currentStock: Number(e.target.value)})} />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditingProductId(null); }}
                  className="flex-1 py-4 border rounded-xl font-bold text-gray-500"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-4 bg-primary text-white rounded-xl font-bold shadow-lg">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryScreen;
