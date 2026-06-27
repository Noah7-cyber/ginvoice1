import React from 'react';
import { ArrowRight, Lightbulb } from 'lucide-react';

interface RecommendationCardProps {
  title: string;
  action: string;
  impact?: string;
  cta?: {
    label: string;
    route: string;
  };
  onNavigate?: (route: any) => void;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({ title, action, impact, cta, onNavigate }) => {
  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100/50 rounded-xl p-4 my-3 relative overflow-hidden group">
      <div className="absolute -right-4 -top-4 opacity-5 transform group-hover:scale-110 transition-transform">
        <Lightbulb size={100} />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <div className="bg-indigo-100 text-indigo-600 p-1 rounded-md">
            <Lightbulb size={14} />
          </div>
          <h4 className="text-sm font-bold text-indigo-900">{title}</h4>
        </div>
        
        <p className="text-sm text-indigo-800 font-medium mb-1">
          {action}
        </p>
        
        {impact && (
          <p className="text-xs text-indigo-600/80 mb-3">
            Expected impact: {impact}
          </p>
        )}
        
        {cta && onNavigate && (
          <button 
            onClick={() => onNavigate(cta.route)}
            className="flex items-center gap-1 text-xs font-bold bg-white text-indigo-600 px-3 py-1.5 rounded-lg shadow-sm hover:shadow transition-all w-fit"
          >
            {cta.label} <ArrowRight size={12} />
          </button>
        )}
      </div>
    </div>
  );
};

export default RecommendationCard;
