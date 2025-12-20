
import React, { useState, useRef } from 'react';
import { ShoppingBag, MapPin, Phone, Mail, ArrowRight, Store, Sparkles, Upload, Trash2, Image as ImageIcon, Lock, ShieldCheck, UserCircle, Info, KeyRound } from 'lucide-react';

interface RegistrationScreenProps {
  onRegister: (details: { name: string, address: string, phone: string, email: string, logo?: string, ownerPassword?: string, staffPassword?: string }) => void;
  onManualLogin: (details: { email: string, pin: string }) => void;
}

const RegistrationScreen: React.FC<RegistrationScreenProps> = ({ onRegister, onManualLogin }) => {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    logo: undefined as string | undefined,
    ownerPassword: '',
    staffPassword: ''
  });

  const [loginData, setLoginData] = useState({
    email: '',
    pin: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'register') {
      if (formData.name && formData.phone && formData.ownerPassword && formData.staffPassword) {
        onRegister(formData);
      }
    } else {
      onManualLogin(loginData);
    }
  };

  return (
    <div className="min-h-screen bg-indigo-700 flex items-center justify-center p-4 overflow-y-auto bg-gradient-to-br from-indigo-700 via-indigo-600 to-indigo-800">
      <div className="max-w-xl w-full py-8">
        <div className="text-center mb-8">
          <div className="inline-flex p-4 rounded-3xl bg-white/10 backdrop-blur-md mb-4 animate-bounce">
            <ShoppingBag size={48} className="text-white" />
          </div>
          <h1 className="text-4xl font-black text-white mb-2 tracking-tight">
            {mode === 'register' ? 'Setup Your Store' : 'Resume Trading'}
          </h1>
          <p className="text-indigo-100 text-lg opacity-80">
            {mode === 'register' 
              ? 'Welcome to Ginvoice. Let\'s get your market desk ready.' 
              : 'Enter your business email and PIN to access your records.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-[2rem] shadow-2xl p-8 md:p-12 space-y-8 border-t-8 border-indigo-500">
          
          {mode === 'register' ? (
            <>
              {/* Initial Logo Upload */}
              <div className="flex flex-col items-center gap-4 border-b border-gray-100 pb-8">
                <div className="relative group">
                    <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center overflow-hidden transition-all group-hover:border-indigo-500">
                      {formData.logo ? (
                        <img src={formData.logo} alt="Business Logo" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon size={32} className="text-gray-300" />
                      )}
                    </div>
                    {formData.logo && (
                      <button 
                        type="button" 
                        onClick={() => setFormData({...formData, logo: undefined})}
                        className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg flex items-center gap-2"
                  >
                    <Upload size={14} /> {formData.logo ? 'Change Logo' : 'Add Store Logo (Optional)'}
                  </button>
              </div>

              <div className="space-y-6">
                <div className="relative">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Business Name *</label>
                  <div className="relative">
                    <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                      required
                      type="text" 
                      placeholder="e.g. Ebuka & Sons Trading"
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none font-bold text-gray-800 transition-all"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="relative">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Phone Number *</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <input 
                        required
                        type="tel" 
                        inputMode="tel"
                        autoComplete="tel"
                        pattern="[0-9+()\\-\\s]{7,}"
                        placeholder="080..."
                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none font-bold text-gray-800 transition-all"
                        value={formData.phone}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="relative">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Business Email</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <input 
                        type="text" 
                        placeholder="contact@store.com"
                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none font-bold text-gray-800 transition-all"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 space-y-4">
                  <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-start gap-3">
                    <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-indigo-700 leading-relaxed font-medium">
                      Note: Your email is vital for password recovery. While you can enter any text, we recommend using a valid business email. Without a valid email, you may lose access to your store's data forever if you forget your password.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="relative">
                      <label className="block text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1 ml-1 flex items-center gap-1">
                        <ShieldCheck size={12} /> Owner PIN *
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                          required
                          type="password" 
                          placeholder="Admin PIN"
                          className="w-full pl-12 pr-4 py-4 bg-indigo-50/50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none font-bold text-gray-800 transition-all"
                          value={formData.ownerPassword}
                          onChange={e => setFormData({...formData, ownerPassword: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="relative">
                      <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 ml-1 flex items-center gap-1">
                        <UserCircle size={12} /> Staff PIN *
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                          required
                          type="password" 
                          placeholder="Sales PIN"
                          className="w-full pl-12 pr-4 py-4 bg-emerald-50/50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-600 outline-none font-bold text-gray-800 transition-all"
                          value={formData.staffPassword}
                          onChange={e => setFormData({...formData, staffPassword: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-6 py-4 animate-in fade-in slide-in-from-top-4">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <KeyRound size={32} />
                </div>
                <h3 className="font-bold text-gray-900">Access My Store</h3>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Store Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      required
                      type="text" 
                      placeholder="e.g. owner@store.com"
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none font-bold text-gray-800 transition-all"
                      value={loginData.email}
                      onChange={e => setLoginData({...loginData, email: e.target.value})}
                    />
                  </div>
                </div>

                <div className="relative">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Admin PIN</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      required
                      type="password" 
                      placeholder="••••"
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none font-bold text-gray-800 text-center tracking-[1em]"
                      value={loginData.pin}
                      onChange={e => setLoginData({...loginData, pin: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 space-y-4">
            <button 
              type="submit"
              className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 active:scale-95"
            >
              {mode === 'register' ? (
                <><Sparkles size={24} /> Create Store Account</>
              ) : (
                <><ShieldCheck size={24} /> Log In to Store</>
              )}
              <ArrowRight size={24} />
            </button>

            <button 
              type="button"
              onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
              className="w-full text-sm font-bold text-indigo-600 hover:underline text-center"
            >
              {mode === 'register' ? 'Already have a store? Login here' : 'Need to setup a new store? Register here'}
            </button>

            <p className="text-center text-xs text-gray-400 mt-6 font-medium">
              Ginvoice Market OS • Made for Nigerian Traders 🇳🇬
              <br />All data is encrypted and stored locally.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegistrationScreen;
