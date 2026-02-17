import React, { useState, useRef, useEffect } from 'react';
import { Store, Save, RefreshCw, CloudCheck, Upload, Trash2, Image as ImageIcon, MessageSquare, HeadphonesIcon, HelpCircle, Lock, AlertTriangle, X, Ticket, ToggleLeft, ToggleRight, Loader2, CreditCard, ShieldCheck, CheckCircle2, Palette, Database, Download, Printer } from 'lucide-react';
import { BusinessProfile, DiscountCode } from '../types';
import { THEME_COLORS, FONTS } from '../constants';
import { changeBusinessPins, deleteAccount, uploadFile, updateSettings, generateDiscountCode, verifyPayment, getEntitlements, cancelSubscription, pauseSubscription, resumeSubscription, exportBusinessData } from '../services/api';
import api from '../services/api';
import SupportBot from './SupportBot';
import { useToast } from './ToastProvider';
import { loadState } from '../services/storage';

interface SettingsScreenProps {
  business: BusinessProfile;
  onUpdateBusiness: (profile: BusinessProfile) => void;
  onManualSync?: () => void;
  lastSyncedAt?: string;
  isSyncing?: boolean;
  onLogout?: () => void;
  onDeleteAccount?: () => void;
  isOnline: boolean;
  onSubscribe?: () => void;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ business, onUpdateBusiness, onManualSync, lastSyncedAt, isSyncing, onLogout, onDeleteAccount, isOnline, onSubscribe }) => {
  const { addToast } = useToast();
  const [formData, setFormData] = useState<BusinessProfile>(business);
  const [showSaved, setShowSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'shop' | 'preferences' | 'billing' | 'security' | 'data' | 'help'>('shop');

  // Security State
  const [currentOwnerPin, setCurrentOwnerPin] = useState('');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [newOwnerPin, setNewOwnerPin] = useState('');
  const [securityMsg, setSecurityMsg] = useState('');

  // Delete Account State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmBusinessName, setConfirmBusinessName] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Payment Verification State
  const [paystackReference, setPaystackReference] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isExportingFull, setIsExportingFull] = useState(false);

  // Polling for Subscription Status (Hot Reload)
  const [isPollingSubscription, setIsPollingSubscription] = useState(false);
  const pollCountRef = useRef(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPollingSubscription) {
      pollCountRef.current = 0;
      interval = setInterval(async () => {
        pollCountRef.current += 1;
        if (pollCountRef.current > 15) { // 30 seconds timeout
            setIsPollingSubscription(false);
            return;
        }

        try {
            const data = await getEntitlements();
            if (data.plan === 'PRO') {
                setIsPollingSubscription(false);
                addToast("Welcome to Pro! Subscription active.", "success");

                // Update local business state to reflect change immediately
                const newBusiness = { ...business, isSubscribed: true, subscriptionExpiresAt: data.subscriptionExpiresAt };
                onUpdateBusiness(newBusiness);
                setFormData(prev => ({ ...prev, ...newBusiness }));
            }
        } catch (err) {
            // ignore errors during polling
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isPollingSubscription, addToast, business, onUpdateBusiness]);

  const handleSubscribe = () => {
      if (onSubscribe) onSubscribe();
      setIsPollingSubscription(true);
  };

  // Subscription Management State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isManagingSub, setIsManagingSub] = useState(false);

  const handlePause = async () => {
    if(!confirm("Pause auto-renewal? You will keep access until your current period ends.")) return;
    setIsManagingSub(true);
    try {
       await pauseSubscription();
       addToast("Auto-renewal paused.", "success");
       const newBusiness = { ...business, autoRenew: false, subscriptionStatus: 'non-renewing' };
       onUpdateBusiness(newBusiness as any);
       setFormData(prev => ({ ...prev, ...newBusiness } as any));
    } catch(e) {
       addToast("Failed to pause.", "error");
    } finally {
       setIsManagingSub(false);
    }
  };

  const handleResume = async () => {
    setIsManagingSub(true);
    try {
       await resumeSubscription();
       addToast("Auto-renewal resumed!", "success");
       const newBusiness = { ...business, autoRenew: true, subscriptionStatus: 'active' };
       onUpdateBusiness(newBusiness as any);
       setFormData(prev => ({ ...prev, ...newBusiness } as any));
    } catch(e) {
       addToast("Failed to resume.", "error");
    } finally {
       setIsManagingSub(false);
    }
  };

  const handleCancel = async () => {
      if(!cancelReason) return addToast("Please provide a reason.", "error");
      setIsManagingSub(true);
      try {
          await cancelSubscription(cancelReason);
          addToast("Subscription cancelled.", "success");
          const newBusiness = { ...business, autoRenew: false, subscriptionStatus: 'cancelled' };
          onUpdateBusiness(newBusiness as any);
          setFormData(prev => ({ ...prev, ...newBusiness } as any));
          setShowCancelModal(false);
      } catch(e) {
          addToast("Cancellation failed.", "error");
      } finally {
          setIsManagingSub(false);
      }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpdateBusiness = async (data: Partial<BusinessProfile>) => {
    if (!isOnline) {
      addToast("You must be online to update settings.", "error");
      return;
    }

    setIsLoading(true);
    try {
      await api.put('/settings', data);
      addToast("Business updated successfully!", "success");

      const updatedBusiness = { ...business, ...data };
      setFormData(prev => ({ ...prev, ...data }));
      onUpdateBusiness(updatedBusiness);

      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 3000);
    } catch (e) {
      console.error("Update failed", e);
      addToast("Update failed. Please try again.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveChanges = () => {
     handleUpdateBusiness(formData);
  };

  const hasChanges = JSON.stringify(formData) !== JSON.stringify(business);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 200 * 1024) {
        addToast("Image too large. Max 200KB.", "error");
        return;
      }
      if (!isOnline) {
        addToast('Online required for logo change', 'error');
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      setFormData(prev => ({ ...prev, logo: previewUrl }));

      try {
          const url = await uploadFile(file);
          setFormData(prev => ({ ...prev, logo: url }));
          handleUpdateBusiness({ logo: url });
      } catch (err) {
        addToast('Logo upload failed.', 'error');
        setFormData(prev => ({ ...prev, logo: business.logo }));
      }
    }
  };

  const handleRemoveLogo = async () => {
    if (!confirm('Are you sure you want to remove the logo?')) return;
    await handleUpdateBusiness({ logo: null as any });
  };

  const togglePermission = async (key: string) => {
    if (!isOnline) {
        addToast('You must be online to change permissions.', 'error');
        return;
    }
    const currentPerms = formData.staffPermissions as any || {};
    const newVal = !currentPerms[key];
    const newPermissions = { ...currentPerms, [key]: newVal };

    try {
        await updateSettings(undefined, newPermissions);
        setFormData(prev => ({ ...prev, staffPermissions: newPermissions }));
        onUpdateBusiness({ ...formData, staffPermissions: newPermissions });
    } catch (err) {
        addToast('Failed to update permission.', 'error');
    }
  };

  const handleUpdatePins = async () => {
    if (!isOnline) return setSecurityMsg('Internet connection required');
    if (!currentOwnerPin) return setSecurityMsg('Current Owner PIN required');
    if (!newStaffPin && !newOwnerPin) return setSecurityMsg('Enter at least one new PIN');

    try {
      await changeBusinessPins(currentOwnerPin, newStaffPin || undefined, newOwnerPin || undefined);
      setSecurityMsg('PINs updated successfully');
      setCurrentOwnerPin('');
      setNewStaffPin('');
      setNewOwnerPin('');
      setTimeout(() => setSecurityMsg(''), 3000);
    } catch (err: any) {
      setSecurityMsg(err.message || 'Failed to update PINs');
    }
  };

  const handleDeleteAccount = async () => {
    if (!isOnline) { setDeleteError('Internet connection required'); return; }
    if (confirmBusinessName !== business.name) { setDeleteError('Business name does not match'); return; }

    setIsDeleting(true);
    setDeleteError('');
    try {
      await deleteAccount(confirmBusinessName);
      if (onDeleteAccount) onDeleteAccount();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete account');
      setIsDeleting(false);
    }
  };

  const handleVerifyPayment = async () => {
      if (!paystackReference) return;
      if (!isOnline) {
          addToast('Internet connection required.', 'error');
          return;
      }
      setIsVerifying(true);
      try {
          await verifyPayment(paystackReference);
          addToast('Payment verified successfully! Please refresh.', 'success');
          setPaystackReference('');
      } catch (err: any) {
          addToast(err.message || 'Verification failed.', 'error');
      } finally {
          setIsVerifying(false);
      }
  };

  // Discount Code Modal State
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountForm, setDiscountForm] = useState({ type: 'fixed' as 'fixed' | 'percent', value: 0, scope: 'global' as 'global'|'product' });
  const [generatedCode, setGeneratedCode] = useState<DiscountCode | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateDiscount = async () => {
    if (!isOnline) { addToast('Internet connection required.', 'error'); return; }
    setIsGenerating(true);
    try {
      const code = await generateDiscountCode(discountForm);
      setGeneratedCode(code);
    } catch (err) { addToast('Failed to generate code', 'error'); }
    finally { setIsGenerating(false); }
  };

  const PERMISSION_OPTIONS = [
    { id: 'canGiveDiscount', label: 'Give Discounts', desc: 'Allow staff to apply manual discounts' },
    { id: 'canViewInventory', label: 'View Inventory', desc: 'Access inventory screen' },
    { id: 'canEditInventory', label: 'Manage Stock', desc: 'Add/Edit/Delete products' },
    { id: 'canViewHistory', label: 'View History', desc: 'Access past transactions' },
    { id: 'canEditHistory', label: 'Edit History', desc: 'Delete/Modify past transactions' },
    { id: 'canViewExpenditure', label: 'Expenditures', desc: 'View and manage expenses' },
    { id: 'canViewDashboard', label: 'View Dashboard', desc: 'Access analytics and revenue data' },
  ];

  const TABS = [
      { id: 'shop', label: 'Shop', icon: Store },
      { id: 'preferences', label: 'Preferences', icon: Palette },
      { id: 'billing', label: 'Billing', icon: CreditCard },
      { id: 'security', label: 'Security', icon: ShieldCheck },
      { id: 'data', label: 'Data', icon: Database },
      { id: 'help', label: 'Help', icon: HelpCircle },
  ];

  const handleExport = (type: 'inventory' | 'transactions' | 'expenses') => {
      const state = loadState();
      if (!state) return addToast('No data to export', 'error');

      let headers = '';
      let rows: string[] = [];
      let filename = '';

      if (type === 'inventory') {
          headers = 'Name,Category,Cost Price,Selling Price,Quantity';
          rows = state.products.map(p =>
             `"${p.name}","${p.category}",${p.costPrice},${p.sellingPrice},${p.currentStock}`
          );
          filename = `inventory_${new Date().toISOString().split('T')[0]}.csv`;
      } else if (type === 'transactions') {
          headers = 'Date,Invoice #,Customer Name,Total Amount,Amount Paid,Debt,Status';
          rows = state.transactions.map(t =>
             `"${t.transactionDate}","${t.id}","${t.customerName}",${t.totalAmount},${t.amountPaid},${t.balance},"${t.paymentStatus || (t.balance > 0 ? 'credit' : 'paid')}"`
          );
           filename = `sales_${new Date().toISOString().split('T')[0]}.csv`;
      } else if (type === 'expenses') {
          headers = 'Date,Category,Description,Amount,Type';
          rows = (state.expenditures || []).map(e =>
              `"${e.date}","${e.category}","${e.description || ''}",${e.amount},"${e.flowType === 'in' ? 'Money In' : 'Money Out'}"`
          );
          filename = `expenses_${new Date().toISOString().split('T')[0]}.csv`;
      }

      const csvContent = [headers, ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast(`${type.charAt(0).toUpperCase() + type.slice(1)} exported!`, 'success');
  };


  const handleExportFullBackup = async () => {
      if (!isOnline) {
          addToast('Internet connection required for full backup export.', 'error');
          return;
      }

      setIsExportingFull(true);
      try {
          const payload = await exportBusinessData('full');
          const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `ginvoice_backup_${new Date().toISOString().split('T')[0]}.json`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          if (payload?.meta?.truncated) {
             addToast('Backup exported with size limits. Use date filters for very large history.', 'info');
          } else {
             addToast('Full backup exported successfully!', 'success');
          }
      } catch (err: any) {
          addToast(err?.message || 'Failed to export full backup', 'error');
      } finally {
          setIsExportingFull(false);
      }
  };

  // handleCancelSubscription removed

  return (
    <div className="max-w-4xl mx-auto pb-10 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 text-sm">Manage your store profile and preferences</p>
        </div>
        
        <div className="bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-xl flex items-center gap-3">
          <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs">
             {isSyncing ? <RefreshCw className="animate-spin" size={14} /> : <CloudCheck size={16} />}
             <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Synced'}</span>
          </div>
          <button 
            onClick={onManualSync}
            disabled={isSyncing}
            className="text-[10px] bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            Sync Now
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto pb-2 mb-4 gap-2 shrink-0 no-scrollbar">
          {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
                    activeTab === tab.id
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-white text-gray-500 hover:bg-gray-50 border border-transparent'
                }`}
              >
                  <tab.icon size={18} />
                  {tab.label}
              </button>
          ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto pr-1 pb-24">
          {/* SHOP TAB */}
          {activeTab === 'shop' && (
             <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="bg-white rounded-3xl shadow-sm border p-6 md:p-8 space-y-6">
                    <h2 className="text-lg font-bold flex items-center gap-2"><Store className="text-primary" /> Business Profile</h2>

                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        {/* Logo Uploader */}
                        <div className="flex flex-col items-center gap-3 w-full md:w-auto">
                             <div className="relative group">
                                <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center overflow-hidden">
                                {formData.logo ? (
                                    <img src={formData.logo} alt="Logo" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="flex flex-col items-center text-gray-400">
                                    <ImageIcon size={32} className="mb-2" />
                                    <span className="text-[10px] font-bold">No Logo</span>
                                    </div>
                                )}
                                </div>
                            </div>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                            <div className="flex gap-2">
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black uppercase text-primary bg-indigo-50 px-3 py-2 rounded-lg hover:bg-indigo-100">
                                <Upload size={14} /> Upload
                                </button>
                                {formData.logo && (
                                <button type="button" onClick={handleRemoveLogo} className="text-[10px] font-black uppercase text-red-600 bg-red-50 px-3 py-2 rounded-lg hover:bg-red-100">
                                    <Trash2 size={14} />
                                </button>
                                )}
                            </div>
                        </div>

                        {/* Text Inputs */}
                        <div className="flex-1 space-y-4 w-full">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Business Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                    className="w-full mt-1 px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary outline-none font-bold text-gray-900"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Phone</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={e => setFormData({...formData, phone: e.target.value})}
                                        className="w-full mt-1 px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary outline-none font-bold text-gray-900"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Address</label>
                                    <input
                                        type="text"
                                        value={formData.address}
                                        onChange={e => setFormData({...formData, address: e.target.value})}
                                        className="w-full mt-1 px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary outline-none font-bold text-gray-900"
                                    />
                                </div>
                            </div>

                            {/* Support ID */}
                            {business.id && (
                                <div className="pt-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Support ID (Tap to Copy)</label>
                                    <button
                                        onClick={() => { navigator.clipboard.writeText(business.id); addToast('Copied ID', 'success'); }}
                                        className="w-full mt-1 px-4 py-2 bg-gray-100 border border-dashed border-gray-300 rounded-lg text-xs font-mono text-gray-500 text-left hover:bg-gray-200 transition-colors"
                                    >
                                        {business.id}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
             </div>
          )}

          {/* PREFERENCES TAB */}
          {activeTab === 'preferences' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  {/* Colors */}
                  <div className="bg-white rounded-3xl shadow-sm border p-6 md:p-8 space-y-6">
                      <h2 className="text-lg font-bold flex items-center gap-2"><Palette className="text-primary" /> Appearance</h2>
                      <div className="flex flex-wrap gap-4">
                        {THEME_COLORS.map(color => (
                        <button key={color.value} type="button" onClick={() => {
                            setFormData({ ...formData, theme: { ...formData.theme, primaryColor: color.value }});
                        }} className={`w-12 h-12 rounded-full border-4 transition-all ${formData.theme.primaryColor === color.value ? 'border-indigo-100 scale-110' : 'border-transparent'}`} style={{ backgroundColor: color.value }}>
                            {formData.theme.primaryColor === color.value && <CheckCircle2 className="text-white" size={24} />}
                        </button>
                        ))}
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-3 tracking-widest">Fonts</label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {FONTS.map(font => (
                                <button
                                key={font.value}
                                onClick={() => {
                                    setFormData({ ...formData, theme: { ...formData.theme, fontFamily: font.value } });
                                }}
                                className={`px-4 py-3 rounded-xl border-2 text-sm transition-all ${formData.theme.fontFamily === font.value ? 'border-primary bg-primary-bg text-primary font-bold shadow-sm' : 'border-gray-100 text-gray-600 hover:border-gray-200'}`}
                                style={{ fontFamily: font.value }}
                                >
                                {font.name}
                                </button>
                            ))}
                        </div>
                    </div>
                  </div>

                  {/* Receipt Settings */}
                  <div className="bg-white rounded-3xl shadow-sm border p-6 md:p-8 space-y-6">
                      <h2 className="text-lg font-bold flex items-center gap-2"><Printer className="text-primary" /> Receipt Settings</h2>
                      <div className="flex items-center justify-between p-4 rounded-2xl border bg-gray-50">
                          <div>
                              <p className="font-bold text-sm text-gray-900">Use Thermal Printer Format (80mm)</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">Format invoices for thermal rolls instead of A4</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                                setFormData({ ...formData, useThermalPrinter: !formData.useThermalPrinter });
                            }}
                            className={`transition-colors ${formData.useThermalPrinter ? 'text-primary' : 'text-gray-300'}`}
                          >
                              {formData.useThermalPrinter ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                          </button>
                      </div>
                  </div>

                  {/* Tax Compliance Toggle */}
                  <div className="bg-white rounded-3xl shadow-sm border p-6 md:p-8 space-y-6">
                      <h2 className="text-lg font-bold flex items-center gap-2"><ShieldCheck className="text-primary" /> Tax Compliance</h2>
                      <div className="flex items-center justify-between p-4 rounded-2xl border bg-gray-50">
                          <div>
                              <p className="font-bold text-sm text-gray-900">Enable Tax Compliance Shield</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">Show tax estimates and exemption limits on dashboard</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                                // Initialize if undefined
                                const currentSettings = formData.taxSettings || { isEnabled: false, jurisdiction: 'NG', incorporationDate: new Date().toISOString() };
                                const newSettings = { ...currentSettings, isEnabled: !currentSettings.isEnabled };
                                setFormData({ ...formData, taxSettings: newSettings });
                            }}
                            className={`transition-colors ${formData.taxSettings?.isEnabled ? 'text-primary' : 'text-gray-300'}`}
                          >
                              {formData.taxSettings?.isEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                          </button>
                      </div>

                       {/* Low Stock Alerts */}
                      <div className="flex items-center justify-between p-4 rounded-2xl border bg-gray-50 mt-4">
                          <div>
                              <p className="font-bold text-sm text-gray-900">Enable Low Stock Alerts</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">Get notified when products run low</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                                const newSettings = { ...formData.settings, enableLowStockAlerts: !formData.settings?.enableLowStockAlerts };
                                setFormData({ ...formData, settings: newSettings as any });
                            }}
                            className={`transition-colors ${formData.settings?.enableLowStockAlerts ? 'text-primary' : 'text-gray-300'}`}
                          >
                              {formData.settings?.enableLowStockAlerts ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                          </button>
                      </div>
                  </div>

                  {/* Staff Permissions */}
                  <div className="bg-white rounded-3xl shadow-sm border p-6 md:p-8 space-y-6">
                    <h2 className="text-lg font-bold flex items-center gap-2"><ShieldCheck className="text-primary" /> Staff Permissions</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {PERMISSION_OPTIONS.map(opt => {
                        const isActive = (formData.staffPermissions as any)?.[opt.id];
                        return (
                            <div key={opt.id} className="flex items-center justify-between p-4 rounded-2xl border bg-gray-50">
                            <div>
                                <p className="font-bold text-sm text-gray-900">{opt.label}</p>
                                <p className="text-[10px] text-gray-500 mt-0.5">{opt.desc}</p>
                            </div>
                            <button type="button" onClick={() => togglePermission(opt.id)} className={`transition-colors ${isActive ? 'text-primary' : 'text-gray-300'}`}>
                                {isActive ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                            </button>
                            </div>
                        );
                        })}
                    </div>
                  </div>

                   {/* Discount Codes */}
                    <div className="bg-white rounded-3xl shadow-sm border p-6 md:p-8 space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-bold flex items-center gap-2"><Ticket className="text-pink-500" /> Discount Codes</h2>
                            <button
                                type="button"
                                onClick={() => setShowDiscountModal(true)}
                                className="text-xs font-black uppercase bg-pink-50 text-pink-600 px-4 py-2 rounded-lg hover:bg-pink-100 transition-all"
                            >
                                + Create Code
                            </button>
                        </div>
                        <p className="text-sm text-gray-500">Manage promo codes for your customers.</p>
                    </div>
              </div>
          )}

          {/* BILLING TAB */}
          {activeTab === 'billing' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="bg-white rounded-3xl shadow-sm border p-6 md:p-8 space-y-6">
                      <h2 className="text-lg font-bold flex items-center gap-2"><CreditCard className="text-emerald-600" /> Subscription Status</h2>

                      {(() => {
                          const isTrial = !business.isSubscribed && new Date(business.trialEndsAt) > new Date();
                          const isFreePlan = !business.isSubscribed && !isTrial;

                          if (isFreePlan) {
                              return (
                                  <div className="p-6 rounded-2xl border-2 bg-slate-50 border-slate-200">
                                      <div className="flex items-center gap-3 mb-2">
                                          <Lock className="text-slate-500" />
                                          <h3 className="font-black text-lg text-slate-800">Free Plan (Restricted)</h3>
                                      </div>
                                      <p className="text-sm text-slate-600 mb-4">
                                          Your trial has ended. You are on the read-only free plan. Upgrade to regain full access.
                                      </p>
                                      <button
                                        onClick={handleSubscribe}
                                        className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold shadow-lg hover:bg-black transition-all"
                                      >
                                          {isPollingSubscription ? <span className="flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={18}/> Checking Payment...</span> : 'Upgrade to Pro (₦2,000/mo)'}
                                      </button>
                                  </div>
                              );
                          }

                          return (
                              <div className={`p-6 rounded-2xl border-2 ${business.isSubscribed ? 'bg-emerald-50 border-emerald-100' : 'bg-orange-50 border-orange-100'}`}>
                                  <div className="flex items-center gap-3 mb-2">
                                      {business.isSubscribed ? <CheckCircle2 className="text-emerald-600" /> : <AlertTriangle className="text-orange-500" />}
                                      <h3 className={`font-black text-lg ${business.isSubscribed ? 'text-emerald-800' : 'text-orange-800'}`}>
                                          {business.isSubscribed ? 'Active Subscription' : 'Free Trial'}
                                      </h3>
                                  </div>
                                  <p className="text-sm text-gray-600 mb-4">
                                      {business.isSubscribed
                                          ? `Your plan renews on ${business.subscriptionExpiresAt ? new Date(business.subscriptionExpiresAt).toDateString() : 'Active (Date updating...)'}`
                                          : `Your trial expires on ${new Date(business.trialEndsAt).toDateString()}`
                                      }
                                  </p>
                                  {isTrial && (
                                      <button
                                        onClick={onSubscribe}
                                        className="text-xs font-bold bg-orange-100 text-orange-700 px-4 py-2 rounded-lg hover:bg-orange-200 transition-colors"
                                      >
                                          Subscribe Early
                                      </button>
                                  )}
                              </div>
                          );
                      })()}

                      {/* Payment Troubleshooting */}
                      <div className="border-t pt-6">
                          <h3 className="font-bold text-gray-900 mb-2">Payment Troubleshooting</h3>
                          <p className="text-sm text-gray-500 mb-4">If you paid via bank transfer or USSD and your account isn't active, verify your reference code here.</p>
                          <div className="flex gap-2">
                              <input
                                  type="text"
                                  placeholder="Enter Paystack Reference Code"
                                  className="flex-1 px-4 py-3 bg-gray-50 border rounded-xl font-mono text-sm"
                                  value={paystackReference}
                                  onChange={(e) => setPaystackReference(e.target.value)}
                              />
                              <button
                                  onClick={handleVerifyPayment}
                                  disabled={isVerifying || !paystackReference}
                                  className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold disabled:opacity-50"
                              >
                                  {isVerifying ? <Loader2 className="animate-spin" /> : 'Verify Payment'}
                              </button>
                          </div>
                      </div>

                       {/* Manage Subscription */}
                      {business.isSubscribed && (
                          <div className="border-t pt-6">
                              <h3 className="font-bold text-gray-900 mb-4">Manage Subscription</h3>

                              {business.autoRenew ? (
                                  <div className="flex flex-col gap-3">
                                      <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl text-sm border border-emerald-100 flex items-center gap-2">
                                          <CheckCircle2 size={16} />
                                          <span>Auto-renewal is <strong>ON</strong>. Next charge on {business.subscriptionExpiresAt ? new Date(business.subscriptionExpiresAt).toDateString() : 'expiry date'}.</span>
                                      </div>
                                      <div className="flex gap-3">
                                          <button
                                              onClick={handlePause}
                                              disabled={isManagingSub}
                                              className="flex-1 py-3 border-2 border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 disabled:opacity-50"
                                          >
                                              {isManagingSub ? <Loader2 className="animate-spin mx-auto"/> : 'Pause Auto-Renew'}
                                          </button>
                                          <button
                                              onClick={() => setShowCancelModal(true)}
                                              disabled={isManagingSub}
                                              className="flex-1 py-3 border-2 border-red-100 text-red-600 font-bold rounded-xl hover:bg-red-50 disabled:opacity-50"
                                          >
                                              Cancel Plan
                                          </button>
                                      </div>
                                  </div>
                              ) : (
                                  <div className="flex flex-col gap-3">
                                      <div className="p-4 bg-orange-50 text-orange-800 rounded-xl text-sm border border-orange-100 flex items-center gap-2">
                                          <AlertTriangle size={16} />
                                          <span>Auto-renewal is <strong>OFF</strong>. Access expires on {business.subscriptionExpiresAt ? new Date(business.subscriptionExpiresAt).toDateString() : 'expiry date'}.</span>
                                      </div>
                                      <button
                                          onClick={handleResume}
                                          disabled={isManagingSub}
                                          className="w-full py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-black disabled:opacity-50"
                                      >
                                          {isManagingSub ? <Loader2 className="animate-spin mx-auto"/> : 'Resume Auto-Renewal'}
                                      </button>
                                  </div>
                              )}
                          </div>
                      )}
                  </div>
              </div>
          )}

           {/* DATA TAB */}
          {activeTab === 'data' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="bg-white rounded-3xl shadow-sm border p-6 md:p-8 space-y-6">
                      <h2 className="text-lg font-bold flex items-center gap-2"><Database className="text-blue-600" /> Data Management</h2>
                      <p className="text-sm text-gray-500">Export your store data for external analysis or backup.</p>

                      <div className="space-y-3">
                          <button onClick={() => handleExport('inventory')} className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group">
                             <span className="font-bold text-gray-700">Export Inventory (CSV)</span>
                             <Download className="text-gray-400 group-hover:text-blue-600" size={20} />
                          </button>
                          <button onClick={() => handleExport('transactions')} className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group">
                             <span className="font-bold text-gray-700">Export Transactions (CSV)</span>
                             <Download className="text-gray-400 group-hover:text-blue-600" size={20} />
                          </button>
                           <button onClick={() => handleExport('expenses')} className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group">
                             <span className="font-bold text-gray-700">Export Expenses (CSV)</span>
                             <Download className="text-gray-400 group-hover:text-blue-600" size={20} />
                          </button>
                          <button onClick={handleExportFullBackup} disabled={isExportingFull || !isOnline} className="w-full flex items-center justify-between p-4 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors group disabled:opacity-60 disabled:cursor-not-allowed">
                             <span className="font-bold text-blue-800">Export Full Cloud Backup (JSON)</span>
                             {isExportingFull ? <Loader2 className="animate-spin text-blue-500" size={20} /> : <Download className="text-blue-500" size={20} />}
                          </button>
                      </div>
                  </div>
              </div>
          )}

          {/* SECURITY TAB */}
          {activeTab === 'security' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="bg-white rounded-3xl shadow-sm border p-6 md:p-8 space-y-6">
                    <h2 className="text-lg font-bold flex items-center gap-2"><Lock className="text-orange-500" /> Manage PINs</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-widest">Current Owner PIN *</label>
                        <input type="password" value={currentOwnerPin} onChange={e => setCurrentOwnerPin(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary outline-none font-bold text-center tracking-widest" placeholder="****" />
                        </div>
                        <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-widest">New Staff PIN</label>
                        <input type="text" value={newStaffPin} onChange={e => setNewStaffPin(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary outline-none font-bold text-center tracking-widest" placeholder="Optional" />
                        </div>
                        <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-widest">New Owner PIN</label>
                        <input type="text" value={newOwnerPin} onChange={e => setNewOwnerPin(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary outline-none font-bold text-center tracking-widest" placeholder="Optional" />
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <p className={`text-xs font-bold ${securityMsg.includes('success') ? 'text-green-600' : 'text-red-500'}`}>{securityMsg}</p>
                        <button type="button" onClick={handleUpdatePins} className="text-xs font-black uppercase text-white bg-gray-900 px-6 py-3 rounded-xl hover:bg-black transition-all">Update PINs</button>
                    </div>
                  </div>

                   <div className="bg-red-50 rounded-3xl shadow-sm border border-red-100 p-6 md:p-8 space-y-6">
                        <h2 className="text-lg font-bold flex items-center gap-2 text-red-600"><AlertTriangle className="text-red-600" /> Delete Account</h2>
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <p className="text-sm text-red-800">
                            Deleting your business account will permanently remove all data, including products, transactions, and settings. This action cannot be undone.
                            </p>
                            <button
                            type="button"
                            onClick={() => setShowDeleteModal(true)}
                            className="bg-white border-2 border-red-200 text-red-600 px-6 py-3 rounded-xl font-bold hover:bg-red-600 hover:text-white transition-all whitespace-nowrap"
                            >
                            Delete Account
                            </button>
                        </div>
                    </div>
              </div>
          )}

          {/* HELP TAB */}
          {activeTab === 'help' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="bg-white rounded-3xl shadow-sm border p-6 md:p-8 space-y-6">
                    <h2 className="text-lg font-bold flex items-center gap-2"><HelpCircle className="text-indigo-600" /> Support Assistant</h2>
                    <p className="text-sm text-gray-500">Ask us anything about Ginvoice.</p>

                    <div className="p-4 border-2 border-indigo-50 bg-indigo-50/20 rounded-2xl">
                        <SupportBot embed />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                        <a href="https://wa.me/2348051763431" target="_blank" rel="noreferrer" className="flex items-center gap-4 p-4 border-2 border-emerald-50 bg-emerald-50/30 rounded-2xl hover:bg-emerald-50 transition-all">
                        <MessageSquare className="text-emerald-500" />
                        <div><p className="font-bold text-gray-900 text-sm">WhatsApp Support</p></div>
                        </a>
                        <a href="mailto:support@ginvoice.com.ng" className="flex items-center gap-4 p-4 border-2 border-indigo-50 bg-indigo-50/30 rounded-2xl hover:bg-indigo-50 transition-all">
                        <HeadphonesIcon className="text-indigo-600" />
                        <div><p className="font-bold text-gray-900 text-sm">Email Support</p></div>
                        </a>
                    </div>
                  </div>
              </div>
          )}
      </div>

      {/* Docked Save Button */}
      {(activeTab === 'shop' || activeTab === 'preferences' || activeTab === 'security') && hasChanges && (
         <div className="fixed bottom-16 md:bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 z-50 flex justify-end shadow-lg">
            <button
               onClick={handleSaveChanges}
               disabled={isLoading}
               className="bg-gray-900 text-white px-8 py-3 rounded-xl font-bold text-lg shadow-xl hover:bg-gray-800 active:scale-95 transition-all flex items-center gap-2"
            >
               {isLoading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
               Save Changes
            </button>
         </div>
      )}

      {/* Discount Code Modal */}
      {showDiscountModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
              <div className="p-4 border-b flex justify-between items-center bg-pink-50">
                 <h3 className="font-bold text-pink-600">Generate Discount</h3>
                 <button onClick={() => { setShowDiscountModal(false); setGeneratedCode(null); }}><X size={20} className="text-gray-400" /></button>
              </div>
              <div className="p-6 space-y-4">
                 {generatedCode ? (
                   <div className="text-center space-y-4">
                      <div className="p-4 bg-gray-900 text-white rounded-xl font-mono text-2xl font-black tracking-widest dashed border-2 border-gray-600">
                        {generatedCode.code}
                      </div>
                      <p className="text-xs text-gray-500">Share this code with customers.</p>
                      <button onClick={() => setGeneratedCode(null)} className="text-xs font-bold text-pink-500 underline">Generate Another</button>
                   </div>
                 ) : (
                   <>
                     <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setDiscountForm({...discountForm, type: 'fixed'})}
                          className={`p-3 rounded-xl border-2 font-bold text-xs ${discountForm.type === 'fixed' ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-gray-100'}`}
                        >
                          Fixed Amount (₦)
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiscountForm({...discountForm, type: 'percent'})}
                          className={`p-3 rounded-xl border-2 font-bold text-xs ${discountForm.type === 'percent' ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-gray-100'}`}
                        >
                          Percentage (%)
                        </button>
                     </div>
                     <div>
                       <label className="text-xs font-bold text-gray-400 uppercase">Value</label>
                       <input
                         type="number"
                         className="w-full px-4 py-2 border rounded-xl font-bold"
                         value={discountForm.value}
                         onChange={e => setDiscountForm({...discountForm, value: Number(e.target.value)})}
                       />
                     </div>
                     <button
                       onClick={handleGenerateDiscount}
                       disabled={isGenerating}
                       className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold flex items-center justify-center gap-2"
                     >
                       {isGenerating ? <Loader2 className="animate-spin" /> : 'Create Code'}
                     </button>
                   </>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* Cancellation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-gray-900">Cancel Subscription</h3>
              <button onClick={() => setShowCancelModal(false)}><X className="text-gray-400" /></button>
            </div>

            <p className="text-sm text-gray-600 font-medium">
              We're sorry to see you go. Please tell us why you're cancelling so we can improve.
            </p>

            <textarea
              placeholder="Reason for cancellation..."
              className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-500 h-32 resize-none"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />

            <div className="flex gap-4">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200"
              >
                Keep Plan
              </button>
              <button
                onClick={handleCancel}
                disabled={isManagingSub || !cancelReason}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50"
              >
                {isManagingSub ? <Loader2 className="animate-spin mx-auto"/> : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-red-600">Delete Account?</h3>
              <button onClick={() => setShowDeleteModal(false)}><X className="text-gray-400" /></button>
            </div>

            <p className="text-sm text-gray-600 font-medium">
              To confirm deletion, please type your business name <span className="font-bold select-all">"{business.name}"</span> below.
            </p>

            <input
              type="text"
              placeholder={business.name}
              className="w-full px-4 py-3 bg-red-50 border-2 border-red-100 rounded-xl font-bold text-red-900 placeholder-red-200 focus:outline-none focus:border-red-500"
              value={confirmBusinessName}
              onChange={(e) => setConfirmBusinessName(e.target.value)}
            />

            {deleteError && <p className="text-xs font-bold text-red-500">{deleteError}</p>}

            <div className="flex gap-4">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting || confirmBusinessName !== business.name}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsScreen;
