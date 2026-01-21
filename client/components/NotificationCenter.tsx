import React, { useState, useMemo, useEffect } from 'react';
import { Bell, X, FileText, AlertTriangle, AlertCircle, Trash2 } from 'lucide-react';
import { Transaction, Product, BusinessProfile, ActivityLog } from '../types';
import { CURRENCY } from '../constants';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[]; // Kept for legacy/reference
  activities: ActivityLog[];
  products: Product[];
  business: BusinessProfile;
  lowStockThreshold: number;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  transactions,
  activities = [],
  products,
  business,
  lowStockThreshold
}) => {
  const [activeTab, setActiveTab] = useState<'transactions' | 'system'>('transactions');

  // Derive Recent Activity
  const recentActivity = useMemo(() => {
    return [...activities]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20)
      .map(log => {
        const timeDiff = Math.floor((Date.now() - new Date(log.timestamp).getTime()) / 60000); // minutes
        let timeDisplay = `${timeDiff} mins ago`;
        if (timeDiff >= 60) {
            const hours = Math.floor(timeDiff / 60);
            timeDisplay = `${hours} hour${hours > 1 ? 's' : ''} ago`;
            if (hours >= 24) {
                const days = Math.floor(hours / 24);
                timeDisplay = `${days} day${days > 1 ? 's' : ''} ago`;
            }
        }

        let title = log.title;
        let subtext = log.description;

        // Enhance Sales logs
        if (log.type === 'sale') {
           const role = log.actor === 'owner' ? 'Owner' : 'Staff';
           subtext = `${subtext} • Sold by ${role}`;
        }

        return {
          id: log.id,
          title,
          subtext,
          time: timeDisplay,
          type: log.type
        };
      });
  }, [activities]);

  // Derive Low Stock & System Alerts
  const systemAlerts = useMemo(() => {
    const alerts = products
      .filter(p => p.currentStock < lowStockThreshold)
      .map(p => ({
        id: p.id,
        title: 'Low Stock Alert',
        body: `${p.name} (Only ${p.currentStock} ${p.baseUnit} left)`,
        type: 'warning' as const
      }));

    // Trial Expiry Check
    if (!business.isSubscribed && business.trialEndsAt) {
        const daysLeft = Math.ceil((new Date(business.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

        if (daysLeft <= 7 && daysLeft >= 0) {
             alerts.unshift({
                 id: 'trial-expiry-urgent',
                 title: 'Subscription Expiring Soon',
                 body: `You have ${daysLeft} days left. Verify payment to renew.`,
                 type: 'urgent' as const
             });
        }
    }

    return alerts;
  }, [products, lowStockThreshold, business]);

  // Effect to mark trial as seen when opened
  React.useEffect(() => {
      if (isOpen && activeTab === 'system') {
          // Check if trial alert is present
          const hasTrial = systemAlerts.some(a => a.id === 'trial-expiry');
          if (hasTrial) {
              localStorage.setItem('ginvoice_trial_notified_date', new Date().toDateString());
              // Force update? No, App.tsx handles the badge based on storage.
              // We might need to trigger a re-render in parent or dispatch event,
              // but since App.tsx renders this, interacting here won't immediately clear parent badge
              // unless we use a callback or context.
              // For now, the next render/interaction will clear the badge.
          }
      }
  }, [isOpen, activeTab, systemAlerts]);

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
             recentActivity.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-4">No recent activity.</p>
             ) : (
                recentActivity.map((item) => (
                <div key={item.id} className="flex gap-3 p-3 bg-white border rounded-xl hover:bg-gray-50 transition-colors group relative">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.type === 'delete' ? 'bg-red-50' : 'bg-green-50'}`}>
                        {item.type === 'delete' ? <Trash2 size={18} className="text-red-600" /> : <FileText size={18} className="text-green-600" />}
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
              systemAlerts.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-4">System is healthy.</p>
              ) : (
                systemAlerts.map((item) => (
                    <div key={item.id} className={`flex gap-3 p-3 bg-white border rounded-xl hover:bg-gray-50 transition-colors ${item.type === 'urgent' ? 'border-red-200 bg-red-50/30' : ''}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.type === 'urgent' ? 'bg-red-100' : item.type === 'warning' ? 'bg-orange-50' : 'bg-blue-50'}`}>
                        {item.type === 'urgent' ? <AlertCircle size={18} className="text-red-600" /> : <AlertTriangle size={18} className="text-orange-600" />}
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-start">
                        <h4 className="text-sm font-black text-gray-900">{item.title}</h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${item.type === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                            {item.type === 'urgent' ? 'Urgent' : 'Action'}
                        </span>
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
