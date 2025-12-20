
import React, { useState } from 'react';
import { ShoppingBag, ArrowLeft, Send, Mail, Store, CheckCircle2, AlertCircle } from 'lucide-react';

interface ForgotPasswordScreenProps {
  onBack: () => void;
  businessName: string;
}

const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ onBack, businessName }) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API call to backend
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-indigo-700 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-indigo-700 via-indigo-600 to-indigo-800">
      <div className="mb-8 text-center text-white">
        <div className="bg-white/10 p-4 rounded-3xl inline-block mb-2 backdrop-blur-lg">
          <ShoppingBag size={48} className="text-white" />
        </div>
        <h1 className="text-2xl font-black tracking-tight">Recovery Center</h1>
      </div>

      <div className="w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl p-8 space-y-8 overflow-hidden">
        {submitted ? (
          <div className="text-center space-y-6 animate-in zoom-in-95">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={48} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-gray-900">Request Sent!</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                We've sent recovery instructions to <strong>{email}</strong>. Please check your inbox or spam folder.
              </p>
            </div>
            <button 
              onClick={onBack}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition-all"
            >
              Return to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <button 
                type="button"
                onClick={onBack}
                className="flex items-center gap-2 text-indigo-600 font-bold text-xs hover:underline"
              >
                <ArrowLeft size={14} /> Back to Login
              </button>
              <h2 className="text-2xl font-black text-gray-900">Forgot Password?</h2>
              <p className="text-sm text-gray-500">Enter your registered business email to reset your access.</p>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center gap-3">
                <Store size={20} className="text-indigo-400" />
                <div className="flex-1 overflow-hidden">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Store Identifying</p>
                  <p className="font-bold text-gray-700 truncate">{businessName}</p>
                </div>
              </div>

              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  required
                  type="email" 
                  placeholder="name@email.com"
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none font-bold"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center gap-2">Processing...</span>
              ) : (
                <>Reset Password <Send size={18} /></>
              )}
            </button>

            <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl text-amber-700">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <p className="text-[10px] leading-relaxed font-medium">
                If you didn't provide a valid email during registration, please contact your market supervisor or system administrator.
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordScreen;
