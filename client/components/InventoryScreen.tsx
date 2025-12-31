
import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit3, Trash2, CheckCircle2, X, ListTodo, Layers, Tag, ArrowUp, Package, Wand2 } from 'lucide-react';
import { Product, ProductUnit } from '../types';
import { CURRENCY, CATEGORIES } from '../constants';
import { deleteProduct } from '../services/api';
import { useToast } from './ToastProvider';

interface InventoryScreenProps {
  products: Product[];
  onUpdateProducts: (products: Product[]) => void;
  isOwner: boolean;
}

const formatStock = (stock: number, units: ProductUnit[] = []) => {
  if (!units || units.length === 0) return `${stock} units`;

  const sortedUnits = [...units].sort((a, b) => b.multiplier - a.multiplier);
  if (sortedUnits.length === 0) return `${stock} base units`;

  let remainingStock = stock;
  const parts = [];

  for (const unit of sortedUnits) {
    if (unit.multiplier === 0) continue;
    const count = Math.floor(remainingStock / unit.multiplier);
    if (count > 0) {
      parts.push(`${count} ${unit.name}(s)`);
      remainingStock %= unit.multiplier;
    }
  }

  if (remainingStock > 0) {
    const baseUnit = units.find(u => u.multiplier === 1) || { name: 'piece' };
    parts.push(`${remainingStock} ${baseUnit.name}(s)`);
  }

  return parts.length > 0 ? parts.join(', ') : `0 ${sortedUnits[0].name}(s)`;
};


