
import React, { useState } from 'react';
import { ShoppingBag, MapPin, Phone, Mail, ArrowRight, Store, Sparkles } from 'lucide-react';

interface RegistrationScreenProps {
  onRegister: (details: { name: string, address: string, phone: string, email: string }) => void;
}

const RegistrationScreen: React.FC<RegistrationScreenProps> = ({ onRegister }) => {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.phone) {
      onRegister(formData);
    }
  };

  return (
    <div className="min-h-screen bg-indigo-700 flex items-center justify-center p-4 overflow-y-auto bg-gradient-to-br from-indigo-700 via-indigo-600 to-indigo-800">
      <div className="max-w-xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex p-4 rounded-3xl bg-white/10 backdrop-blur-md mb-4 animate-bounce">
            <ShoppingBag size={48} className="text-white" />
          </div>
          <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Setup Your Store</h1>
          <p className="text-indigo-100 text-lg opacity-80">Welcome to Ginvoice. Let's get your market desk ready.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-[2rem] shadow-2xl p-8 md:p-12 space-y-8 border-t-8 border-indigo-500">
          <div className="space-y-6">
            <div className="relative">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Business Name *</label>
              <div className="relative">
                <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  required
                  type="text" 
                  placeholder="e.g. Ebuka & Sons Trading"
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none font-bold text-gray-800 placeholder:font-normal placeholder:text-gray-300 transition-all"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
            </div>

            <div className="relative">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Location / Market Address</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="text" 
                  placeholder="e.g. Alaba Market, Block G-42, Lagos"
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none font-bold text-gray-800 placeholder:font-normal placeholder:text-gray-300 transition-all"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
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
                    placeholder="080..."
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none font-bold text-gray-800 placeholder:font-normal placeholder:text-gray-300 transition-all"
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
                    type="email" 
                    placeholder="contact@store.com"
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none font-bold text-gray-800 placeholder:font-normal placeholder:text-gray-300 transition-all"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button 
              type="submit"
              className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 active:scale-95"
            >
              <Sparkles size={24} /> Start My Business
              <ArrowRight size={24} />
            </button>
            <p className="text-center text-xs text-gray-400 mt-6 font-medium">
              By continuing, you agree to our Market Service Terms.
              <br />All data is stored locally on this device.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegistrationScreen;
