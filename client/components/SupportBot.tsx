import React, { useState } from 'react';
import { MessageCircle, X, Send, LifeBuoy } from 'lucide-react';
import { useToast } from './ToastProvider';

const SUPPORT_WHATSAPP = 'https://wa.me/2348051763431';
const SUPPORT_EMAIL = 'noshibr2@gmail.com';

const FAQ: { id: string; q: string; a: string }[] = [
  { id: 'login', q: 'I cannot log in', a: 'Check your email and PIN. If you forgot your PIN, use the Forgot PIN option on the login screen.' },
  { id: 'sync', q: 'Sync is failing', a: 'Ensure you are online and logged in. Then wait a few seconds for auto-sync.' },
  { id: 'payment', q: 'Payment was successful but not unlocked', a: 'Use the Verify Payment button in Settings with your Paystack reference.' },
  { id: 'offline', q: 'Some actions do not work offline', a: 'Deletes and subscription checks require an internet connection.' },
  { id: 'invoice', q: 'Invoice edits are not saving', a: 'Save the invoice edit, then allow auto-sync to push changes when online.' }
];

const SupportBot: React.FC = () => {
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ from: 'bot' | 'user'; text: string }[]>([
    { from: 'bot', text: 'Hi! Tell me what you need help with.' }
  ]);

  const addMessage = (from: 'bot' | 'user', text: string) => {
    setMessages(prev => [...prev, { from, text }]);
  };

  const handleQuestion = (item: { q: string; a: string }) => {
    addMessage('user', item.q);
    addMessage('bot', item.a);
  };

  const handleEscalateEmail = () => {
    if (!navigator.onLine) {
      addToast('Please connect to the internet to contact support.', 'error');
      return;
    }
    const subject = encodeURIComponent('Ginvoice Support Request');
    const body = encodeURIComponent('Describe your issue here...');
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  };

  const handleEscalateWhatsapp = () => {
    if (!navigator.onLine) {
      addToast('Please connect to the internet to contact support.', 'error');
      return;
    }
    window.open(SUPPORT_WHATSAPP, '_blank');
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[70] bg-primary text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center hover:opacity-90 transition-all"
        aria-label="Open support"
      >
        <MessageCircle size={24} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-4 bg-primary text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold">
                <LifeBuoy size={18} /> Support Assistant
              </div>
              <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`text-sm ${msg.from === 'bot' ? 'text-gray-700' : 'text-primary font-bold text-right'}`}
                >
                  {msg.text}
                </div>
              ))}

              <div className="pt-2 space-y-2">
                {FAQ.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleQuestion(item)}
                    className="w-full text-left text-xs font-bold px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100"
                  >
                    {item.q}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 border-t bg-white">
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">Need a human?</div>
              <div className="flex gap-2">
                <button
                  onClick={handleEscalateEmail}
                  className="flex-1 bg-gray-900 text-white py-2 rounded-xl text-xs font-black"
                >
                  Email Support
                </button>
                <button
                  onClick={handleEscalateWhatsapp}
                  className="flex-1 bg-emerald-600 text-white py-2 rounded-xl text-xs font-black"
                >
                  WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SupportBot;