const InventoryScreen: React.FC<InventoryScreenProps> = ({ products, onUpdateProducts, isOwner }) => {
  const { addToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkPriceChange, setBulkPriceChange] = useState<number | ''>('');
  const [bulkStockAdd, setBulkStockAdd] = useState<number | ''>('');

  const createInitialProduct = (): Partial<Product> => ({
    name: '',
    category: CATEGORIES[0],
    costPrice: 0,
    stock: 0,
    units: [{ name: 'Piece', multiplier: 1, sellingPrice: 0 }],
  });

  const [newProduct, setNewProduct] = useState<Partial<Product>>(createInitialProduct());

  useEffect(() => {
    if (editingProductId) {
      const productToEdit = products.find(p => p.id === editingProductId);
      if (productToEdit) {
        setNewProduct(JSON.parse(JSON.stringify(productToEdit)));
      }
    } else {
      setNewProduct(createInitialProduct());
    }
  }, [editingProductId, products]);


  const filteredProducts = products.filter(p => {
    const matchesSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase());
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
        const updated = { ...p };
        if (bulkCategory) {
          updated.category = bulkCategory;
        }
        if (typeof bulkPriceChange === 'number' && p.units) {
          updated.units = p.units.map(u => ({
            ...u,
            sellingPrice: Math.max(0, u.sellingPrice + (u.sellingPrice * (bulkPriceChange / 100)))
          }));
        }
        if (typeof bulkStockAdd === 'number') {
          updated.stock = (p.stock || 0) + bulkStockAdd;
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
  };

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const productData = { ...newProduct };

    if (!productData.name || !productData.units || productData.units.length === 0) {
      addToast('Product name and at least one unit are required.', 'error');
      return;
    }

    if (editingProductId) {
      const updatedProducts = products.map(p =>
        p.id === editingProductId ? { ...p, ...productData } as Product : p
      );
      onUpdateProducts(updatedProducts);
      addToast('Product updated successfully!', 'success');
    } else {
      const product: Product = { ...createInitialProduct(), ...productData, id: `PRD-${Date.now()}` };
      onUpdateProducts([...products, product]);
      addToast('New product added!', 'success');
    }

    setIsModalOpen(false);
    setEditingProductId(null);
    setNewProduct(createInitialProduct());
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
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
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
                      <span className={`w-2 h-2 rounded-full ${(product.stock || 0) < 10 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></span>
                      <span className="font-bold text-gray-800 text-xs">{formatStock(product.stock || 0, product.units)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-black text-gray-900">{CURRENCY}{((product.units || []).find(u => u.multiplier === 1)?.sellingPrice || 0).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingProductId(product.id);
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

      {isBulkEditOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10">
            <div className="p-6 border-b flex justify-between items-center bg-indigo-600 text-white">
              <h2 className="text-xl font-bold flex items-center gap-2"><Layers size={24} /> Bulk Edit Items</h2>
              <button onClick={() => setIsBulkEditOpen(false)}><X size={24} /></button>
            </div>
            <div className="p-6 space-y-6">
              <p className="text-sm text-gray-500 font-medium">Updating {selectedIds.size} selected products.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase mb-2 block">Set Category</label>
                  <select className="w-full p-3 bg-gray-50 border rounded-xl" value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)}>
                    <option value="">No Change</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-black text-gray-400 uppercase mb-2 block">Price Adj. (%)</label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input type="number" placeholder="e.g. 10 or -5" className="w-full pl-10 pr-4 py-3 bg-gray-50 border rounded-xl" value={bulkPriceChange} onChange={(e) => setBulkPriceChange(e.target.value ? Number(e.target.value) : '')} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-black text-gray-400 uppercase mb-2 block">Add Stock (Base Unit)</label>
                    <div className="relative">
                      <ArrowUp className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input type="number" placeholder="e.g. 50" className="w-full pl-10 pr-4 py-3 bg-gray-50 border rounded-xl" value={bulkStockAdd} onChange={(e) => setBulkStockAdd(e.target.value ? Number(e.target.value) : '')} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={() => { setIsBulkEditOpen(false); resetBulkFields(); }} className="flex-1 py-4 border rounded-2xl font-bold text-gray-500 hover:bg-gray-50">Cancel</button>
                <button onClick={applyBulkUpdates} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2"><CheckCircle2 size={20} /> Apply Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b flex justify-between items-center bg-primary text-white">
              <h2 className="text-xl font-bold flex items-center gap-2"><Package size={24} /> {editingProductId ? 'Edit Product' : 'Register New Product'}</h2>
              <button onClick={() => { setIsModalOpen(false); setEditingProductId(null); }}><X size={24} /></button>
            </div>
            <form onSubmit={handleAddProduct} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Product Name</label>
                  <input required type="text" className="w-full px-4 py-3 rounded-xl border" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} placeholder="e.g. OMO Detergent" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
                  <select className="w-full px-4 py-3 rounded-xl border" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})}>
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cost Price ({CURRENCY})</label>
                  <input required type="number" className="w-full px-4 py-3 rounded-xl border" value={newProduct.costPrice} onChange={e => setNewProduct({...newProduct, costPrice: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Initial Stock (In Base Unit)</label>
                  <input required type="number" className="w-full px-4 py-3 rounded-xl border" value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: Number(e.target.value)})} disabled={!!editingProductId} />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-2 border-t pt-4">Units of Measurement</h3>
                <div className="space-y-3">
                  {(newProduct.units || []).map((unit, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center p-2 bg-gray-50 rounded-lg">
                      <div className="col-span-4">
                        <label className="text-xs font-medium text-gray-500">Unit Name</label>
                        <input type="text" value={unit.name} onChange={e => {
                          const units = [...(newProduct.units || [])];
                          units[index].name = e.target.value;
                          setNewProduct({...newProduct, units});
                        }} className="w-full p-2 border rounded" placeholder="e.g. Piece" />
                      </div>
                      <div className="col-span-3">
                        <label className="text-xs font-medium text-gray-500">Multiplier</label>
                        <input type="number" value={unit.multiplier} onChange={e => {
                           const units = [...(newProduct.units || [])];
                           units[index].multiplier = Number(e.target.value);
                           setNewProduct({...newProduct, units});
                        }} className="w-full p-2 border rounded" placeholder="e.g. 1" disabled={unit.multiplier === 1} />
                      </div>
                      <div className="col-span-4">
                        <label className="text-xs font-medium text-gray-500">Selling Price</label>
                        <input type="number" value={unit.sellingPrice} onChange={e => {
                           const units = [...(newProduct.units || [])];
                           units[index].sellingPrice = Number(e.target.value);
                           setNewProduct({...newProduct, units});
                        }} className="w-full p-2 border rounded" />
                      </div>
                      <div className="col-span-1">
                        {unit.multiplier !== 1 && (
                          <button type="button" onClick={() => {
                            const units = (newProduct.units || []).filter((_, i) => i !== index);
                            setNewProduct({...newProduct, units});
                          }} className="text-red-500 hover:text-red-700 mt-5"><Trash2 size={16}/></button>
                        )}
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => {
                    const units = [...(newProduct.units || []), { name: '', multiplier: 0, sellingPrice: 0 }];
                    setNewProduct({...newProduct, units});
                  }} className="text-sm font-bold text-primary flex items-center gap-1 mt-2"><Plus size={14}/> Add Another Unit</button>
                </div>
              </div>

              <div className="pt-6 flex gap-3">
                <button type="button" onClick={() => { setIsModalOpen(false); setEditingProductId(null); }} className="flex-1 py-4 border rounded-xl font-bold text-gray-500 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="flex-1 py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2"><Wand2 size={20}/> Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryScreen;
