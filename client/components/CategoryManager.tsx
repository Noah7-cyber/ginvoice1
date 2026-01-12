import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X, Tag, Edit3, Save } from 'lucide-react';
import { Category } from '../types';
import { getCategories, createCategory, deleteCategory, updateCategory } from '../services/api';
import { useToast } from './ToastProvider';
import { CURRENCY } from '../constants';

interface CategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  setCategories: (categories: Category[]) => void;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({ isOpen, onClose, categories, setCategories }) => {
  const { addToast } = useToast();
  const [newCategoryName, setNewCategoryName] = useState('');
  const [defaultCost, setDefaultCost] = useState<number | ''>('');
  const [defaultSelling, setDefaultSelling] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleAddOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName) return;

    setLoading(true);
    try {
      if (editingId) {
        // Update Logic
        await updateCategory(editingId, {
          name: newCategoryName,
          defaultSellingPrice: Number(defaultSelling) || 0,
          defaultCostPrice: Number(defaultCost) || 0
        });
        setCategories(categories.map(c => c.id === editingId ? {
          ...c,
          name: newCategoryName,
          defaultSellingPrice: Number(defaultSelling) || 0,
          defaultCostPrice: Number(defaultCost) || 0
        } : c));
        addToast('Category updated', 'success');
        setEditingId(null);
      } else {
        // Create Logic
        const newCat = await createCategory({
          name: newCategoryName,
          defaultSellingPrice: Number(defaultSelling) || 0,
          defaultCostPrice: Number(defaultCost) || 0
        });
        setCategories([...categories, newCat]);
        addToast('Category created', 'success');
      }

      setNewCategoryName('');
      setDefaultCost('');
      setDefaultSelling('');
    } catch (err) {
      addToast(editingId ? 'Failed to update' : 'Failed to create', 'error');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setNewCategoryName(cat.name);
    setDefaultCost(cat.defaultCostPrice);
    setDefaultSelling(cat.defaultSellingPrice);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNewCategoryName('');
    setDefaultCost('');
    setDefaultSelling('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? This will not delete products in this category.')) return;
    try {
      await deleteCategory(id);
      setCategories(categories.filter(c => c.id !== id));
      addToast('Category deleted', 'success');
    } catch (err) {
      addToast('Failed to delete category', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-bold flex items-center gap-2"><Tag size={20} /> Manage Categories</h2>
          <button onClick={onClose}><X size={24} /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Add/Edit Form */}
          <form onSubmit={handleAddOrUpdate} className={`space-y-3 p-4 rounded-xl border ${editingId ? 'bg-indigo-50 border-indigo-100' : 'bg-gray-50'}`}>
            <div className="flex justify-between items-center">
               <label className="text-[10px] font-bold text-gray-400 uppercase">{editingId ? 'Edit Category' : 'New Category Name'}</label>
               {editingId && <button type="button" onClick={cancelEdit} className="text-[10px] font-bold text-red-500 uppercase">Cancel</button>}
            </div>
            <div>
               <input
                 autoFocus
                 type="text"
                 required
                 className="w-full px-3 py-2 border rounded-lg text-sm font-bold"
                 placeholder="e.g. Beverages"
                 value={newCategoryName}
                 onChange={e => setNewCategoryName(e.target.value)}
               />
            </div>
            <div className="grid grid-cols-2 gap-3">
               <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Default Cost ({CURRENCY})</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="0"
                    value={defaultCost}
                    onChange={e => setDefaultCost(Number(e.target.value))}
                  />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Default Price ({CURRENCY})</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="0"
                    value={defaultSelling}
                    onChange={e => setDefaultSelling(Number(e.target.value))}
                  />
               </div>
            </div>
            <button
              disabled={loading}
              className={`w-full py-2 text-white rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-50 ${editingId ? 'bg-indigo-600' : 'bg-primary'}`}
            >
              {loading ? 'Saving...' : (editingId ? 'Update Category' : 'Add Category')}
            </button>
          </form>

          {/* List */}
          <div className="max-h-[40vh] overflow-y-auto space-y-2">
            {categories.length === 0 ? (
               <p className="text-center text-gray-400 text-sm py-4">No custom categories yet.</p>
            ) : (
               categories.map(cat => (
                 <div key={cat.id} className={`flex justify-between items-center p-3 border rounded-xl hover:bg-gray-50 ${editingId === cat.id ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''}`}>
                    <div>
                      <h4 className="font-bold text-gray-800">{cat.name}</h4>
                      <p className="text-[10px] text-gray-500">
                        Def: {CURRENCY}{cat.defaultSellingPrice} / {CURRENCY}{cat.defaultCostPrice} (Cost)
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(cat)} className="text-gray-400 hover:text-indigo-600 p-2">
                         <Edit3 size={16} />
                      </button>
                      <button onClick={() => handleDelete(cat.id)} className="text-gray-400 hover:text-red-600 p-2">
                         <Trash2 size={16} />
                      </button>
                    </div>
                 </div>
               ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryManager;
