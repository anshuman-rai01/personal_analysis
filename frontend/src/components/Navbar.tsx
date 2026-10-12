import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Coins,
  CheckCircle2,
  Target,
  TrendingUp,
  SlidersHorizontal,
  Bot,
  Plus,
  LogIn,
  LogOut,
  Database,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext.tsx';

export type ActiveTab =
  | 'dashboard'
  | 'study'
  | 'finance'
  | 'habits'
  | 'goals'
  | 'forecasting'
  | 'simulation'
  | 'assistant'
  | 'auth';

export const DEFAULT_PROTECTED_TABS: ActiveTab[] = [
  'study',
  'finance',
  'habits',
  'goals',
  'forecasting',
  'simulation',
  'assistant',
];

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenQuickLog: () => void;
  onOpenAssistant?: () => void;
  protectedTabs?: ActiveTab[];
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenQuickLog,
  onOpenAssistant,
  protectedTabs = DEFAULT_PROTECTED_TABS,
}) => {
  const { user, isGuest, logout } = useAuth();
  const isAuthenticated = Boolean(user && !isGuest);

  const handleTabClick = (tabId: ActiveTab) => {
    // Intercept clicks: check authentication state for protected tabs
    if (protectedTabs.includes(tabId) && !isAuthenticated) {
      // Trigger sign-in: prevent tab change and immediately redirect to login page
      setActiveTab('auth');
      return;
    }

    // Allow access: proceed with navigation normally
    setActiveTab(tabId);
    if (tabId === 'assistant' && onOpenAssistant) {
      onOpenAssistant();
    }
  };

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'study', label: 'Study', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'finance', label: 'Finance (Money)', icon: <Coins className="w-4 h-4" /> },
    { id: 'habits', label: 'Habits', icon: <CheckCircle2 className="w-4 h-4" /> },
    { id: 'goals', label: 'Goals', icon: <Target className="w-4 h-4" /> },
    { id: 'forecasting', label: 'Forecasting (ML)', icon: <TrendingUp className="w-4 h-4" />, badge: '1,200' },
    { id: 'simulation', label: 'Simulation', icon: <SlidersHorizontal className="w-4 h-4" />, badge: 'What-If' },
    { id: 'assistant', label: 'AI Assistant', icon: <Bot className="w-4 h-4" />, badge: 'Gemini' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-purple-100 bg-white/95 backdrop-blur-md shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & PostgreSQL Badge */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleTabClick('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-pink-500 flex items-center justify-center shadow-md shadow-pink-500/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-purple-800 via-fuchsia-700 to-pink-600 bg-clip-text text-transparent">
                  OmniLife Studio
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  <Database className="w-2.5 h-2.5 text-purple-600" />
                  PostgreSQL
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Study · Money · Habits · Simulations
              </p>
            </div>
          </div>

          {/* Quick Action & Auth controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Conditionally render Quick Log button: hidden on auth tab, visible on dashboard & other tabs */}
            {activeTab !== 'auth' && (
              <button
                onClick={() => {
                  if (!isAuthenticated) {
                    setActiveTab('auth');
                    return;
                  }
                  onOpenQuickLog();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white shadow-md shadow-pink-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                <span>Quick Log</span>
              </button>
            )}

            {user && !isGuest ? (
              <div className="flex items-center gap-2 bg-purple-50/80 border border-purple-200/80 rounded-lg p-1 pr-2">
                <button
                  onClick={() => setActiveTab('auth')}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                  title="View Account Profile"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="w-7 h-7 rounded-full border border-purple-300"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold text-white">
                      {user.email ? user.email[0].toUpperCase() : 'U'}
                    </div>
                  )}
                  <span className="text-xs font-semibold text-purple-900 hidden md:inline truncate max-w-[100px]">
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                </button>
                <button
                  onClick={logout}
                  title="Sign out"
                  className="p-1 text-slate-400 hover:text-rose-500 transition-colors ml-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setActiveTab('auth')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3 sm:py-2 text-xs font-bold rounded-lg transition-all shadow-xs ${
                  activeTab === 'auth'
                    ? 'bg-purple-950 text-white shadow-md'
                    : 'bg-white hover:bg-purple-50 text-purple-900 border border-purple-200'
                }`}
              >
                <LogIn className="w-3.5 h-3.5 text-pink-600" />
                <span>Login / Register</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <nav className="flex space-x-1 overflow-x-auto py-2 scrollbar-none border-t border-purple-100 text-sm">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 relative ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-700 to-fuchsia-600 text-white shadow-sm shadow-purple-500/20'
                    : 'text-purple-900/80 hover:text-purple-950 hover:bg-purple-50/80'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-pink-100 text-pink-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
