import React, { useState, useRef } from 'react';
import { Store, Save, LayoutGrid, MapPin, Phone, Palette, Type, ShieldAlert, CheckCircle2, RefreshCw, CloudCheck, Upload, Trash2, Image as ImageIcon, MessageSquare, HeadphonesIcon, HelpCircle, Lock, LogOut, AlertTriangle, X } from 'lucide-react';
import { BusinessProfile, TabId } from '../types';
import { THEME_COLORS, FONTS } from '../constants';
import { verifyPayment, changeBusinessPins, deleteAccount } from '../services/api';
import SupportBot from './SupportBot'; // Integrated SupportBot

interface SettingsScreenProps {
  business: BusinessProfile;
  onUpdateBusiness: (profile: BusinessProfile) => void;
  onManualSync?: () => void;
  lastSynced?: string;
  isSyncing?: boolean;
  onLogout?: () => void;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ business, onUpdateBusiness, onManualSync, lastSynced, isSyncing, onLogout }) => {
  const [formData, setFormData] = useState<BusinessProfile>(business);
  const [showSaved, setShowSaved] = useState(false);
  const [paymentRef, setPaymentRef] = useState('');
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateBusiness(formData);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 3000);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, logo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setFormData({ ...formData, logo: undefined });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const togglePermission = (tab: string) => {
    const perms = new Set(formData.staffPermissions || []);
    if (perms.has(tab)) {
      perms.delete(tab);
    } else {
      perms.add(tab);
    }
    setFormData({ ...formData, staffPermissions: Array.from(perms) as any });
  };

  const handleVerifyPayment = async () => {
    if (!paymentRef.trim()) return;
    setVerifyStatus('loading');
    try {
      await verifyPayment(paymentRef.trim());
      setVerifyStatus('success');
      setPaymentRef('');
    } catch (err) {
      setVerifyStatus('error');
    }
  };

  const handleUpdatePins = async () => {
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
    if (confirmBusinessName !== business.name) {
      setDeleteError('Business name does not match');
      return;
    }

    setIsDeleting(true);
    setDeleteError('');

    try {
      await deleteAccount(confirmBusinessName);
      if (onLogout) onLogout();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete account');
      setIsDeleting(false);
    }
  };

  const PERMISSION_OPTIONS: { id: string; label: string; desc: string }[] = [
    { id: 'sales', label: 'Point of Sale', desc: 'Process new sales' },

    // Split Inventory
    { id: 'inventory', label: 'Inventory (View)', desc: 'View stock levels and prices' },
    { id: 'stock-management', label: 'Inventory (Edit)', desc: 'Add, edit, or delete products' },

    // Split History (Billing)
    { id: 'history', label: 'History (View)', desc: 'View past transactions and receipts' },
    { id: 'history-management', label: 'History (Edit)', desc: 'Delete or modify past records' },

    // Add Missing Expenditure
    { id: 'expenditure', label: 'Expenditures', desc: 'Manage business expenses' },

    { id: 'dashboard', label: 'Analytics', desc: 'View sales performance' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Store Settings</h1>
          <p className="text-gray-500">Customize appearance and manage staff access levels</p>
        </div>
        
        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex flex-col items-end gap-2 text-right">
          <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
             {isSyncing ? <RefreshCw className="animate-spin" size={16} /> : <CloudCheck size={18} />}
             <span>Cloud Backup Active</span>
          </div>
          <p className="text-[10px] text-indigo-400 font-medium uppercase tracking-widest">
            Last Sync: {lastSynced ? new Date(lastSynced).toLocaleString() : 'Never'}
          </p>
          <button 
            type="button"
            onClick={onManualSync}
            disabled={isSyncing}
            className="text-[10px] bg-indigo-600 text-white px-3 py-1 rounded-full font-black hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {isSyncing ? 'SYNCING...' : 'SYNC NOW'}
          </button>
          <div className="mt-2 w-full flex flex-col items-end gap-2">
            <input
              type="text"
              placeholder="Payment Reference"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-indigo-100 rounded-xl text-xs font-bold text-gray-700"
            />
            <button
              type="button"
              onClick={handleVerifyPayment}
              disabled={verifyStatus === 'loading'}
              className="text-[10px] bg-gray-900 text-white px-3 py-1 rounded-full font-black hover:bg-black transition-colors disabled:opacity-50"
            >
              {verifyStatus === 'loading' ? 'VERIFYING...' : 'VERIFY PAYMENT'}
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Store Identity */}
        <div className="bg-white rounded-3xl shadow-sm border p-6 md:p-8 space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2"><Store className="text-primary" /> Store Identity</h2>
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="flex flex-col items-center gap-3">
              <div className="relative group">
                <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center overflow-hidden transition-all group-hover:border-primary">
                  {formData.logo ? (
                    <img src={formData.logo} alt="Business Logo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center text-gray-400">
                      <ImageIcon size={32} className="mb-2" />
                      <span className="text-[10px] font-bold">No Logo</span>
                    </div>
                  )}
                </div>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black uppercase text-primary bg-primary-bg px-4 py-2 rounded-lg flex items-center gap-2 hover:opacity-80 transition-all">
                <Upload size={14} /> {formData.logo ? 'Change Logo' : 'Upload Logo'}
              </button>
            </div>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-widest">Business Name</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary outline-none font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-widest">Phone</label>
                <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary outline-none font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-widest">Address</label>
                <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary outline-none font-bold" />
              </div>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="bg-white rounded-3xl shadow-sm border p-6 md:p-8 space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2"><Palette className="text-primary" /> App Appearance</h2>
          <div className="flex flex-wrap gap-4">
            {THEME_COLORS.map(color => (
              <button key={color.value} type="button" onClick={() => setFormData({ ...formData, theme: { ...formData.theme, primaryColor: color.value }})} className={`w-12 h-12 rounded-full border-4 transition-all ${formData.theme.primaryColor === color.value ? 'border-indigo-100 scale-110' : 'border-transparent'}`} style={{ backgroundColor: color.value }}>
                {formData.theme.primaryColor === color.value && <CheckCircle2 className="text-white" size={24} />}
              </button>
            ))}
          </div>
        </div>

        {/* Staff Permissions */}
        <div className="bg-white rounded-3xl shadow-sm border p-6 md:p-8 space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2"><ShieldAlert className="text-primary" /> Staff Permissions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PERMISSION_OPTIONS.map(opt => (
              <label key={opt.id} className={`flex items-start gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all ${formData.staffPermissions?.includes(opt.id as any) ? 'border-primary bg-primary-bg' : 'border-gray-50'}`}>
                <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-primary mt-1" checked={formData.staffPermissions?.includes(opt.id as any)} onChange={() => togglePermission(opt.id)} disabled={opt.id === 'sales'} />
                <div>
                  <p className="font-bold text-gray-900">{opt.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Security / PINs */}
        <div className="bg-white rounded-3xl shadow-sm border p-6 md:p-8 space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2"><Lock className="text-orange-500" /> Security</h2>
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

        {/* Support Section */}
        <div className="bg-white rounded-3xl shadow-sm border p-6 md:p-8 space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2"><HelpCircle className="text-emerald-600" /> Support & Help</h2>
          <p className="text-sm text-gray-500 font-medium">Use the support assistant below for immediate help or contact our team.</p>
          
          {/* SupportBot Trigger UI rendered here locally */}
          <div className="p-4 border-2 border-indigo-50 bg-indigo-50/20 rounded-2xl">
            <SupportBot />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <a href="https://wa.me/2348051763431" target="_blank" rel="noreferrer" className="flex items-center gap-4 p-4 border-2 border-emerald-50 bg-emerald-50/30 rounded-2xl hover:bg-emerald-50 transition-all">
              <MessageSquare className="text-emerald-500" />
              <div><p className="font-bold text-gray-900 text-sm">WhatsApp Support</p></div>
            </a>
            <a href="mailto:noahibr2@gmail.com" className="flex items-center gap-4 p-4 border-2 border-indigo-50 bg-indigo-50/30 rounded-2xl hover:bg-indigo-50 transition-all">
              <HeadphonesIcon className="text-indigo-600" />
              <div><p className="font-bold text-gray-900 text-sm">Email Support</p></div>
            </a>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-50 rounded-3xl shadow-sm border border-red-100 p-6 md:p-8 space-y-6">
           <h2 className="text-lg font-bold flex items-center gap-2 text-red-600"><AlertTriangle className="text-red-600" /> Danger Zone</h2>
           <div className="flex flex-col md:flex-row justify-between items-center gap-4">
             <p className="text-sm text-red-800">
               Deleting your business account will permanently remove all data, including products, transactions, and settings. This action cannot be undone.
             </p>
             <button
               type="button"
               onClick={() => setShowDeleteModal(true)}
               className="bg-white border-2 border-red-200 text-red-600 px-6 py-3 rounded-xl font-bold hover:bg-red-600 hover:text-white transition-all whitespace-nowrap"
             >
               Delete Business
             </button>
           </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between bg-white p-6 rounded-3xl shadow-lg border-t-4 border-primary mt-8">
          <div>{showSaved && <p className="text-green-600 font-bold animate-bounce">✓ Changes saved!</p>}</div>
          <div className="flex items-center gap-4">
             {onLogout && (
               <button type="button" onClick={onLogout} className="bg-red-50 text-red-600 px-6 py-4 rounded-2xl font-black shadow-sm hover:bg-red-100 transition-all flex items-center gap-2 active:scale-95">
                 <LogOut size={20} /> Logout
               </button>
             )}
             <button type="submit" className="bg-primary text-white px-10 py-4 rounded-2xl font-black shadow-xl hover:opacity-90 transition-all flex items-center gap-2 active:scale-95">
               <Save size={20} /> Update Business
             </button>
          </div>
        </div>
      </form>

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
