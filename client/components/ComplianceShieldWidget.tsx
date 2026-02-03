import React, { useEffect, useState } from 'react';
import { Shield, CheckCircle, X } from 'lucide-react';
import api from '../services/api';
import { CURRENCY } from '../constants';

interface ComplianceShieldWidgetProps {
    onClose?: () => void;
}

interface TaxEstimate {
  estimatedTax: number;
  taxBand: string;
  message: string;
  safeToSpend: number;
  deductibleExpenses?: number;
  personalRelief?: number;
  taxableIncome?: number;
  breakdown: {
    revenue: number;
    assessableProfit: number;
    totalDeductible: number;
    personalRelief?: number;
    taxRate: string;
  };
}

const ComplianceShieldWidget: React.FC<ComplianceShieldWidgetProps> = ({ onClose }) => {
  const [estimate, setEstimate] = useState<TaxEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    api.get('/tax/estimate')
      .then((res: any) => {
        if (active && res.success) {
           setEstimate(res.estimation);
        }
      })
      .catch((err) => {
        // Silent fail is okay if checking status, but usually 403 means not opted in
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  if (loading) return (
    <div className="p-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl shadow-sm animate-pulse h-40 mb-8 flex flex-col justify-between">
       <div className="h-4 bg-gray-300 rounded w-1/3"></div>
       <div className="h-8 bg-gray-300 rounded w-1/2 self-end"></div>
       <div className="h-2 bg-gray-300 rounded w-full mt-4"></div>
    </div>
  );

  if (error || !estimate) return null;

  const revenue = estimate.breakdown.revenue;
  const threshold = 50000000;
  const vatThreshold = 25000000;
  // Calculate visual progress, capped at 100%
  const progress = Math.min(100, (revenue / threshold) * 100);
  const vatPosition = (vatThreshold / threshold) * 100;

  const isExempt = estimate.taxBand === 'EXEMPT';
  const isApproaching = isExempt && revenue > 45000000;

  return (
    <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden mb-8">
       {/* Background Decoration */}
       <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

       {/* Close Button */}
       {onClose && (
           <button
             onClick={onClose}
             className="absolute top-4 right-4 z-20 text-indigo-300 hover:text-white transition-colors"
           >
             <X size={20} />
           </button>
       )}

       <div className="flex justify-between items-start relative z-10 pr-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
               <Shield className="text-emerald-400" size={24} />
               <h3 className="font-bold text-lg">Compliance Shield</h3>
            </div>
            <p className="text-indigo-200 text-sm max-w-md">{estimate.message}</p>
          </div>

          <div className="text-right">
             <p className="text-xs text-indigo-300 font-bold uppercase tracking-widest">Est. Tax Due</p>
             <h2 className="text-3xl font-black text-white">{CURRENCY}{estimate.estimatedTax.toLocaleString()}</h2>
          </div>
       </div>

       {/* Deductions & Relief Stats */}
       <div className="grid grid-cols-2 gap-4 mt-6 relative z-10">
          <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm">
             <p className="text-[10px] text-indigo-300 font-bold uppercase mb-1">Biz Deductions</p>
             <p className="font-bold text-white text-lg">{CURRENCY}{(estimate.deductibleExpenses || 0).toLocaleString()}</p>
          </div>
          <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm">
             <p className="text-[10px] text-indigo-300 font-bold uppercase mb-1">Personal Relief (CRA)</p>
             <p className="font-bold text-white text-lg">{CURRENCY}{(estimate.personalRelief || 0).toLocaleString()}</p>
          </div>
       </div>

       {/* Taxable Income */}
       <div className="mt-4 relative z-10 flex justify-between items-center bg-white/5 px-3 py-2 rounded-lg">
           <span className="text-xs font-bold text-indigo-200">Taxable Income</span>
           <span className="text-sm font-bold text-white">{CURRENCY}{(estimate.taxableIncome || 0).toLocaleString()}</span>
       </div>

       {/* Progress Bar for Exemption */}
       <div className="mt-6 relative z-10">
          <div className="flex justify-between text-xs font-bold mb-1">
             <span className={isExempt ? 'text-emerald-400' : 'text-red-400'}>
                {isExempt ? 'Tax Exempt Limit (₦50m)' : 'Taxable Threshold Exceeded'}
             </span>
             <span className="text-indigo-300">{CURRENCY}{revenue.toLocaleString()} / {CURRENCY}{threshold.toLocaleString()}</span>
          </div>
          <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
             <div
               className={`h-full rounded-full transition-all duration-1000 ${isExempt ? (isApproaching ? 'bg-yellow-400' : 'bg-emerald-500') : 'bg-red-500'}`}
               style={{ width: `${progress}%` }}
             ></div>
             {/* VAT Threshold Marker */}
             <div
               className="absolute top-0 bottom-0 w-0.5 bg-indigo-300/50"
               style={{ left: `${vatPosition}%` }}
             ></div>
          </div>
          <div className="relative mt-1 h-4">
             <div className="absolute text-[10px] text-indigo-300 font-medium transform -translate-x-1/2" style={{ left: `${vatPosition}%` }}>
               VAT Threshold (25m)
             </div>
          </div>
       </div>

       {/* Safe to Spend */}
       <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-white/10 rounded-lg">
                <CheckCircle size={18} className="text-emerald-400" />
             </div>
             <div>
                <p className="text-xs text-indigo-300 font-bold">Safe to Spend</p>
                <p className="font-bold text-white">{CURRENCY}{estimate.safeToSpend.toLocaleString()}</p>
             </div>
          </div>
       </div>
    </div>
  );
};

export default ComplianceShieldWidget;
