import React from 'react';
import { 
  TrendingUp, 
  Award, 
  Calendar, 
  Users, 
  Banknote, 
  CreditCard, 
  Gift, 
  ShoppingCart, 
  PackageMinus, 
  Sparkles 
} from 'lucide-react';

export interface WrappedCardProps {
  card: {
    type: string;
    title: string;
    metric: string;
    copy: string;
  };
  index: number;
  totalCards: number;
}

const WrappedCard: React.FC<WrappedCardProps> = ({ card, index, totalCards }) => {
  const getCardStyle = (type: string) => {
    switch(type) {
      case 'volume': return { bg: 'linear-gradient(135deg, #10B981, #059669)', icon: <TrendingUp size={48} color="white" /> };
      case 'top_product': return { bg: 'linear-gradient(135deg, #F59E0B, #D97706)', icon: <Award size={48} color="white" /> };
      case 'busy_day': return { bg: 'linear-gradient(135deg, #3B82F6, #2563EB)', icon: <Calendar size={48} color="white" /> };
      case 'loyalty': return { bg: 'linear-gradient(135deg, #8B5CF6, #6D28D9)', icon: <Users size={48} color="white" /> };
      case 'debt': return { bg: 'linear-gradient(135deg, #EF4444, #DC2626)', icon: <Banknote size={48} color="white" /> };
      case 'payment': return { bg: 'linear-gradient(135deg, #06B6D4, #0891B2)', icon: <CreditCard size={48} color="white" /> };
      case 'discount': return { bg: 'linear-gradient(135deg, #EC4899, #DB2777)', icon: <Gift size={48} color="white" /> };
      case 'ticket': return { bg: 'linear-gradient(135deg, #6366F1, #4F46E5)', icon: <ShoppingCart size={48} color="white" /> };
      case 'restock': return { bg: 'linear-gradient(135deg, #F43F5E, #E11D48)', icon: <PackageMinus size={48} color="white" /> };
      case 'persona': return { bg: 'linear-gradient(135deg, #14B8A6, #0D9488)', icon: <Sparkles size={48} color="white" /> };
      default: return { bg: 'linear-gradient(135deg, #6B7280, #4B5563)', icon: <Sparkles size={48} color="white" /> };
    }
  };

  const style = getCardStyle(card.type);

  return (
    <div style={{
      background: style.bg,
      borderRadius: '24px',
      padding: '32px',
      height: '400px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',
      color: 'white',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      position: 'relative',
      overflow: 'hidden',
      width: '100%',
      maxWidth: '350px',
      margin: '0 auto'
    }}>
      <div style={{ marginBottom: '24px', background: 'rgba(255,255,255,0.2)', padding: '16px', borderRadius: '50%' }}>
        {style.icon}
      </div>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px', opacity: 0.9 }}>{card.title}</h3>
      <div style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1.1, marginBottom: '16px', textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        {card.metric}
      </div>
      <p style={{ fontSize: '1rem', lineHeight: 1.5, opacity: 0.9, maxWidth: '280px' }}>
        {card.copy}
      </p>
      
      <div style={{ position: 'absolute', bottom: '16px', fontSize: '0.875rem', opacity: 0.6, fontWeight: 500 }}>
        {index + 1} / {totalCards}
      </div>
    </div>
  );
};

export default WrappedCard;
