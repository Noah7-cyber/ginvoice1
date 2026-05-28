import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, ShieldCheck, Box, User, CheckCircle, ArrowRight, Star,
  WifiOff, Cloud, Database, PieChart, Activity,
  BarChart3, Bot, Lock, ChevronDown, ArrowUp
} from 'lucide-react';
import { getBusinessCount } from './services/api';
import { useTranslation } from 'react-i18next';

// --- DATA ---
const TESTIMONIALS = [
  {
    text: "Before Ginvoice, my sales girl would tell me stories. Now I check everything from my house. It is very easy to use.",
    author: "Madam Grace",
    role: "Provision Store Owner",
    initials: "MG",
    color: "bg-indigo-100 text-indigo-700"
  },
  {
    text: "Selling tailoring materials has many small items. Ginvoice helps me track every button and thread. No more loss.",
    author: "Teknod Ventures",
    role: "Tailoring Materials",
    initials: "TV",
    color: "bg-emerald-100 text-emerald-700"
  },
  {
     text: "As a fashion designer, I need to know my profit on every cloth I sew. Ginvoice makes it simple.",
     author: "Zia Royalle",
     role: "Fashion Designer",
     initials: "ZR",
     color: "bg-purple-100 text-purple-700"
  }
];

const FAQS = [
  {
     question: "Do I need internet to use it?",
     answer: "No! Ginvoice works offline. You can sell and record everything without data. You only need internet to sync (backup) your data to our secure cloud."
  },
  {
     question: "Can my staff steal money or stock?",
     answer: "It becomes very hard. Ginvoice tracks every single item in real-time. If stock is missing, the system will show you exactly what is gone and when."
  },
  {
     question: "Can I print receipts?",
     answer: "Yes. You can print professional receipts using any standard 58mm or 80mm Bluetooth thermal printer directly from your device."
  },
  {
     question: "Are there setup fees or hidden charges?",
     answer: "No hidden charges whatsoever. You only pay the flat subscription fee, which gives you unlimited access to all basic features without any surprise billing."
  }
];

