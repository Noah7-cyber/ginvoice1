
import React, { useState } from 'react';
import { UserCircle, ShieldCheck, ShoppingBag, Info, Lock, Eye, EyeOff, ArrowLeft, ArrowRight, RefreshCw, Loader2 } from 'lucide-react';
import { UserRole, BusinessProfile } from '../types';

interface AuthScreenProps {
  onLogin: (pin: string, role: UserRole) => Promise<boolean>;
  onForgotPassword: () => void;
  onResetBusiness: () => void;
  business: BusinessProfile;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin, onForgotPassword, onResetBusiness, business }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setError(false);
    setPassword('');
  };

  const handleLoginAttempt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    setIsLoading(true);
    const ok = await onLogin(password, selectedRole);
    setIsLoading(false);
    if (!ok) {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-indigo-700 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-indigo-700 via-indigo-600 to-indigo-800">
      <div className="mb-10 text-center text-white">
        <div className="bg-white/10 p-5 rounded-3xl inline-block mb-4 backdrop-blur-lg animate-pulse">
          {business.logo ? (
            <img src={business.logo} alt="Logo" className="w-16 h-16 rounded-xl object-cover bg-white p-1" />
          ) : (
            <ShoppingBag size={64} className="text-white" />
          )}
        </div>
        <h1 className="text-4xl font-black mb-1 tracking-tight">{business.name || 'Ginvoice'}</h1>
        <p className="text-indigo-200 text-sm font-medium">The Modern Market Operating System</p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl p-8 space-y-8 border-b-8 border-indigo-100 overflow-hidden relative">
        {!selectedRole ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-black text-gray-900">Welcome Back</h2>
              <p className="text-sm text-gray-500">Select your profile to start trading</p>
            </div>

            <div className="space-y-4">
              <button 
                onClick={() => handleRoleSelect('owner')}
                className="w-full group relative flex items-center gap-4 p-5 border-2 border-indigo-50 rounded-2xl hover:border-indigo-600 hover:bg-indigo-50 transition-all text-left"
              >
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <ShieldCheck size={28} />
                </div>
                <div>
                  <p className="font-bold text-gray-900">Store Owner</p>
                  <p className="text-xs text-gray-500">Full control over records</p>
                </div>
              </button>

              <button 
                onClick={() => handleRoleSelect('staff')}
                className="w-full group relative flex items-center gap-4 p-5 border-2 border-indigo-50 rounded-2xl hover:border-indigo-600 hover:bg-indigo-50 transition-all text-left"
              >
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <UserCircle size={28} />
                </div>
                <div>
                  <p className="font-bold text-gray-900">Sales Staff</p>
                  <p className="text-xs text-gray-500">Register sales & stock</p>
                </div>
              </button>
            </div>

            {/* Logout/Reset Business Toggle */}
            <div className="pt-4 border-t border-gray-100 text-center">
               <button 
                 type="button"
                 onClick={(e) => {
                    e.preventDefault();
                    onResetBusiness();
                 }}
                 className="w-full py-3 text-sm font-black text-indigo-600 bg-indigo-50 rounded-2xl flex items-center justify-center gap-2 hover:bg-indigo-100 transition-colors active:scale-95"
               >
                 <RefreshCw size={16} /> Not your store? Switch Store
               </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleLoginAttempt} className="space-y-6 animate-in fade-in zoom-in-95">
            <button 
              type="button"
              onClick={() => setSelectedRole(null)}
              className="flex items-center gap-2 text-indigo-600 font-bold text-xs hover:underline mb-2"
            >
              <ArrowLeft size={14} /> Back to roles
            </button>

            <div className="text-center space-y-1">
              <div className="w-16 h-16 mx-auto bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-2">
                {selectedRole === 'owner' ? <ShieldCheck size={32} /> : <UserCircle size={32} />}
              </div>
              <h2 className="text-2xl font-black text-gray-900 capitalize">{selectedRole} Login</h2>
              <p className="text-sm text-gray-500">Enter your secure access PIN</p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  autoFocus
                  required
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter PIN"
                  className={`w-full pl-12 pr-12 py-4 bg-gray-50 border-2 rounded-2xl outline-none font-bold text-lg text-center tracking-widest transition-all ${
                    error ? 'border-red-500 bg-red-50 animate-shake' : 'border-transparent focus:border-indigo-600'
                  }`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {error && <p className="text-center text-xs font-bold text-red-500 animate-bounce">Incorrect PIN. Try again.</p>}
              {!navigator.onLine && <p className="text-center text-xs font-bold text-orange-500 animate-pulse">Internet Connection Required</p>}

              <button 
                type="submit"
                disabled={!navigator.onLine || isLoading}
                className="w-full bg-indigo-600 disabled:bg-gray-400 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="animate-spin" size={24} /> : <>Access Store <ArrowRight size={18} /></>}
              </button>
            </div>

            <div className="text-center">
              <button 
                type="button"
                onClick={onForgotPassword}
                className="text-xs font-bold text-gray-400 hover:text-indigo-600"
              >
                Forgot Password?
              </button>
            </div>
          </form>
        )}

        <div className="pt-4 border-t border-gray-100 flex items-start gap-3 text-gray-400">
          <Info size={16} className="shrink-0 mt-0.5" />
          <p className="text-[10px] leading-relaxed">
            Ginvoice stores data locally. Passwords are encrypted on your device.
          </p>
        </div>
      </div>
      
      <p className="mt-8 text-indigo-300 text-xs font-medium uppercase tracking-widest">Market Operating System 🇳🇬</p>
      
      <style>{`
        .animate-shake {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}</style>
    </div>
  );
};

export default AuthScreen;
