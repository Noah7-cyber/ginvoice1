import React, { useState, useMemo, useEffect } from 'react';
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
  CheckCircle2,
  Plus,
  Minus,
  ShoppingBag
} from 'lucide-react';
import { Transaction, BusinessProfile, Product, SaleItem, ProductUnit } from '../types';
import { CURRENCY } from '../constants';
import InvoicePreview from './InvoicePreview';
import { useToast } from './ToastProvider';
import api, { settleTransaction } from '../services/api';
import { formatCurrency } from '../utils/currency';

interface HistoryScreenProps {
  transactions: Transaction[];
  products: Product[];
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

const HistoryScreen: React.FC<HistoryScreenProps> = ({ transactions, products, business, onDeleteTransaction, onUpdateTransaction, isSubscriptionExpired, onRenewSubscription, isReadOnly, isOnline, initialParams }) => {
  const { addToast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>('invoices');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Edit State
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

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
        const hasDeepLink = currentPath.split('/').length > 2;

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

  const [expandedDebtor, setExpandedDebtor] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);

  const filteredInvoices = useMemo(() => transactions.filter(t => {
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
  }), [transactions, searchTerm, startDate, endDate]);

  const visibleInvoices = useMemo(() => filteredInvoices.slice(0, visibleCount), [filteredInvoices, visibleCount]);

  useEffect(() => {
      setVisibleCount(50);
  }, [searchTerm, startDate, endDate]);

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
    setEditingTransaction(t);
  };

  const handleDeleteRequest = (t: Transaction) => {
     if (!isOnline) {
      addToast('Please connect to the internet to perform this action.', 'error');
      return;
    }
    setTransactionToDelete(t);
    setShouldRestock(true);
  };

