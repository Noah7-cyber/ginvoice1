import React, { useState, useEffect } from 'react';
import { Plus, X, Save, Calendar, DollarSign, Tag, FileText, CreditCard, Pencil, Trash2, Settings } from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import { getCategories } from '../services/api';
import CategoryManager from './CategoryManager';
import { Category } from '../types';

// Update Interface to match your types.ts
interface Expenditure {
  id: string; // Changed from _id to id for local compatibility
  title: string;
  amount: number;
  category: string;
  date: string;
  description: string;
  paymentMethod: string;
  expenseType?: 'business' | 'personal';
}

interface ExpenditureScreenProps {
  expenditures: Expenditure[];
  onAddExpenditure: (item: Expenditure) => void;
  onDeleteExpenditure: (id: string) => void;
  onEditExpenditure: (item: Expenditure) => void;
  isOnline: boolean;
  isReadOnly?: boolean;
}

const ExpenditureScreen: React.FC<ExpenditureScreenProps> = ({ expenditures, onAddExpenditure, onDeleteExpenditure, onEditExpenditure, isOnline, isReadOnly }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { addToast } = useToast();

  // Categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const cats = await getCategories();
        setCategories(cats);
      } catch (err) {
        console.error('Failed to fetch categories');
      }
    };
    if (isOnline) fetchCats();
  }, [isOnline]);

  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    paymentMethod: 'Cash',
    expenseType: 'business' as 'business' | 'personal'
  });

  // Date Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Calculate Summary Metrics
  const summaryMetrics = React.useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonth = expenditures.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const thisMonthTotal = thisMonth.reduce((sum, e) => sum + (e.amount || 0), 0);
    const allTimeTotal = expenditures.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Top Category
    const catMap: Record<string, number> = {};
    thisMonth.forEach(e => {
      catMap[e.category] = (catMap[e.category] || 0) + (e.amount || 0);
    });
    let topCat = '-';
    let max = 0;
    Object.entries(catMap).forEach(([cat, amt]) => {
      if (amt > max) {
        max = amt;
        topCat = cat;
      }
    });

    return { thisMonthTotal, allTimeTotal, topCat };
  }, [expenditures]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Filtered List
  const filteredExpenditures = React.useMemo(() => {
    return expenditures.filter(e => {
      if (startDate && e.date < startDate) return false;
      if (endDate && e.date > endDate) return false;
      return true;
    });
  }, [expenditures, startDate, endDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      addToast('Please connect to the internet to perform this action.', 'error');
      return;
    }
    try {
      if (editingId) {
        // Edit Mode
        const updatedExpenditure: Expenditure = {
          id: editingId,
          title: formData.title,
          amount: parseFloat(formData.amount),
          category: formData.category,
          date: formData.date,
          description: formData.description,
          paymentMethod: formData.paymentMethod,
          expenseType: formData.expenseType
        };
        onEditExpenditure(updatedExpenditure);
        addToast('Expenditure updated', 'success');
      } else {
        // Add Mode
        const newExpenditure: Expenditure = {
          id: crypto.randomUUID(), // Client-side ID
          title: formData.title,
          amount: parseFloat(formData.amount),
          category: formData.category,
          date: formData.date,
          description: formData.description,
          paymentMethod: formData.paymentMethod,
          expenseType: formData.expenseType
        };
        onAddExpenditure(newExpenditure);
        addToast('Expenditure saved', 'success');
      }

      setShowAddModal(false);
      setEditingId(null); // Reset edit state
      setFormData({
        title: '',
        amount: '',
        category: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        paymentMethod: 'Cash',
        expenseType: 'business'
      });

    } catch (error) {
      console.error('Error saving expenditure:', error);
      addToast('Failed to save expenditure', 'error');
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Shop Expenses</h1>

        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
           {/* Date Filters */}
           <div className="flex items-center gap-2 bg-white p-2 rounded-lg border">
              <span className="text-xs font-bold text-gray-500 uppercase">From</span>
              <input
                type="date"
                className="text-sm font-bold text-gray-700 outline-none"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="text-gray-300">|</span>
              <span className="text-xs font-bold text-gray-500 uppercase">To</span>
              <input
                type="date"
                className="text-sm font-bold text-gray-700 outline-none"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              {(startDate || endDate) && (
                <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-red-400 hover:text-red-600 ml-2"><X size={14}/></button>
              )}
           </div>

           {!isReadOnly && (
             <>
                <button
                    onClick={() => setIsCategoryManagerOpen(true)}
                    className="flex items-center justify-center px-4 py-2 bg-white text-gray-700 border rounded-lg hover:bg-gray-50 transition-colors font-bold"
                >
                    <Tag className="w-5 h-5 mr-2" />
                    Manage Categories
                </button>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold shadow-lg shadow-blue-100"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Add Expense
                </button>
             </>
           )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
          <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1">This Month</p>
          <p className="text-2xl font-black text-blue-700">
            {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(summaryMetrics.thisMonthTotal)}
          </p>
        </div>
        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
          <p className="text-xs font-bold text-purple-500 uppercase tracking-wider mb-1">Total Spent</p>
          <p className="text-2xl font-black text-purple-700">
            {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(summaryMetrics.allTimeTotal)}
          </p>
        </div>
        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
          <p className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-1">Top Category (Month)</p>
          <p className="text-xl font-black text-orange-700 truncate">{summaryMetrics.topCat}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Title</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Method</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Amount</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(!filteredExpenditures || filteredExpenditures.length === 0) ? (
                 <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-500">No expenditures found.</td></tr>
              ) : (
                filteredExpenditures.map((exp) => (
                  <tr key={exp.id || Math.random()} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-600">
                       {exp.date ? new Date(exp.date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{exp.title}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <span className="px-2 py-1 rounded-full bg-gray-100 text-xs text-gray-600">{exp.category}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{exp.paymentMethod}</td>
                    <td className="px-6 py-4 text-sm font-bold text-red-600 text-right">
                      -{new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(exp.amount || 0)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right flex justify-end gap-2">
                      {isReadOnly ? (
                        <span className="text-gray-400 italic text-xs">Locked</span>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              if (!isOnline) {
                                addToast('Please connect to the internet to perform this action.', 'error');
                                return;
                              }
                              setFormData({
                                title: exp.title,
                                amount: exp.amount.toString(),
                                category: exp.category,
                                date: exp.date ? new Date(exp.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                                description: exp.description || '',
                                paymentMethod: exp.paymentMethod || 'Cash',
                                expenseType: exp.expenseType || 'business'
                              });
                              setEditingId(exp.id);
                              setShowAddModal(true);
                            }}
                            className="text-blue-500 hover:text-blue-700"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => {
                              if (!isOnline) {
                                addToast('Please connect to the internet to perform this action.', 'error');
                                return;
                              }
                              if (window.confirm('Are you sure you want to delete this expenditure?')) {
                                onDeleteExpenditure(exp.id);
                              }
                            }}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FIXED CENTRALIZED MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800">{editingId ? 'Edit Expense' : 'Record New Expense'}</h3>
              <button onClick={() => { setShowAddModal(false); setEditingId(null); }} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
               <div><label className="block text-sm font-medium text-gray-700 mb-1">Title</label><input name="title" type="text" required value={formData.title} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" /></div>
               <div className="grid grid-cols-2 gap-4">
                  <input name="amount" type="number" placeholder="Amount" required value={formData.amount} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                  <input name="date" type="date" required value={formData.date} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
               </div>

               <div>
                   <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Expense Type</label>
                   <div className="flex bg-gray-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, expenseType: 'business' })}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${formData.expenseType === 'business' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        Business (Tax Deductible)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, expenseType: 'personal' })}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${formData.expenseType === 'personal' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        Personal (Not Deductible)
                      </button>
                   </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="flex gap-2">
                    <select name="category" value={formData.category} onChange={handleInputChange} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg outline-none">
                        <option value="">Category...</option>
                        {categories.filter(c => c.type === 'expense').map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                        {!categories.some(c => c.name === 'Rent') && <option value="Rent">Rent</option>}
                        {/* Removed Personal Home Rent as per new Tax Logic */}
                        {!categories.some(c => c.name === 'Utilities') && <option value="Utilities">Utilities</option>}
                        {!categories.some(c => c.name === 'Inventory') && <option value="Inventory">Inventory</option>}
                        {!categories.some(c => c.name === 'Withholding Tax (WHT)') && <option value="Withholding Tax (WHT)">Withholding Tax (WHT)</option>}
                        {!categories.some(c => c.name === 'Other') && <option value="Other">Other</option>}
                    </select>
                    <button
                        type="button"
                        onClick={() => setIsCategoryManagerOpen(true)}
                        className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                        title="Manage Categories"
                    >
                        <Settings size={18} />
                    </button>
                 </div>
                 <select name="paymentMethod" value={formData.paymentMethod} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"><option value="Cash">Cash</option><option value="Bank Transfer">Bank Transfer</option></select>
               </div>
               <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => { setShowAddModal(false); setEditingId(null); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editingId ? 'Update' : 'Save'}</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Manager */}
      <CategoryManager
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
        categories={categories}
        setCategories={setCategories}
        isOnline={isOnline}
        mode="expense"
      />
    </div>
  );
};

export default ExpenditureScreen;
