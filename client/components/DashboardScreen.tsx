
import React, { useMemo, useEffect, useState } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Package,
  Calendar,
  Wallet,
  ShoppingBag,
  Banknote,
  CreditCard,
  AlertCircle,
  Coins,
  Gem,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { Transaction, Product, BusinessProfile } from '../types';
import { CURRENCY } from '../constants';
import { getAnalytics, updateBusinessProfile } from '../services/api';
import { safeCalculate, safeSum } from '../utils/math';
import ComplianceShieldWidget from './ComplianceShieldWidget';
import ComplianceShieldModal from './ComplianceShieldModal';

interface DashboardScreenProps {
  transactions: Transaction[];
  products: Product[];
  business?: BusinessProfile;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({ transactions, products, business }) => {
  const [showShieldModal, setShowShieldModal] = useState(false);

  const [remoteAnalytics, setRemoteAnalytics] = useState<{
    stats: {
      totalRevenue: number;
      totalProfit: number;
      totalDebt: number;
      totalSales: number;
      cashSales: number;
      transferSales: number;
      posSales: number;
      shopCost: number;
      shopWorth: number;
      dailyRevenue: number;
      cashCollectedToday: number;
      newDebtToday: number;
      monthlySales: number;
      yearlySales: number;
      revenueTrendText?: string;
      profitTrendText?: string;
    };
    chartData: { date: string; amount: number }[];
    topProducts: { name: string; qty: number }[];
  } | null>(null);

  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '1y'>('7d');

  useEffect(() => {
    let active = true;
    if (!navigator.onLine) return;
    if (!localStorage.getItem('ginvoice_auth_token_v1')) return;
    getAnalytics(timeRange)
      .then((data) => {
        if (active) setRemoteAnalytics(data);
      })
      .catch((err) => {
        const status = err?.status;
        if (status === 402 && active) {
          setRemoteAnalytics(null);
        } else {
          console.error('Analytics fetch failed', err);
        }
      });
    return () => {
      active = false;
    };
  }, [transactions, timeRange]);

  const localStats = useMemo(() => {
    // SAFE MATH IMPLEMENTATION
    const totalRevenue = safeSum(transactions, 'totalAmount');
    const totalDebt = safeSum(transactions, 'balance');
    
    // Calculate total profit
    const totalProfit = transactions.reduce((sum, tx) => {
      const txProfit = tx.items.reduce((pSum, item) => {
        const product = products.find(p => p.id === item.productId);
        // FIX: If unit cost is 0, use base cost * multiplier
        let cost = 0;

        // Check if item has a selected unit (variant sale)
        if (item.selectedUnit) {
            // Priority 1: Unit specific cost price
            if (item.selectedUnit.costPrice > 0) {
                cost = item.selectedUnit.costPrice;
            }
            // Priority 2: Base Product Cost * Multiplier
            else if (product && product.costPrice > 0) {
                cost = product.costPrice * item.selectedUnit.multiplier;
            }
        }
        // Direct Base Product Sale (no unit selected or base unit)
        else {
             if (product) cost = product.costPrice;
        }

        // [FIX] Use item.total (net price) - (cost * quantity)
        // Profit per item = total_selling - total_cost
        const itemTotalCost = safeCalculate(cost, item.quantity);
        return pSum + (item.total - itemTotalCost);
      }, 0);

      // Subtract tx.globalDiscount from profit
      // Net Profit = Gross Profit - Global Discount.
      return sum + txProfit - (tx.globalDiscount || 0);
    }, 0);

    const cashSales = transactions.filter(t => t.paymentMethod === 'cash').length;
    const transferSales = transactions.filter(t => ['transfer', 'bank'].includes(t.paymentMethod)).length;
    const posSales = transactions.filter(t => t.paymentMethod === 'pos').length;

    // Calculate Shop Cost & Worth locally
    const shopCost = products.reduce((sum, p) => sum + safeCalculate(p.costPrice, p.currentStock), 0);
    const shopWorth = products.reduce((sum, p) => sum + safeCalculate(p.sellingPrice, p.currentStock), 0);

    // Calculate Daily Revenue locally
    const today = new Date().toISOString().split('T')[0];
    const dailyRevenue = safeSum(
        transactions.filter(t => t.transactionDate.startsWith(today)),
        'totalAmount'
    );

    return { totalRevenue, totalProfit, totalSales: transactions.length, cashSales, transferSales, posSales, totalDebt, shopCost, shopWorth, dailyRevenue };
  }, [transactions, products]);

  // Hybrid Stats Logic: Merge remote and local
  const stats = useMemo(() => {
    const remote = remoteAnalytics?.stats;
    if (!remote) return localStats;

    return {
      ...remote,
      // Fallback to local if remote returns 0 (likely due to glitch or sync delay)
      shopCost: remote.shopCost || localStats.shopCost,
      shopWorth: remote.shopWorth || localStats.shopWorth,
      dailyRevenue: remote.dailyRevenue || localStats.dailyRevenue
    };
  }, [remoteAnalytics, localStats]);

  // Daily sales data for the chart
  const chartData = useMemo(() => {
    if (remoteAnalytics?.chartData) return remoteAnalytics.chartData;
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => {
      const daySales = transactions
        .filter(t => t.transactionDate.split('T')[0] === date)
        .reduce((sum, t) => sum + t.totalAmount, 0);
      
      const displayDate = new Date(date).toLocaleDateString('en-NG', { weekday: 'short' });
      return { date: displayDate, amount: daySales };
    });
  }, [transactions, remoteAnalytics]);

