import React from 'react';
import { Sparkles, ShieldCheck } from 'lucide-react';

interface WelcomeScreenProps {
  onRegister: () => void;
  onLogin: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onRegister, onLogin }) => {
  return (
    <div className="min-h-screen bg-white flex flex-col relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-indigo-50 to-white -z-10" />

      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center mt-10">
        <h1 className="text-5xl md:text-6xl font-black text-gray-900 mb-6 tracking-tight leading-tight">
          Business,<br />
          <span className="text-indigo-600">Simplified.</span>
        </h1>
        <p className="text-gray-500 text-lg max-w-md mb-10 font-medium">
          The all-in-one market operating system for modern Nigerian traders. Track sales, manage stock, and grow faster.
        </p>

        {/* Floating Illustration */}
        <div className="relative w-full max-w-md aspect-video rounded-3xl overflow-hidden shadow-2xl shadow-indigo-200 animate-float mb-8 transform rotate-1">
            <img
              src="https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=800&q=80"
              alt="Modern Office"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-indigo-900/10 mix-blend-multiply" />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-8 pb-12 bg-white flex flex-col gap-4 max-w-md w-full mx-auto">
        <button
          onClick={onRegister}
          className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <Sparkles size={20} /> Get Started
        </button>
        <button
          onClick={onLogin}
          className="w-full bg-indigo-50 text-indigo-700 py-5 rounded-3xl font-black text-lg hover:bg-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <ShieldCheck size={20} /> Login
        </button>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(1deg); }
          50% { transform: translateY(-10px) rotate(1deg); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default WelcomeScreen;
