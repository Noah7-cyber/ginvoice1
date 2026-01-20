
import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Trash2, 
  Edit3, 
  Calendar,
  Tag,
  User, 
  ArrowRight, 
  Download, 
  Eye, 
  X, 
  Save, 
  FileText,
  Users,
  Receipt,
  Phone,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { Transaction, BusinessProfile } from '../types';
import { CURRENCY } from '../constants';
import InvoicePreview from './InvoicePreview';
import { useToast } from './ToastProvider';
import api from '../services/api';

interface HistoryScreenProps {
  transactions: Transaction[];
  business: BusinessProfile;
  onDeleteTransaction: (id: string, restockItems: boolean) => void;
  onUpdateTransaction: (transaction: Transaction) => void;
  isSubscriptionExpired?: boolean;
  onRenewSubscription?: () => void;
  isReadOnly?: boolean;
  isOnline: boolean;
  initialParams?: { id?: string };
}

type ViewMode = 'invoices' | 'debtors';

const HistoryScreen: React.FC<HistoryScreenProps> = ({ transactions, business, onDeleteTransaction, onUpdateTransaction, isSubscriptionExpired, onRenewSubscription, isReadOnly, isOnline, initialParams }) => {
  const { addToast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>('invoices');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmountPaid, setEditAmountPaid] = useState<number>(0);
  const [editCustomerName, setEditCustomerName] = useState<string>('');
  const [selectedInvoice, setSelectedInvoice] = useState<Transaction | null>(null);

  // Sync with URL Params
  useEffect(() => {
    if (initialParams?.id) {
       const tx = transactions.find(t => t.id === initialParams.id);
       if (tx) {
         setSelectedInvoice(tx);
       }
    } else {
        const currentPath = window.location.pathname;
        const hasDeepLink = currentPath.split('/').length > 2; // e.g. /history/123

        if (selectedInvoice && !hasDeepLink) {
             setSelectedInvoice(null);
        }
    }
  }, [initialParams, transactions]);

  const updateUrlForInvoice = (id: string | null) => {
      if (id) {
          window.history.pushState(null, '', `/history/${id}`);
      } else {
          window.history.pushState(null, '', `/history`);
      }
  };

  // Modal State for Delete
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [shouldRestock, setShouldRestock] = useState(true);

  const filteredInvoices = transactions.filter(t => {
    const matchesSearch = t.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.id.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesDate = true;
    if (startDate) {
        matchesDate = matchesDate && new Date(t.transactionDate) >= new Date(startDate);
    }
    if (endDate) {
        // End of day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && new Date(t.transactionDate) <= end;
    }

    return matchesSearch && matchesDate;
  });

  // Aggregated Debtors Ledger
  const debtorsLedger = useMemo(() => {
    const map = new Map<string, { totalOwed: number, invoiceCount: number, lastTxDate: string, transactions: Transaction[], phone?: string }>();
    
    transactions.forEach(t => {
      if (t.balance > 0) {
        const existing = map.get(t.customerName) || { totalOwed: 0, invoiceCount: 0, lastTxDate: t.transactionDate, transactions: [], phone: t.customerPhone };
        existing.totalOwed += t.balance;
        existing.invoiceCount += 1;
        if (new Date(t.transactionDate) > new Date(existing.lastTxDate)) {
          existing.lastTxDate = t.transactionDate;
        }
        existing.transactions.push(t);
        if (!existing.phone && t.customerPhone) existing.phone = t.customerPhone;
        map.set(t.customerName, existing);
      }
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => b.totalOwed - a.totalOwed);
  }, [transactions, searchTerm]);

  const handleEditClick = (t: Transaction) => {
    if (!isOnline) {
      addToast('Please connect to the internet to perform this action.', 'error');
      return;
    }
    setEditingId(t.id);
    setEditAmountPaid(t.amountPaid);
    setEditCustomerName(t.customerName);
  };

  const handleSaveEdit = (t: Transaction) => {
    if (!isOnline) {
      addToast('Please connect to the internet to perform this action.', 'error');
      return;
    }
    onUpdateTransaction({
      ...t,
      customerName: editCustomerName,
      amountPaid: editAmountPaid,
      balance: Math.max(0, t.totalAmount - editAmountPaid)
    });
    setEditingId(null);
  };

  const handleDeleteRequest = (t: Transaction) => {
     if (!isOnline) {
      addToast('Please connect to the internet to perform this action.', 'error');
      return;
    }
    setTransactionToDelete(t);
    setShouldRestock(true); // Default to true
  };

  const confirmDelete = async () => {
    if (!transactionToDelete) return;

    setIsDeleting(true);
    try {
      // Call Backend to Delete (Pass restock param)
      // @ts-ignore
      await api.delete(`/transactions/${transactionToDelete.id}?restock=${shouldRestock}`);

      // Update local state to remove it from UI immediately
      // Passing shouldRestock to trigger the optimistic stock update in App.tsx if needed
      onDeleteTransaction(transactionToDelete.id, shouldRestock);

      const msg = shouldRestock ? 'Transaction deleted and stock restored' : 'Transaction deleted (Stock NOT restored)';
      addToast(msg, 'success');
      setTransactionToDelete(null);
    } catch (e) {
      console.error(e);
      addToast('Failed to delete. You might be offline.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {isSubscriptionExpired && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={40} className="text-red-500" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-gray-900">Subscription Expired</h2>
                <p className="text-gray-500 font-medium text-sm leading-relaxed">
                  Your free trial has ended. Please renew your subscription to continue managing your business effectively.
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-left space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-medium">Plan</span>
                  <span className="font-bold text-gray-900">Professional Monthly</span>
                </div>
                <div className="pt-3 border-t flex justify-between items-center">
                  <span className="font-black text-gray-900">Amount Due</span>
                  <span className="font-black text-xl text-primary">{CURRENCY}2,000</span>
                </div>
              </div>

              <button
                onClick={onRenewSubscription}
                className="w-full py-4 bg-primary text-white rounded-xl font-black text-lg shadow-xl shadow-indigo-200 hover:opacity-90 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                Pay Subscription Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header & View Toggle */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales & Debtors</h1>
          <p className="text-gray-500">See past sales and who owes you money</p>
          
          <div className="flex p-1 bg-gray-100 rounded-xl mt-4 w-fit border shadow-inner">
            <button 
              onClick={() => setViewMode('invoices')}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                viewMode === 'invoices' ? 'bg-white shadow-md text-primary' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Receipt size={16} /> All Invoices
            </button>
            <button 
              onClick={() => setViewMode('debtors')}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                viewMode === 'debtors' ? 'bg-white shadow-md text-red-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users size={16} /> Debtors List
            </button>
          </div>
        </div>

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text"
            placeholder={viewMode === 'invoices' ? "Search invoice or customer..." : "Search debtor name..."}
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-primary outline-none shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Date Filters */}
      {viewMode === 'invoices' && (
        <div className="flex gap-4 items-center bg-white p-3 rounded-xl border w-fit">
            <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500 uppercase">From</span>
                <input
                    type="date"
                    className="bg-gray-50 border rounded-lg px-2 py-1 text-sm font-bold text-gray-700"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                />
            </div>
            <ArrowRight size={16} className="text-gray-300" />
            <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500 uppercase">To</span>
                <input
                    type="date"
                    className="bg-gray-50 border rounded-lg px-2 py-1 text-sm font-bold text-gray-700"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                />
            </div>
            {(startDate || endDate) && (
                <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-xs font-bold text-red-500 hover:underline ml-2">Clear</button>
            )}
        </div>
      )}

      {/* Main List */}
      <div className="grid gap-4">
        {viewMode === 'invoices' ? (
          // Invoices View
          filteredInvoices.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-dashed flex flex-col items-center justify-center text-gray-400">
              <Calendar size={48} className="mb-4 opacity-20" />
              <p>No transactions found</p>
            </div>
          ) : (
            filteredInvoices.map(t => (
              <div key={t.id} className="bg-white p-6 rounded-2xl shadow-sm border group hover:shadow-md transition-all">
                <div className="flex flex-col lg:flex-row justify-between gap-6">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                          {t.customerName[0].toUpperCase()}
                        </div>
                        <div>
                          {editingId === t.id ? (
                            <input
                              type="text"
                              className="w-full px-2 py-1 bg-gray-50 border rounded text-sm font-bold focus:ring-1 focus:ring-indigo-500 outline-none"
                              value={editCustomerName}
                              onChange={(e) => setEditCustomerName(e.target.value)}
                            />
                          ) : (
                            <h3 className="font-bold text-gray-900">{t.customerName}</h3>
                          )}
                          <p className="text-xs text-gray-400">ID: {t.id} • {new Date(t.transactionDate).toLocaleDateString()}</p>
                        </div>
                      </div>

                      {/* Discount Badge */}
                      {(t.globalDiscount > 0 || t.items.some(i => i.discount > 0)) && (
                          <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-yellow-50 text-yellow-700 rounded-lg border border-yellow-100 self-center">
                              <Tag size={12} />
                              <span className="text-[10px] font-bold uppercase">Discount Applied</span>
                          </div>
                      )}

                      <div className="lg:hidden text-right">
                         <p className="text-lg font-black">{CURRENCY}{t.totalAmount.toLocaleString()}</p>
                         <p className={`text-[10px] font-bold uppercase ${t.balance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                           {t.balance > 0 ? 'Owe Balance' : 'Fully Paid'}
                         </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {t.items.map((item, idx) => (
                        <span key={idx} className="px-2 py-1 bg-gray-50 border rounded-lg text-xs font-medium text-gray-600">
                          {item.quantity}x {item.productName}
                        </span>
                      ))}
                       {/* Mobile Discount Badge */}
                       {(t.globalDiscount > 0 || t.items.some(i => i.discount > 0)) && (
                          <div className="sm:hidden flex items-center gap-1 px-2 py-1 bg-yellow-50 text-yellow-700 rounded-lg border border-yellow-100">
                              <Tag size={12} />
                              <span className="text-[10px] font-bold uppercase">Discount</span>
                          </div>
                      )}
                    </div>
                  </div>

                  <div className="hidden lg:flex flex-col items-end justify-center px-8 border-x space-y-1 min-w-[200px]">
                    <p className="text-sm font-medium text-gray-500">Total Bill</p>
                    <p className="text-2xl font-black text-gray-900">{CURRENCY}{t.totalAmount.toLocaleString()}</p>
                  </div>

                  <div className="flex flex-col justify-center space-y-4 min-w-[220px]">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 font-medium">Paid:</span>
                        {editingId === t.id ? (
                          <input 
                            type="number"
                            autoFocus
                            className="w-24 px-2 py-1 bg-gray-50 border rounded text-right font-bold focus:ring-1 focus:ring-indigo-500 outline-none"
                            value={editAmountPaid}
                            onChange={(e) => setEditAmountPaid(Number(e.target.value))}
                          />
                        ) : (
                          <span className="font-bold text-green-600">{CURRENCY}{t.amountPaid.toLocaleString()}</span>
                        )}
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 font-medium">Balance:</span>
                        <span className={`font-black ${t.balance > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                          {CURRENCY}{(editingId === t.id ? Math.max(0, t.totalAmount - editAmountPaid) : t.balance).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end">
                      {editingId === t.id ? (
                        <>
                          <button onClick={() => handleSaveEdit(t)} className="p-2 bg-green-600 text-white rounded-lg font-bold"><Save size={16} /></button>
                          <button onClick={() => setEditingId(null)} className="p-2 bg-gray-100 text-gray-600 rounded-lg"><X size={16} /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setSelectedInvoice(t); updateUrlForInvoice(t.id); }} className="p-2 text-indigo-600 bg-indigo-50 rounded-lg"><FileText size={18} /></button>
                          {!isReadOnly && (
                            <>
                              <button onClick={() => handleEditClick(t)} className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg"><Edit3 size={18} /></button>
                              <button onClick={() => handleDeleteRequest(t)} className="p-2 text-gray-400 hover:text-red-600 rounded-lg"><Trash2 size={18} /></button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )
        ) : (
          // Debtors Ledger View
          debtorsLedger.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-dashed flex flex-col items-center justify-center text-gray-400 text-center">
              <CheckCircle2 size={48} className="mb-4 text-emerald-300" />
              <h3 className="font-bold text-gray-900 text-lg">No Debts Recorded</h3>
              <p>Excellent! All your customers are currently up to date.</p>
            </div>
          ) : (
            debtorsLedger.map(debtor => (
              <div key={debtor.name} className="bg-white p-6 rounded-2xl shadow-sm border-l-8 border-l-red-500 border group hover:shadow-lg transition-all">
                <div className="flex flex-col md:flex-row justify-between gap-6 items-center">
                  <div className="flex items-center gap-4 flex-1 w-full">
                    <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 font-black text-xl">
                      {debtor.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-black text-gray-900">{debtor.name}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1 font-medium"><Receipt size={14} /> {debtor.invoiceCount} Pending Bills</span>
                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                        <span className="flex items-center gap-1 font-medium"><Calendar size={14} /> Last Activity: {new Date(debtor.lastTxDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end px-6 md:border-x border-gray-100 min-w-[200px]">
                    <div className="flex items-center gap-2 text-red-600 mb-1">
                      <AlertCircle size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Total Debt</span>
                    </div>
                    <p className="text-3xl font-black text-red-600">{CURRENCY}{debtor.totalOwed.toLocaleString()}</p>
                  </div>

                  <div className="flex gap-2 w-full md:w-auto">
                    <button 
                      onClick={() => {
                        setSearchTerm(debtor.name);
                        setViewMode('invoices');
                      }}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all active:scale-95"
                    >
                      <Eye size={18} /> View Bills
                    </button>
                    <button
                      onClick={() => {
                        if (debtor.phone) {
                          window.location.href = `tel:${debtor.phone}`;
                        } else {
                          addToast('No phone number saved for this customer.', 'error');
                        }
                      }}
                      className="p-3 text-emerald-600 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-all border border-emerald-100"
                    >
                      <Phone size={20} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )
        )}
      </div>

      {selectedInvoice && (
        <InvoicePreview 
          transaction={selectedInvoice} 
          business={business} 
          onClose={() => { setSelectedInvoice(null); updateUrlForInvoice(null); }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {transactionToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm scale-100 transform transition-all">
            <div className="flex justify-between items-start mb-4">
               <div className="bg-red-50 p-3 rounded-full">
                  <AlertCircle size={24} className="text-red-600" />
               </div>
               <button onClick={() => setTransactionToDelete(null)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>

            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Transaction?</h3>
            <p className="text-sm text-gray-500 mb-4">
              This action cannot be undone.
            </p>

             {/* Restock Checkbox */}
             <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl mb-6">
                <input
                  type="checkbox"
                  id="restock"
                  className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                  checked={shouldRestock}
                  onChange={(e) => setShouldRestock(e.target.checked)}
                />
                <label htmlFor="restock" className="text-sm font-bold text-gray-700 cursor-pointer select-none">
                  Return items to stock?
                </label>
             </div>

            <div className="flex gap-3">
              <button
                onClick={() => setTransactionToDelete(null)}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200 flex items-center justify-center gap-2"
              >
                {isDeleting ? 'Deleting...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default HistoryScreen;
