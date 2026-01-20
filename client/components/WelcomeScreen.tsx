import React from 'react';
import { Sparkles, ShieldCheck, Box, User, Receipt, CheckCircle, ArrowRight } from 'lucide-react';

interface WelcomeScreenProps {
  onRegister: () => void;
  onLogin: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onRegister, onLogin }) => {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 scroll-smooth">
      {/* Sticky Navbar */}
      <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <img src="/ginvoice.png" alt="Logo" className="w-8 h-8 rounded-lg" onError={(e) => (e.currentTarget.style.display = 'none')} />
             <span className="text-xl font-bold tracking-tight">Ginvoice Market OS</span>
          </div>
          <div className="flex items-center gap-4">
             <button onClick={onLogin} className="text-sm font-bold text-gray-600 hover:text-indigo-600 transition-colors">
               Login
             </button>
             <button
               onClick={onRegister}
               className="bg-indigo-600 text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
             >
               Get Started
             </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-br from-indigo-50 to-white overflow-hidden">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">
           <div className="flex-1 text-center md:text-left space-y-6 animate-in slide-in-from-bottom-8 fade-in duration-700">
              <h1 className="text-5xl md:text-6xl font-black text-gray-900 leading-tight">
                The Operating System<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">for Your Market.</span>
              </h1>
              <p className="text-xl text-gray-500 font-medium max-w-lg mx-auto md:mx-0">
                Invoicing, Inventory, and Debt Tracking. Simplified. Run your entire shop from your phone.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start pt-4">
                 <button
                    onClick={onRegister}
                    className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold text-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                 >
                    <Sparkles size={20} className="text-yellow-400" /> Start Free Trial
                 </button>
                 <button
                    onClick={onLogin}
                    className="px-8 py-4 bg-white border-2 border-gray-100 text-gray-900 rounded-2xl font-bold text-lg hover:bg-gray-50 active:scale-95 transition-all"
                 >
                    Login to Shop
                 </button>
              </div>
           </div>

           {/* Animated Floating Image */}
           <div className="flex-1 w-full max-w-lg relative animate-float">
              <div className="aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl shadow-indigo-200 border-4 border-white transform rotate-2">
                 <img
                   src="https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?w=800&q=80"
                   alt="Modern Market Desk"
                   className="w-full h-full object-cover"
                 />
                 <div className="absolute inset-0 bg-indigo-900/10 mix-blend-multiply" />
              </div>

              {/* Floating Badge */}
              <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-2xl shadow-xl flex items-center gap-3 animate-bounce-slow">
                 <div className="bg-emerald-100 p-2 rounded-full text-emerald-600"><CheckCircle size={24} /></div>
                 <div>
                    <p className="text-xs font-bold text-gray-400 uppercase">Sales Today</p>
                    <p className="text-lg font-black text-gray-900">₦1,250,000</p>
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* Power Features Grid */}
      <section className="py-24 px-4 bg-white">
         <div className="max-w-6xl mx-auto space-y-16">
            <div className="text-center max-w-2xl mx-auto space-y-4">
               <h2 className="text-4xl font-black text-gray-900">Everything you need to run your shop.</h2>
               <p className="text-gray-500 text-lg">Replace your notebook and calculator with a professional digital tool.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
               {/* Card 1 */}
               <div className="group p-8 rounded-3xl bg-gray-50 hover:bg-indigo-50 transition-colors duration-300 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                  <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-110 transition-transform">
                     <Receipt size={28} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Professional Invoices</h3>
                  <p className="text-gray-500">Generate and print receipts in seconds. Impress your customers and look professional.</p>
               </div>

               {/* Card 2 */}
               <div className="group p-8 rounded-3xl bg-gray-50 hover:bg-indigo-50 transition-colors duration-300 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                  <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-pink-600 mb-6 group-hover:scale-110 transition-transform">
                     <Box size={28} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Stock Tracking</h3>
                  <p className="text-gray-500">Never lose money to theft. Know exactly what you have in stock at any moment.</p>
               </div>

               {/* Card 3 */}
               <div className="group p-8 rounded-3xl bg-gray-50 hover:bg-indigo-50 transition-colors duration-300 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
                  <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-emerald-600 mb-6 group-hover:scale-110 transition-transform">
                     <User size={28} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Debt Management</h3>
                  <p className="text-gray-500">Track who owes you money automatically. Send reminders and get paid faster.</p>
               </div>
            </div>
         </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 px-4 bg-gray-900 text-white">
         <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-12 bg-white/5 rounded-[3rem] p-8 md:p-12 border border-white/10 relative overflow-hidden">
            {/* Glow Effect */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />

            <div className="flex-1 space-y-6 z-10">
               <h2 className="text-4xl font-black">Simple Pricing.<br />No Surprises.</h2>
               <div className="space-y-4">
                  <div className="flex items-center gap-3">
                     <div className="bg-emerald-500/20 p-1 rounded-full text-emerald-400"><CheckCircle size={16} /></div>
                     <span className="font-medium text-gray-300">Unlimited Invoices & Receipts</span>
                  </div>
                  <div className="flex items-center gap-3">
                     <div className="bg-emerald-500/20 p-1 rounded-full text-emerald-400"><CheckCircle size={16} /></div>
                     <span className="font-medium text-gray-300">Full Offline Mode Support</span>
                  </div>
                  <div className="flex items-center gap-3">
                     <div className="bg-emerald-500/20 p-1 rounded-full text-emerald-400"><CheckCircle size={16} /></div>
                     <span className="font-medium text-gray-300">Multi-Staff Permissions</span>
                  </div>
               </div>
               <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg text-sm font-bold text-yellow-400">
                  <Sparkles size={16} /> 7-Day Free Trial included
               </div>
            </div>

            <div className="bg-white text-gray-900 p-8 rounded-3xl w-full max-w-xs text-center space-y-6 shadow-2xl z-10 transform md:rotate-3 hover:rotate-0 transition-transform duration-300">
               <h3 className="text-gray-500 font-bold uppercase tracking-widest text-xs">Standard Plan</h3>
               <div className="space-y-1">
                  <p className="text-5xl font-black">₦2,000</p>
                  <p className="text-gray-400 font-medium">per month</p>
               </div>
               <button
                  onClick={onRegister}
                  className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"
               >
                  Get Started <ArrowRight size={18} />
               </button>
            </div>
         </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-white border-t border-gray-100">
         <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-gray-400 font-medium">
            <p>© 2026 Ginvoice Market OS. All rights reserved.</p>
            <div className="flex gap-8">
               <a href="/privacy.html" className="hover:text-gray-900 transition-colors">Privacy Policy</a>
               <a href="/terms.html" className="hover:text-gray-900 transition-colors">Terms of Service</a>
            </div>
         </div>
      </footer>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        @keyframes bounce-slow {
           0%, 100% { transform: translateY(0px); }
           50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow {
           animation: bounce-slow 4s ease-in-out infinite;
           animation-delay: 1s;
        }
      `}</style>
    </div>
  );
};

export default WelcomeScreen;
