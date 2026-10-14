import React, { useEffect, useState } from 'react';
import { ActiveTab } from '../../components/Navbar.tsx';
import { DashboardMetrics, StudySession, FinanceTransaction, Habit, Goal } from '../../types/index.ts';
import { authedFetch } from '../../services/apiClient.ts';
import { DashboardContent } from './DashboardContent.tsx';

interface DashboardViewProps {
  setActiveTab: (tab: ActiveTab) => void;
  onOpenQuickLog: () => void;
  onOpenAssistant?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ setActiveTab, onOpenQuickLog, onOpenAssistant }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentStudy, setRecentStudy] = useState<StudySession[]>([]);
  const [recentFinance, setRecentFinance] = useState<FinanceTransaction[]>([]);
  const [habitsList, setHabitsList] = useState<Habit[]>([]);
  const [goalsList, setGoalsList] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [ovRes, stRes, finRes, habRes, goalRes] = await Promise.all([
        authedFetch('/api/dashboard/overview'),
        authedFetch('/api/study'),
        authedFetch('/api/finance'),
        authedFetch('/api/habits'),
        authedFetch('/api/goals'),
      ]);

      if (ovRes.ok) setMetrics(await ovRes.json());
      if (stRes.ok) setRecentStudy(await stRes.json());
      if (finRes.ok) setRecentFinance(await finRes.json());
      if (habRes.ok) {
        const habData = await habRes.json();
        setHabitsList(habData.habits || []);
      }
      if (goalRes.ok) setGoalsList(await goalRes.json());
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <DashboardContent
      data={{ metrics, recentStudy, recentFinance, habitsList, goalsList }}
      loading={loading}
      readOnly={false}
      onTabClick={setActiveTab}
      onOpenQuickLog={onOpenQuickLog}
      onOpenAssistant={onOpenAssistant}
    />
  );
};
