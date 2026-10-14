import React, { useState, useRef } from 'react';
import { Lock, Bot, Sparkles, UserCheck, ArrowRight } from 'lucide-react';
import { Navbar, ActiveTab } from '../../components/Navbar.tsx';
import { DashboardContent } from '../dashboard/DashboardContent.tsx';
import { PREVIEW_DASHBOARD_DATA } from './previewData.ts';
import { useAuthGate } from './AuthGateContext.tsx';
import { formatTabAuthReason } from './authGate.ts';

export const LockedPreview: React.FC = () => {
  const { requestAuth } = useAuthGate();
  const [hoverHint, setHoverHint] = useState<{ x: number; y: number; text: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleCaptureClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // Query elements under the cursor to determine specific target clicked
    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    let targetReason: string | undefined;
    let targetTab: ActiveTab | undefined;

    for (const el of elements) {
      const htmlEl = el as HTMLElement;
      if (htmlEl.dataset && htmlEl.dataset.authReason) {
        targetReason = htmlEl.dataset.authReason;
        targetTab = htmlEl.dataset.intendedTab as ActiveTab | undefined;
        break;
      }
    }

    requestAuth({
      reason: targetReason || 'Sign in to unlock all features',
      intendedTab: targetTab,
      initialMode: 'login',
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if hovering over a specific targeted element
    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    let hintText = 'Sign in to unlock';

    for (const el of elements) {
      const htmlEl = el as HTMLElement;
      if (htmlEl.dataset && htmlEl.dataset.authReason) {
        hintText = htmlEl.dataset.authReason;
        break;
      }
    }

    setHoverHint({ x, y, text: hintText });
  };

  const handleMouseLeave = () => {
    setHoverHint(null);
  };

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-800 flex flex-col font-sans selection:bg-pink-500 selection:text-white relative">
      {/* 1. Persistent Locked Preview Ribbon */}
      <aside
        aria-label="Locked preview notification"
        className="w-full bg-gradient-to-r from-purple-950 via-purple-900 to-slate-950 text-white px-4 py-2 border-b border-purple-500/20 text-xs shadow-inner shrink-0"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <span className="flex h-2 w-2 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
            </span>
            <span className="font-semibold text-purple-200">
              Locked preview · Sample data · Sign in to use your own
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              requestAuth({
                reason: 'Sign in to unlock your personal analytics',
                initialMode: 'login',
              })
            }
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-[11px] transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-pink-400 cursor-pointer"
          >
            <Lock className="w-3 h-3 text-pink-400" />
            <span>Sign in to unlock</span>
          </button>
        </div>
      </aside>

      {/* 2. Top Navigation Bar in Locked Mode */}
      <Navbar
        activeTab="dashboard"
        setActiveTab={() => {}}
        onOpenQuickLog={() =>
          requestAuth({
            reason: 'Sign in to log new activity',
            initialMode: 'login',
          })
        }
        locked={true}
        onLockedTabClick={(tab) =>
          requestAuth({
            reason: formatTabAuthReason(tab),
            intendedTab: tab,
            initialMode: 'login',
          })
        }
        onSignInClick={() =>
          requestAuth({
            reason: 'Sign in to access your personal analytics and forecasting',
            initialMode: 'login',
          })
        }
        onRegisterClick={() =>
          requestAuth({
            reason: 'Create a free account to track your life data',
            initialMode: 'register',
          })
        }
      />

      {/* 3. Main Content Area with Inert Region & Transparent Capture Layer */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative">
        <div ref={containerRef} className="relative overflow-hidden rounded-3xl">
          {/* Inert Preview Content (Zero network calls, fully client-side fixtures) */}
          <div inert aria-hidden="true" className="select-none pointer-events-none">
            <DashboardContent
              data={PREVIEW_DASHBOARD_DATA}
              readOnly={true}
              loading={false}
            />
          </div>

          {/* Transparent Capture Layer over Preview Content */}
          <div
            role="presentation"
            onClick={handleCaptureClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="absolute inset-0 z-10 cursor-not-allowed"
            title="Sign in to unlock"
          />

          {/* Floating Hover Lock Hint Tooltip */}
          {hoverHint && (
            <div
              className="pointer-events-none absolute z-30 px-2.5 py-1 rounded-lg bg-purple-950/90 text-white text-[11px] font-bold shadow-xl border border-purple-500/30 backdrop-blur-sm whitespace-nowrap flex items-center gap-1.5 transition-opacity"
              style={{
                left: `${Math.min(hoverHint.x + 16, (containerRef.current?.clientWidth || 800) - 220)}px`,
                top: `${hoverHint.y + 16}px`,
              }}
            >
              <Lock className="w-3 h-3 text-pink-400" />
              <span>{hoverHint.text}</span>
            </div>
          )}

          {/* Tasteful Frosted Fade over Lower Dashboard Sections with Centered CTA */}
          <div className="absolute inset-x-0 bottom-0 h-96 pointer-events-none bg-gradient-to-t from-slate-50 via-slate-50/85 to-transparent flex items-end justify-center pb-8 sm:pb-12 z-20">
            <div className="pointer-events-auto p-6 sm:p-8 rounded-3xl bg-white/95 backdrop-blur-md border border-purple-200/80 shadow-2xl text-center max-w-md mx-4 space-y-3">
              <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-pink-500 text-white shadow-md shadow-pink-500/25">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg sm:text-xl font-black text-purple-950 tracking-tight">
                Create a free account to see your own analytics
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Experience AI forecasting, What-If simulations, and habit compounding with your real data.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    requestAuth({
                      reason: 'Create a free account to track your life data',
                      initialMode: 'register',
                    })
                  }
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white text-xs font-bold shadow-md shadow-pink-500/25 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                >
                  Sign Up Free
                </button>
                <button
                  type="button"
                  onClick={() =>
                    requestAuth({
                      reason: 'Sign in to access your personal analytics and forecasting',
                      initialMode: 'login',
                    })
                  }
                  className="px-4 py-2.5 rounded-xl border border-purple-200 bg-white hover:bg-purple-50 text-purple-900 text-xs font-bold transition-all cursor-pointer"
                >
                  Sign In
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 4. Footer */}
      <footer className="w-full border-t border-purple-100 bg-white/80 py-6 text-center text-xs text-slate-500 shrink-0">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 OmniLife Studio. Personal Analytics, Forecasting &amp; Simulations.</p>
          <div className="flex items-center gap-4 text-purple-700 font-medium">
            <span>PostgreSQL Relational DB</span>
            <span>·</span>
            <span>Python ML Engine</span>
            <span>·</span>
            <span>Gemini AI Assistant (₹ INR)</span>
          </div>
        </div>
      </footer>

      {/* 5. Floating AI Assistant Widget Trigger (Locked) */}
      <button
        type="button"
        onClick={() =>
          requestAuth({
            reason: 'Sign in to use AI Assistant',
            intendedTab: 'assistant',
            initialMode: 'login',
          })
        }
        aria-label="OmniLife Assistant (Locked - Sign in to use)"
        title="AI Assistant (Sign in to unlock)"
        className="fixed bottom-6 right-6 z-30 p-3.5 rounded-full bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-pink-500 text-white shadow-xl shadow-purple-500/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-offset-2 cursor-pointer"
      >
        <Bot className="w-6 h-6" />
        <span className="absolute -top-1 -right-1 p-1 bg-purple-950 rounded-full text-pink-300 border border-purple-300/60 shadow">
          <Lock className="w-3 h-3" />
        </span>
      </button>
    </div>
  );
};
