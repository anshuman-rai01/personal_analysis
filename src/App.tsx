/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext.tsx';
import { Navbar, ActiveTab } from './components/Navbar.tsx';
import {
  DashboardView,
  StudyView,
  FinanceView,
  HabitsView,
  GoalsView,
  ForecastingView,
  SimulationView,
  AuthView,
} from './components/views/index.ts';
import { QuickLogModal } from './components/QuickLogModal.tsx';
import { AssistantWidget } from './components/assistant/AssistantWidget.tsx';
import { onServer500Error } from './lib/apiClient.ts';
import { AlertBanner } from './components/common/AlertBanner.tsx';

function MainApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [assistantOpenSignal, setAssistantOpenSignal] = useState(0);
  const [dbDegraded, setDbDegraded] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const checkDbHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'degraded') {
          setDbDegraded(true);
          setBannerDismissed(false);
        } else {
          setDbDegraded(false);
        }
      } else {
        setDbDegraded(true);
        setBannerDismissed(false);
      }
    } catch (_err) {
      setDbDegraded(true);
      setBannerDismissed(false);
    }
  };

  React.useEffect(() => {
    // Initial health check on app load
    checkDbHealth();

    // Re-check whenever any API request fails with 500
    const unsubscribe = onServer500Error(() => {
      checkDbHealth();
    });

    return () => unsubscribe();
  }, []);

  const handleQuickLogSuccess = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-800 flex flex-col font-sans selection:bg-pink-500 selection:text-white">
      {/* Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenQuickLog={() => setQuickLogOpen(true)}
        onOpenAssistant={() => setAssistantOpenSignal(s => s + 1)}
      />

      {/* Global Degraded Database Alert Banner */}
      {dbDegraded && !bannerDismissed && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <AlertBanner
            variant="warning"
            message="The database is not reachable or not set up. Records can't be saved. Run npm run db:setup, then reload."
            onDismiss={() => setBannerDismissed(true)}
            action={{
              label: 'Check Health Again',
              onClick: () => checkDbHealth(),
            }}
          />
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8" key={refreshKey}>
        {(activeTab === 'dashboard' || activeTab === 'assistant') && (
          <DashboardView
            setActiveTab={setActiveTab}
            onOpenQuickLog={() => setQuickLogOpen(true)}
            onOpenAssistant={() => setAssistantOpenSignal(s => s + 1)}
          />
        )}
        {activeTab === 'study' && <StudyView />}
        {activeTab === 'finance' && <FinanceView />}
        {activeTab === 'habits' && <HabitsView />}
        {activeTab === 'goals' && <GoalsView />}
        {activeTab === 'forecasting' && <ForecastingView />}
        {activeTab === 'simulation' && <SimulationView />}
        {activeTab === 'auth' && <AuthView onNavigateToDashboard={() => setActiveTab('dashboard')} />}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-purple-100 bg-white/80 py-6 text-center text-xs text-slate-500">
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

      {/* Quick Log Modal */}
      <QuickLogModal
        isOpen={quickLogOpen}
        onClose={() => setQuickLogOpen(false)}
        onSuccess={handleQuickLogSuccess}
      />

      {/* Floating AI Assistant Widget */}
      <AssistantWidget
        onDataChanged={() => setRefreshKey(k => k + 1)}
        openSignal={assistantOpenSignal}
      />
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
