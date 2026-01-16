import React, { useState, useRef, useEffect, useCallback } from 'react';

interface AlphabetScrubberProps {
  onScrollTo: (letter: string) => void;
  className?: string;
}

const ALPHABET = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const AlphabetScrubber: React.FC<AlphabetScrubberProps> = ({ onScrollTo, className }) => {
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleInteraction = useCallback((clientY: number) => {
    if (!trackRef.current) return;
    const { top, height } = trackRef.current.getBoundingClientRect();
    const relativeY = clientY - top;

    // Calculate index based on height
    // Clamp between 0 and 1
    const percentage = Math.max(0, Math.min(1, relativeY / height));
    const index = Math.floor(percentage * ALPHABET.length);
    const safeIndex = Math.min(index, ALPHABET.length - 1);

    const letter = ALPHABET[safeIndex];

    if (letter !== activeLetter) {
        setActiveLetter(letter);
        onScrollTo(letter);

        // Haptic feedback if available (mobile only)
        if (navigator.vibrate) navigator.vibrate(5);
    }
  }, [activeLetter, onScrollTo]);

  const onTouchStart = (e: React.TouchEvent) => {
    setIsInteracting(true);
    handleInteraction(e.touches[0].clientY);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    // Prevent default scroll
    // e.preventDefault(); // Might interfere with passive listeners, better handled by CSS touch-action
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
        className={`fixed right-0 top-20 bottom-24 w-6 z-[60] flex flex-col items-center justify-between py-2 touch-none select-none transition-opacity duration-300 ${isInteracting ? 'opacity-100 bg-black/5' : 'opacity-0 hover:opacity-100'}`}
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

      {/* The Pop-Up Bubble */}
      {activeLetter && isInteracting && (
        <div className="fixed inset-0 pointer-events-none z-[70] flex items-center justify-center">
            <div className="w-24 h-24 bg-primary rounded-full shadow-2xl flex items-center justify-center animate-in zoom-in fade-in duration-200">
                <span className="text-5xl font-black text-white">{activeLetter}</span>
            </div>
        </div>
      )}
    </>
  );
};

export default AlphabetScrubber;
