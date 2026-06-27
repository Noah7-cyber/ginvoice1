import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: string;
  status?: 'good' | 'neutral' | 'bad';
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, trend, status }) => {
  const isGood = status === 'good';
  const isBad = status === 'bad';
  
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex flex-col justify-between transition-shadow hover:shadow-md">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
        {label}
      </span>
      
      <div className="flex items-end justify-between mt-1">
        <span className="text-xl font-bold text-gray-900 tracking-tight">
          {value}
        </span>
        
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full
            ${isGood ? 'bg-emerald-50 text-emerald-600' : 
              isBad ? 'bg-rose-50 text-rose-600' : 
              'bg-gray-100 text-gray-600'}`}
          >
            {isGood ? <TrendingUp size={12} /> : 
             isBad ? <TrendingDown size={12} /> : 
             <Minus size={12} />}
            <span>{trend}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricCard;
