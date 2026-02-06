import React, { useState } from 'react';
import { adminLogin, saveAdminToken } from '../services/api';
import { useToast } from './ToastProvider';
import { Lock, ShieldCheck, Loader2, ArrowRight } from 'lucide-react';

interface AdminLoginProps {
  onLoginSuccess: () => void;
}

const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess }) => {
  const { addToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      addToast('Please fill all fields', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const response = await adminLogin(email, password);
      if (response && response.token) {
        saveAdminToken(response.token);
        addToast('Welcome back, Admin', 'success');
        onLoginSuccess();
      } else {
        addToast('Invalid credentials', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Login failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-100 p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-blue-500/20 shadow-xl">
             <ShieldCheck size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight mb-2">Command Center</h1>
          <p className="text-gray-400">Restricted Access. Authorized Personnel Only.</p>
        </div>

        <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Admin Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 pl-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-600 transition-all"
                  placeholder="admin@ginvoice.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Access Key
              </label>
              <div className="relative">
                 <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 pl-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-600 transition-all"
                  placeholder="••••••••••••"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600">
                    <Lock size={16} />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isLoading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <span>Authenticate</span>
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-8 text-center">
            <a href="/" className="text-sm font-bold text-gray-500 hover:text-gray-300 transition-colors">
                ← Return to Main Application
            </a>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
