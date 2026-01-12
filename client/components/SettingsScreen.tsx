import React, { useState, useRef, useEffect } from 'react';
import { Store, Save, LayoutGrid, MapPin, Phone, Palette, Type, ShieldAlert, CheckCircle2, RefreshCw, CloudCheck, Upload, Trash2, Image as ImageIcon, MessageSquare, HeadphonesIcon, HelpCircle, Lock, LogOut, AlertTriangle, X, Ticket, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { BusinessProfile, TabId, DiscountCode } from '../types';
import { THEME_COLORS, FONTS } from '../constants';
import { changeBusinessPins, deleteAccount, uploadFile, updateSettings, generateDiscountCode } from '../services/api';
import SupportBot from './SupportBot'; // Integrated SupportBot

interface SettingsScreenProps {
  business: BusinessProfile;
  onUpdateBusiness: (profile: BusinessProfile) => void;
  onManualSync?: () => void;
  lastSynced?: string;
  isSyncing?: boolean;
  onLogout?: () => void;
  onDeleteAccount?: () => void;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ business, onUpdateBusiness, onManualSync, lastSynced, isSyncing, onLogout, onDeleteAccount }) => {
  const [formData, setFormData] = useState<BusinessProfile>(business);
  const [showSaved, setShowSaved] = useState(false);

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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Preview immediately
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, logo: reader.result as string }));
      };
      reader.readAsDataURL(file);

      // Try uploading
      try {
        if (navigator.onLine) {
          const url = await uploadFile(file);
          setFormData(prev => ({ ...prev, logo: url }));
        }
      } catch (err) {
        console.error('Logo upload failed, using local base64 fallback', err);
      }
    }
  };

  const removeLogo = () => {
    setFormData({ ...formData, logo: undefined });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const togglePermission = (key: string) => {
    // Handle both new object-based and old array-based perms logic if mixing (for now assume object structure is dominant based on new types)
    const currentPerms = formData.staffPermissions as any || {};
    // If it's the old array, we might need a migration strategy, but let's assume we are using the new object
    const newVal = !currentPerms[key];

    setFormData(prev => ({
      ...prev,
      staffPermissions: {
        ...prev.staffPermissions,
        [key]: newVal
      }
    }));
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
      if (onDeleteAccount) onDeleteAccount();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete account');
      setIsDeleting(false);
    }
  };

  // Discount Code Modal State
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountForm, setDiscountForm] = useState({ type: 'fixed' as 'fixed' | 'percent', value: 0, scope: 'global' as 'global'|'product' });
  const [generatedCode, setGeneratedCode] = useState<DiscountCode | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateDiscount = async () => {
    setIsGenerating(true);
    try {
      const code = await generateDiscountCode(discountForm);
      setGeneratedCode(code);
    } catch (err) {
      alert('Failed to generate code');
    } finally {
      setIsGenerating(false);
    }
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
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Store Identity */}
        <div className="bg-white rounded-3xl shadow-sm border p-6 md:p-8 space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2"><Store className="text-primary" /> Store Identity</h2>
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="flex flex-col items-center gap-3">
              {business.id && (
                <div className="w-full mb-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1 tracking-widest text-center">Support ID</label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={business.id}
                      className="w-full px-2 py-1 bg-gray-100 border rounded text-xs text-center font-mono text-gray-600"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (business.id) navigator.clipboard.writeText(business.id);
                      }}
                      className="px-2 py-1 bg-gray-200 rounded text-xs font-bold text-gray-600 hover:bg-gray-300"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
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
          <div className="mt-6 border-t border-gray-100 pt-6">
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1 tracking-widest">Typography</label>
            <p className="text-sm text-gray-500 mb-4">Choose the font style for your receipts and app interface.</p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {FONTS.map(font => (
                <button
                  key={font.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, theme: { ...formData.theme, fontFamily: font.value } })}
                  className={`px-4 py-3 rounded-xl border-2 text-sm transition-all ${formData.theme.fontFamily === font.value ? 'border-primary bg-primary-bg text-primary font-bold shadow-sm' : 'border-gray-100 text-gray-600 hover:border-gray-200'}`}
                  style={{ fontFamily: font.value }}
                >
                  {/* FIX: Use font.name, not font.label */}
                  {font.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Staff Permissions */}
        <div className="bg-white rounded-3xl shadow-sm border p-6 md:p-8 space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2"><ShieldAlert className="text-primary" /> Staff Permissions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PERMISSION_OPTIONS.map(opt => {
              const isActive = (formData.staffPermissions as any)?.[opt.id];
              return (
                <div key={opt.id} className="flex items-center justify-between p-5 rounded-2xl border bg-gray-50">
                  <div>
                    <p className="font-bold text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-1">{opt.desc}</p>
                  </div>
                  <button type="button" onClick={() => togglePermission(opt.id)} className={`transition-colors ${isActive ? 'text-primary' : 'text-gray-300'}`}>
                    {isActive ? <ToggleRight size={40} /> : <ToggleLeft size={40} />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Discount Codes */}
        <div className="bg-white rounded-3xl shadow-sm border p-6 md:p-8 space-y-6">
           <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold flex items-center gap-2"><Ticket className="text-pink-500" /> Discount Codes</h2>
              <button
                type="button"
                onClick={() => setShowDiscountModal(true)}
                className="text-xs font-black uppercase bg-pink-50 text-pink-600 px-4 py-2 rounded-lg hover:bg-pink-100 transition-all"
              >
                + Generate Code
              </button>
           </div>
           <p className="text-sm text-gray-500">Create unique codes for marketing campaigns or loyal customers.</p>
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
            <a href="mailto:support@ginvoice.com.ng" className="flex items-center gap-4 p-4 border-2 border-indigo-50 bg-indigo-50/30 rounded-2xl hover:bg-indigo-50 transition-all">
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
             <button type="submit" className="bg-primary text-white px-10 py-4 rounded-2xl font-black shadow-xl hover:opacity-90 transition-all flex items-center gap-2 active:scale-95">
               <Save size={20} /> Update Business
             </button>
          </div>
        </div>
      </form>

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
