import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X, Share2 } from 'lucide-react';
import WrappedCard, { WrappedCardProps } from './WrappedCard';

interface WrappedCarouselProps {
  wrappedData: any;
  onClose: () => void;
}

const WrappedCarousel: React.FC<WrappedCarouselProps> = ({ wrappedData, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!wrappedData || !wrappedData.cards || wrappedData.cards.length === 0) {
    return null;
  }

  const cards = wrappedData.cards;
  const totalCards = cards.length;

  const handleNext = () => {
    if (currentIndex < totalCards - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'My Ginvoice Wrapped',
        text: `I just checked my monthly stats on Ginvoice! My persona is ${wrappedData.persona}.`,
        url: 'https://ginvoice.com.ng'
      }).catch(console.error);
    } else {
      alert('Sharing is not supported on this browser.');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backdropFilter: 'blur(8px)'
    }}>
      {/* Top Bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        padding: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10
      }}>
        <div style={{ color: 'white', fontWeight: 'bold', fontSize: '1.25rem' }}>
          Ginvoice Wrapped
        </div>
        <button 
          onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', padding: '8px', cursor: 'pointer', color: 'white' }}
        >
          <X size={24} />
        </button>
      </div>

      {/* Carousel */}
      <div style={{ position: 'relative', width: '100%', maxWidth: '400px', padding: '0 20px' }}>
        <WrappedCard card={cards[currentIndex]} index={currentIndex} totalCards={totalCards} />
        
        {/* Navigation Buttons */}
        {currentIndex > 0 && (
          <button 
            onClick={handlePrev}
            style={{
              position: 'absolute',
              left: '-10px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.3)',
              border: 'none',
              borderRadius: '50%',
              padding: '12px',
              cursor: 'pointer',
              color: 'white',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}
          >
            <ChevronLeft size={24} />
          </button>
        )}

        {currentIndex < totalCards - 1 ? (
          <button 
            onClick={handleNext}
            style={{
              position: 'absolute',
              right: '-10px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.3)',
              border: 'none',
              borderRadius: '50%',
              padding: '12px',
              cursor: 'pointer',
              color: 'white',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}
          >
            <ChevronRight size={24} />
          </button>
        ) : (
          <button 
            onClick={handleShare}
            style={{
              position: 'absolute',
              right: '-10px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: '#10B981',
              border: 'none',
              borderRadius: '50%',
              padding: '12px',
              cursor: 'pointer',
              color: 'white',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Share2 size={24} />
          </button>
        )}
      </div>

      {/* Progress Dots */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '32px' }}>
        {cards.map((_, i) => (
          <div 
            key={i} 
            style={{ 
              width: i === currentIndex ? '24px' : '8px', 
              height: '8px', 
              borderRadius: '4px', 
              backgroundColor: 'white',
              opacity: i === currentIndex ? 1 : 0.4,
              transition: 'all 0.3s ease'
            }} 
          />
        ))}
      </div>
    </div>
  );
};

export default WrappedCarousel;
