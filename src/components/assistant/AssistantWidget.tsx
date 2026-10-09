import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Bot,
  User as UserIcon,
  RotateCcw,
  AlertCircle,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { ChatMessage, Block } from '../../lib/assistantTypes.ts';
import { BlockRenderer, CardState } from './BlockRenderer.tsx';

interface AssistantWidgetProps {
  onDataChanged?: () => void;
  openSignal?: number;
  renderCustomBlock?: (type: string, props: any) => React.ReactNode;
}

const STARTER_CHIPS = [
  'Predict my next month\'s expenses and finances',
  'Financial report for the past week',
  'What can you do?',
];

export const AssistantWidget: React.FC<AssistantWidgetProps> = ({
  onDataChanged,
  openSignal,
  renderCustomBlock,
}) => {
  const { isGuest, getAuthHeaders } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hello! I am your OmniLife personal analytics assistant. I can analyze your study and money records, generate financial forecasts, and prepare entries or deletions for your review. How can I help you today?',
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFailedText, setLastFailedText] = useState<string | null>(null);
  const [cardStates, setCardStates] = useState<Record<string, CardState>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Open widget when openSignal changes
  useEffect(() => {
    if (openSignal && openSignal > 0) {
      setIsOpen(true);
    }
  }, [openSignal]);

  // Focus textarea when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  // Abort in-flight requests on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const getClientLocalDate = (): string => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    if (!textToSend) {
      setInput('');
    }
    setLastFailedText(null);

    const userMsgId = 'u_' + Date.now();
    const newMessages: ChatMessage[] = [
      ...messages,
      { id: userMsgId, role: 'user', text: query },
    ];
    setMessages(newMessages);
    setIsLoading(true);

    // Format last 12 turns for payload
    const historyPayload = newMessages.slice(-12).map(m => ({
      role: m.role,
      text: m.text,
    }));

    try {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const headers = {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      };

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          messages: historyPayload,
          clientDate: getClientLocalDate(),
        }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.text || 'Rate limited. Please wait a moment.');
        }
        throw new Error('Server returned error status ' + res.status);
      }

      const data = await res.json();
      setMessages(prev => [
        ...prev,
        {
          id: data.id || 'a_' + Date.now(),
          role: 'assistant',
          text: data.text || '',
          blocks: data.blocks || [],
          outcome: data.outcome || 'ok',
        },
      ]);
    } catch (err: any) {
      if (err.name === 'AbortError') return;

      setLastFailedText(query);
      setMessages(prev => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          role: 'assistant',
          text: err.message || 'Network error connecting to assistant.',
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        aria-label={isOpen ? 'Close OmniLife Assistant' : 'Open OmniLife Assistant'}
        className="fixed bottom-6 right-6 z-50 p-3.5 rounded-full bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-pink-500 text-white shadow-xl shadow-purple-500/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-offset-2"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
      </button>

      {/* Floating Assistant Dialog */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="OmniLife Assistant"
          aria-modal="false"
          className="fixed z-50 sm:bottom-20 sm:right-6 bottom-0 right-0 sm:w-[400px] sm:h-[580px] w-full h-[100dvh] bg-white sm:rounded-2xl shadow-2xl border border-purple-100 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-purple-900 via-purple-800 to-fuchsia-900 text-white flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center border border-white/20">
                <Sparkles className="w-4 h-4 text-pink-300" />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                  OmniLife Assistant
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-pink-500/30 text-pink-200 border border-pink-400/30">
                    AI
                  </span>
                </h2>
                <p className="text-[11px] text-purple-200">Study · Money (₹) · Forecasts</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-purple-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Close Assistant Dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Guest Writes Notice */}
          {isGuest && (
            <div className="bg-amber-50/90 border-b border-amber-200 px-3 py-1.5 text-[11px] text-amber-800 flex items-center gap-1.5 shrink-0">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Sign in to let me save or delete records.</span>
            </div>
          )}

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
            {messages.map(msg => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold ${
                      isUser
                        ? 'bg-gradient-to-tr from-pink-500 to-purple-600 text-white'
                        : msg.isError
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div className={`max-w-[84%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap break-words ${
                        isUser
                          ? 'bg-gradient-to-r from-purple-700 to-fuchsia-600 text-white rounded-tr-none shadow-xs'
                          : msg.isError
                          ? 'bg-rose-50 border border-rose-200 text-rose-800 rounded-tl-none'
                          : 'bg-white border border-purple-100/80 text-slate-800 rounded-tl-none shadow-xs'
                      }`}
                    >
                      {msg.text}
                    </div>

                    {/* Retry button for error message */}
                    {msg.isError && lastFailedText && (
                      <button
                        onClick={() => handleSend(lastFailedText)}
                        className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 rounded-md border border-purple-200 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Retry</span>
                      </button>
                    )}

                    {/* Render inline structured blocks if present */}
                    {msg.blocks && msg.blocks.length > 0 && (
                      <div className="w-full mt-2 space-y-2">
                        {msg.blocks.map(block => (
                          <BlockRenderer
                            key={block.id}
                            block={block}
                            cardState={cardStates[block.id]}
                            renderCustomBlock={renderCustomBlock}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Loading Indicator */}
            {isLoading && (
              <div
                className="flex items-center gap-2 text-purple-600 text-xs py-2 px-1"
                aria-live="polite"
              >
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse delay-75" />
                <div className="w-2 h-2 rounded-full bg-purple-700 animate-pulse delay-150" />
                <span className="text-[11px] text-purple-700 font-medium">Assistant is thinking...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Starter Chips (shown when few messages) */}
          {messages.length <= 2 && !isLoading && (
            <div className="p-2 border-t border-purple-100 bg-white flex flex-wrap gap-1.5 shrink-0">
              {STARTER_CHIPS.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(chip)}
                  className="text-[11px] px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-800 font-medium rounded-full border border-purple-200 transition-colors text-left"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className="p-3 border-t border-purple-100 bg-white shrink-0">
            <div className="flex items-end gap-2 bg-slate-50 border border-purple-200 rounded-xl p-2 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-400">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value.slice(0, 2000))}
                onKeyDown={handleKeyDown}
                placeholder="Ask or command (e.g. predict expenses)..."
                rows={1}
                maxLength={2000}
                disabled={isLoading}
                className="flex-1 bg-transparent text-xs resize-none max-h-24 focus:outline-none placeholder:text-slate-400 text-slate-800"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                aria-label="Send message"
                className="p-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-500 text-white disabled:opacity-40 hover:from-purple-700 hover:to-pink-600 transition-all shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex justify-between items-center mt-1 px-1 text-[10px] text-slate-400">
              <span>Enter to send · Shift+Enter for newline</span>
              <span>{input.length}/2000</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
