import React, { useEffect, useState } from 'react';
import { Sparkles, ShieldCheck, Box, User, Receipt, CheckCircle, ArrowRight, Star, Globe, Lock, Play, Layers, WifiOff, Cloud, Database } from 'lucide-react';
import { getBusinessCount } from '../services/api';

interface WelcomeScreenProps {
  onRegister: () => void;
  onLogin: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onRegister, onLogin }) => {
  const [businessCount, setBusinessCount] = useState<number | null>(null);

  useEffect(() => {
    getBusinessCount().then(data => {
      if (data && typeof data.count === 'number') {
        setBusinessCount(data.count);
      }
    }).catch(() => setBusinessCount(null));
  }, []);

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
                Ginvoice Market OS.
              </h1>
              <p className="text-xl text-gray-500 font-medium max-w-lg mx-auto md:mx-0">
                The Operating System for Your Market. Invoicing, Inventory, and Debt Tracking.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start pt-4">
                 <button
                    onClick={onRegister}
                    className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold text-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-xl"
                 >
                    <Sparkles size={20} className="text-yellow-400" /> Start Your 30-Day Free Trial
                 </button>
                 <button
                    onClick={onLogin}
                    className="px-8 py-4 bg-white border-2 border-gray-100 text-gray-900 rounded-2xl font-bold text-lg hover:bg-gray-50 active:scale-95 transition-all"
                 >
                    Login
                 </button>
              </div>
           </div>

           {/* Hero Image */}
           <div className="flex-1 w-full max-w-lg relative animate-float">
              <div className="aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl shadow-indigo-200 border-4 border-white transform rotate-2">
                 <img
                   src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80"
                   alt="Business Dashboard"
                   className="w-full h-full object-cover"
                 />
                 <div className="absolute inset-0 bg-indigo-900/5 mix-blend-multiply" />
              </div>
           </div>
        </div>
      </section>

      {/* Social Proof Strip */}
      <section className="bg-gray-900 py-6 text-white overflow-hidden">
         <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-center gap-6 text-center">
            <div className="flex -space-x-2">
               <div className="w-8 h-8 rounded-full bg-indigo-500 border-2 border-gray-900"></div>
               <div className="w-8 h-8 rounded-full bg-pink-500 border-2 border-gray-900"></div>
               <div className="w-8 h-8 rounded-full bg-emerald-500 border-2 border-gray-900"></div>
               <div className="w-8 h-8 rounded-full bg-white text-gray-900 flex items-center justify-center text-[10px] font-bold border-2 border-gray-900">+</div>
            </div>
            <p className="font-medium text-gray-300 text-sm md:text-base">
               Join <span className="font-black text-white text-lg">
                 {businessCount !== null ? (businessCount >= 2000 ? '2,000+' : businessCount.toLocaleString()) : '1,000+'}
               </span> businesses growing with Ginvoice today.
            </p>
         </div>
      </section>

      {/* Features Strip */}
      <section className="py-12 bg-white border-b border-gray-100">
         <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 transition-colors">
               <div className="bg-indigo-100 p-3 rounded-xl text-indigo-600"><Box size={24} /></div>
               <div>
                  <h3 className="font-bold text-gray-900">Stock Control</h3>
                  <p className="text-sm text-gray-500">Stop theft and track every item.</p>
               </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 transition-colors">
               <div className="bg-pink-100 p-3 rounded-xl text-pink-600"><User size={24} /></div>
               <div>
                  <h3 className="font-bold text-gray-900">Debt Tracking</h3>
                  <p className="text-sm text-gray-500">Know exactly who owes you.</p>
               </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 transition-colors">
               <div className="bg-emerald-100 p-3 rounded-xl text-emerald-600"><Globe size={24} /></div>
               <div>
                  <h3 className="font-bold text-gray-900">Remote Supervision</h3>
                  <p className="text-sm text-gray-500">Manage your shop from anywhere.</p>
               </div>
            </div>
         </div>
      </section>

      {/* Ready on Day One Section */}
      <section className="py-20 px-4 bg-white">
         <div className="max-w-4xl mx-auto bg-gradient-to-br from-indigo-50 to-white rounded-[2.5rem] p-8 md:p-12 border border-indigo-100 shadow-xl">
            <div className="text-center space-y-4 mb-10">
               <div className="inline-flex items-center gap-2 bg-indigo-100 px-4 py-1.5 rounded-full text-indigo-700 text-xs font-black uppercase tracking-widest">
                  <Play size={12} fill="currentColor" /> Instant Start
               </div>
               <h2 className="text-3xl font-black text-gray-900">Ready on Day One.</h2>
               <p className="text-gray-500 max-w-lg mx-auto">No setup fees. No training required. Log in and start working immediately.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
               <div className="text-center space-y-3">
                  <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-indigo-600 mx-auto border border-indigo-50">
                     <Receipt size={24} />
                  </div>
                  <p className="font-bold text-sm text-gray-900">Create Invoices</p>
               </div>
               <div className="text-center space-y-3">
                  <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-pink-600 mx-auto border border-pink-50">
                     <Box size={24} />
                  </div>
                  <p className="font-bold text-sm text-gray-900">Track Inventory</p>
               </div>
               <div className="text-center space-y-3">
                  <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-emerald-600 mx-auto border border-emerald-50">
                     <User size={24} />
                  </div>
                  <p className="font-bold text-sm text-gray-900">Add Staff</p>
               </div>
               <div className="text-center space-y-3">
                  <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-orange-600 mx-auto border border-orange-50">
                     <Layers size={24} />
                  </div>
                  <p className="font-bold text-sm text-gray-900">Monitor Debtors</p>
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
                     <span className="font-medium text-gray-300">Offline Sales Support</span>
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

      {/* Real Stories (Testimonials) */}
      <section className="py-24 px-4 bg-gray-50">
         <div className="max-w-6xl mx-auto space-y-12">
            <div className="text-center space-y-4">
               <h2 className="text-4xl font-black text-gray-900">Real Stories from Real Traders</h2>
               <p className="text-gray-500 text-lg">Join hundreds of Nigerian businesses growing with Ginvoice.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               {/* Card 1 */}
               <div className="bg-white p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex gap-1 text-yellow-400 mb-4"><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /></div>
                  <p className="text-gray-700 font-medium mb-6">"Never knew the importance of stock until now."</p>
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-xs">TV</div>
                     <span className="font-bold text-sm text-gray-900">Teknod Ventures</span>
                  </div>
               </div>

               {/* Card 2 */}
               <div className="bg-white p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex gap-1 text-yellow-400 mb-4"><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /></div>
                  <p className="text-gray-700 font-medium mb-6">"Helped me find holes within my sales girl service."</p>
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center text-pink-700 font-bold text-xs">RS</div>
                     <span className="font-bold text-sm text-gray-900">Retail Shop Owner</span>
                  </div>
               </div>

               {/* Card 3 */}
               <div className="bg-white p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex gap-1 text-yellow-400 mb-4"><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /></div>
                  <p className="text-gray-700 font-medium mb-6">"I can accurately keep track of profits."</p>
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold text-xs">ZR</div>
                     <span className="font-bold text-sm text-gray-900">Ziaroyalle</span>
                  </div>
               </div>

               {/* Card 4 */}
               <div className="bg-white p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex gap-1 text-yellow-400 mb-4"><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /></div>
                  <p className="text-gray-700 font-medium mb-6">"When onboarding it was a lot of work I will admit, but being able to supervise my goods from anywhere in the world is a win."</p>
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-700 font-bold text-xs">TR</div>
                     <span className="font-bold text-sm text-gray-900">Tretize</span>
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* Trust & Reliability Signals */}
      <section className="py-12 bg-gray-50 border-t border-gray-200">
         <div className="max-w-6xl mx-auto px-4 flex flex-wrap justify-center gap-x-12 gap-y-6 text-gray-500 font-bold text-xs uppercase tracking-widest">
            <div className="flex items-center gap-3">
               <Lock size={16} className="text-gray-400" /> Secure by Design
            </div>
            <div className="flex items-center gap-3">
               <WifiOff size={16} className="text-gray-400" /> Offline-First Support
            </div>
            <div className="flex items-center gap-3">
               <Database size={16} className="text-gray-400" /> Data Backed Up Automatically
            </div>
            <div className="flex items-center gap-3">
               <Cloud size={16} className="text-gray-400" /> Built for Unstable Internet
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
      `}</style>
    </div>
  );
};

export default WelcomeScreen;
