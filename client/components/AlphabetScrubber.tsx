import React, { useState, useRef, useEffect, useCallback } from 'react';

interface AlphabetScrubberProps {
  onScrollTo: (letter: string) => void;
  className?: string;
}

const ALPHABET = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const AlphabetScrubber: React.FC<AlphabetScrubberProps> = ({ onScrollTo, className }) => {
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const [touchY, setTouchY] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleInteraction = useCallback((clientY: number) => {
    if (!trackRef.current) return;
    const { top, height } = trackRef.current.getBoundingClientRect();

    // Adjust for padding (py-2 which is approx 8px top/bottom)
    const padding = 8;
    const contentHeight = height - (padding * 2);
    const relativeY = clientY - top - padding;

    // Calculate index based on height
    // Clamp between 0 and 1
    const percentage = Math.max(0, Math.min(1, relativeY / contentHeight));
    const index = Math.floor(percentage * ALPHABET.length);
    const safeIndex = Math.min(index, ALPHABET.length - 1);

    const letter = ALPHABET[safeIndex];

    setTouchY(clientY); // Update touch position for bubble

    if (letter !== activeLetter) {
        setActiveLetter(letter);
        onScrollTo(letter);

        // Haptic feedback if available (mobile only)
        if (navigator.vibrate) navigator.vibrate(5);
    }
  }, [activeLetter, onScrollTo]);

  const onTouchStart = (e: React.TouchEvent) => {
    setIsInteracting(true);
    handleInteraction(e.touches[0].clientY); // Immediate trigger
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    handleInteraction(e.touches[0].clientY);
  };

  const onTouchEnd = () => {
    hideTimeoutRef.current = setTimeout(() => {
        setIsInteracting(false);
        setActiveLetter(null);
    }, 500);
  };

  // Also support mouse for testing/desktop
  const onMouseDown = (e: React.MouseEvent) => {
      setIsInteracting(true);
      handleInteraction(e.clientY);
  };
  const onMouseMove = (e: React.MouseEvent) => {
      if (isInteracting) handleInteraction(e.clientY);
  };
  const onMouseUp = () => {
      setIsInteracting(false);
      setActiveLetter(null);
  };

  return (
    <>
      {/* The Track */}
      <div
        ref={trackRef}
        className={`fixed right-0 top-20 bottom-24 w-8 z-[60] flex flex-col items-center justify-between py-2 touch-none select-none transition-opacity duration-300 ${isInteracting ? 'opacity-100 bg-black/5' : 'opacity-0 hover:opacity-100'}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
         {ALPHABET.map((char, i) => (
             <div key={i} className="w-1 h-1 rounded-full bg-gray-400/50" />
         ))}
      </div>

      {/* The Pop-Up Bubble (Side Indicator) */}
      {activeLetter && isInteracting && (
        <div
            className="fixed right-12 z-[70] pointer-events-none flex items-center justify-center animate-in zoom-in fade-in duration-150"
            style={{ top: touchY - 24 }} // Center vertically on touch
        >
            <div className="w-12 h-12 bg-primary text-white rounded-full shadow-xl flex items-center justify-center relative">
                <span className="text-xl font-black">{activeLetter}</span>
                {/* Little triangle pointing right */}
                <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rotate-45 transform origin-center"></div>
            </div>
        </div>
      )}
    </>
  );
};

export default AlphabetScrubber;