  // Top products
  const topProducts = useMemo(() => {
    // If remote, we might need to enhance it with local categories if possible,
    // but for now let's assume remote is simple or we fallback to local calc for better detail
    // Actually, local calc is better if we have all transactions.

    const productSales: Record<string, { name: string, qty: number, category: string }> = {};
    transactions.forEach(tx => {
      tx.items.forEach(item => {
        if (!productSales[item.productId]) {
          const product = products.find(p => p.id === item.productId);
          productSales[item.productId] = {
             name: item.productName,
             qty: 0,
             category: product?.category || 'Uncategorized'
          };
        }
        productSales[item.productId].qty += item.quantity;
      });
    });

    return Object.values(productSales)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [transactions, products]);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <div className="flex justify-between items-start">
           <div>
              <h1 className="text-2xl font-bold text-gray-900">Owner Dashboard</h1>
              <p className="text-gray-500">Real-time performance overview</p>
           </div>

           {business && !business.taxSettings?.isEnabled && (
             <button
               onClick={() => setShowShieldModal(true)}
               className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-bold text-sm hover:bg-indigo-100 transition-colors"
             >
               <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
               Activate Compliance Shield
             </button>
           )}
        </div>
      </div>

      {business && business.taxSettings?.isEnabled && <ComplianceShieldWidget />}
      {showShieldModal && (
        <ComplianceShieldModal
           onConfirm={async () => {
              try {
                await updateBusinessProfile({
                   taxSettings: {
                      isEnabled: true,
                      jurisdiction: 'NG',
                      incorporationDate: new Date().toISOString()
                   }
                });
                setShowShieldModal(false);
                window.location.reload();
              } catch (err) {
                 console.error("Failed to enable shield", err);
                 alert("Failed to enable. Please try again.");
              }
           }}
           onCancel={() => setShowShieldModal(false)}
        />
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Existing Cards */}
        <StatCard 
          title="Total Sales"
          value={`${CURRENCY}${stats.totalRevenue.toLocaleString()}`} 
          icon={<DollarSign className="text-blue-600" />} 
          trend={stats.revenueTrendText || '+12% from last month'}
          color="bg-blue-50"
        />
        <StatCard 
          title="Total Profit"
          value={`${CURRENCY}${stats.totalProfit.toLocaleString()}`} 
          icon={<TrendingUp className="text-green-600" />} 
          trend={stats.profitTrendText || '+8.4% from last month'}
          color="bg-green-50"
        />
        <StatCard 
          title="Money Owed To You"
          value={`${CURRENCY}${stats.totalDebt.toLocaleString()}`} 
          icon={<AlertCircle className="text-red-600" />} 
          trend="Total money owed to you"
          color="bg-red-50"
        />
        <StatCard 
          title="Sales Count"
          value={stats.totalSales.toString()} 
          icon={<ShoppingBag className="text-purple-600" />} 
          trend="Lifetime transactions"
          color="bg-purple-50"
        />

        {/* Revenue Carousel */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border group hover:shadow-md transition-all relative overflow-hidden">
           {/* Navigation Controls */}
           <div className="absolute inset-y-0 left-0 flex items-center pl-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setTimeRange(prev => prev === '7d' ? '1y' : prev === '30d' ? '7d' : '30d')}
                className="p-1 bg-white/80 rounded-full shadow-md hover:bg-white"
              >
                <ChevronLeft size={16} className="text-gray-600" />
              </button>
           </div>
           <div className="absolute inset-y-0 right-0 flex items-center pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setTimeRange(prev => prev === '7d' ? '30d' : prev === '30d' ? '1y' : '7d')}
                className="p-1 bg-white/80 rounded-full shadow-md hover:bg-white"
              >
                <ChevronRight size={16} className="text-gray-600" />
              </button>
           </div>

           <div className="absolute top-2 right-2 flex gap-1">
              <div className={`w-2 h-2 rounded-full ${timeRange === '7d' ? 'bg-blue-600' : 'bg-gray-200'}`} />
              <div className={`w-2 h-2 rounded-full ${timeRange === '30d' ? 'bg-blue-600' : 'bg-gray-200'}`} />
              <div className={`w-2 h-2 rounded-full ${timeRange === '1y' ? 'bg-blue-600' : 'bg-gray-200'}`} />
           </div>

           <div className="flex justify-between items-start mb-4">
              <div className="p-3 rounded-xl bg-blue-50 transition-transform group-hover:scale-110">
                <DollarSign className="text-blue-600" size={24} />
              </div>
           </div>

           {/* Slide 1: Daily */}
           {timeRange === '7d' && (
             <div className="space-y-1 animate-in fade-in slide-in-from-right duration-300">
               <p className="text-sm font-medium text-gray-500">Today's Cash</p>
               <h4 className="text-2xl font-black text-gray-900">{CURRENCY}{(stats.cashCollectedToday || 0).toLocaleString()}</h4>
               <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider">
                 New Debt: {CURRENCY}{(stats.newDebtToday || 0).toLocaleString()}
               </p>
             </div>
           )}

           {/* Slide 2: Monthly */}
           {timeRange === '30d' && (
             <div className="space-y-1 animate-in fade-in slide-in-from-right duration-300">
               <p className="text-sm font-medium text-gray-500">Monthly Sales</p>
               <h4 className="text-2xl font-black text-gray-900">{CURRENCY}{(stats.monthlySales || 0).toLocaleString()}</h4>
               <input
                 type="month"
                 className="text-[10px] font-bold text-gray-400 bg-transparent border-none p-0 focus:ring-0"
                 onChange={(e) => {
                    // Logic to trigger fetch with ?date=YYYY-MM
                    // For now, we assume this view binds to the global timeRange selector or separate fetch
                 }}
               />
             </div>
           )}

           {/* Slide 3: Yearly */}
           {timeRange === '1y' && (
             <div className="space-y-1 animate-in fade-in slide-in-from-right duration-300">
               <p className="text-sm font-medium text-gray-500">Yearly Sales</p>
               <h4 className="text-2xl font-black text-gray-900">{CURRENCY}{(stats.yearlySales || 0).toLocaleString()}</h4>
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Includes Debts</p>
             </div>
           )}
        </div>
        <StatCard
          title="Cost of Stock"
          value={`${CURRENCY}${(stats.shopCost || 0).toLocaleString()}`}
          icon={<Coins className="text-orange-600" />}
          trend="Money you spent buying goods"
          color="bg-orange-50"
        />
        <StatCard
          title="Value of Stock"
          value={`${CURRENCY}${(stats.shopWorth || 0).toLocaleString()}`}
          icon={<Gem className="text-purple-600" />}
          trend="Money you will make"
          color="bg-purple-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
        {/* Sales Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Calendar className="text-indigo-600" size={20} /> Sales Performance
            </h3>
            <div className="flex gap-2">
              {['7d', '30d', '1y'].map(r => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r as any)}
                  className={`px-3 py-1 rounded-full text-xs font-bold ${timeRange === r ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  {r === '7d' ? 'Weekly' : r === '30d' ? 'Monthly' : 'Yearly'}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[300px] min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} tickFormatter={(val) => `₦${val/1000}k`} />
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  formatter={(value: number) => [`${CURRENCY}${value.toLocaleString()}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods & Top Items */}
        <div className="space-y-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Wallet className="text-indigo-600" size={20} /> Payment Methods
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
                    <Banknote size={18} />
                  </div>
                  <span className="text-sm font-medium text-gray-600">Cash</span>
                </div>
                <span className="font-bold">{stats.cashSales}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{ width: `${(stats.cashSales / (stats.totalSales || 1)) * 100}%` }}
                ></div>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                    <CreditCard size={18} />
                  </div>
                  <span className="text-sm font-medium text-gray-600">Transfer</span>
                </div>
                <span className="font-bold">{stats.transferSales}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full" 
                  style={{ width: `${(stats.transferSales / (stats.totalSales || 1)) * 100}%` }}
                ></div>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
                    <CreditCard size={18} />
                  </div>
                  <span className="text-sm font-medium text-gray-600">POS</span>
                </div>
                <span className="font-bold">{stats.posSales || 0}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-purple-500 h-2 rounded-full"
                  style={{ width: `${((stats.posSales || 0) / (stats.totalSales || 1)) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Package className="text-indigo-600" size={20} /> Top Selling Items
            </h3>
            <div className="space-y-3">
              {topProducts.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No sales data yet</p>
              ) : (
                topProducts.map((prod, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-xl transition-colors">
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-800 truncate max-w-[150px]">{prod.name}</span>
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{prod.category}</span>
                    </div>
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-black">{prod.qty} units</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string, value: string, icon: React.ReactNode, trend: string, color: string }> = ({ title, value, icon, trend, color }) => (
  <div className="bg-white p-5 rounded-2xl shadow-sm border group hover:shadow-md transition-all">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl ${color} transition-transform group-hover:scale-110`}>
        {React.cloneElement(icon as React.ReactElement<any>, { size: 24 })}
      </div>
    </div>
    <div className="space-y-1">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <h4 className="text-2xl font-black text-gray-900">{value}</h4>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{trend}</p>
    </div>
  </div>
);

export default DashboardScreen;
