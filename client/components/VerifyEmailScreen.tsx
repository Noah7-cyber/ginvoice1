import React, { useState } from 'react';
import { ShieldCheck, ArrowRight, Mail, RotateCw } from 'lucide-react';
import { resendVerification, checkVerificationStatus } from '../services/api';
import { useToast } from './ToastProvider';

interface VerifyEmailScreenProps {
  email: string;
  onContinue: () => void;
}

const VerifyEmailScreen: React.FC<VerifyEmailScreenProps> = ({ email, onContinue }) => {
  const { addToast } = useToast();
  const [isResending, setIsResending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const handleResend = async () => {
      setIsResending(true);
      try {
          await resendVerification(email);
          addToast("Verification email sent! Check your inbox.", "success");
      } catch (err: any) {
          addToast(err.message || "Failed to resend email.", "error");
      } finally {
          setIsResending(false);
      }
  };

  const handleCheck = async () => {
      setIsChecking(true);
      try {
          const res = await checkVerificationStatus(email);
          if (res.verified) {
              addToast("Email verified successfully!", "success");
              onContinue();
          } else {
              addToast("Still not verified. Please check your email.", "warning");
          }
      } catch (err) {
          addToast("Could not verify status. Try again.", "error");
      } finally {
          setIsChecking(false);
      }
  };

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
          onClick={handleCheck}
          disabled={isChecking}
          className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black text-lg shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isChecking ? "Checking..." : "I've Verified My Email"} <ArrowRight size={20} />
        </button>

        <div className="mt-6 flex flex-col items-center gap-2">
            <p className="text-xs text-gray-400">Did not receive it? Check your spam folder.</p>
            <button
                onClick={handleResend}
                disabled={isResending}
                className="text-indigo-600 font-bold text-sm flex items-center gap-1 hover:underline disabled:opacity-50"
            >
                {isResending ? "Sending..." : "Resend Verification Email"} <RotateCw size={14} className={isResending ? "animate-spin" : ""} />
            </button>
        </div>
      </div>
    </div>
  );
};
export default VerifyEmailScreen;
