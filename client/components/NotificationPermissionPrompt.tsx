import React, { useState, useEffect } from 'react';
import { Bell, BellRing, X, Shield, Zap, TrendingUp } from 'lucide-react';
import { subscribeUserToPush } from '../services/pushNotifications';

interface NotificationPermissionPromptProps {
  onComplete: () => void;
}

const STORAGE_KEY = 'ginvoice_push_prompt_dismissed';

/**
 * Full-screen notification permission prompt.
 * Designed specifically for TWA/PWA users who may not see the browser's
 * default notification permission banner. Shows once after login and
 * can be permanently dismissed.
 */
const NotificationPermissionPrompt: React.FC<NotificationPermissionPromptProps> = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<'idle' | 'success' | 'denied'>('idle');

  useEffect(() => {
    // Don't show if:
    // 1. Already dismissed before
    // 2. Notifications not supported
    // 3. Permission already granted
    // 4. Permission permanently denied (can't do anything about it)
    const wasDismissed = localStorage.getItem(STORAGE_KEY);
    const notSupported = !('Notification' in window) || !('serviceWorker' in navigator);
    const alreadyGranted = 'Notification' in window && Notification.permission === 'granted';
    const permanentlyDenied = 'Notification' in window && Notification.permission === 'denied';

    if (wasDismissed || notSupported || alreadyGranted || permanentlyDenied) {
      // If already granted, silently ensure subscription is saved
      if (alreadyGranted) {
        subscribeUserToPush().catch(console.error);
      }
      onComplete();
      return;
    }

    // Small delay so it doesn't feel jarring right after login
    const timer = setTimeout(() => setIsVisible(true), 1500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const handleEnable = async () => {
    setIsLoading(true);
    try {
      const success = await subscribeUserToPush();
      if (success) {
        setResult('success');
        localStorage.setItem(STORAGE_KEY, 'enabled');
        setTimeout(() => {
          setIsVisible(false);
          onComplete();
        }, 1500);
      } else {
        setResult('denied');
        localStorage.setItem(STORAGE_KEY, 'denied');
        setTimeout(() => {
          setIsVisible(false);
          onComplete();
        }, 2000);
      }
    } catch {
      setResult('denied');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, 'skipped');
    setIsVisible(false);
    onComplete();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
         style={{ background: 'linear-gradient(135deg, rgba(79,70,229,0.97) 0%, rgba(99,102,241,0.97) 50%, rgba(129,140,248,0.97) 100%)' }}>
      
      {/* Dismiss button */}
      <button 
        onClick={handleSkip}
        className="absolute top-4 right-4 p-2 text-white/60 hover:text-white transition-colors"
        aria-label="Skip"
      >
        <X size={24} />
      </button>

      <div className="max-w-sm w-full text-center space-y-6">
        {/* Animated bell icon */}
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 bg-white/20 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
          <div className="relative w-24 h-24 bg-white/25 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30">
            {result === 'success' ? (
              <BellRing size={40} className="text-white animate-bounce" />
            ) : (
              <Bell size={40} className="text-white" />
            )}
          </div>
        </div>

        {result === 'success' ? (
          <>
            <h2 className="text-2xl font-bold text-white">You're all set! 🎉</h2>
            <p className="text-white/80 text-sm">You'll now receive important business alerts.</p>
          </>
        ) : result === 'denied' ? (
          <>
            <h2 className="text-2xl font-bold text-white">No worries!</h2>
            <p className="text-white/80 text-sm">You can enable notifications later in your phone's Settings app under Notifications → Ginvoice.</p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-white">Stay on top of your business</h2>
            <p className="text-white/80 text-sm leading-relaxed">
              Enable notifications so you never miss important updates about your store.
            </p>

            {/* Benefits */}
            <div className="space-y-3 text-left">
              <div className="flex items-center gap-3 bg-white/15 rounded-2xl p-3 backdrop-blur-sm">
                <div className="p-2 bg-white/20 rounded-xl">
                  <TrendingUp size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Sales Alerts</p>
                  <p className="text-white/70 text-xs">Know instantly when a sale is recorded</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white/15 rounded-2xl p-3 backdrop-blur-sm">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Shield size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Low Stock Warnings</p>
                  <p className="text-white/70 text-xs">Get alerted before you run out of stock</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white/15 rounded-2xl p-3 backdrop-blur-sm">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Zap size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Daily Summaries</p>
                  <p className="text-white/70 text-xs">Evening recap of your sales & expenses</p>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="space-y-3 pt-2">
              <button
                onClick={handleEnable}
                disabled={isLoading}
                className="w-full py-4 bg-white text-indigo-700 font-bold text-base rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-700 rounded-full animate-spin" />
                    Enabling...
                  </>
                ) : (
                  <>
                    <BellRing size={20} />
                    Enable Notifications
                  </>
                )}
              </button>
              <button
                onClick={handleSkip}
                className="w-full py-3 text-white/70 text-sm font-medium hover:text-white transition-colors"
              >
                Maybe later
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationPermissionPrompt;
