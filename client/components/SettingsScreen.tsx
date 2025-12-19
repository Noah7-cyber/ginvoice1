
import React, { useState } from 'react';
import { Store, Save, LayoutGrid, MapPin, Phone, Palette, Type, ShieldAlert, CheckCircle2, RefreshCw, CloudCheck } from 'lucide-react';
import { BusinessProfile, TabId } from '../types';
import { THEME_COLORS, FONTS } from '../constants';

interface SettingsScreenProps {
  business: BusinessProfile;
  onUpdateBusiness: (profile: BusinessProfile) => void;
  onManualSync?: () => void;
  lastSynced?: string;
  isSyncing?: boolean;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ business, onUpdateBusiness, onManualSync, lastSynced, isSyncing }) => {
  const [formData, setFormData] = useState<BusinessProfile>(business);
  const [showSaved, setShowSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateBusiness(formData);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 3000);
  };

  const togglePermission = (tab: TabId) => {
    const next = formData.staffPermissions.includes(tab)
      ? formData.staffPermissions.filter(t => t !== tab)
      : [...formData.staffPermissions, tab];
    setFormData({ ...formData, staffPermissions: next });
  };

  const PERMISSION_OPTIONS: { id: TabId; label: string; desc: string }[] = [
    { id: 'sales', label: 'Point of Sale', desc: 'Can register new transactions' },
    { id: 'inventory', label: 'Inventory Access', desc: 'Can view and update stock levels' },
    { id: 'history', label: 'Billing Records', desc: 'Can see previous invoices' },
    { id: 'dashboard', label: 'Analytics (Restricted)', desc: 'Can see sales summaries' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Store Settings</h1>
          <p className="text-gray-500">Customize appearance and manage staff access levels</p>
        </div>
        
        {/* Sync Reassurance Panel */}
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
        {/* Core Info */}
        <div className="bg-white rounded-3xl shadow-sm border p-6 md:p-8 space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2"><Store className="text-primary" /> Store Identity</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-widest">Business Name</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary outline-none font-bold"
                placeholder="Business Name"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-widest">Phone Contact</label>
              <input 
                type="tel" 
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary outline-none font-bold"
                placeholder="080..."
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-widest">Address</label>
              <input 
                type="text" 
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-primary outline-none font-bold"
                placeholder="Market stall address"
              />
            </div>
          </div>
        </div>

        {/* Appearance Picker */}
        <div className="bg-white rounded-3xl shadow-sm border p-6 md:p-8 space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2"><Palette className="text-primary" /> App Appearance</h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-4 tracking-widest">Brand Color</label>
              <div className="flex flex-wrap gap-4">
                {THEME_COLORS.map(color => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, theme: { ...formData.theme, primaryColor: color.value }})}
                    className={`w-12 h-12 rounded-full border-4 transition-all shadow-sm flex items-center justify-center ${
                      formData.theme.primaryColor === color.value ? 'border-indigo-100 scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color.value }}
                  >
                    {formData.theme.primaryColor === color.value && <CheckCircle2 className="text-white" size={24} />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-4 tracking-widest">Typography</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {FONTS.map(font => (
                  <button
                    key={font.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, theme: { ...formData.theme, fontFamily: font.value }})}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      formData.theme.fontFamily === font.value ? 'border-primary bg-primary-bg' : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <Type size={18} className={formData.theme.fontFamily === font.value ? 'text-primary' : 'text-gray-400'} />
                    <p className="font-bold mt-2" style={{ fontFamily: font.value }}>{font.name}</p>
                    <p className="text-[10px] text-gray-400">The quick brown fox...</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Staff Permissions */}
        <div className="bg-white rounded-3xl shadow-sm border p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2"><ShieldAlert className="text-primary" /> Staff Permissions</h2>
            <span className="text-[10px] font-black uppercase text-gray-400">Standard User Access</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PERMISSION_OPTIONS.map(opt => (
              <label 
                key={opt.id}
                className={`flex items-start gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  formData.staffPermissions.includes(opt.id) ? 'border-primary bg-primary-bg' : 'border-gray-50'
                }`}
              >
                <div className="mt-1">
                  <input 
                    type="checkbox"
                    className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                    checked={formData.staffPermissions.includes(opt.id)}
                    onChange={() => togglePermission(opt.id)}
                    disabled={opt.id === 'sales'} // Sales always enabled
                  />
                </div>
                <div>
                  <p className="font-bold text-gray-900">{opt.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between bg-white p-6 rounded-3xl shadow-lg border-t-4 border-primary">
          <div>
            {showSaved && <p className="text-green-600 font-bold flex items-center gap-2 animate-bounce">✓ Changes saved!</p>}
          </div>
          <button 
            type="submit"
            className="bg-primary text-white px-10 py-4 rounded-2xl font-black shadow-xl hover:opacity-90 transition-all flex items-center gap-2 active:scale-95"
          >
            <Save size={20} /> Update Business
          </button>
        </div>
      </form>
    </div>
  );
};

export default SettingsScreen;
