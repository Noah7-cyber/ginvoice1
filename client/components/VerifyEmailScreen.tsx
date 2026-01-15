import React from 'react';
import { ShieldCheck, ArrowRight, Mail } from 'lucide-react';

interface VerifyEmailScreenProps {
  email: string;
  onContinue: () => void;
}

const VerifyEmailScreen: React.FC<VerifyEmailScreenProps> = ({ email, onContinue }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md text-center border-t-8 border-indigo-600">
        <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
          <Mail className="w-10 h-10 text-indigo-600" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">Verify Your Email</h2>
        <p className="text-gray-500 mb-8 leading-relaxed">
          We've sent a secure verification link to <br/>
          <span className="font-black text-indigo-600 text-lg">{email}</span>
        </p>

        <div className="bg-indigo-50 p-4 rounded-xl text-xs text-indigo-800 font-medium mb-8 text-left">
           <p>1. Open your email app.</p>
           <p>2. Look for an email from <strong>Ginvoice</strong>.</p>
           <p>3. Click the <strong>Verify Email</strong> link inside.</p>
           <p>4. Come back here and click continue.</p>
        </div>

        <button
          onClick={onContinue}
          className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black text-lg shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 active:scale-95"
        >
          I've Verified My Email <ArrowRight size={20} />
        </button>

        <p className="mt-6 text-xs text-gray-400">
           Did not receive it? Check your spam folder.
        </p>
      </div>
    </div>
  );
};
export default VerifyEmailScreen;
