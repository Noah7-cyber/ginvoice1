import React from 'react';
import { ShieldCheck, ArrowRight } from 'lucide-react';

interface VerifyEmailScreenProps {
  email: string;
  onContinue: () => void;
}

const VerifyEmailScreen: React.FC<VerifyEmailScreenProps> = ({ email, onContinue }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-8 h-8 text-indigo-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Check your Email</h2>
        <p className="text-gray-500 mb-6">
          We sent a verification link to <span className="font-bold text-gray-800">{email}</span>.<br/>
          Please click the link in your email to verify your account.
        </p>
        <button onClick={onContinue} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
          I have Verified <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
};
export default VerifyEmailScreen;
