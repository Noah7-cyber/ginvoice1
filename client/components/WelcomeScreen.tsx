import React, { useEffect, useState } from 'react';
import { Sparkles, ShieldCheck, Box, User, Receipt, CheckCircle, ArrowRight, Star, Globe, Lock, Play, Layers, WifiOff, Cloud, Database, MessageCircle, ShoppingBag, Scissors, Wrench, Pill, ShoppingCart, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
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
             <img src="/ginvoice.png" alt="Ginvoice Logo" className="w-8 h-8 rounded-lg" onError={(e) => (e.currentTarget.style.display = 'none')} />
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
              <h1 className="text-4xl md:text-6xl font-black text-gray-900 leading-tight">
                The Easy Way to Manage Your Shop & Money.
              </h1>
              <p className="text-xl text-gray-600 font-medium max-w-lg mx-auto md:mx-0">
                Invoicing, Stock Control, and Debt Tracking for Nigerian businesses.
              </p>

              <div className="space-y-4">
                 <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start pt-4">
                    <button
                        onClick={onRegister}
                        className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-200"
                    >
                        <Sparkles size={20} className="text-yellow-300" /> Start Free 30-Day Trial
                    </button>
                    <button
                        onClick={onLogin}
                        className="px-8 py-4 bg-white border-2 border-gray-200 text-gray-700 rounded-2xl font-bold text-lg hover:bg-gray-50 hover:border-gray-300 active:scale-95 transition-all"
                    >
                        Login
                    </button>
                 </div>
                 <p className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center justify-center md:justify-start gap-2">
                    <ShieldCheck size={14} className="text-green-500" /> No card required • Cancel anytime • Set up in minutes
                 </p>
              </div>
           </div>

           {/* Hero Image */}
           <div className="flex-1 w-full max-w-lg relative animate-float">
              <div className="aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl shadow-indigo-200 border-4 border-white transform rotate-2">
                 <img
                   src="https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?auto=format&fit=crop&w=800&q=80"
                   alt="Shop owner managing business on tablet"
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
               <div className="w-8 h-8 rounded-full bg-indigo-500 border-2 border-gray-900 flex items-center justify-center text-xs font-bold">MG</div>
               <div className="w-8 h-8 rounded-full bg-pink-500 border-2 border-gray-900 flex items-center justify-center text-xs font-bold">CK</div>
               <div className="w-8 h-8 rounded-full bg-emerald-500 border-2 border-gray-900 flex items-center justify-center text-xs font-bold">ZR</div>
               <div className="w-8 h-8 rounded-full bg-white text-gray-900 flex items-center justify-center text-[10px] font-bold border-2 border-gray-900">+</div>
            </div>
            <p className="font-medium text-gray-300 text-sm md:text-base">
               Join <span className="font-black text-white text-lg">
                 {businessCount !== null ? (businessCount >= 2000 ? '2,000+' : businessCount.toLocaleString()) : '1,000+'}
               </span> Nigerian businesses growing with Ginvoice.
            </p>
         </div>
      </section>

      {/* Features Strip (Benefits) */}
      <section className="py-12 bg-white border-b border-gray-100">
         <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 transition-colors group">
               <div className="bg-indigo-100 p-3 rounded-xl text-indigo-600 group-hover:bg-indigo-200 transition-colors"><Box size={24} /></div>
               <div>
                  <h3 className="font-bold text-gray-900">Stop Shop Theft</h3>
                  <p className="text-sm text-gray-500">Track every item in stock automatically.</p>
               </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 transition-colors group">
               <div className="bg-pink-100 p-3 rounded-xl text-pink-600 group-hover:bg-pink-200 transition-colors"><User size={24} /></div>
               <div>
                  <h3 className="font-bold text-gray-900">Collect Debts Faster</h3>
                  <p className="text-sm text-gray-500">Know exactly who owes you money.</p>
               </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 transition-colors group">
               <div className="bg-emerald-100 p-3 rounded-xl text-emerald-600 group-hover:bg-emerald-200 transition-colors"><Globe size={24} /></div>
               <div>
                  <h3 className="font-bold text-gray-900">See Sales From Home</h3>
                  <p className="text-sm text-gray-500">Supervise your shop without being there.</p>
               </div>
            </div>
         </div>
      </section>

      {/* Who It's For Section */}
      <section className="py-20 px-4 bg-gray-50">
          <div className="max-w-6xl mx-auto">
              <div className="text-center mb-12 space-y-2">
                  <h2 className="text-3xl font-black text-gray-900">Is Ginvoice For You?</h2>
                  <p className="text-gray-500">Perfect for Nigerian business owners who want peace of mind.</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                  <div className="bg-white p-6 rounded-2xl shadow-sm text-center space-y-3 hover:-translate-y-1 transition-transform duration-300">
                      <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto"><ShoppingBag size={24} /></div>
                      <p className="font-bold text-gray-900 text-sm">Provision Stores</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm text-center space-y-3 hover:-translate-y-1 transition-transform duration-300">
                      <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto"><Scissors size={24} /></div>
                      <p className="font-bold text-gray-900 text-sm">Boutiques</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm text-center space-y-3 hover:-translate-y-1 transition-transform duration-300">
                      <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto"><Wrench size={24} /></div>
                      <p className="font-bold text-gray-900 text-sm">Spare Parts</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm text-center space-y-3 hover:-translate-y-1 transition-transform duration-300">
                      <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto"><ShoppingCart size={24} /></div>
                      <p className="font-bold text-gray-900 text-sm">Supermarkets</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm text-center space-y-3 hover:-translate-y-1 transition-transform duration-300 col-span-2 md:col-span-1">
                      <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto"><Pill size={24} /></div>
                      <p className="font-bold text-gray-900 text-sm">Pharmacies</p>
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
               <h2 className="text-3xl font-black text-gray-900">Know Your Profit.</h2>
               <p className="text-gray-500 max-w-lg mx-auto">No setup fees. No training required. Log in and start tracking immediately.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
               <div className="text-center space-y-3">
                  <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-indigo-600 mx-auto border border-indigo-50">
                     <Receipt size={24} />
                  </div>
                  <p className="font-bold text-sm text-gray-900">Print Receipts</p>
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
                  <p className="font-bold text-sm text-gray-900">Supervise Staff</p>
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
               <h2 className="text-4xl font-black">Simple Pricing.<br />Cheaper than a Recharge Card.</h2>
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
                     <span className="font-medium text-gray-300">Supervise Staff & Track Debt</span>
                  </div>
               </div>
               <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg text-sm font-bold text-yellow-400">
                  <Sparkles size={16} /> 30-Day Free Trial (No Card Needed)
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {/* Card 1: Madam Grace */}
               <div className="bg-white p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex gap-1 text-yellow-400 mb-4"><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /></div>
                  <p className="text-gray-700 font-medium mb-6">"Before Ginvoice, my sales girl would tell me stories. Now I check everything from my house. It is very easy to use."</p>
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-xs">MG</div>
                     <div>
                        <span className="font-bold text-sm text-gray-900 block">Madam Grace</span>
                        <span className="text-xs text-gray-500">Provision Store Owner, Lagos</span>
                     </div>
                  </div>
               </div>

                {/* Card 2: Teknod */}
               <div className="bg-white p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex gap-1 text-yellow-400 mb-4"><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /></div>
                  <p className="text-gray-700 font-medium mb-6">"Selling tailoring materials has many small items. Ginvoice helps me track every button and thread. No more loss."</p>
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-xs">TV</div>
                     <div>
                        <span className="font-bold text-sm text-gray-900 block">Teknod Ventures</span>
                        <span className="text-xs text-gray-500">Tailoring Materials</span>
                     </div>
                  </div>
               </div>

                {/* Card 3: Mr Henry (CK) */}
               <div className="bg-white p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex gap-1 text-yellow-400 mb-4"><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /></div>
                  <p className="text-gray-700 font-medium mb-6">"I distribute Great Insect Repellant. Managing stock across locations was hard until I found this app. Highly recommended."</p>
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold text-xs">CK</div>
                     <div>
                        <span className="font-bold text-sm text-gray-900 block">Mr. Henry (CK)</span>
                        <span className="text-xs text-gray-500">Great Insect Repellant</span>
                     </div>
                  </div>
               </div>

               {/* Card 4: Zia Royalle */}
               <div className="bg-white p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex gap-1 text-yellow-400 mb-4"><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /></div>
                  <p className="text-gray-700 font-medium mb-6">"As a fashion designer, I need to know my profit on every cloth I sew. Ginvoice makes it simple."</p>
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-bold text-xs">ZR</div>
                     <div>
                        <span className="font-bold text-sm text-gray-900 block">Zia Royalle</span>
                        <span className="text-xs text-gray-500">Fashion Designer</span>
                     </div>
                  </div>
               </div>

               {/* Card 5: Tretize */}
               <div className="bg-white p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex gap-1 text-yellow-400 mb-4"><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /></div>
                  <p className="text-gray-700 font-medium mb-6">"Selling drinks is fast-paced. I need speed and accuracy. This app gives me both. Onboarding was work, but worth it."</p>
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-700 font-bold text-xs">TR</div>
                     <div>
                        <span className="font-bold text-sm text-gray-900 block">Tretize</span>
                        <span className="text-xs text-gray-500">Drinks Dealer</span>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 bg-white">
          <div className="max-w-3xl mx-auto space-y-12">
              <div className="text-center space-y-4">
                  <h2 className="text-3xl font-black text-gray-900">Common Questions</h2>
                  <p className="text-gray-500">Everything you need to know about Ginvoice.</p>
              </div>

              <div className="space-y-4">
                  <FAQItem
                     question="Do I need internet to use it?"
                     answer="No! Ginvoice works offline. You can sell and record everything without data. You only need internet to sync (backup) your data."
                  />
                   <FAQItem
                     question="Can my staff steal money or stock?"
                     answer="It becomes very hard. Ginvoice tracks every single item. If stock is missing, the system will show you exactly what is gone and when."
                  />
                  <FAQItem
                     question="Can I print receipts?"
                     answer="Yes. You can print professional receipts using any standard 58mm or 80mm Bluetooth thermal printer."
                  />
                  <FAQItem
                     question="How much is it?"
                     answer="It costs ₦2,000 per month. That's less than ₦70 per day—cheaper than a bottle of Coke."
                  />
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

      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/2348051763431"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 p-4 bg-green-500 text-white rounded-full shadow-lg hover:bg-green-600 transition-all hover:scale-110"
      >
        <MessageCircle size={24} />
      </a>
    </div>
  );
};

const FAQItem = ({ question, answer }: { question: string, answer: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border border-gray-200 rounded-2xl overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 md:p-6 bg-white hover:bg-gray-50 transition-colors text-left"
            >
                <span className="font-bold text-gray-900 text-lg">{question}</span>
                {isOpen ? <ChevronUp className="text-indigo-600" /> : <ChevronDown className="text-gray-400" />}
            </button>
            {isOpen && (
                <div className="p-4 md:p-6 pt-0 bg-white text-gray-600 leading-relaxed">
                    {answer}
                </div>
            )}
        </div>
    );
};

export default WelcomeScreen;