// --- ANIMATION VARIANTS & FEATURES ---
const FEATURES = [
  {
    id: 'ai',
    title: 'AI Business Intelligence',
    icon: Bot,
    color: 'text-purple-400',
    bgLight: 'bg-purple-500/10',
    bgDark: 'bg-slate-800',
    border: '!border-purple-500/50',
    description: 'gBot is not just a support bot—it is your personal data analyst. Get instant business reports, inventory predictions, and actionable insights to grow your margins.',
    renderVisual: () => {
      return (
      <div className="flex flex-col h-full bg-slate-900 rounded-3xl p-6 md:p-8 shadow-2xl relative border border-slate-800 overflow-hidden min-h-[300px]">
         <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />
         
         <div className="flex-1 space-y-6 flex flex-col justify-end text-sm md:text-base">
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="flex gap-3 justify-end items-end">
               <div className="bg-slate-800 p-4 rounded-2xl rounded-br-sm text-slate-200 border border-slate-700 shadow-sm max-w-[85%]">
                 Give me a quick analysis of yesterday's sales.
               </div>
               <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 border border-slate-600"><User size={18} className="text-slate-300" /></div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.0 }} className="flex gap-3 items-end">
               <div className="w-10 h-10 rounded-full bg-purple-900/80 flex flex-shrink-0 items-center justify-center border border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.4)]"><Bot size={18} className="text-purple-300" /></div>
               <div className="bg-purple-900/30 border border-purple-500/30 p-4 md:p-5 rounded-2xl rounded-bl-sm text-purple-100 shadow-sm max-w-[90%] space-y-4">
                 <p>Yesterday's revenue was <strong>₦245,000</strong> (+12% vs last Tuesday).</p>
                 <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ delay: 2.0 }} className="bg-purple-950/50 p-3 rounded-xl border border-purple-800/50 overflow-hidden">
                    <p className="text-xs text-purple-300 mb-2 font-semibold tracking-wide uppercase">Top Movers:</p>
                    <div className="flex justify-between items-center text-sm mb-1"><span className="text-white">1. Peak Milk (Carton)</span><span className="text-emerald-400 font-bold">↑ 24 units</span></div>
                    <div className="flex justify-between items-center text-sm"><span className="text-white">2. Milo (500g)</span><span className="text-emerald-400 font-bold">↑ 18 units</span></div>
                 </motion.div>
                 <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.0 }} className="text-sm italic text-purple-300/90">
                    Prediction: You will run out of Peak Milk in 4 days. <br/><span className="underline cursor-pointer font-semibold text-purple-200 mt-1 inline-block hover:text-white transition-colors">Draft restock order?</span>
                 </motion.p>
               </div>
            </motion.div>
         </div>
      </div>
    )}
  },
  {
    id: 'offline',
    title: 'Unbreakable Offline Mode',
    icon: WifiOff,
    color: 'text-indigo-400',
    bgLight: 'bg-indigo-500/10',
    bgDark: 'bg-slate-800',
    border: '!border-indigo-500/50',
    description: 'Sales never stop. State-of-the-art background sync queue with strict idempotency logic guarantees zero duplicate records when the internet returns.',
    renderVisual: () => (
      <div className="flex flex-col h-full bg-slate-900 rounded-3xl p-6 md:p-8 font-mono text-sm text-indigo-300 shadow-2xl relative border border-slate-800 overflow-hidden min-h-[300px]">
         <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />
         <div className="flex justify-between items-center mb-6 md:mb-8 text-slate-500 border-b border-slate-800 pb-4">
            <span className="flex items-center gap-2">Network: <span className="text-red-400 flex items-center gap-2"><WifiOff size={16}/> Offline</span></span>
            <Cloud size={20} className="text-slate-600" />
         </div>
         <div className="space-y-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="opacity-80 flex gap-2">
                <span className="text-indigo-500">{'>'}</span> <span>Queueing transaction <br/><span className="text-indigo-200">{`{ id: "tx...", amount: 4500 }`}</span></span>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }} className="opacity-80 flex gap-2">
                <span className="text-indigo-500">{'>'}</span> <span>Idempotency key generated: <span className="text-emerald-400 font-bold">idk_bf2k</span></span>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.0 }} className="opacity-80 flex gap-2">
                <span className="text-indigo-500">{'>'}</span> <span>Stored locally.<br/>Awaiting network restoration...</span>
            </motion.div>
         </div>
         
         <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.5 }} className="mt-auto border-t border-slate-800 pt-6 flex items-center justify-between">
             <span className="text-emerald-400 flex items-center gap-3 font-semibold"><div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"/> Online</span>
             <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 4.5 }} className="text-slate-400">Syncing... <span className="text-white">100%</span></motion.span>
         </motion.div>
      </div>
    )
  },
  {
    id: 'inventory',
    title: 'Advanced Inventory Control',
    icon: Database,
    color: 'text-emerald-400',
    bgLight: 'bg-emerald-500/10',
    bgDark: 'bg-slate-800',
    border: '!border-emerald-500/50',
    description: 'Real-time tracking, proactive low-stock alerts, and rapid onboarding with bulk CSV imports. Control thousands of SKUs flawlessly.',
    renderVisual: () => (
      <div className="flex flex-col h-full bg-slate-900 rounded-3xl p-6 md:p-8 shadow-2xl relative border border-slate-800 overflow-hidden min-h-[300px]">
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />
         
         <div className="space-y-6 relative z-10 h-full flex flex-col justify-center">
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                   <span className="text-sm md:text-base font-semibold text-slate-300">Bulk CSV Import</span>
                   <span className="text-sm text-emerald-400 font-mono">1,200 / 1,200</span>
                </div>
                <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden">
                   <motion.div initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }} className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full" />
                </div>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2 }} className="mt-4 text-sm text-emerald-400 flex items-center gap-2 font-semibold">
                   <CheckCircle size={16}/> Import Complete Successfully
                </motion.div>
             </motion.div>

             <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.7 }} className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
                <div className="flex items-start gap-4">
                   <div className="bg-amber-500/20 text-amber-500 p-3 rounded-xl"><Activity size={20}/></div>
                   <div>
                      <h4 className="font-bold text-amber-100">Low Stock Alert</h4>
                      <p className="text-sm text-amber-200/80 mt-1">Product B is running critically low across 2 branches.</p>
                      <div className="mt-3 text-xs font-mono font-semibold text-amber-900 bg-amber-400 inline-block px-3 py-1.5 rounded-md uppercase tracking-wider">2 Units Remaining</div>
                   </div>
                </div>
             </motion.div>
         </div>
      </div>
    )
  },
  {
    id: 'analytics',
    title: 'Comprehensive Analytics',
    icon: BarChart3,
    color: 'text-pink-400',
    bgLight: 'bg-pink-500/10',
    bgDark: 'bg-slate-800',
    border: '!border-pink-500/50',
    description: 'From expenditure tracking to multi-shop capabilities and historic sales ledgers, unlock powerful insights that drive margin improvements.',
    renderVisual: () => (
      <div className="flex flex-col h-full bg-slate-900 rounded-3xl p-6 md:p-8 shadow-2xl relative border border-slate-800 overflow-hidden min-h-[300px]">
         <div className="absolute top-0 right-0 w-96 h-96 bg-pink-500/10 blur-[100px] rounded-full pointer-events-none" />
         
         <div className="flex justify-between items-end mb-8 relative z-10">
            <div>
               <h4 className="text-slate-400 text-sm font-semibold mb-1 uppercase tracking-widest">Total Sales</h4>
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-3xl md:text-4xl font-bold text-white">₦42.5M</motion.div>
            </div>
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.0 }} className="text-emerald-400 flex items-center gap-1 font-semibold bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
               <ArrowUp size={16} /> 24%
            </motion.div>
         </div>

         <div className="flex-1 flex items-end justify-between gap-3 md:gap-5 mt-auto relative z-10 min-h-[140px]">
            {[40, 60, 30, 80, 50, 90, 70].map((h, i) => (
              <div key={i} className="flex-1 bg-slate-800/50 rounded-t-xl relative group h-full flex items-end">
                <motion.div 
                   initial={{ height: 0 }} 
                   animate={{ height: `${h}%` }} 
                   transition={{ duration: 1.0, delay: 0.5 + (i * 0.1), ease: "easeOut", type: "spring", bounce: 0.3 }} 
                   className="w-full bg-gradient-to-t from-pink-600 to-pink-400 rounded-t-xl relative overflow-visible"
                >
                   <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-sm font-semibold px-3 py-1.5 rounded-lg text-slate-200 border border-slate-700 shadow-xl pointer-events-none">
                      {h}k
                   </div>
                </motion.div>
              </div>
            ))}
         </div>

         <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.8 }} className="mt-8 flex flex-wrap gap-2 relative z-10">
            <span className="text-xs font-semibold bg-slate-800 text-slate-300 px-3 py-1.5 rounded-full border border-slate-700 hover:bg-slate-700 transition-colors cursor-default">Multi-branch</span>
            <span className="text-xs font-semibold bg-slate-800 text-slate-300 px-3 py-1.5 rounded-full border border-slate-700 hover:bg-slate-700 transition-colors cursor-default">Tax Ready</span>
            <span className="text-xs font-semibold bg-slate-800 text-slate-300 px-3 py-1.5 rounded-full border border-slate-700 hover:bg-slate-700 transition-colors cursor-default">Ledgers</span>
         </motion.div>
      </div>
    )
  }
];

