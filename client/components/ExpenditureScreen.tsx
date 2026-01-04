import React, { useState } from 'react';
import { Plus, X, Save, Calendar, DollarSign, Tag, FileText, CreditCard, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '../components/ToastProvider';
// Remove 'api' import - we don't need it anymore!

// Update Interface to match your types.ts
interface Expenditure {
  id: string; // Changed from _id to id for local compatibility
  title: string;
  amount: number;
  category: string;
  date: string;
  description: string;
  paymentMethod: string;
}

interface ExpenditureScreenProps {
  expenditures: Expenditure[];
  onAddExpenditure: (item: Expenditure) => void;
  onDeleteExpenditure: (id: string) => void;
  onEditExpenditure: (item: Expenditure) => void;
}

const ExpenditureScreen: React.FC<ExpenditureScreenProps> = ({ expenditures, onAddExpenditure, onDeleteExpenditure, onEditExpenditure }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { addToast } = useToast();

  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    paymentMethod: 'Cash'
  });

  // Remove fetchExpenditures and useEffect - we use props now!

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Create object locally
      const newExpenditure: Expenditure = {
        id: crypto.randomUUID(), // Client-side ID
        title: formData.title,
        amount: parseFloat(formData.amount),
        category: formData.category,
        date: formData.date,
        description: formData.description,
        paymentMethod: formData.paymentMethod
      };

      // Update Parent State (Local First)
      onAddExpenditure(newExpenditure);

      setShowAddModal(false);
      setFormData({
        title: '',
        amount: '',
        category: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        paymentMethod: 'Cash'
      });

      addToast('Expenditure saved (will sync automatically)', 'success');
    } catch (error) {
      console.error('Error saving expenditure:', error);
      addToast('Failed to save expenditure', 'error');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Expenditures</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Expense
        </button>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(!expenditures || expenditures.length === 0) ? (
                 <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">No expenditures recorded.</td></tr>
              ) : (
                expenditures.map((exp) => (
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
              <h3 className="text-lg font-bold text-gray-800">Record New Expense</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
               <div><label className="block text-sm font-medium text-gray-700 mb-1">Title</label><input name="title" type="text" required value={formData.title} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" /></div>
               <div className="grid grid-cols-2 gap-4">
                  <input name="amount" type="number" placeholder="Amount" required value={formData.amount} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                  <input name="date" type="date" required value={formData.date} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <select name="category" value={formData.category} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"><option value="">Category...</option><option value="Rent">Rent</option><option value="Utilities">Utilities</option><option value="Inventory">Inventory</option><option value="Other">Other</option></select>
                 <select name="paymentMethod" value={formData.paymentMethod} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none"><option value="Cash">Cash</option><option value="Bank Transfer">Bank Transfer</option></select>
               </div>
               <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenditureScreen;
