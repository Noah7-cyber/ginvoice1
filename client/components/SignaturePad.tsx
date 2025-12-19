
import React, { useRef, useEffect, useState } from 'react';
import { Eraser, Lock, Unlock, CheckCircle } from 'lucide-react';

interface SignaturePadProps {
  onSave: (dataUrl: string, isLocked: boolean) => void;
  onClear: () => void;
  initialData?: string;
  initialLocked?: boolean;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onClear, initialData, initialLocked = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isLocked, setIsLocked] = useState(initialLocked);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#1e1b4b'; 
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    if (initialData) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = initialData;
    }
  }, [initialData]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (isLocked) return;
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    if (isLocked) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      onSave(canvas.toDataURL(), isLocked);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || isLocked) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clear = () => {
    if (isLocked) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    onClear();
  };

  const toggleLock = () => {
    const newLockState = !isLocked;
    setIsLocked(newLockState);
    const canvas = canvasRef.current;
    if (canvas) {
      onSave(canvas.toDataURL(), newLockState);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
          {isLocked ? <Lock size={12} className="text-indigo-600" /> : <Unlock size={12} />}
          Customer/Seller Signature
        </label>
        <div className="flex gap-3">
          {!isLocked && (
            <button 
              type="button"
              onClick={clear}
              className="text-xs text-red-500 flex items-center gap-1 font-bold hover:underline"
            >
              <Eraser size={12} /> Clear
            </button>
          )}
          <button 
            type="button"
            onClick={toggleLock}
            className={`text-xs flex items-center gap-1 font-bold px-2 py-1 rounded transition-colors ${
              isLocked 
              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' 
              : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
            }`}
          >
            {isLocked ? <Unlock size={12} /> : <Lock size={12} />}
            {isLocked ? 'Unlock to Edit' : 'Lock Signature'}
          </button>
        </div>
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          onMouseDown={startDrawing}
          onMouseUp={stopDrawing}
          onMouseMove={draw}
          onTouchStart={startDrawing}
          onTouchEnd={stopDrawing}
          onTouchMove={draw}
          className={`w-full border-2 rounded-xl transition-all ${
            isLocked 
            ? 'bg-gray-100 border-indigo-200 cursor-not-allowed opacity-70' 
            : 'bg-gray-50 border-dashed border-gray-200 cursor-crosshair touch-none'
          }`}
        />
        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white/80 px-3 py-1 rounded-full shadow-sm flex items-center gap-2 text-indigo-600 border border-indigo-100">
              <CheckCircle size={14} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Locked & Verified</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SignaturePad;
