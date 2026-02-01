import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit3, Trash2, CheckCircle2, X, ListTodo, Layers, Tag, DollarSign, ArrowUp, Maximize2, Save, Loader2, Calculator, SlidersHorizontal } from 'lucide-react';
import { Product, Category } from '../types';
import { CURRENCY } from '../constants';
import { formatCurrency } from '../utils/currency';
import { deleteProduct, createProduct, updateProduct, getCategories } from '../services/api';
import { useToast } from './ToastProvider';
import CategoryManager from './CategoryManager';
import AlphabetScrubber from './AlphabetScrubber';
import { useAlphabetIndexer } from '@/hooks/useAlphabetIndexer';
import useLongPress from '../hooks/useLongPress';

interface InventoryScreenProps {
  products: Product[];
  onUpdateProducts: (products: Product[]) => void;
  isOwner: boolean;
  isReadOnly?: boolean;
  isOnline: boolean;
  initialParams?: { id?: string };
}

const InventoryScreen: React.FC<InventoryScreenProps> = ({ products, onUpdateProducts, isOwner, isReadOnly, isOnline, initialParams }) => {
  // Ensure safeReadOnly respects the passed prop (for subscription lock), falling back to permissions logic if needed
  // App.tsx handles the permission logic in the passed isReadOnly prop.
  const safeReadOnly = isReadOnly;
  const { addToast } = useToast();

  // Ref for scroll container
  const listRef = React.useRef<HTMLDivElement>(null);

  // States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [visibleCount, setVisibleCount] = useState(50); // Performance Pagination
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(10);
  
  // New States for Features
  const [minPrice, setMinPrice] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Category Management
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);

  // Inline Editing
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Bulk Edit Panel States
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkPriceChange, setBulkPriceChange] = useState<number | ''>('');
  const [bulkStockAdd, setBulkStockAdd] = useState<number | ''>('');
  const [bulkStockReduce, setBulkStockReduce] = useState<number | ''>('');
  const [bulkCostPrice, setBulkCostPrice] = useState<number | ''>(''); // New field

  // Fetch Categories on Mount
  useEffect(() => {
    const fetchCats = async () => {
      try {
        const cats = await getCategories();
        setCategories(cats);
      } catch (err) {
        console.error('Failed to fetch categories');
      }
    };
    if (navigator.onLine) fetchCats();
  }, []);

  // Sync with URL params
  useEffect(() => {
    if (initialParams?.id) {
       const product = products.find(p => p.id === initialParams.id);
       if (product) {
         setEditingProductId(product.id);
         setNewProduct({ ...product });
         setIsModalOpen(true);
       }
    } else {
       // Only close if the ACTUAL URL matches the "root" path (no ID).
       // This prevents closing the modal when 'products' updates but we are locally deep-linked (via click)
       // and 'initialParams' is stale (because App doesn't re-render on pushState).
       const currentPath = window.location.pathname;
       const hasDeepLink = currentPath.split('/').length > 2; // e.g. /inventory/123

       if (isModalOpen && editingProductId && !hasDeepLink) {
          setIsModalOpen(false);
          setEditingProductId(null);
       }
    }
  }, [initialParams, products]);

  const updateUrlForProduct = (id: string | null) => {
      if (id) {
          window.history.pushState(null, '', `/inventory/${id}`);
      } else {
          window.history.pushState(null, '', `/inventory`);
      }
  };

  // Merge default categories with custom ones for display
  const allCategoryNames = categories.map(c => c.name);

  const initialProductState: Partial<Product> = {
    name: '',
    sku: '',
    category: allCategoryNames[0] || 'Uncategorized',
    costPrice: 0,
    sellingPrice: 0,
    currentStock: 0,
    baseUnit: 'Piece',
    units: []
  };

  const [newProduct, setNewProduct] = useState<Partial<Product>>(initialProductState);

  const filteredProducts = products.filter(p => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = p.name.toLowerCase().includes(term) || (p.category && p.category.toLowerCase().includes(term));
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesLowStock = !filterLowStock || p.currentStock < lowStockThreshold;
    const matchesMinPrice = minPrice === '' || p.sellingPrice >= minPrice;
    const matchesMaxPrice = maxPrice === '' || p.sellingPrice <= maxPrice;

    return matchesSearch && matchesCategory && matchesLowStock && matchesMinPrice && matchesMaxPrice;
  }).sort((a, b) => a.name.localeCompare(b.name));

  // Reset pagination on filter change
  useEffect(() => {
      setVisibleCount(50);
  }, [searchTerm, selectedCategory, filterLowStock, minPrice, maxPrice]);

  // Initialize Indexer Hook
  const { scrollToLetter } = useAlphabetIndexer(listRef, [filteredProducts], (index) => {
      // If target index is beyond visible range, expand range
      if (index >= visibleCount) {
          setVisibleCount(index + 50);
      }
  });

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Click Outside Handler
  const handleBackgroundClick = (e: React.MouseEvent) => {
     // Do not auto-exit on mobile (width < 768) as per requirements
     if (window.innerWidth >= 768 && e.target === e.currentTarget && isSelectionMode) {
         setIsSelectionMode(false);
         setSelectedIds(new Set());
     }
  };

  const selectAll = () => {
    // Smart Select All: Only select visible items
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const applyBulkUpdates = () => {
    if (safeReadOnly) return;
    if (!isOnline) {
        addToast('Please connect to the internet to perform this action.', 'error');
        return;
    }
    const updatedProducts = products.map(p => {
      if (selectedIds.has(p.id)) {
        let updated = { ...p, isManualUpdate: true };

        // Partial Updates: Only update if value is provided
        if (bulkCategory) updated.category = bulkCategory;

        if (typeof bulkPriceChange === 'number' && bulkPriceChange !== 0) {
          updated.sellingPrice = Math.max(0, updated.sellingPrice + (updated.sellingPrice * (bulkPriceChange / 100)));
        }

        if (typeof bulkStockAdd === 'number') {
          updated.currentStock = Math.max(0, updated.currentStock + bulkStockAdd);
        }

        if (typeof bulkStockReduce === 'number') {
          updated.currentStock = Math.max(0, updated.currentStock - bulkStockReduce);
        }

        if (typeof bulkCostPrice === 'number') {
          updated.costPrice = bulkCostPrice;
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
    setBulkCostPrice('');
  };

  const handleAddNew = () => {
    if (!isOnline) {
      addToast('Please connect to the internet to perform this action.', 'error');
      return;
    }
    setEditingProductId(null);
    setNewProduct({
      ...initialProductState,
      sku: Date.now().toString().slice(-5) // Default 5-digit SKU
    });
    setIsModalOpen(true);
  };

  const handleCategoryChange = (catName: string) => {
    const customCat = categories.find(c => c.name === catName);
    const updated = { ...newProduct, category: catName };

    // Pre-fill logic: Only if prices are 0 or empty
    if (customCat) {
      if (!updated.sellingPrice || updated.sellingPrice === 0) {
        updated.sellingPrice = customCat.defaultSellingPrice;
      }
      if (!updated.costPrice || updated.costPrice === 0) {
        updated.costPrice = customCat.defaultCostPrice;
      }
      if ((!updated.baseUnit || updated.baseUnit === 'Piece') && customCat.defaultUnit) {
          updated.baseUnit = customCat.defaultUnit;
      }
    }
    setNewProduct(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (safeReadOnly) return;
    if (!isOnline) {
      addToast('Please connect to the internet to perform this action.', 'error');
      return;
    }
    setIsSaving(true);

    try {
        if (editingProductId) {
             const updatedItem = { ...(newProduct as Product), id: editingProductId, isManualUpdate: true };
             await updateProduct(updatedItem);
             const updatedProducts = products.map(p => p.id === editingProductId ? updatedItem : p);
             onUpdateProducts(updatedProducts);
        } else {
             // Fix: Sanitize numeric fields to prevent crashes if empty
             const sanitizedProduct = {
               ...newProduct,
               costPrice: Number(newProduct.costPrice) || 0,
               sellingPrice: Number(newProduct.sellingPrice) || 0,
               currentStock: Number(newProduct.currentStock) || 0,
             } as Product;

             const newItem: Product = { ...sanitizedProduct, id: `PRD-${Date.now()}`, isManualUpdate: true };
             await createProduct(newItem);
             onUpdateProducts([...products, newItem]);
        }
        setIsModalOpen(false);
        setNewProduct(initialProductState);
        setEditingProductId(null);
        updateUrlForProduct(null);
    } catch (err: any) {
        console.error(err);
        if (err.message?.includes('409') || err.response?.status === 409 || err.message?.toLowerCase().includes('duplicate')) {
            addToast('Product with this name already exists in this category.', 'error');
        } else {
            addToast('Failed to save product. Please try again.', 'error');
        }
    } finally {
        setIsSaving(false);
    }
  };

  const handleInlineSave = async (id: string) => {
    if (!isOnline) {
      addToast('Please connect to the internet to perform this action.', 'error');
      return;
    }
    const product = products.find(p => p.id === id);
    if (!product) return;

    const updated = { ...product, isManualUpdate: true };
    try {
        await updateProduct(updated);
        setInlineEditingId(null);
    } catch(err) {
        addToast('Failed to save changes', 'error');
    }
  };

  const handleInlineUpdateLocal = (id: string, field: 'currentStock' | 'sellingPrice', value: string) => {
    if (safeReadOnly) return;
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    const updatedProducts = products.map(p => {
      if (p.id === id) {
        return { ...p, [field]: numValue };
      }
      return p;
    });
    onUpdateProducts(updatedProducts);
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

  const calculateUnitPrice = (index: number) => {
    const currentUnits = [...(newProduct.units || [])];
    const unit = currentUnits[index];

    if (unit.multiplier) {
      if (newProduct.sellingPrice) {
        unit.sellingPrice = newProduct.sellingPrice * unit.multiplier;
      }
      if (newProduct.costPrice) {
        unit.costPrice = newProduct.costPrice * unit.multiplier;
      }
      setNewProduct({ ...newProduct, units: currentUnits });
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (safeReadOnly) return;
    if (!isOnline) {
      addToast('Please connect to the internet to perform this action.', 'error');
      return;
    }
    setItemToDelete(id);
  };

  const confirmDeleteProduct = async () => {
    if (!itemToDelete) return;
    console.log('Deleting ID:', itemToDelete);
    setIsDeleting(true);
    try {
      await deleteProduct(itemToDelete);
      onUpdateProducts(products.filter(p => p.id !== itemToDelete));
      setItemToDelete(null);
    } catch (err) {
      addToast('Delete failed. Please try again.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col overflow-hidden relative">
        {/* New Invisible Scrubber - Position fixed relative to viewport is fine, but it needs to call our hook */}
        <div className="md:hidden">
            <AlphabetScrubber onScrollTo={scrollToLetter} />
        </div>

        {/* Mobile Selection Bar */}
        {isSelectionMode && (
          <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b shadow-lg animate-in slide-in-from-top-2 p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
               <button onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
                  <X size={24} className="text-gray-600" />
               </button>
               <span className="text-lg font-bold text-gray-900">{selectedIds.size} Selected</span>
            </div>
            <div className="flex items-center gap-2">
               {/* Select All / Clear Toggle */}
               <button
                  onClick={selectAll}
                  className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-bold text-gray-700 whitespace-nowrap"
               >
                  {selectedIds.size === filteredProducts.length ? 'Clear All' : 'Select All'}
               </button>

               {/* Bulk Edit Trigger */}
               {selectedIds.size > 0 && (
                   <button
                     onClick={() => setIsBulkEditOpen(true)}
                     disabled={!navigator.onLine}
                     className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                     title="Bulk Edit"
                   >
                      <ListTodo size={20} />
                   </button>
               )}
            </div>
          </div>
        )}

      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2 md:mb-8 shrink-0 ${isSelectionMode ? 'mt-16 md:mt-0' : ''}`}>
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold text-gray-900">Manage Stock</h1>
          <p className="text-gray-500">Add or edit items in your shop</p>
        </div>

        <div className={`flex gap-2 ${isSelectionMode ? 'hidden md:flex' : ''}`}>
           {!safeReadOnly && (
             <button
               onClick={() => setIsCategoryManagerOpen(true)}
               className="bg-white text-gray-700 px-4 py-3 rounded-xl flex items-center gap-2 font-bold border hover:bg-gray-50 transition-all"
             >
               <Tag size={20} /> <span className="hidden md:inline">Manage Categories</span>
             </button>
           )}

          {selectedIds.size > 0 && !safeReadOnly && (
            <button 
              onClick={() => setIsBulkEditOpen(true)}
              disabled={!navigator.onLine}
              className={`bg-indigo-50 text-indigo-700 px-6 py-3 rounded-xl flex items-center gap-2 font-bold border border-indigo-200 hover:bg-indigo-100 transition-all ${!navigator.onLine ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={!navigator.onLine ? "Internet connection required for bulk updates." : ""}
            >
              <ListTodo size={20} /> Edit Many ({selectedIds.size})
            </button>
          )}
          {!safeReadOnly && (
            <button 
              onClick={handleAddNew}
              className="bg-primary text-white px-6 py-3 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-indigo-100 hover:opacity-90 transition-all active:scale-95"
            >
              <Plus size={20} /> <span className="hidden md:inline">Add New</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border mb-6 flex flex-col gap-4 shrink-0 sticky top-0 z-20">

        {/* Row 1: Search + Toggle */}
        <div className="flex gap-2 items-center">
             <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                    type="text"
                    list="inventory-suggestions"
                    placeholder="Search products..."
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-primary outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <datalist id="inventory-suggestions">
                {products.map(p => <option key={p.id} value={p.name} />)}
                </datalist>
            </div>
            <button
                onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                className={`md:hidden p-2 rounded-lg border ${isFiltersOpen ? 'bg-primary text-white' : 'bg-gray-50 text-gray-600'}`}
            >
                <SlidersHorizontal size={20} />
            </button>
        </div>

        {/* Row 2: Collapsible Filters */}
        <div className={`${isFiltersOpen ? 'flex' : 'hidden'} md:flex flex-col md:flex-row gap-4 items-center animate-in slide-in-from-top-2 md:animate-none`}>

            <select
            className="w-full md:w-auto bg-gray-50 border-none rounded-lg px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            >
            <option value="All">All Categories</option>
            {[...allCategoryNames].sort().map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>

            {/* Price Range Filters */}
            <div className="flex items-center gap-2 w-full md:w-auto">
                <input
                    type="number"
                    placeholder="Min"
                    className="flex-1 md:w-24 px-3 py-2 bg-gray-50 border-none rounded-lg text-sm"
                    value={minPrice}
                    onChange={e => setMinPrice(e.target.value ? Number(e.target.value) : '')}
                />
                <span className="text-gray-400">-</span>
                <input
                    type="number"
                    placeholder="Max"
                    className="flex-1 md:w-24 px-3 py-2 bg-gray-50 border-none rounded-lg text-sm"
                    value={maxPrice}
                    onChange={e => setMaxPrice(e.target.value ? Number(e.target.value) : '')}
                />
            </div>

            <div className="flex items-center gap-2 px-2 whitespace-nowrap w-full md:w-auto">
                <input
                    type="checkbox"
                    id="lowStock"
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    checked={filterLowStock}
                    onChange={(e) => setFilterLowStock(e.target.checked)}
                />
                <label htmlFor="lowStock" className="text-sm font-bold text-gray-600 cursor-pointer">Low Stock (&lt;</label>
                <input
                type="number"
                className="w-12 px-1 py-0.5 text-sm border rounded bg-gray-50 text-center font-bold"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                onClick={(e) => e.stopPropagation()}
                />
                <span className="text-sm font-bold text-gray-600">)</span>
            </div>

        </div>
      </div>

      {/* Scrollable Content Area */}
      <div
        className="flex-1 overflow-y-auto relative pb-24"
        ref={listRef}
        onClick={handleBackgroundClick} // Click outside listener
      >

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 w-12">
                   {/* Always show checkbox on desktop, or toggle? User asked for "Default View: Hide checkbox column". But usually desktop has checkboxes.
                       "Selection Mode: Add state isSelectionMode... Default View: Hide the checkbox column."
                       This likely applies to both views or primarily mobile. Let's apply to desktop too for consistency with "Selection Mode".
                       Wait, prompt says "When clicked, show checkboxes...".
                   */}
                   {isSelectionMode ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={selectedIds.size > 0 && selectedIds.size === filteredProducts.length}
                          onChange={selectAll}
                        />
                        <button
                          onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }}
                          className="text-red-400 hover:text-red-600"
                          title="Exit Selection Mode"
                        >
                          <X size={16} />
                        </button>
                      </div>
                   ) : (
                       <button onClick={() => setIsSelectionMode(true)} title="Enable Selection" className="text-gray-400 hover:text-primary"><ListTodo size={16}/></button>
                   )}
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Product</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase hidden sm:table-cell">Category</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Stock</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Price</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredProducts.slice(0, visibleCount).map(product => (
                <tr key={product.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(product.id) ? 'bg-indigo-50/50' : ''}`}>
                  <td className="px-6 py-4">
                    {isSelectionMode && (
                        <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                        checked={selectedIds.has(product.id)}
                        onChange={() => toggleSelection(product.id)}
                        />
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">{product.name}</div>
                    <div className="text-[10px] text-gray-400 font-medium">#{product.sku || product.id.slice(-5)}</div>
                  </td>
                  <td className="px-6 py-4 hidden sm:table-cell">
                    <span className="px-2 py-1 bg-white border rounded text-[10px] font-bold uppercase text-gray-500">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${product.currentStock < 10 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></span>
                      {(!safeReadOnly && inlineEditingId === product.id) ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            className="w-20 px-2 py-1 border rounded font-bold text-gray-800"
                            value={product.currentStock}
                            onChange={(e) => handleInlineUpdateLocal(product.id, 'currentStock', e.target.value)}
                          />
                          <span className="text-xs text-gray-500">{product.baseUnit}</span>
                        </div>
                      ) : (
                        <span className="font-bold text-gray-800">{product.currentStock} {product.baseUnit}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-black text-gray-900">
                    {(!safeReadOnly && inlineEditingId === product.id) ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">{CURRENCY}</span>
                        <input
                          type="number"
                          className="w-24 px-2 py-1 border rounded font-black text-gray-900"
                          value={product.sellingPrice}
                          onChange={(e) => handleInlineUpdateLocal(product.id, 'sellingPrice', e.target.value)}
                        />
                      </div>
                    ) : (
                      <>{CURRENCY}{(product.sellingPrice || 0).toLocaleString()}</>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {!safeReadOnly && (
                      <div className="flex gap-2">
                        {inlineEditingId === product.id ? (
                            <>
                                <button
                                    onClick={() => handleInlineSave(product.id)}
                                    className="p-2 text-green-500 hover:text-green-700"
                                    title="Save"
                                >
                                    <CheckCircle2 size={18} />
                                </button>
                                <button
                                    onClick={() => setInlineEditingId(null)}
                                    className="p-2 text-red-500 hover:text-red-700"
                                    title="Cancel"
                                >
                                    <X size={18} />
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => setInlineEditingId(product.id)}
                                    className="p-2 text-gray-400 hover:text-primary"
                                    title="Quick Edit"
                                >
                                    <Edit3 size={18} />
                                </button>
                                <button
                                    onClick={() => {
                                        if (!isOnline) {
                                            addToast('Please connect to the internet to perform this action.', 'error');
                                            return;
                                        }
                                        setEditingProductId(product.id);
                                        setNewProduct({ ...product });
                                        setIsModalOpen(true);
                                    updateUrlForProduct(product.id);
                                    }}
                                    className="p-2 text-gray-400 hover:text-primary"
                                    title="Full Edit"
                                >
                                    <Maximize2 size={18} />
                                </button>
                                <button onClick={() => handleDeleteProduct(product.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={18} /></button>
                            </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Desktop Load More Sentinel */}
        {visibleCount < filteredProducts.length && (
            <div className="p-4 text-center">
                <button onClick={() => setVisibleCount(prev => prev + 50)} className="text-primary font-bold text-sm hover:underline">
                    Load More Items...
                </button>
            </div>
        )}
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3 pb-10">
        {filteredProducts.slice(0, visibleCount).map((product, index) => {
            // Check if this is the first item starting with this letter
            const firstChar = product.name.charAt(0).toUpperCase();
            const prevChar = index > 0 ? filteredProducts[index - 1].name.charAt(0).toUpperCase() : null;
            const showHeader = firstChar !== prevChar;
            const isAlpha = /[A-Z]/.test(firstChar);
            const headerId = `section-${isAlpha ? firstChar : '#'}`;

            return (
              <InventoryCard
                 key={product.id}
                 product={product}
                 showHeader={showHeader}
                 headerId={headerId}
                 firstChar={isAlpha ? firstChar : '#'}
                 isSelectionMode={isSelectionMode}
                 isSelected={selectedIds.has(product.id)}
                 onToggleSelection={() => toggleSelection(product.id)}
                 onLongPressSelection={() => {
                     setIsSelectionMode(true);
                     if (!selectedIds.has(product.id)) toggleSelection(product.id);
                 }}
                 safeReadOnly={safeReadOnly}
                 isOnline={isOnline}
                 onEdit={(p) => {
                    setEditingProductId(p.id);
                    setNewProduct({ ...p });
                    setIsModalOpen(true);
                    updateUrlForProduct(p.id);
                 }}
                 onDelete={() => handleDeleteProduct(product.id)}
                 addToast={addToast}
              />
            );
      })}
        {/* Mobile Load More Sentinel */}
        {visibleCount < filteredProducts.length && (
            <div className="p-4 text-center pb-20">
                <button onClick={() => setVisibleCount(prev => prev + 50)} className="text-primary font-bold text-sm bg-indigo-50 px-4 py-2 rounded-lg">
                    Tap to Load More
                </button>
            </div>
        )}
      </div>

      </div> {/* End of Scrollable Content */}

      {/* Bulk Edit Panel */}
      {isBulkEditOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[85vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center bg-indigo-600 text-white shrink-0 sticky top-0 bg-indigo-600 z-10">
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
                    {allCategoryNames.map(c => <option key={c} value={c}>{c}</option>)}
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
                    <label className="text-xs font-black text-gray-400 uppercase mb-2 block">Set Buying Price</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input 
                        type="number" 
                        placeholder="New Cost"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border rounded-xl"
                        value={bulkCostPrice}
                        onChange={(e) => setBulkCostPrice(e.target.value ? Number(e.target.value) : '')}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
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
              <button onClick={() => { setIsModalOpen(false); updateUrlForProduct(null); }}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Product Name</label>
                <input required type="text" className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary outline-none" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} placeholder="e.g. OMO Detergent" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">SKU / Code</label>
                <input
                   type="text"
                   className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-primary outline-none font-mono"
                   value={newProduct.sku || ''}
                   onChange={e => setNewProduct({...newProduct, sku: e.target.value})}
                   placeholder="e.g. 12345"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
                  <select
                    className="w-full px-4 py-3 rounded-xl border bg-white focus:ring-2 focus:ring-primary outline-none"
                    value={newProduct.category}
                    onChange={e => handleCategoryChange(e.target.value)}
                  >
                    {[...allCategoryNames].sort().map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sold By</label>
                  <input
                    type="text"
                    list="unit-suggestions"
                    className="w-full px-4 py-3 rounded-xl border"
                    value={newProduct.baseUnit}
                    onChange={e => setNewProduct({...newProduct, baseUnit: e.target.value})}
                    onBlur={(e) => {
                        const val = e.target.value;
                        if (val) {
                            try {
                                const stored = localStorage.getItem('ginvoice_recent_units');
                                const units = stored ? JSON.parse(stored) : [];
                                if (!units.includes(val)) {
                                    units.push(val);
                                    if(units.length > 10) units.shift();
                                    localStorage.setItem('ginvoice_recent_units', JSON.stringify(units));
                                }
                            } catch {}
                        }
                    }}
                    placeholder="e.g. Bottle"
                  />
                  <datalist id="unit-suggestions">
                     {(() => {
                         try {
                             const stored = localStorage.getItem('ginvoice_recent_units');
                             const units = stored ? JSON.parse(stored) : [];
                             return units.map((u: string) => <option key={u} value={u} />);
                         } catch { return null; }
                     })()}
                  </datalist>
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
                    <div key={idx} className="flex flex-col gap-2 border-b pb-2 mb-2">
                      <div className="flex gap-2 items-center flex-wrap">
                        <input
                          placeholder="Name (e.g. Carton)"
                          className="flex-1 px-3 py-2 text-sm rounded-lg border min-w-[120px]"
                          value={u.name}
                          onChange={e => handleUpdateUnit(idx, 'name', e.target.value)}
                        />
                        <input
                          type="number"
                          placeholder="Qty"
                          className="w-16 px-3 py-2 text-sm rounded-lg border text-center"
                          value={u.multiplier}
                          onChange={e => handleUpdateUnit(idx, 'multiplier', Number(e.target.value))}
                        />
                        <button type="button" onClick={() => handleRemoveUnit(idx)} className="text-red-400 hover:text-red-600">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        {/* NEW INPUT: Cost Price */}
                        <div className="flex-1">
                            <label className="text-[10px] uppercase font-bold text-gray-400">Buying Price</label>
                            <input
                              type="number"
                              className="w-full px-3 py-2 text-sm rounded-lg border"
                              value={u.costPrice || 0}
                              onChange={e => handleUpdateUnit(idx, 'costPrice', Number(e.target.value))}
                            />
                        </div>
                        <div className="flex-1 relative">
                            <label className="text-[10px] uppercase font-bold text-gray-400">Selling Price</label>
                            <div className="flex items-center gap-1">
                                <input
                                type="number"
                                className="w-full px-3 py-2 text-sm rounded-lg border"
                                value={u.sellingPrice}
                                onChange={e => handleUpdateUnit(idx, 'sellingPrice', Number(e.target.value))}
                                />
                                <button type="button" onClick={() => calculateUnitPrice(idx)} className="text-indigo-500 p-1 hover:bg-indigo-50 rounded" title="Calculate from Base Price">
                                    <Calculator size={16} />
                                </button>
                            </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Buying Price ({CURRENCY})</label>
                  <input
                    type="number"
                    className="w-full px-4 py-3 rounded-xl border"
                    value={newProduct.costPrice || ''}
                    onChange={e => setNewProduct({...newProduct, costPrice: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Selling Price ({CURRENCY})</label>
                  <input
                    type="number"
                    className="w-full px-4 py-3 rounded-xl border"
                    value={newProduct.sellingPrice || ''}
                    onChange={e => setNewProduct({...newProduct, sellingPrice: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Quantity Left</label>
                  <input
                    type="number"
                    className="w-full px-4 py-3 rounded-xl border"
                    value={newProduct.currentStock || ''}
                    onChange={e => setNewProduct({...newProduct, currentStock: Number(e.target.value)})}
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditingProductId(null); updateUrlForProduct(null); }}
                  className="flex-1 py-4 border rounded-xl font-bold text-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-4 bg-primary text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2"
                >
                   {isSaving ? <Loader2 className="animate-spin" size={20} /> : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Manager Modal */}
      <CategoryManager
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
        categories={categories}
        setCategories={setCategories}
        isOnline={isOnline}
        onCategoryRename={(oldName, newName) => {
            const updatedProducts = products.map(p => {
                if (p.category === oldName) {
                    return { ...p, category: newName };
                }
                return p;
            });
            onUpdateProducts(updatedProducts);
        }}
      />

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm scale-100">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Product?</h3>
            <p className="text-sm text-gray-500 mb-6">Are you sure you want to delete this item? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteProduct}
                disabled={isDeleting}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isDeleting ? <Loader2 className="animate-spin" size={20} /> : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Extracted Card Component to support hooks usage inside map
const InventoryCard = ({ product, showHeader, headerId, firstChar, isSelectionMode, isSelected, onToggleSelection, onLongPressSelection, safeReadOnly, isOnline, onEdit, onDelete, addToast }: any) => {
    const longPressProps = useLongPress(
        onLongPressSelection,
        (e) => {
            // CRITICAL: Allow simple TAP to toggle selection when in mode
            if (isSelectionMode) {
                onToggleSelection();
            } else {
                // Default non-selection click behavior (e.g., nothing or view details)
            }
        }
    );

    return (
        <React.Fragment>
        {showHeader && (
            <div id={headerId} className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm py-2 px-4 -mx-4 mb-2 border-b border-gray-100 font-black text-gray-400 text-xs uppercase tracking-widest scroll-mt-0">
                {firstChar}
            </div>
        )}
        <div
            className={`bg-white p-4 rounded-2xl shadow-sm border flex flex-col gap-3 transition-colors ${isSelected ? 'ring-2 ring-primary bg-indigo-50/30' : ''} select-none`}
            {...longPressProps}
        >
            <div className="flex justify-between items-start">
        <div className="flex gap-3 items-start">
            {isSelectionMode && (
                <input
                    type="checkbox"
                    className="mt-1 w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary pointer-events-auto"
                    checked={isSelected}
                    onChange={(e) => { e.stopPropagation(); onToggleSelection(); }}
                />
            )}
            <div>
                <h3 className="font-bold text-gray-900">{product.name}</h3>
                <p className="text-xs text-gray-400">#{product.sku || product.id.slice(-5)}</p>
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

        {!safeReadOnly && !isSelectionMode && (
        <div className="flex justify-end gap-2 border-t pt-3 mt-1">
            <button
                onClick={(e) => {
                e.stopPropagation();
                if (!isOnline) {
                    addToast('Please connect to the internet to perform this action.', 'error');
                    return;
                }
                onEdit(product);
                }}
                className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-gray-200"
            >
                <Edit3 size={14} /> Edit
            </button>
            <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-red-100"
            >
                <Trash2 size={14} /> Delete
            </button>
        </div>
        )}
    </div>
    </React.Fragment>
    );
};

export default InventoryScreen;
