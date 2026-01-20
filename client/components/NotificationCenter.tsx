import React, { useState, useMemo } from 'react';
import { Bell, X, FileText, AlertTriangle, AlertCircle } from 'lucide-react';
import { Transaction, Product } from '../types';
import { CURRENCY } from '../constants';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  products: Product[];
  lowStockThreshold: number;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  transactions,
  products,
  lowStockThreshold
}) => {
  const [activeTab, setActiveTab] = useState<'transactions' | 'system'>('transactions');

  // Derive Recent Transactions
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
      .slice(0, 10)
      .map(tx => {
        const timeDiff = Math.floor((Date.now() - new Date(tx.transactionDate).getTime()) / 60000); // minutes
        let timeDisplay = `${timeDiff} mins ago`;
        if (timeDiff >= 60) {
            const hours = Math.floor(timeDiff / 60);
            timeDisplay = `${hours} hour${hours > 1 ? 's' : ''} ago`;
            if (hours >= 24) {
                const days = Math.floor(hours / 24);
                timeDisplay = `${days} day${days > 1 ? 's' : ''} ago`;
            }
        }

        return {
          id: tx.id,
          title: `New Sale: ${CURRENCY}${tx.totalAmount.toLocaleString()}`,
          subtext: `${tx.items.length} items • ${tx.paymentMethod} • Sold by Staff`, // Simplify "Staff" for now
          time: timeDisplay
        };
      });
  }, [transactions]);

  // Derive Low Stock Alerts
  const lowStockAlerts = useMemo(() => {
    return products
      .filter(p => p.currentStock < lowStockThreshold)
      .map(p => ({
        id: p.id,
        title: 'Low Stock Alert',
        body: `${p.name} (Only ${p.currentStock} ${p.baseUnit} left)`,
        type: 'warning' as const
      }));
  }, [products, lowStockThreshold]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex justify-end">
      <div className="w-full max-w-md bg-white h-full shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
         {/* Modal Header */}
         <div className="p-4 border-b flex justify-between items-center bg-gray-50">
           <h2 className="text-lg font-bold flex items-center gap-2">
             <Bell size={20} className="text-indigo-600" /> Notifications
           </h2>
           <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full">
             <X size={24} className="text-gray-500" />
           </button>
         </div>

         {/* Tabs */}
         <div className="flex border-b">
           <button
             onClick={() => setActiveTab('transactions')}
             className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'transactions' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
           >
             Transactions
           </button>
           <button
             onClick={() => setActiveTab('system')}
             className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'system' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
           >
             System
           </button>
         </div>

         {/* Content */}
         <div className="flex-1 overflow-y-auto p-4 space-y-3">
           {activeTab === 'transactions' ? (
             recentTransactions.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-4">No recent transactions.</p>
             ) : (
                recentTransactions.map((item) => (
                <div key={item.id} className="flex gap-3 p-3 bg-white border rounded-xl hover:bg-gray-50 transition-colors group relative">
                    <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                        <FileText size={18} className="text-green-600" />
                    </div>
                    <div className="flex-1">
                        <h4 className="text-sm font-black text-gray-900">{item.title}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">{item.subtext}</p>
                        <span className="absolute bottom-3 right-3 text-[10px] font-bold text-gray-400 group-hover:text-indigo-500">{item.time}</span>
                    </div>
                </div>
                ))
             )
           ) : (
              lowStockAlerts.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-4">System is healthy.</p>
              ) : (
                lowStockAlerts.map((item) => (
                    <div key={item.id} className="flex gap-3 p-3 bg-white border rounded-xl hover:bg-gray-50 transition-colors">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.type === 'warning' ? 'bg-orange-50' : 'bg-blue-50'}`}>
                        <AlertTriangle size={18} className="text-orange-600" />
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-start">
                        <h4 className="text-sm font-black text-gray-900">{item.title}</h4>
                        <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">Action</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{item.body}</p>
                    </div>
                    </div>
                ))
              )
           )}
         </div>

         {/* Footer */}
         <div className="p-4 border-t bg-gray-50">
           <button onClick={onClose} className="w-full py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors shadow-sm">
             View All
           </button>
         </div>
      </div>
    </div>
  );
};

export default NotificationCenter;
