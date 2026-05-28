import React, { useState } from 'react';
import { ShieldCheck, ArrowRight, Mail, RotateCw, KeyRound } from 'lucide-react';
import { resendVerification, checkVerificationStatus, verifyEmailCode } from '../services/api';
import { useToast } from './ToastProvider';

interface VerifyEmailScreenProps {
  email: string;
  onContinue: () => void;
}

const VerifyEmailScreen: React.FC<VerifyEmailScreenProps> = ({ email, onContinue }) => {
  const { addToast } = useToast();
  const [isResending, setIsResending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [otp, setOtp] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const handleResend = async () => {
      setIsResending(true);
      try {
          await resendVerification(email);
          addToast("Verification code sent! Check your inbox.", "success");
      } catch (err: any) {
          addToast(err.message || "Failed to resend email.", "error");
      } finally {
          setIsResending(false);
      }
  };

  const handleVerifyOtp = async () => {
      if (!otp || otp.length < 6) return addToast('Enter 6-digit code', 'error');

      setIsVerifyingOtp(true);
      try {
          await verifyEmailCode(email, otp);
          addToast("Email verified successfully!", "success");
          onContinue();
      } catch (err: any) {
          addToast(err.message || "Verification failed.", "error");
      } finally {
          setIsVerifyingOtp(false);
      }
  };

  // Keep manual check for link clickers
  const handleCheckLink = async () => {
      setIsChecking(true);
      try {
          const res = await checkVerificationStatus(email);
          if (res.verified) {
              addToast("Email verified successfully!", "success");
              onContinue();
          } else {
              addToast("Not verified yet.", "warning");
          }
      } catch (err) {
          addToast("Check failed.", "error");
      } finally {
          setIsChecking(false);
      }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md text-center border-t-8 border-indigo-600">
        <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Mail className="w-10 h-10 text-indigo-600" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">Verify Your Email</h2>
        <p className="text-gray-500 mb-6 leading-relaxed">
          We sent a code and link to <br/>
          <span className="font-black text-indigo-600 text-lg">{email}</span>
        </p>

        {/* OTP Section */}
        <div className="mb-8">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">Enter 6-Digit Code</label>
            <div className="flex gap-2 justify-center mb-4">
               <input
                 type="text"
                 inputMode="numeric"
                 autoComplete="one-time-code"
                 maxLength={6}
                 value={otp}
                 onChange={(e) => setOtp(e.target.value.replace(/\D/g,''))}
                 className="w-full text-center text-3xl font-black tracking-widest py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-600 focus:ring-0 outline-none transition-all placeholder-gray-200"
                 placeholder="000000"
               />
            </div>
            <button
                onClick={handleVerifyOtp}
                disabled={isVerifyingOtp || otp.length < 6}
                className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black text-lg shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isVerifyingOtp ? <RotateCw className="animate-spin" /> : <ShieldCheck size={20} />}
                Verify Code
            </button>
        </div>

        {/* Divider */}
        <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-400 font-bold">OR</span></div>
        </div>

        {/* Link Check Section */}
        <div className="text-center">
            <p className="text-xs text-gray-500 mb-3">Clicked the link in your email?</p>
            <button
                onClick={handleCheckLink}
                disabled={isChecking}
                className="text-indigo-600 font-bold text-sm bg-indigo-50 px-4 py-2 rounded-lg hover:bg-indigo-100 transition-colors"
            >
                {isChecking ? "Checking Status..." : "I clicked the link"}
            </button>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100">
            <button
                onClick={handleResend}
                disabled={isResending}
                className="text-gray-400 font-bold text-xs flex items-center justify-center gap-1 hover:text-gray-600 w-full transition-colors"
            >
                {isResending ? "Sending..." : "Did not receive code? Resend"} <RotateCw size={12} className={isResending ? "animate-spin" : ""} />
            </button>
        </div>
      </div>
    </div>
  );
};
export default VerifyEmailScreen;
