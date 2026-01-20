import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, LifeBuoy, Send, User, Bot, Mail, MessageSquare } from 'lucide-react';
import { useToast } from './ToastProvider';
import { contactSupport } from '../services/api';
import { loadState } from '../services/storage';

const SUPPORT_WHATSAPP = 'https://wa.me/2348051763431';

// Quick Actions
const QUICK_ACTIONS = [
  { id: 'verify', label: 'How to verify payment?' },
  { id: 'discount', label: 'How to add discounts?' },
  { id: 'resetpin', label: 'Reset Owner PIN' },
  { id: 'invoice', label: 'How to create an Invoice?' },
];

// Knowledge Base
const KNOWLEDGE_BASE: Record<string, string> = {
  verify: "Go to Settings > Billing and enter your Paystack reference code. This will manually unlock your subscription.",
  discount: "Go to Settings > Preferences > Discount Codes to generate new codes for your customers.",
  resetpin: "Go to Settings > Security. You need your current PIN to change it. If you lost it, use 'Forgot Password' on the login screen.",
  invoice: "To create an invoice, go to the 'Sales' tab. Add products to the cart by tapping them. Then open the cart sidebar (right side) to enter customer details and select a payment method. Click 'Complete Sale' to generate the receipt.",
};

const GENERIC_HELP = "I can help you with Sales, Inventory, and Expenses. Please select a topic below or contact our support team.";