const InteractiveFeatureShowcase = () => {
    const [activeIndex, setActiveIndex] = useState(0);
    const activeFeature = FEATURES[activeIndex];

    return (
        <section className="py-32 px-6 bg-slate-950 text-slate-50 relative" id="features">
            <div className="max-w-7xl mx-auto">
                <div className="mb-16 md:mb-24 text-center md:text-left">
                    <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">
                        Engineering meets commerce. <br className="hidden md:block" />
                        <span className="text-slate-400">Built for speed, reliability, and growth.</span>
                    </h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                    {/* Left side: Feature List */}
                    <div className="lg:col-span-5 space-y-4">
                        {FEATURES.map((feature, i) => {
                            const isActive = i === activeIndex;
                            const Icon = feature.icon;
                            return (
                                <button
                                    key={feature.id}
                                    onClick={() => setActiveIndex(i)}
                                    className={`w-full text-left p-6 rounded-3xl transition-all duration-300 border block ${
                                        isActive 
                                            ? `bg-slate-900 border-slate-700 shadow-xl ${feature.border}` 
                                            : 'bg-transparent border-transparent hover:bg-slate-900/50 hover:border-slate-800'
                                    }`}
                                >
                                    <div className="flex items-center gap-4 mb-2">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isActive ? feature.bgDark : 'bg-slate-800'} ${isActive ? feature.color : 'text-slate-400'} transition-colors`}>
                                            <Icon size={24} />
                                        </div>
                                        <h3 className={`text-xl font-bold ${isActive ? 'text-white' : 'text-slate-400'}`}>
                                            {feature.title}
                                        </h3>
                                    </div>
                                    <AnimatePresence>
                                        {isActive && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.3 }}
                                                className="overflow-hidden"
                                            >
                                                <p className="text-slate-400 text-sm md:text-base leading-relaxed pt-2 pl-16 pb-2">
                                                    {feature.description}
                                                </p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </button>
                            );
                        })}
                    </div>

                    {/* Right side: Interactive Visual */}
                    <div className="lg:col-span-7 relative min-h-[400px]">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeFeature.id}
                                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -20, scale: 0.98 }}
                                transition={{ duration: 0.4 }}
                                className="h-full w-full"
                            >
                                {activeFeature.renderVisual()}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </section>
    );
};

// --- COMPONENTS ---
const FAQItem: React.FC<{ question: string, answer: string }> = ({ question, answer }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border border-slate-200 rounded-2xl overflow-hidden mb-4 bg-white last:mb-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors text-left"
            >
                <span className="font-bold text-slate-900 text-lg">{question}</span>
                <ChevronDown className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
               {isOpen && (
                  <motion.div
                     initial={{ height: 0, opacity: 0 }}
                     animate={{ height: "auto", opacity: 1 }}
                     exit={{ height: 0, opacity: 0 }}
                     className="px-6 text-slate-600 leading-relaxed overflow-hidden"
                  >
                     <div className="pb-6">
                        {answer}
                     </div>
                  </motion.div>
               )}
            </AnimatePresence>
        </div>
    );
};

const TestimonialCarousel = () => {
    const [currentIndex, setCurrentIndex] = useState(0);
    
    useEffect(() => {
       const timer = setInterval(() => {
          setCurrentIndex(prev => (prev + 1) % TESTIMONIALS.length);
       }, 5000);
       return () => clearInterval(timer);
    }, []);

    return (
       <div className="relative overflow-hidden w-full max-w-4xl mx-auto min-h-[300px]">
          <AnimatePresence mode="wait">
             <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-white border border-slate-200/60 rounded-3xl shadow-xl shadow-slate-200/50"
             >
                <div className="flex gap-1 text-yellow-500 mb-6">
                   <Star size={20} fill="currentColor" /><Star size={20} fill="currentColor" /><Star size={20} fill="currentColor" /><Star size={20} fill="currentColor" /><Star size={20} fill="currentColor" />
                </div>
                <p className="text-xl md:text-2xl text-slate-700 font-medium mb-8 leading-relaxed max-w-2xl px-4">
                   "{TESTIMONIALS[currentIndex].text}"
                </p>
                <div className="flex items-center justify-center gap-4">
                   <div className={`w-12 h-12 ${TESTIMONIALS[currentIndex].color} rounded-full flex items-center justify-center font-bold text-lg`}>
                      {TESTIMONIALS[currentIndex].initials}
                   </div>
                   <div className="text-left">
                      <span className="font-bold text-slate-900 block">{TESTIMONIALS[currentIndex].author}</span>
                      <span className="text-sm text-slate-500">{TESTIMONIALS[currentIndex].role}</span>
                   </div>
                </div>
             </motion.div>
          </AnimatePresence>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
             {TESTIMONIALS.map((_, i) => (
                <button
                   key={i}
                   onClick={() => setCurrentIndex(i)}
                   className={`w-2.5 h-2.5 rounded-full transition-colors ${i === currentIndex ? 'bg-indigo-600' : 'bg-slate-300 hover:bg-slate-400'}`}
                />
             ))}
          </div>
       </div>
    );
};

// --- MAIN SCREEN ---
interface WelcomeScreenProps {
  onRegister: () => void;
  onLogin: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onRegister, onLogin }) => {
  const { t, i18n } = useTranslation();
  const [businessCount, setBusinessCount] = useState<number | null>(null);
  const [dashboardLoaded, setDashboardLoaded] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showCookieConsent, setShowCookieConsent] = useState(false);
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    // Fetch business count
    getBusinessCount()
      .then(data => {
        if (data && typeof data.count === 'number') {
          setBusinessCount(data.count);
        }
      })
      .catch(() => setBusinessCount(null));

    // Dashboard initialization skeleton delay
    const dashboardTimer = setTimeout(() => setDashboardLoaded(true), 2500);

    // Scroll to top visibility toggle
    const handleScroll = () => {
        setShowScrollTop(window.scrollY > 500);
    };
    window.addEventListener('scroll', handleScroll);

    // Cookie consent initialization
    const cookieTimer = setTimeout(() => setShowCookieConsent(true), 1500);

    return () => {
        clearTimeout(dashboardTimer);
        clearTimeout(cookieTimer);
        window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleSubscribe = (e: React.FormEvent) => {
     e.preventDefault();
     if (email) {
        setSubscribed(true);
        setEmail('');
     }
  };

  const scrollToTop = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-500/30 overflow-x-hidden">
      {/* Background Graphic Grid */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.05) 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 bg-white/70 backdrop-blur-xl z-50 border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-inner shadow-white/20">
              G
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">Ginvoice</span>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={i18n.language}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="text-sm font-semibold text-slate-600 bg-transparent outline-none cursor-pointer hover:text-slate-900 transition-colors"
            >
              <option value="en">EN</option>
              <option value="pcm">PCM</option>
            </select>
            <button onClick={onLogin} className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
              Log in
            </button>
            <button
              onClick={onRegister}
              className="bg-slate-900 text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-slate-800 transition-all shadow-md shadow-slate-900/10 active:scale-95"
            >
              Start Free
            </button>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        {/* HERO SECTION */}
        <section className="pt-32 pb-24 px-6 relative overflow-hidden">
          {/* Subtle Glows */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />

          <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100/50 px-3 py-1.5 rounded-full text-indigo-700 text-xs font-bold uppercase tracking-widest mb-8"
            >
              <Sparkles size={14} className="text-indigo-500" />
              Introducing Market OS 2.0
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
              className="text-5xl md:text-7xl font-bold tracking-tighter text-slate-900 leading-[1.1] max-w-4xl"
            >
              The Operating System for <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600">
                Modern Retail.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
              className="mt-6 text-xl text-slate-600 font-medium max-w-2xl"
            >
              Track sales, control inventory, and master your finances. Engineered for resilience with unbreakable offline mode. No internet required to keep selling.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
              className="mt-10 flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
            >
              <button
                onClick={onRegister}
                className="px-8 py-4 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-slate-800 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-900/10 group"
              >
                Start Free Trial
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={onLogin}
                className="px-8 py-4 bg-white border border-slate-200 text-slate-800 rounded-xl font-bold text-lg hover:bg-slate-50 hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-sm"
              >
                View Demo
              </button>
            </motion.div>

            {/* Abstract Dashboard Graphic with Skeletons */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
              className="mt-20 w-full max-w-5xl relative"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-transparent to-transparent z-10 h-full w-full bottom-0" />
              <div className="bg-white rounded-t-3xl border border-slate-200/60 shadow-2xl overflow-hidden flex flex-col h-[400px]">
                {/* Mock Window Header */}
                <div className="h-12 bg-slate-100/50 border-b border-slate-200/60 flex items-center px-4 gap-2">
                  <div className="w-3 h-3 rounded-full bg-slate-300" />
                  <div className="w-3 h-3 rounded-full bg-slate-300" />
                  <div className="w-3 h-3 rounded-full bg-slate-300" />
                  <div className="ml-4 h-5 w-48 bg-white rounded-md border border-slate-200/50" />
                </div>
                {/* Mock UI Grid */}
                <div className="flex-1 p-6 grid grid-cols-12 gap-6 bg-slate-50/50">
                   {/* Sidebar Skeleton */}
                   <div className="col-span-3 space-y-4 hidden md:block">
                      <div className="h-8 bg-slate-200/50 rounded-lg w-full" />
                      <div className="h-8 bg-slate-200/50 rounded-lg w-4/5" />
                      <div className="h-8 bg-slate-200/50 rounded-lg w-5/6" />
                   </div>
                   
                   {/* Main Content */}
                   <div className="col-span-12 md:col-span-9 space-y-6">
                     {!dashboardLoaded ? (
                         <>
                            <div className="grid grid-cols-3 gap-4">
                               {[1,2,3].map(i => (
                                 <div key={i} className="h-24 bg-white border border-slate-200/60 shadow-sm rounded-xl p-4 flex flex-col justify-between">
                                    <div className="h-4 w-12 bg-slate-200 rounded animate-pulse" />
                                    <div className="h-6 w-24 bg-slate-100 rounded animate-pulse" />
                                 </div>
                               ))}
                            </div>
                            <div className="h-48 bg-white border border-slate-200/60 shadow-sm rounded-xl flex items-end p-6 gap-2">
                               {[...Array(5)].map((_, i) => (
                                 <div key={i} className="flex-1 bg-slate-100 rounded-t-sm h-full animate-pulse" />
                               ))}
                            </div>
                         </>
                      ) : (
                         <AnimatePresence mode="popLayout">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                               <div className="grid grid-cols-3 gap-4">
                                  <div className="h-24 bg-white border border-slate-200/60 shadow-sm rounded-xl p-4 flex flex-col justify-between">
                                     <div className="h-4 w-12 bg-indigo-100 rounded" />
                                     <div className="h-6 w-24 bg-slate-800 rounded" />
                                  </div>
                                  <div className="h-24 bg-white border border-slate-200/60 shadow-sm rounded-xl p-4 flex flex-col justify-between">
                                     <div className="h-4 w-16 bg-emerald-100 rounded" />
                                     <div className="h-6 w-32 bg-slate-800 rounded" />
                                  </div>
                                  <div className="h-24 bg-white border border-slate-200/60 shadow-sm rounded-xl p-4 flex flex-col justify-between">
                                     <div className="h-4 w-16 bg-purple-100 rounded" />
                                     <div className="h-6 w-20 bg-slate-800 rounded" />
                                  </div>
                               </div>
                               <div className="h-48 bg-white border border-slate-200/60 shadow-sm rounded-xl flex items-end p-6 gap-2">
                                  <motion.div initial={{ height: 0 }} animate={{ height: '30%' }} transition={{ duration: 0.5 }} className="flex-1 bg-indigo-100 rounded-t-sm" />
                                  <motion.div initial={{ height: 0 }} animate={{ height: '50%' }} transition={{ duration: 0.5, delay: 0.1 }} className="flex-1 bg-indigo-200 rounded-t-sm" />
                                  <motion.div initial={{ height: 0 }} animate={{ height: '80%' }} transition={{ duration: 0.5, delay: 0.2 }} className="flex-1 bg-indigo-300 rounded-t-sm" />
                                  <motion.div initial={{ height: 0 }} animate={{ height: '60%' }} transition={{ duration: 0.5, delay: 0.3 }} className="flex-1 bg-indigo-400 rounded-t-sm" />
                                  <motion.div initial={{ height: 0 }} animate={{ height: '100%' }} transition={{ duration: 0.5, delay: 0.4 }} className="flex-1 bg-indigo-500 rounded-t-sm" />
                               </div>
                            </motion.div>
                         </AnimatePresence>
                      )}
                   </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* LOGO STRIP WITH SKELETON */}
        <section className="py-12 border-y border-slate-200/50 bg-white">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-6 flex items-center justify-center gap-2">
               Trusted by 
               {businessCount === null ? (
                 <span className="w-16 h-5 bg-slate-200 animate-pulse rounded inline-block"></span>
               ) : (
                 <span className="text-slate-700 font-bold">{businessCount.toLocaleString()}+</span>
               )} 
               scaling businesses
            </p>
            <div className="flex flex-wrap justify-center gap-x-12 gap-y-6 grayscale opacity-40">
               <div className="flex items-center gap-2 font-black text-xl tracking-tighter"><Box size={24} /> STOCKSYNC</div>
               <div className="flex items-center gap-2 font-black text-xl tracking-tighter"><ShieldCheck size={24} /> OMNIRETAIL</div>
               <div className="flex items-center gap-2 font-black text-xl tracking-tighter"><Activity size={24} /> PULSEPOS</div>
               <div className="flex items-center gap-2 font-black text-xl tracking-tighter"><PieChart size={24} /> FINSTRIDE</div>
            </div>
          </div>
        </section>

        {/* INTERACTIVE FEATURE SHOWCASE */}
        <InteractiveFeatureShowcase />

        {/* TESTIMONIALS SECTION */}
        <section className="py-24 px-6 bg-slate-50 overflow-hidden">
           <div className="max-w-7xl mx-auto flex flex-col items-center">
              <div className="text-center mb-16 max-w-2xl">
                 <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
                    Real stories. Real results.
                 </h2>
                 <p className="text-slate-500 text-lg">Join forward-thinking retailers who have transformed their operations with Ginvoice Market OS.</p>
              </div>
              <TestimonialCarousel />
           </div>
        </section>

        {/* PRICING SECTION */}
        <section className="py-24 px-6 bg-slate-950 text-white relative border-y border-slate-900" id="pricing">
           <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950"></div>
           <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-12 bg-slate-900 rounded-[3rem] p-8 md:p-12 border border-slate-800 relative overflow-hidden shadow-2xl">
              {/* Glow Effect */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />

              <div className="flex-1 space-y-6 z-10 w-full text-center md:text-left">
                 <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">Simple Pricing.<br /><span className="text-slate-400 font-medium">Cheaper than a recharge card.</span></h2>
                 <div className="space-y-4 py-4 flex flex-col text-left max-w-sm mx-auto md:mx-0">
                    <div className="flex items-center gap-4 bg-slate-950/50 p-3 rounded-2xl border border-slate-800">
                       <div className="bg-emerald-500/20 p-2 rounded-xl text-emerald-400 shrink-0"><CheckCircle size={20} /></div>
                       <span className="font-semibold text-slate-300">Unlimited Invoices & Receipts</span>
                    </div>
                    <div className="flex items-center gap-4 bg-slate-950/50 p-3 rounded-2xl border border-slate-800">
                       <div className="bg-emerald-500/20 p-2 rounded-xl text-emerald-400 shrink-0"><CheckCircle size={20} /></div>
                       <span className="font-semibold text-slate-300">Unbreakable Offline Mode</span>
                    </div>
                    <div className="flex items-center gap-4 bg-slate-950/50 p-3 rounded-2xl border border-slate-800">
                       <div className="bg-emerald-500/20 p-2 rounded-xl text-emerald-400 shrink-0"><CheckCircle size={20} /></div>
                       <span className="font-semibold text-slate-300">Advanced Inventory & Analytics</span>
                    </div>
                 </div>
                 <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 px-5 py-3 rounded-xl text-sm font-bold text-yellow-500">
                    <Sparkles size={16} /> 30-Day Free Trial (No Card Needed)
                 </div>
              </div>

              <div className="bg-slate-50 text-slate-900 p-8 rounded-[2rem] w-full max-w-sm shrink-0 text-center space-y-6 shadow-xl z-10 transform md:rotate-2 hover:rotate-0 transition-transform duration-300 border border-slate-200">
                 <h3 className="text-slate-500 font-bold uppercase tracking-widest text-xs">Standard Plan</h3>
                 <div className="space-y-1">
                    <p className="text-5xl font-black tracking-tighter">₦2,000</p>
                    <p className="text-slate-500 font-medium">per month</p>
                 </div>
                 <button
                    onClick={onRegister}
                    className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-500 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                 >
                    Start Free Trial <ArrowRight size={18} />
                 </button>
                 <p className="text-xs text-slate-400 font-semibold pt-2">Cancel anytime. No questions asked.</p>
              </div>
           </div>
        </section>

        {/* FAQ SECTION */}
        <section className="py-24 px-6 bg-white border-t border-slate-200/50">
           <div className="max-w-3xl mx-auto">
              <div className="text-center mb-16">
                 <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                    Frequently Asked Questions
                 </h2>
                 <p className="text-slate-500 text-lg">Everything you need to know about getting started.</p>
              </div>
              <div>
                 {FAQS.map((faq, i) => (
                    <FAQItem key={i} question={faq.question} answer={faq.answer} />
                 ))}
              </div>
           </div>
        </section>

        {/* BOTTOM CTA / CONVERSION */}
        <section className="py-24 px-6 bg-indigo-600 text-white relative overflow-hidden">
           <div className="absolute inset-0 z-0">
             <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
             <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-black/10 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/2" />
           </div>

           <div className="max-w-4xl mx-auto text-center relative z-10">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
                 Ready to modernize your operations?
              </h2>
              <p className="text-indigo-100 text-xl font-medium mb-12 max-w-2xl mx-auto">
                 Join thousands of retailers mastering their inventory and soaring past their sales targets with Ginvoice Market OS.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                 <button
                    onClick={onRegister}
                    className="px-8 py-5 bg-white text-indigo-600 rounded-2xl font-bold text-lg hover:bg-indigo-50 hover:scale-105 active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-2"
                 >
                    Start Free 30-Day Trial
                 </button>
                 <button
                    onClick={onLogin}
                    className="px-8 py-5 bg-indigo-700/50 border border-indigo-400 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2 backdrop-blur-sm"
                 >
                    <Lock size={18} /> Sign In to Dashboard
                 </button>
              </div>
              <p className="text-sm text-indigo-200 mt-6 font-medium">No credit card required. Setup takes 2 minutes.</p>
           </div>
        </section>

        {/* NEWSLETTER SECTION */}
        <section className="py-20 px-6 bg-slate-900 border-t border-slate-800 text-slate-300">
           <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="text-center md:text-left">
                 <h3 className="text-2xl font-bold text-white mb-2">Subscribe to our newsletter</h3>
                 <p className="text-slate-400">Get the latest product updates, retail tips, and exclusive offers.</p>
              </div>
              <form onSubmit={handleSubscribe} className="flex-1 w-full max-w-md flex flex-col sm:flex-row gap-3">
                 {subscribed ? (
                    <div className="px-6 py-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl w-full flex items-center justify-center font-medium">
                       Thanks for subscribing!
                    </div>
                 ) : (
                    <>
                       <input 
                          type="email" 
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Enter your email address"
                          required
                          className="flex-1 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 focus:outline-none focus:border-indigo-500 text-white placeholder:text-slate-500 transition-colors"
                       />
                       <button type="submit" className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 transition-colors whitespace-nowrap shadow-md">
                          Subscribe
                       </button>
                    </>
                 )}
              </form>
           </div>
        </section>

        {/* FOOTER */}
        <footer className="bg-slate-950 text-slate-400 py-12 px-6 border-t border-slate-900">
           <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-white font-bold text-xs">
                  G
                </div>
                <span className="font-bold text-slate-300">Ginvoice Market OS</span>
              </div>
              <div className="flex gap-8 text-sm font-semibold">
                 <a href="#features" className="hover:text-white transition-colors">Features</a>
                 <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
                 <a href="#privacy" className="hover:text-white transition-colors">Privacy</a>
                 <a href="#terms" className="hover:text-white transition-colors">Terms</a>
              </div>
              <p className="text-sm">© {new Date().getFullYear()} Ginvoice Inc.</p>
           </div>
        </footer>
      </main>

      {/* Floating Scroll to Top button */}
      <AnimatePresence>
         {showScrollTop && (
            <motion.button
               initial={{ opacity: 0, scale: 0, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0, y: 20 }}
               onClick={scrollToTop}
               className="fixed bottom-8 right-8 z-40 p-4 bg-indigo-600 text-white rounded-full shadow-2xl hover:bg-indigo-500 hover:scale-110 active:scale-95 transition-all"
               aria-label="Scroll to top"
            >
               <ArrowUp size={24} />
            </motion.button>
         )}
      </AnimatePresence>

      {/* Cookie Consent Banner */}
      <AnimatePresence>
         {showCookieConsent && (
            <motion.div
               initial={{ y: 100, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               exit={{ y: 100, opacity: 0 }}
               className="fixed bottom-6 left-6 right-6 md:left-8 md:right-auto md:max-w-sm z-50 p-6 bg-white border border-slate-200/60 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col gap-4"
            >
               <div>
                  <h4 className="font-bold text-slate-900 mb-1">We value your privacy</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">We use cookies to improve your browsing experience and analyze our traffic.</p>
               </div>
               <div className="flex items-center gap-3">
                  <button 
                     onClick={() => setShowCookieConsent(false)}
                     className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-colors text-sm"
                  >
                     Decline
                  </button>
                  <button 
                     onClick={() => setShowCookieConsent(false)}
                     className="flex-1 px-4 py-2.5 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-colors text-sm shadow-md"
                  >
                     Accept
                  </button>
               </div>
            </motion.div>
         )}
      </AnimatePresence>
    </div>
  );
};

export default WelcomeScreen;
