import React, { useState, useRef, useEffect } from 'react';
import { X, LifeBuoy, Send, User, Bot, Mail, MessageSquare } from 'lucide-react';
import { useToast } from './ToastProvider';
import { sendChat } from '../services/api';
import { loadState } from '../services/storage';
import { TabId } from '../types';

const SUPPORT_WHATSAPP = 'https://wa.me/2348051763431';

interface SupportBotProps {
  embed?: boolean;
  onNavigate?: (tab: TabId, params?: any) => void;
}

const SupportBot: React.FC<SupportBotProps> = ({ embed = false, onNavigate }) => {
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // State
  const [messages, setMessages] = useState<{ from: 'bot' | 'user'; text: string; isAction?: boolean }[]>([
    { from: 'bot', text: 'Hello! I am your Ginvoice Market OS Assistant. I can help with business questions, math, or navigating the app.' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, isSending]);

  // Focus input on open
  useEffect(() => {
      if (open && inputRef.current) {
          setTimeout(() => inputRef.current?.focus(), 100);
      }
  }, [open]);

  const addMessage = (from: 'bot' | 'user', text: string, isAction = false) => {
    setMessages(prev => [...prev, { from, text, isAction }]);
  };

  const handleSendMessage = async (text: string) => {
      if (!text.trim()) return;

      const userMessage = text.trim();
      addMessage('user', userMessage);
      setInputText('');
      setIsSending(true);

      try {
          const response = await sendChat(userMessage, messages);

          let botText = response.text || "I'm having trouble connecting right now.";

          // --- 1. Structured Action Handler (Priority) ---
          if (response.action && response.action.type === 'NAVIGATE') {
              const payload = response.action.payload;
              const params = response.action.params; // Get params if any

              if (onNavigate) {
                  // Pass params to onNavigate if supported, or just navigate
                  onNavigate(payload as TabId, params);

                  // Use message from server if available, or fallback
                  const toastMsg = response.text || `Taking you to ${payload}...`;
                  addToast(toastMsg, 'info');
              }
          }

          // --- 2. Fallback: JSON in Text (Legacy/Backup) ---
          const jsonNavMatch = botText.match(/\{[\s\S]*"type":\s*"NAVIGATE"[\s\S]*\}/);
          if (jsonNavMatch) {
             try {
                const command = JSON.parse(jsonNavMatch[0]);
                if (command.type === 'NAVIGATE' && command.payload) {
                   const screen = command.payload.toLowerCase();
                   let targetTab: TabId | null = null;

                   // Map payload to valid tabs
                   if (['sales', 'inventory', 'history', 'dashboard', 'expenditure', 'settings'].includes(screen)) {
                      targetTab = screen as TabId;
                   }

                   if (targetTab && onNavigate) {
                      onNavigate(targetTab);
                      addToast(command.message || `Taking you to ${targetTab}...`, 'info');
                   }

                   // Strip the JSON from the text shown to user
                   botText = botText.replace(jsonNavMatch[0], '').trim();
                   // If text became empty, show the message from JSON
                   if (!botText) botText = command.message || `Navigating to ${command.payload}...`;
                }
             } catch (e) {
                console.error("JSON Parse Error", e);
             }
          }

          // --- 3. Fallback: Tag in Text (Legacy) ---
          const navMatch = botText.match(/\[\[NAVIGATE:([a-zA-Z]+)\]\]/);
          if (navMatch && navMatch[1]) {
              const screen = navMatch[1].toLowerCase();
              let targetTab: TabId | null = null;
              if (['sales', 'inventory', 'history', 'dashboard', 'expenditure', 'settings'].includes(screen)) {
                  targetTab = screen as TabId;
              }

              botText = botText.replace(navMatch[0], '').trim();

              if (targetTab && onNavigate) {
                  onNavigate(targetTab);
                  addToast(`Taking you to ${targetTab}...`, 'info');
              }
          }

          addMessage('bot', botText);

      } catch (err) {
          console.error(err);
          addMessage('bot', "Sorry, I'm having trouble connecting to the server. Please check your internet connection.");
      } finally {
          setIsSending(false);
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      handleSendMessage(inputText);
  };

  const QUICK_ACTIONS = [
      "How much did I sell today?",
      "Show me my profit this month",
      "Do I have low stock?",
      "Take me to Inventory",
      "How to create an invoice?"
  ];

  const ChatWindow = (
    <div className={`flex flex-col h-[500px] max-h-[60vh] md:max-h-[80vh] w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300 border border-gray-100`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-4 text-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                    <LifeBuoy size={18} />
                </div>
                <div>
                    <h3 className="font-bold text-sm">Market OS Assistant</h3>
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
                    <div className={`max-w-[80%] p-3 text-sm shadow-sm whitespace-pre-wrap ${
                        msg.from === 'user'
                        ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-2xl rounded-tr-none'
                        : 'bg-white text-gray-700 rounded-2xl rounded-tl-none border border-gray-100'
                    }`}>
                        {msg.text}
                    </div>
                </div>
            ))}
            {isSending && (
                 <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-gray-200 text-gray-600">
                        <Bot size={14} />
                    </div>
                    <div className="bg-white text-gray-500 rounded-2xl rounded-tl-none border border-gray-100 p-3 text-sm italic">
                        Thinking...
                    </div>
                 </div>
            )}
        </div>

        {/* Input Area */}
        <div className="p-3 bg-white border-t">
            {/* Quick Chips if empty input */}
            {messages.length < 3 && !inputText && (
                <div className="flex overflow-x-auto gap-2 mb-3 pb-1 no-scrollbar">
                    {QUICK_ACTIONS.map((action, i) => (
                        <button
                            key={i}
                            onClick={() => handleSendMessage(action)}
                            className="whitespace-nowrap px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors"
                        >
                            {action}
                        </button>
                    ))}
                </div>
            )}

            <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Ask anything..."
                    className="flex-1 bg-gray-100 border-0 rounded-xl px-4 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none"
                    disabled={isSending}
                />
                <button
                    type="submit"
                    disabled={!inputText.trim() || isSending}
                    className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <Send size={18} />
                </button>
            </form>
        </div>
    </div>
  );

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

  // Floating Mode
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 md:bottom-10 right-4 z-[9999] p-4 bg-indigo-600 text-white rounded-full shadow-xl hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95"
      >
        <MessageSquare size={24} />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-end justify-end p-4 md:p-6 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md">
        {ChatWindow}
      </div>
    </div>
  );
};

export default SupportBot;
