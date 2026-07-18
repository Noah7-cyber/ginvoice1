import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Send, User, Bot, Mic, Copy } from 'lucide-react';
import { motion } from 'motion/react';
import { marked } from 'marked';
marked.use({ breaks: true });
import { useToast } from './ToastProvider';
import { sendChat } from '../services/api';
import { TabId } from '../types';
import { useHybridSpeech } from '../hooks/useHybridSpeech';
import DashboardMessage from './ai-dashboard/DashboardMessage';

interface SupportBotProps {
  embed?: boolean;
  onNavigate?: (tab: TabId, params?: any) => void;
  uiContext?: Record<string, any>;
}

const SupportBot: React.FC<SupportBotProps> = ({ embed = false, onNavigate, uiContext }) => {
  const BOT_BRAND_IMAGE = '/gbot.png';
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // State
  const [messages, setMessages] = useState<{ from: 'bot' | 'user'; text: string; isAction?: boolean }[]>([
    { from: 'bot', text: 'Hello! I am your Ginvoice Market OS Assistant. I can help with business questions, math, or navigating the app.' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const responseCacheRef = useRef<Map<string, { at: number; payload: any }>>(new Map());
  
  const { status: voiceStatus, transcript, toggleListening, setTranscript } = useHybridSpeech();

  useEffect(() => {
    if (transcript) {
      setInputText(transcript);
    }
  }, [transcript]);

  // Compute visual state
  const visualState = isSending ? 'processing' : voiceStatus;

  const localCommandMap = useMemo(() => ([
    { pattern: /(take me to|go to|open)\s+(inventory|stock)/i, tab: 'inventory' as TabId, text: 'Opening Inventory for you.' },
    { pattern: /(take me to|go to|open)\s+(history|sales history|past sales|debtors)/i, tab: 'history' as TabId, text: 'Opening Sales & Debtors for you.' },
    { pattern: /(take me to|go to|open)\s+(dashboard|report|analytics)/i, tab: 'dashboard' as TabId, text: 'Opening Dashboard for you.' },
    { pattern: /(take me to|go to|open)\s+(settings)/i, tab: 'settings' as TabId, text: 'Opening Settings for you.' },
    { pattern: /(take me to|go to|open)\s+(expenses|expenditure)/i, tab: 'expenditure' as TabId, text: 'Opening Expenditure for you.' }
  ]), []);

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
    setMessages(prev => {
      const next = [...prev, { from, text, isAction }];
      return next.slice(-40);
    });
  };

  const handleSendMessage = async (text: string) => {
      if (!text.trim() || isSending) return;

      const userMessage = text.trim().slice(0, 500);
      addMessage('user', userMessage);
      setInputText('');
      setIsSending(true);

      try {
          const localMatch = localCommandMap.find(entry => entry.pattern.test(userMessage));
          if (localMatch && onNavigate) {
              onNavigate(localMatch.tab);
              addToast(localMatch.text, 'info');
              addMessage('bot', localMatch.text);
              return;
          }

          const cacheKey = userMessage.toLowerCase();
          const cached = responseCacheRef.current.get(cacheKey);
          if (cached && Date.now() - cached.at < 5 * 60_000) {
              const cachedResponse = cached.payload;
              if (cachedResponse.action?.type === 'NAVIGATE' && onNavigate) {
                  onNavigate(cachedResponse.action.payload as TabId, cachedResponse.action.params);
                  addToast(cachedResponse.text || `Taking you to ${cachedResponse.action.payload}...`, 'info');
              }
              addMessage('bot', cachedResponse.text || "I'm having trouble connecting right now.");
              return;
          }

          // Send chat to backend
          const response = await sendChat(userMessage, messages, uiContext);
          responseCacheRef.current.set(cacheKey, { at: Date.now(), payload: response });

          let botText = response.text || "I'm having trouble connecting right now.";

          // --- Structured Action Handler ---
          if (response.action && response.action.type === 'NAVIGATE') {
              const payload = response.action.payload;
              const params = response.action.params;

              if (onNavigate) {
                  // We assume payload is already a valid route from server (e.g., 'inventory', 'history')
                  onNavigate(payload as TabId, params);
                  addToast(botText || `Taking you to ${payload}...`, 'info');
              }
          }

          addMessage('bot', botText);

      } catch (err: any) {
          console.error(err);
          if (err?.status === 429) {
              addMessage('bot', err?.message || "You've reached today's chat limit.");
          } else {
              addMessage('bot', "Sorry, I'm having trouble connecting to the server. Please check your internet connection.");
          }
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
    <div className={`flex flex-col h-full max-h-none w-full max-w-none rounded-none inset-0 fixed md:relative md:inset-auto md:h-auto md:max-h-[80vh] md:w-full md:max-w-md md:rounded-2xl bg-white overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300 border border-gray-100 z-[99999]`}>
        {/* Header */}
        <div className="bg-indigo-600 p-4 text-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/30">
                     <Bot size={20} className="text-white" />
                </div>
                <div>
                    <h3 className="font-bold text-base">gBot Assistant</h3>
                    <div className="flex items-center gap-1.5 opacity-80">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        <span className="text-[10px] font-medium uppercase tracking-wide">Online</span>
                    </div>
                </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={24} />
            </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50" ref={scrollRef}>
            {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.from === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.from === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-600'}`}>
                        {msg.from === 'user' ? <User size={14} /> : <Bot size={14} />}
                    </div>
                    {msg.from === 'user' ? (
                        <div className="max-w-[80%] p-3 text-sm shadow-sm whitespace-pre-wrap bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-2xl rounded-tr-none">
                            {msg.text}
                        </div>
                    ) : (
                        <div className="max-w-[95%] p-3 text-sm shadow-sm bg-white text-gray-700 rounded-2xl rounded-tl-none border border-gray-100 relative group">
                            {(() => {
                                try {
                                    const textMatch = msg.text.match(/\{[\s\S]*\}/);
                                    if (textMatch) {
                                        const parsed = JSON.parse(textMatch[0]);
                                        if (parsed.type === 'dashboard') {
                                            return <DashboardMessage payload={parsed} onNavigate={onNavigate} />;
                                        }
                                    }
                                } catch (e) {
                                    // Fallback to markdown
                                }
                                return (
                                    <div 
                                        className="prose prose-sm prose-indigo max-w-none pr-6"
                                        dangerouslySetInnerHTML={{ __html: marked.parse(msg.text) as string }}
                                    />
                                );
                            })()}
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(msg.text);
                                    addToast('Copied to clipboard', 'success');
                                }}
                                className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all active:scale-95"
                                title="Copy response"
                            >
                                <Copy size={14} />
                            </button>
                        </div>
                    )}
                </div>
            ))}
            {isSending && (
                 <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-gray-200 text-gray-600">
                        <Bot size={14} />
                    </div>
                    <div className="bg-white text-gray-500 rounded-2xl rounded-tl-none border border-gray-100 p-4 flex items-center gap-1.5 w-fit">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    </div>
                 </div>
            )}
        </div>

        {/* Input Area */}
        <div className="p-3 bg-white border-t md:rounded-b-2xl">
            {/* Quick Chips if empty input */}
            {messages.length < 3 && !inputText && (
                <div className="flex overflow-x-auto gap-2 mb-3 pb-1 no-scrollbar">
                    {QUICK_ACTIONS.map((action, i) => (
                        <button
                            key={i}
                            onClick={() => handleSendMessage(action)}
                            disabled={isSending}
                            className="whitespace-nowrap px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors"
                        >
                            {action}
                        </button>
                    ))}
                </div>
            )}

            <form onSubmit={handleSubmit} className="flex items-end gap-2">
                <div className="flex-1 bg-gray-100 rounded-xl flex items-end relative focus-within:ring-2 focus-within:ring-indigo-500 focus-within:bg-white transition-all overflow-hidden">
                    <textarea
                        ref={inputRef}
                        value={inputText}
                        onChange={(e) => {
                            setInputText(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                if (inputText.trim() && !isSending) {
                                    handleSubmit(e as any);
                                }
                            }
                        }}
                        placeholder="Ask anything..."
                        rows={1}
                        className="flex-1 bg-transparent border-0 px-4 py-3 text-sm outline-none resize-none overflow-y-auto"
                        style={{ minHeight: '44px', maxHeight: '120px' }}
                        disabled={isSending}
                    />
                    <button
                        type="button"
                        onClick={() => {
                            if (visualState === 'idle') setInputText('');
                            toggleListening();
                        }}
                        disabled={isSending || visualState === 'loading_model'}
                        className="relative flex items-center justify-center w-10 h-10 mb-0.5 mr-1 rounded-xl transition-colors disabled:opacity-50 shrink-0 text-gray-500 hover:text-indigo-600 hover:bg-gray-200"
                        aria-label="Voice input"
                        title="Using Local Whisper"
                    >
                        {(visualState === 'idle' && !isSending) && (
                            <Mic size={18} />
                        )}
                        
                        {(visualState === 'listening' && !isSending) && (
                            <motion.div
                                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                                transition={{ repeat: Infinity, duration: 1.5 }}
                                className="absolute inset-0 rounded-xl bg-indigo-100 flex items-center justify-center"
                            >
                                <Mic size={18} className="text-indigo-600" />
                            </motion.div>
                        )}

                        {(visualState === 'processing' || visualState === 'loading_model') && (
                            <>
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                    className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-600"
                                    style={{ background: 'conic-gradient(from 0deg, transparent, rgba(79, 70, 229, 0.1))' }}
                                />
                                <Mic size={18} className="text-indigo-400 relative z-10" />
                            </>
                        )}
                    </button>
                </div>
                <button
                    type="submit"
                    disabled={!inputText.trim() || isSending}
                    className="h-11 w-11 flex items-center justify-center shrink-0 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            <img src={BOT_BRAND_IMAGE} alt="gBot avatar" className="w-5 h-5 rounded-full bg-white/20 p-0.5" /> NEED HELP? OPEN CHAT
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
        className="fixed bottom-24 md:bottom-10 right-4 z-[9999] p-1.5 bg-white rounded-full shadow-xl ring-2 ring-indigo-200 hover:ring-indigo-400 transition-all hover:scale-105 active:scale-95"
        aria-label="Open gBot support chat"
      >
        <img src={BOT_BRAND_IMAGE} alt="gBot avatar" className="w-12 h-12 rounded-full" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[99999] flex items-end justify-end md:p-6 pointer-events-none">
      <div className="pointer-events-auto w-full md:max-w-md h-full md:h-auto">
        {ChatWindow}
      </div>
    </div>
  );
};

export default SupportBot;