const SupportBot: React.FC<{ embed?: boolean }> = ({ embed = false }) => {
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // State
  const [messages, setMessages] = useState<{ from: 'bot' | 'user'; text: string; isAction?: boolean }[]>([
    { from: 'bot', text: 'Hello! I am your Ginvoice Assistant. How can I help you today?' }
  ]);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [contactMode, setContactMode] = useState(false);
  const [contactMessage, setContactMessage] = useState('');

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const addMessage = (from: 'bot' | 'user', text: string, isAction = false) => {
    setMessages(prev => [...prev, { from, text, isAction }]);
  };

  const handleQuickAction = (actionId: string, label: string) => {
    addMessage('user', label);

    // Simulate thinking
    setTimeout(() => {
        const response = KNOWLEDGE_BASE[actionId];
        if (response) {
            addMessage('bot', response);
            setFailedAttempts(0); // Reset failure count on success
        } else {
            handleUnknownQuery();
        }
    }, 600);
  };

  const handleUnknownQuery = () => {
      const newFailCount = failedAttempts + 1;
      setFailedAttempts(newFailCount);

      if (newFailCount >= 2) {
          addMessage('bot', "I'm having trouble understanding. Would you like to contact a human support agent?", true);
      } else {
          addMessage('bot', GENERIC_HELP);
      }
  };

  const handleSendSupportEmail = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!contactMessage.trim()) return;
      if (!navigator.onLine) {
          addToast('Please connect to the internet.', 'error');
          return;
      }

      setIsSending(true);
      try {
          const state = loadState();
          const email = state?.business?.email || 'unknown@ginvoice.app';
          const businessName = state?.business?.name || 'Unknown Business';

          await contactSupport(contactMessage, email, businessName);

          addMessage('user', `Support Request: ${contactMessage}`);
          addMessage('bot', 'We have received your message. A support agent will reply to your email shortly.');
          setContactMode(false);
          setContactMessage('');
          setFailedAttempts(0);
      } catch (err) {
          addToast('Failed to send message. Try again later.', 'error');
      } finally {
          setIsSending(false);
      }
  };

  const ChatWindow = (
    <div className={`flex flex-col h-[500px] max-h-[60vh] md:max-h-[80vh] w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300 border border-gray-100`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-4 text-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                    <LifeBuoy size={18} />
                </div>
                <div>
                    <h3 className="font-bold text-sm">Ginvoice Support</h3>
                    <div className="flex items-center gap-1.5 opacity-80">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        <span className="text-[10px] font-medium uppercase tracking-wide">Online</span>
                    </div>
                </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-4 md:p-2 -mr-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={20} />
            </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50" ref={scrollRef}>
            {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.from === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.from === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-600'}`}>
                        {msg.from === 'user' ? <User size={14} /> : <Bot size={14} />}
                    </div>
                    <div className={`max-w-[80%] p-3 text-sm shadow-sm ${
                        msg.from === 'user'
                        ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-2xl rounded-tr-none'
                        : 'bg-white text-gray-700 rounded-2xl rounded-tl-none border border-gray-100'
                    }`}>
                        {msg.text}
                    </div>
                </div>
            ))}

            {/* Anti-Loop / Contact Trigger */}
            {failedAttempts >= 2 && !contactMode && (
                <div className="flex flex-col gap-2 pl-11">
                    <button
                        onClick={() => setContactMode(true)}
                        className="bg-gray-900 text-white px-4 py-3 rounded-xl text-sm font-bold shadow-lg hover:scale-[1.02] transition-transform flex items-center gap-2 w-fit"
                    >
                        <Mail size={16} /> Contact Human Support
                    </button>
                    <a
                        href={SUPPORT_WHATSAPP}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-emerald-500 text-white px-4 py-3 rounded-xl text-sm font-bold shadow-lg hover:scale-[1.02] transition-transform flex items-center gap-2 w-fit"
                    >
                        <MessageSquare size={16} /> Chat on WhatsApp
                    </a>
                </div>
            )}

            {/* Contact Form */}
            {contactMode && (
                <div className="pl-11 pr-4 animate-in fade-in slide-in-from-bottom-2">
                    <form onSubmit={handleSendSupportEmail} className="bg-white p-4 rounded-xl border shadow-sm space-y-3">
                        <p className="text-xs font-bold text-gray-500 uppercase">Send a message to support</p>
                        <textarea
                            autoFocus
                            className="w-full p-3 bg-gray-50 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                            placeholder="Describe your issue..."
                            rows={3}
                            value={contactMessage}
                            onChange={(e) => setContactMessage(e.target.value)}
                        />
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setContactMode(false)}
                                className="flex-1 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSending || !contactMessage.trim()}
                                className="flex-1 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {isSending ? 'Sending...' : 'Send Message'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>

        {/* Footer / Chips */}
        <div className="p-4 bg-white border-t space-y-3">
            {!contactMode && (
                <>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Quick Actions</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                        {QUICK_ACTIONS.map(action => (
                            <button
                                key={action.id}
                                onClick={() => handleQuickAction(action.id, action.label)}
                                className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold border border-indigo-100 hover:bg-indigo-100 hover:border-indigo-200 transition-colors active:scale-95"
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    </div>
  );

  // 1. EMBED MODE
  if (embed) {
      return (
          <div className="w-full">
              {!open ? (
                  <button
                      onClick={() => setOpen(true)}
                      className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-black text-sm shadow-lg flex items-center justify-center gap-2 hover:opacity-95 transition-opacity"
                  >
                      <LifeBuoy size={20} /> NEED HELP? OPEN CHAT
                  </button>
              ) : (
                  <div className="mt-4">{ChatWindow}</div>
              )}
          </div>
      );
  }

  // 2. FLOATING MODE
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-6 z-[100] bg-gradient-to-r from-indigo-600 to-violet-600 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform ${open ? 'hidden' : 'flex'}`}
        aria-label="Open support"
      >
        <MessageCircle size={24} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:justify-end sm:pr-6 sm:pb-20 p-4 pointer-events-none">
          {/* Backdrop for mobile only */}
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] sm:hidden pointer-events-auto" onClick={() => setOpen(false)} />
          <div className="pointer-events-auto w-full max-w-md">
            {ChatWindow}
          </div>
        </div>
      )}
    </>
  );
};

export default SupportBot;
