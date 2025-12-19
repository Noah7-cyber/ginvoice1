
import React from 'react';
import { UserCircle, ShieldCheck, ShoppingBag, Info } from 'lucide-react';
import { UserRole } from '../types';

interface AuthScreenProps {
  onLogin: (role: UserRole) => void;
  mode: string;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  return (
    <div className="min-h-screen bg-indigo-700 flex flex-col items-center justify-center p-6">
      <div className="mb-12 text-center text-white">
        <div className="bg-white/10 p-5 rounded-3xl inline-block mb-4 backdrop-blur-lg">
          <ShoppingBag size={64} className="text-white" />
        </div>
        <h1 className="text-4xl font-black mb-2 tracking-tight">Ginvoice</h1>
        <p className="text-indigo-200">The Modern Market Operating System</p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold text-gray-900">Welcome Back</h2>
          <p className="text-sm text-gray-500">Select your profile to start trading</p>
        </div>

        <div className="space-y-4">
          <button 
            onClick={() => onLogin('owner')}
            className="w-full group relative flex items-center gap-4 p-5 border-2 border-indigo-50 rounded-2xl hover:border-indigo-600 hover:bg-indigo-50 transition-all text-left"
          >
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <ShieldCheck size={28} />
            </div>
            <div>
              <p className="font-bold text-gray-900">Store Owner</p>
              <p className="text-xs text-gray-500">Full control over inventory & money</p>
            </div>
          </button>

          <button 
            onClick={() => onLogin('staff')}
            className="w-full group relative flex items-center gap-4 p-5 border-2 border-indigo-50 rounded-2xl hover:border-indigo-600 hover:bg-indigo-50 transition-all text-left"
          >
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <UserCircle size={28} />
            </div>
            <div>
              <p className="font-bold text-gray-900">Sales Staff</p>
              <p className="text-xs text-gray-500">Register sales & check prices</p>
            </div>
          </button>
        </div>

        <div className="pt-4 border-t border-gray-100 flex items-start gap-3 text-gray-400">
          <Info size={16} className="shrink-0 mt-0.5" />
          <p className="text-[10px] leading-relaxed">
            Ginvoice works offline. Data will sync to the server when you are back online.
          </p>
        </div>
      </div>
      
      <p className="mt-8 text-indigo-300 text-xs font-medium">Built for Nigerian Market Excellence 🇳🇬</p>
    </div>
  );
};

export default AuthScreen;
