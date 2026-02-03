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
  isOnline?: boolean;
  onCategoryRename?: (oldName: string, newName: string) => void;
  mode?: 'inventory' | 'expense';
}

const CategoryManager: React.FC<CategoryManagerProps> = ({ isOpen, onClose, categories, setCategories, isOnline = true, onCategoryRename, mode = 'inventory' }) => {
  const { addToast } = useToast();
  const [newCategoryName, setNewCategoryName] = useState('');
  const [defaultCost, setDefaultCost] = useState<number | ''>('');
  const [defaultSelling, setDefaultSelling] = useState<number | ''>('');
  const [defaultUnit, setDefaultUnit] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleAddOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName) return;
    if (!isOnline) {
      addToast('Please connect to the internet to perform this action.', 'error');
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        // Find old category name
        const oldCat = categories.find(c => c.id === editingId);
        const oldName = oldCat ? oldCat.name : '';

        // Update Logic
        await updateCategory(editingId, {
          name: newCategoryName,
          defaultSellingPrice: Number(defaultSelling) || 0,
          defaultCostPrice: Number(defaultCost) || 0,
          defaultUnit
        });

        setCategories(categories.map(c => c.id === editingId ? {
          ...c,
          name: newCategoryName,
          defaultSellingPrice: Number(defaultSelling) || 0,
          defaultCostPrice: Number(defaultCost) || 0,
          defaultUnit
        } : c));

        // Trigger parent callback
        if (oldName && oldName !== newCategoryName && onCategoryRename) {
            onCategoryRename(oldName, newCategoryName);
        }

        addToast('Category updated', 'success');
        setEditingId(null);
      } else {
        // Create Logic
        const newCat = await createCategory({
          name: newCategoryName,
          defaultSellingPrice: Number(defaultSelling) || 0,
          defaultCostPrice: Number(defaultCost) || 0,
          defaultUnit
        });
        setCategories([...categories, newCat]);
        addToast('Category created', 'success');
      }

      setNewCategoryName('');
      setDefaultCost('');
      setDefaultSelling('');
      setDefaultUnit('');
      setShowForm(false);
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
    setDefaultUnit(cat.defaultUnit || '');
    setShowForm(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNewCategoryName('');
    setDefaultCost('');
    setDefaultSelling('');
    setDefaultUnit('');
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    if (!isOnline) {
      addToast('Please connect to the internet to perform this action.', 'error');
      return;
    }
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
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95 flex flex-col h-[80vh] relative overflow-hidden">
        {/* Header - Fixed */}
        <div className="p-4 border-b flex justify-between items-center bg-gray-50 flex-none z-20">
          <h2 className="text-lg font-bold flex items-center gap-2"><Tag size={20} /> Manage Categories</h2>
          <button onClick={onClose}><X size={24} /></button>
        </div>

        {/* List - Scrollable (Visible by default) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50/50 pb-24">
            {categories.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm">
                 <Tag size={40} className="mb-2 opacity-20" />
                 <p>No custom categories yet.</p>
                 <p className="text-xs mt-1">Tap + to add one.</p>
               </div>
            ) : (
               [...categories].sort((a, b) => a.name.localeCompare(b.name)).map(cat => (
                 <div key={cat.id} className="flex justify-between items-center p-3 bg-white border rounded-xl hover:shadow-sm transition-shadow">
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

        {/* Floating Add Button (Visible when form is closed) */}
        {!showForm && (
           <div className="absolute bottom-20 right-6 z-10">
              <button
                onClick={() => {
                  setEditingId(null);
                  setNewCategoryName('');
                  setDefaultCost('');
                  setDefaultSelling('');
                  setDefaultUnit('');
                  setShowForm(true);
                }}
                className="w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-colors"
              >
                <Plus size={28} />
              </button>
           </div>
        )}

        {/* Input Form Overlay (Slide Up) */}
        {showForm && (
          <div className="absolute inset-0 z-30 bg-white flex flex-col animate-in slide-in-from-bottom-10">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 flex-none">
               <h3 className="font-bold text-gray-700">{editingId ? 'Edit Category' : 'New Category'}</h3>
               <button onClick={cancelEdit} className="p-2 hover:bg-gray-200 rounded-full">
                 <X size={20} />
               </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              <form onSubmit={handleAddOrUpdate} className="space-y-4">
                <div>
                   <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Category Name</label>
                   <input
                     autoFocus
                     type="text"
                     required
                     className="w-full px-4 py-3 border rounded-xl text-lg font-bold"
                     placeholder={mode === 'inventory' ? "e.g. Beverages" : "e.g. Utilities"}
                     value={newCategoryName}
                     onChange={e => setNewCategoryName(e.target.value)}
                   />
                </div>


                {mode === 'inventory' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                       <div>
                          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Def. Cost ({CURRENCY})</label>
                          <input
                            type="number"
                            className="w-full px-4 py-3 border rounded-xl"
                            placeholder="0"
                            value={defaultCost || ''}
                            onChange={e => setDefaultCost(Number(e.target.value))}
                          />
                       </div>
                       <div>
                          <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Def. Price ({CURRENCY})</label>
                          <input
                            type="number"
                            className="w-full px-4 py-3 border rounded-xl"
                            placeholder="0"
                            value={defaultSelling || ''}
                            onChange={e => setDefaultSelling(Number(e.target.value))}
                          />
                       </div>
                    </div>

                    <div>
                       <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Def. Unit Type</label>
                       <input
                         type="text"
                         className="w-full px-4 py-3 border rounded-xl"
                         placeholder="e.g. Bottle, Pack, Kg"
                         value={defaultUnit}
                         onChange={e => setDefaultUnit(e.target.value)}
                       />
                    </div>
                  </>
                )}

                <div className="pt-4 flex gap-3">
                   <button
                     type="button"
                     onClick={cancelEdit}
                     className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200"
                   >
                     Cancel
                   </button>
                   <button
                     type="submit"
                     disabled={loading}
                     className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200"
                   >
                     {loading ? 'Saving...' : (editingId ? 'Update' : 'Create')}
                   </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Footer - Close Button (Visible when form is closed) */}
        {!showForm && (
          <div className="p-4 border-t bg-white flex-none">
             <button
               onClick={onClose}
               className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors"
             >
               Close Manager
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryManager;