  const confirmDelete = async () => {
    if (!transactionToDelete) return;

    setIsDeleting(true);
    try {
      // @ts-ignore
      await api.delete(`/transactions/${transactionToDelete.id}?restock=${shouldRestock}`);
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

  const handleSaveEdit = async (updatedTx: Transaction) => {
    // Optimistic Update handled by parent logic via onUpdateTransaction
    // But we should probably call API here first?
    // The parent onUpdateTransaction does: pushToBackend({ transactions: [t] })
    // We should call the PUT endpoint specifically for the "Smart Edit" logic (restock/destock).
    // The generic pushToBackend might simply overwrite.
    // So we must use api.put directly.

    try {
       // @ts-ignore
       const res = await api.put(`/transactions/${updatedTx.id}`, updatedTx);
       // Result should be the updated transaction from backend (with recalculated totals)
       if (res) {
          onUpdateTransaction(res); // Update local state
          addToast('Transaction updated successfully', 'success');
          setEditingTransaction(null);
       }
    } catch (error) {
       console.error("Edit failed", error);
       addToast("Failed to update transaction", "error");
    }
  };

  const handleSettle = async (t: Transaction) => {
      if (!isOnline) {
          addToast('Online connection required to settle debt.', 'error');
          return;
      }

      // Optimistic Update
      const updatedTx = { ...t, balance: 0, amountPaid: t.totalAmount, paymentStatus: 'paid' as const };
      onUpdateTransaction(updatedTx);
      addToast('Debt marked as paid!', 'success');

      try {
          await settleTransaction(t.id);
      } catch (err) {
          console.error(err);
          addToast('Failed to sync payment status.', 'error');
      }
  };

  const handleSettleDebtor = async (debtorTransactions: Transaction[]) => {
      if (!isOnline) {
          addToast('Online connection required to settle debt.', 'error');
          return;
      }

      if (!confirm(`Mark all debts for this customer as paid?`)) return;

      // Optimistic Update Loop
      debtorTransactions.forEach(t => {
         const updatedTx = { ...t, balance: 0, amountPaid: t.totalAmount, paymentStatus: 'paid' as const };
         onUpdateTransaction(updatedTx);
      });
      addToast('All debts marked as paid!', 'success');

      try {
          // Sequential Settle (to avoid race conditions or complex bulk API)
          for (const t of debtorTransactions) {
             await settleTransaction(t.id);
          }
      } catch (err) {
          console.error(err);
          addToast('Failed to sync some payments.', 'error');
      }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
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
            <>
            {visibleInvoices.map(t => (
              <div key={t.id} className="bg-white p-6 rounded-2xl shadow-sm border group hover:shadow-md transition-all">
                <div className="flex flex-col lg:flex-row justify-between gap-6">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                          {t.customerName[0].toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">{t.customerName}</h3>
                          <p className="text-xs text-gray-400">
                            ID: {t.id} • {new Date(t.transactionDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} • {new Date(t.transactionDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                          </p>
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
                        <span className="font-bold text-green-600">{CURRENCY}{t.amountPaid.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 font-medium">Balance:</span>
                        <span className={`font-black ${t.balance > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                          {CURRENCY}{t.balance.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setSelectedInvoice(t); updateUrlForInvoice(t.id); }} className="p-2 text-indigo-600 bg-indigo-50 rounded-lg"><FileText size={18} /></button>
                      {!isReadOnly && (
                        <>
                          <button onClick={() => handleEditClick(t)} className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg"><Edit3 size={18} /></button>
                          <button onClick={() => handleDeleteRequest(t)} className="p-2 text-gray-400 hover:text-red-600 rounded-lg"><Trash2 size={18} /></button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {filteredInvoices.length > visibleCount && (
                <button
                  onClick={() => setVisibleCount(prev => prev + 50)}
                  className="w-full py-4 bg-gray-50 text-gray-600 font-bold rounded-2xl border border-dashed hover:bg-gray-100 transition-colors"
                >
                    Load More Invoices ({filteredInvoices.length - visibleCount} remaining)
                </button>
            )}
            </>
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
              <div key={debtor.name} className="bg-white rounded-2xl shadow-sm border-l-8 border-l-red-500 border group hover:shadow-lg transition-all overflow-hidden">
                <div
                  className="p-6 flex flex-col md:flex-row justify-between gap-6 items-center cursor-pointer"
                  onClick={() => setExpandedDebtor(expandedDebtor === debtor.name ? null : debtor.name)}
                >
                  <div className="flex items-center gap-4 flex-1 w-full">
                    <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 font-black text-xl">
                      {debtor.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                        {debtor.name}
                        <span className="text-gray-400 text-xs">{expandedDebtor === debtor.name ? '▲' : '▼'}</span>
                      </h3>
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
                      onClick={(e) => {
                        e.stopPropagation();
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

                {/* EXPANDED DRILL-DOWN VIEW */}
                {expandedDebtor === debtor.name && (
                   <div className="bg-gray-50 border-t p-4 space-y-3 animate-in slide-in-from-top-2">
                       <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-2">Unpaid Invoices</h4>
                       {debtor.transactions.map(tx => (
                           <div key={tx.id} className="flex items-center justify-between bg-white p-3 rounded-xl border shadow-sm">
                               <div className="flex items-center gap-3">
                                   <div className="bg-gray-100 p-2 rounded-lg text-gray-500 font-mono text-xs font-bold">
                                       #{tx.id.slice(-4)}
                                   </div>
                                   <div>
                                       <p className="text-sm font-bold text-gray-900">
                                            {new Date(tx.transactionDate).toLocaleDateString()}
                                       </p>
                                       <p className="text-xs text-gray-500">
                                           {tx.items.length} items • Total: {CURRENCY}{tx.totalAmount.toLocaleString()}
                                       </p>
                                   </div>
                               </div>
                               <div className="flex items-center gap-4">
                                   <div className="text-right">
                                       <p className="text-xs font-bold text-gray-400 uppercase">Owed</p>
                                       <p className="text-sm font-black text-red-600">{CURRENCY}{tx.balance.toLocaleString()}</p>
                                   </div>
                                   <div className="flex gap-2">
                                       <button
                                          onClick={() => { setSelectedInvoice(tx); updateUrlForInvoice(tx.id); }}
                                          className="p-2 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-200 hover:bg-indigo-100"
                                          title="View Bill"
                                       >
                                           <Eye size={18} />
                                       </button>
                                       {!isReadOnly && (
                                           <button
                                              onClick={() => handleSettle(tx)}
                                              className="p-2 bg-green-50 text-green-600 rounded-lg border border-green-200 hover:bg-green-100"
                                              title="Mark Paid"
                                           >
                                               <CheckCircle2 size={18} />
                                           </button>
                                       )}
                                   </div>
                               </div>
                           </div>
                       ))}

                       <div className="flex justify-end pt-2">
                           {!isReadOnly && (
                               <button
                                  onClick={() => handleSettleDebtor(debtor.transactions)}
                                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-bold text-xs hover:bg-black transition-all"
                               >
                                  <CheckCircle2 size={14} /> Settle All ({debtor.transactions.length})
                               </button>
                           )}
                       </div>
                   </div>
                )}
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
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
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

      {/* EDIT MODAL */}
      {editingTransaction && (
         <EditTransactionModal
            transaction={editingTransaction}
            products={products}
            onClose={() => setEditingTransaction(null)}
            onSave={handleSaveEdit}
         />
      )}

    </div>
  );
};

// --- Subcomponent: Edit Modal ---
interface EditModalProps {
   transaction: Transaction;
   products: Product[];
   onClose: () => void;
   onSave: (t: Transaction) => void;
}

const EditTransactionModal: React.FC<EditModalProps> = ({ transaction, products, onClose, onSave }) => {
   const [items, setItems] = useState<SaleItem[]>([...transaction.items]);
   const [customerName, setCustomerName] = useState(transaction.customerName);
   const [amountPaid, setAmountPaid] = useState(transaction.amountPaid);
   const [globalDiscount, setGlobalDiscount] = useState(transaction.globalDiscount || 0);
   const [isSubmitting, setIsSubmitting] = useState(false);

   // Product Search State
   const [isAddingItem, setIsAddingItem] = useState(false);
   const [searchTerm, setSearchTerm] = useState('');

   // Recalculate Totals
   const subtotal = items.reduce((sum, item) => sum + item.total, 0);
   const totalAmount = Math.max(0, subtotal - globalDiscount);
   const balance = Math.max(0, totalAmount - amountPaid);

   const updateQuantity = (index: number, delta: number) => {
      setItems(prev => {
         const newItems = [...prev];
         const item = newItems[index];
         const newQty = Math.max(1, item.quantity + delta);
         newItems[index] = { ...item, quantity: newQty, total: (newQty * item.unitPrice) - item.discount };
         return newItems;
      });
   };

   const removeItem = (index: number) => {
      setItems(prev => prev.filter((_, i) => i !== index));
   };

   const addItem = (p: Product) => {
      const newItem: SaleItem = {
         cartId: crypto.randomUUID(),
         productId: p.id,
         productName: p.name,
         quantity: 1,
         unitPrice: p.sellingPrice,
         discount: 0,
         total: p.sellingPrice
      };
      setItems(prev => [...prev, newItem]);
      setIsAddingItem(false);
      setSearchTerm('');
   };

   const handleSave = () => {
      setIsSubmitting(true);
      const updated: Transaction = {
         ...transaction,
         items,
         customerName,
         amountPaid,
         globalDiscount,
         subtotal,
         totalAmount,
         balance
      };
      onSave(updated);
   };

   const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 10);

   return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
         <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
               <h2 className="text-lg font-black flex items-center gap-2">
                  <Edit3 size={18} className="text-primary"/> Edit Sale #{transaction.id.slice(-4)}
               </h2>
               <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-200 rounded-full"><X size={20}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
               {/* Customer Info */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                     <label className="text-xs font-bold text-gray-500 uppercase">Customer Name</label>
                     <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-primary outline-none"
                     />
                  </div>
                  <div className="space-y-1">
                     <label className="text-xs font-bold text-gray-500 uppercase">Amount Paid</label>
                     <input
                        type="number"
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-primary outline-none"
                     />
                  </div>
               </div>

               {/* Items List */}
               <div className="space-y-2">
                  <div className="flex justify-between items-center">
                     <label className="text-xs font-bold text-gray-500 uppercase">Items Purchased</label>
                     <button
                        onClick={() => setIsAddingItem(true)}
                        className="text-xs font-bold text-primary flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-lg hover:bg-indigo-100"
                     >
                        <Plus size={12}/> Add Item
                     </button>
                  </div>

                  {isAddingItem && (
                     <div className="mb-4 bg-gray-50 p-3 rounded-xl border animate-in slide-in-from-top-2">
                        <div className="relative mb-2">
                           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                           <input
                              type="text"
                              autoFocus
                              placeholder="Search product to add..."
                              className="w-full pl-9 pr-3 py-2 rounded-lg border focus:ring-2 focus:ring-primary outline-none text-sm"
                              value={searchTerm}
                              onChange={e => setSearchTerm(e.target.value)}
                           />
                           <button onClick={() => setIsAddingItem(false)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"><X size={16}/></button>
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                           {filteredProducts.map(p => (
                              <button
                                 key={p.id}
                                 onClick={() => addItem(p)}
                                 className="w-full flex justify-between items-center p-2 hover:bg-white rounded-lg text-sm text-left group"
                              >
                                 <span className="font-bold text-gray-700">{p.name}</span>
                                 <span className="text-primary font-bold">{CURRENCY}{p.sellingPrice.toLocaleString()}</span>
                              </button>
                           ))}
                           {filteredProducts.length === 0 && <p className="text-xs text-center text-gray-400 py-2">No products found</p>}
                        </div>
                     </div>
                  )}

                  <div className="space-y-2">
                     {items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                           <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-800 truncate">{item.productName}</p>
                              <p className="text-[10px] text-gray-400">{CURRENCY}{item.unitPrice.toLocaleString()} / unit</p>
                           </div>
                           <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
                                 <button onClick={() => updateQuantity(idx, -1)} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 hover:text-primary"><Minus size={12}/></button>
                                 <span className="text-xs font-black w-4 text-center">{item.quantity}</span>
                                 <button onClick={() => updateQuantity(idx, 1)} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 hover:text-primary"><Plus size={12}/></button>
                              </div>
                              <div className="text-right w-16">
                                 <p className="font-bold text-sm">{CURRENCY}{item.total.toLocaleString()}</p>
                              </div>
                              <button onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-500"><Trash2 size={16}/></button>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>

               {/* Summary */}
               <div className="bg-gray-50 p-4 rounded-xl space-y-2 text-sm">
                  <div className="flex justify-between text-gray-500">
                     <span>Subtotal</span>
                     <span className="font-bold">{CURRENCY}{subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-500 items-center">
                     <span>Global Discount</span>
                     <input
                        type="number"
                        value={globalDiscount}
                        onChange={e => setGlobalDiscount(Number(e.target.value))}
                        className="w-20 px-2 py-1 text-right border rounded font-bold outline-none focus:border-primary"
                     />
                  </div>
                  <div className="flex justify-between text-gray-900 pt-2 border-t border-gray-200">
                     <span className="font-black">Total Amount</span>
                     <span className="font-black text-lg">{CURRENCY}{totalAmount.toLocaleString()}</span>
                  </div>
                   <div className="flex justify-between text-gray-500 pt-1">
                     <span>Balance Due</span>
                     <span className={`font-black ${balance > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{CURRENCY}{balance.toLocaleString()}</span>
                  </div>
               </div>

            </div>

            <div className="p-4 border-t bg-white shrink-0 flex gap-3">
               <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200">Cancel</button>
               <button
                  onClick={handleSave}
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50"
               >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
               </button>
            </div>
         </div>
      </div>
   );
};

export default HistoryScreen;
