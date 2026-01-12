import React, { useState } from 'react';
import { MessageCircle, X, LifeBuoy } from 'lucide-react';
import { useToast } from './ToastProvider';

const SUPPORT_WHATSAPP = 'https://wa.me/2348051763431';
const SUPPORT_EMAIL = 'support@ginvoice.com.ng';

const FAQ: { id: string; q: string; a: string }[] = [
  { id: 'login', q: 'I cannot log in', a: 'Check your email and PIN. If you forgot your PIN, use the Forgot PIN option on the login screen.' },
  { id: 'sync', q: 'Sync is failing', a: 'Ensure you are online and logged in. Then wait a few seconds for auto-sync.' },
  { id: 'payment', q: 'Payment was successful but not unlocked', a: 'Use the Verify Payment button in Settings with your Paystack reference.' },
  { id: 'offline', q: 'Some actions do not work offline', a: 'Deletes and subscription checks require an internet connection.' },
  { id: 'invoice', q: 'Invoice edits are not saving', a: 'Save the invoice edit, then allow auto-sync to push changes when online.' }
];

// Added embed prop to handle the two different display modes
const SupportBot: React.FC<{ embed?: boolean }> = ({ embed = false }) => {
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

  // --- RENDERING LOGIC ---

  // 1. INLINE MODE (For Settings Screen)
  if (embed) {
    return (
      <div className="w-full">
        {!open ? (
          <button 
            onClick={() => setOpen(true)} 
            className="w-full py-3 bg-primary text-white rounded-xl font-black text-sm shadow-md flex items-center justify-center gap-2"
          >
            <LifeBuoy size={18} /> OPEN SUPPORT ASSISTANT
          </button>
        ) : (
          <div className="border border-gray-100 rounded-2xl bg-white overflow-hidden shadow-inner">
            <div className="p-3 bg-gray-50 border-b flex justify-between items-center">
              <span className="text-xs font-black uppercase text-gray-400 tracking-widest">Support Chat</span>
              <button onClick={() => setOpen(false)} className="text-[10px] font-bold text-red-500 uppercase">Close</button>
            </div>
            <ChatContent 
              messages={messages} 
              onQuestion={handleQuestion} 
              onEmail={handleEscalateEmail} 
              onWhatsapp={handleEscalateWhatsapp} 
            />
          </div>
        )}
      </div>
    );
  }

  // 2. FLOATING MODE (Original)
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
            <ChatContent 
              messages={messages} 
              onQuestion={handleQuestion} 
              onEmail={handleEscalateEmail} 
              onWhatsapp={handleEscalateWhatsapp} 
            />
          </div>
        </div>
      )}
    </>
  );
};

// Reusable Chat UI to keep the code clean
const ChatContent: React.FC<{
  messages: any[], 
  onQuestion: (q: any) => void, 
  onEmail: () => void, 
  onWhatsapp: () => void
}> = ({ messages, onQuestion, onEmail, onWhatsapp }) => (
  <>
    <div className="p-4 space-y-3 max-h-[40vh] overflow-y-auto bg-gray-50/50">
      {messages.map((msg, idx) => (
        <div
          key={idx}
          className={`text-sm p-3 rounded-2xl max-w-[85%] ${
            msg.from === 'bot' 
            ? 'bg-white text-gray-700 shadow-sm self-start' 
            : 'bg-primary text-white font-bold ml-auto'
          }`}
        >
          {msg.text}
        </div>
      ))}

      <div className="pt-2 space-y-2">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Quick FAQ</p>
        {FAQ.map(item => (
          <button
            key={item.id}
            onClick={() => onQuestion(item)}
            className="w-full text-left text-xs font-bold px-3 py-2 rounded-xl border border-gray-100 bg-white hover:bg-gray-100 transition-colors"
          >
            {item.q}
          </button>
        ))}
      </div>
    </div>

    <div className="p-4 border-t bg-white">
      <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">Speak to a human</div>
      <div className="flex gap-2">
        <button onClick={onEmail} className="flex-1 bg-gray-900 text-white py-2 rounded-xl text-xs font-black">Email</button>
        <button onClick={onWhatsapp} className="flex-1 bg-emerald-600 text-white py-2 rounded-xl text-xs font-black">WhatsApp</button>
      </div>
    </div>
  </>
);

export default SupportBot;