import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Coins,
  CheckCircle2,
  Target,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  BarChart2,
  PieChart,
  Activity,
  PlusCircle,
  Flame,
  Award
} from 'lucide-react';
import { ActiveTab } from './Navbar.tsx';
import { DashboardMetrics, StudySession, FinanceTransaction, Habit, Goal } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';

interface DashboardViewProps {
  setActiveTab: (tab: ActiveTab) => void;
  onOpenQuickLog: () => void;
  onOpenAssistant?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ setActiveTab, onOpenQuickLog, onOpenAssistant }) => {
  const { getAuthHeaders } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentStudy, setRecentStudy] = useState<StudySession[]>([]);
  const [recentFinance, setRecentFinance] = useState<FinanceTransaction[]>([]);
  const [habitsList, setHabitsList] = useState<Habit[]>([]);
  const [goalsList, setGoalsList] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [ovRes, stRes, finRes, habRes, goalRes] = await Promise.all([
        fetch('/api/dashboard/overview', { headers }),
        fetch('/api/study', { headers }),
        fetch('/api/finance', { headers }),
        fetch('/api/habits', { headers }),
        fetch('/api/goals', { headers }),
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
    <div className="space-y-8 animate-fadeIn">
      {/* Top Hero Banner in Vibrant Purple & Pink Theme */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-900 via-fuchsia-900 to-pink-800 text-white p-6 sm:p-8 shadow-xl shadow-purple-950/10">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-pink-400/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-60 h-60 rounded-full bg-purple-400/20 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-pink-200 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-pink-300" />
              <span>Full-Stack Personal Intelligence Platform</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
              Optimize Study, Money &amp; Habits in Unison
            </h1>
            <p className="text-sm sm:text-base text-purple-100/90 leading-relaxed">
              PostgreSQL database storage, 1,200-row ML forecasts, What-If decision simulations, and Gemini AI.
            </p>
          </div>

          {/* Life Synergy Index Card */}
          <div className="flex-shrink-0 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 text-center shadow-lg min-w-[200px]">
            <span className="text-xs uppercase tracking-wider text-purple-200 font-bold">
              Life Synergy Index
            </span>
            <div className="mt-2 flex items-baseline justify-center gap-1">
              <span className="text-4xl font-black text-white">
                {metrics ? metrics.synergyIndex : 84}
              </span>
              <span className="text-purple-200 text-sm font-semibold">/100</span>
            </div>
            <div className="mt-2 text-[11px] text-pink-200 font-semibold flex items-center justify-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Harmonious Compounding</span>
            </div>
          </div>
        </div>

        {/* Quick Launchpad Buttons */}
        <div className="mt-6 pt-6 border-t border-white/15 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => setActiveTab('forecasting')}
            className="flex items-center justify-between p-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-left transition-all group backdrop-blur-sm"
          >
            <div>
              <p className="text-xs font-bold text-white group-hover:text-pink-200">ML Forecasting</p>
              <p className="text-[11px] text-purple-200">1,200 records model</p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-purple-300 group-hover:text-white transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>

          <button
            onClick={() => setActiveTab('simulation')}
            className="flex items-center justify-between p-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-left transition-all group backdrop-blur-sm"
          >
            <div>
              <p className="text-xs font-bold text-white group-hover:text-pink-200">What-If Simulation</p>
              <p className="text-[11px] text-purple-200">Decision sliders &amp; risk</p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-purple-300 group-hover:text-white transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>

          <button
            onClick={onOpenAssistant}
            className="flex items-center justify-between p-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-left transition-all group backdrop-blur-sm"
          >
            <div>
              <p className="text-xs font-bold text-white group-hover:text-pink-200">AI Assistant</p>
              <p className="text-[11px] text-purple-200">Tool-calling &amp; forecasting</p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-purple-300 group-hover:text-white transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>

          <button
            onClick={onOpenQuickLog}
            className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold text-left transition-all group shadow-md"
          >
            <div>
              <p className="text-xs font-bold text-white">Log New Activity</p>
              <p className="text-[11px] text-pink-100">Study, Money, Habits</p>
            </div>
            <PlusCircle className="w-4 h-4 text-white group-hover:rotate-90 transition-transform" />
          </button>
        </div>
      </div>

      {/* 4 Primary KPI Cards in White & Pink/Purple theme */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Study KPI */}
        <div
          onClick={() => setActiveTab('study')}
          className="cursor-pointer bg-white hover:bg-purple-50/50 border border-purple-100 hover:border-purple-300 rounded-2xl p-5 transition-all shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">Study &amp; Learning</span>
            <div className="p-2 rounded-xl bg-purple-100 text-purple-700 group-hover:bg-purple-200">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">
              {metrics ? `${metrics.study.totalHours} hrs` : '0 hrs'}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span>{metrics ? metrics.study.sessionsCount : 0} sessions logged</span>
              <span className="text-purple-700 font-bold">
                Focus: {metrics ? metrics.study.avgFocus : 0}/10
              </span>
            </div>
          </div>
        </div>

        {/* Finance (Money) KPI */}
        <div
          onClick={() => setActiveTab('finance')}
          className="cursor-pointer bg-white hover:bg-pink-50/50 border border-purple-100 hover:border-pink-300 rounded-2xl p-5 transition-all shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-pink-600 uppercase tracking-wider">Net Money Saved</span>
            <div className="p-2 rounded-xl bg-pink-100 text-pink-600 group-hover:bg-pink-200">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">
              Money {metrics ? metrics.finance.netSavings.toLocaleString() : '0'}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span>Savings Rate:</span>
              <span className="text-pink-600 font-bold">
                {metrics ? `${metrics.finance.savingsRate}%` : '0%'}
              </span>
            </div>
          </div>
        </div>

        {/* Habits KPI */}
        <div
          onClick={() => setActiveTab('habits')}
          className="cursor-pointer bg-white hover:bg-fuchsia-50/50 border border-purple-100 hover:border-fuchsia-300 rounded-2xl p-5 transition-all shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-fuchsia-600 uppercase tracking-wider">Habit Consistency</span>
            <div className="p-2 rounded-xl bg-fuchsia-100 text-fuchsia-600 group-hover:bg-fuchsia-200">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">
              {metrics ? `${metrics.habits.maxStreak} Days` : '0 Days'}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span>{metrics ? metrics.habits.activeCount : 0} active routines</span>
              <span className="text-fuchsia-600 font-bold">Max streak</span>
            </div>
          </div>
        </div>

        {/* Goals KPI */}
        <div
          onClick={() => setActiveTab('goals')}
          className="cursor-pointer bg-white hover:bg-purple-50/50 border border-purple-100 hover:border-purple-300 rounded-2xl p-5 transition-all shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">Target Goals</span>
            <div className="p-2 rounded-xl bg-purple-100 text-purple-800 group-hover:bg-purple-200">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">
              {metrics ? `${metrics.goals.inProgress} In Flight` : '0 In Flight'}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span>Total goals: {metrics ? metrics.goals.total : 0}</span>
              <span className="text-purple-700 font-bold">
                {metrics ? metrics.goals.achieved : 0} Achieved
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* DASHBOARD GRAPHS & CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Study Duration & Focus Trend Chart */}
        <div className="bg-white border border-purple-100 rounded-2xl p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-purple-950 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-purple-600" />
                <span>Study Sessions &amp; Focus Depth</span>
              </h3>
              <p className="text-xs text-slate-500">Duration in minutes and focus score per session</p>
            </div>
            <button
              onClick={() => setActiveTab('study')}
              className="text-xs font-semibold text-purple-600 hover:text-pink-600 transition-colors"
            >
              View Study Log →
            </button>
          </div>

          <div className="h-56 relative flex items-end pt-4">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 450 160">
              {/* Horizontal gridlines */}
              {[30, 70, 110, 150].map((y) => (
                <line
                  key={y}
                  x1="20"
                  y1={y}
                  x2="430"
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
              ))}

              {(() => {
                const sessionsToShow = recentStudy.slice(0, 7).reverse();
                if (sessionsToShow.length === 0) {
                  return (
                    <text x="225" y="80" textAnchor="middle" fill="#94a3b8" fontSize="12">
                      No study sessions to display. Add your first session!
                    </text>
                  );
                }

                const maxDur = Math.max(...sessionsToShow.map((s) => s.durationMinutes), 60);
                const stepX = 410 / (sessionsToShow.length || 1);

                return sessionsToShow.map((s, idx) => {
                  const x = 30 + idx * stepX;
                  const barH = (s.durationMinutes / maxDur) * 110;
                  const y = 145 - barH;

                  return (
                    <g key={s.id}>
                      {/* Bar for Duration */}
                      <rect
                        x={x - 12}
                        y={y}
                        width="24"
                        height={barH}
                        rx="6"
                        fill="url(#studyBarGrad)"
                      />
                      {/* Label Duration */}
                      <text
                        x={x}
                        y={y - 6}
                        textAnchor="middle"
                        fill="#7e22ce"
                        fontSize="10"
                        fontWeight="bold"
                        fontFamily="sans-serif"
                      >
                        {s.durationMinutes}m
                      </text>
                      {/* Focus dot badge */}
                      <circle cx={x} cy={145 - s.focusScore * 12} r="3.5" fill="#ec4899" stroke="#fff" strokeWidth="1.5" />
                      {/* Subject label truncated */}
                      <text
                        x={x}
                        y="158"
                        textAnchor="middle"
                        fill="#64748b"
                        fontSize="9"
                        fontFamily="sans-serif"
                      >
                        {s.subject.substring(0, 6)}..
                      </text>
                    </g>
                  );
                });
              })()}

              <defs>
                <linearGradient id="studyBarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="#c084fc" stopOpacity="0.4" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div className="mt-3 flex items-center justify-center gap-6 text-xs text-slate-500 pt-2 border-t border-purple-50">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded bg-purple-500" /> Duration (mins)
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-pink-500" /> Focus Depth (1-10)
            </span>
          </div>
        </div>

        {/* Chart 2: Money Flow & Net Savings Breakdown */}
        <div className="bg-white border border-purple-100 rounded-2xl p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-purple-950 flex items-center gap-2">
                <Coins className="w-4 h-4 text-pink-600" />
                <span>Money Flow &amp; Allocation</span>
              </h3>
              <p className="text-xs text-slate-500">Income inflows vs Outflow expenses vs Saved Money</p>
            </div>
            <button
              onClick={() => setActiveTab('finance')}
              className="text-xs font-semibold text-pink-600 hover:text-purple-700 transition-colors"
            >
              View Ledger →
            </button>
          </div>

          {metrics && (
            <div className="space-y-4 pt-2">
              {/* Money Totals row */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-100">
                  <span className="text-[10px] uppercase font-bold text-purple-700">Money Inflow</span>
                  <p className="text-base font-black text-purple-900 mt-0.5">
                    Money {metrics.finance.totalIncome.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-pink-50 border border-pink-100">
                  <span className="text-[10px] uppercase font-bold text-pink-700">Money Spent</span>
                  <p className="text-base font-black text-pink-900 mt-0.5">
                    Money {metrics.finance.totalExpenses.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-fuchsia-50 border border-fuchsia-100">
                  <span className="text-[10px] uppercase font-bold text-fuchsia-700">Money Invested</span>
                  <p className="text-base font-black text-fuchsia-900 mt-0.5">
                    Money {metrics.finance.totalInvested.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Progress Stack Bar */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs font-semibold text-slate-600">
                  <span>Money Allocation Ratio</span>
                  <span className="text-pink-600 font-bold">{metrics.finance.savingsRate}% Retained</span>
                </div>
                <div className="h-4 rounded-full bg-slate-100 overflow-hidden flex shadow-inner">
                  {metrics.finance.totalIncome > 0 ? (
                    <>
                      <div
                        style={{
                          width: `${Math.min(100, (metrics.finance.netSavings / metrics.finance.totalIncome) * 100)}%`,
                        }}
                        className="bg-gradient-to-r from-purple-600 to-pink-500 h-full"
                        title="Saved Money"
                      />
                      <div
                        style={{
                          width: `${Math.min(100, (metrics.finance.totalExpenses / metrics.finance.totalIncome) * 100)}%`,
                        }}
                        className="bg-rose-400 h-full"
                        title="Expense Money"
                      />
                    </>
                  ) : (
                    <div className="w-full bg-slate-200" />
                  )}
                </div>
              </div>

              {/* Category distribution pills */}
              <div className="pt-2 flex flex-wrap gap-2">
                {recentFinance.slice(0, 5).map((f) => (
                  <span
                    key={f.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-slate-50 border border-purple-100 text-slate-700 font-medium"
                  >
                    <span className="w-2 h-2 rounded-full bg-pink-500" />
                    <span>{f.category}: Money {f.amount.toLocaleString()}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chart 3 & 4: Habit Consistency & Goal Milestones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Habit Completion Progress */}
        <div className="bg-white border border-purple-100 rounded-2xl p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-purple-950 flex items-center gap-2">
                <Activity className="w-4 h-4 text-fuchsia-600" />
                <span>Habit Streak &amp; Routine Consistency</span>
              </h3>
              <p className="text-xs text-slate-500">Current active habits and uninterrupted streaks</p>
            </div>
            <button
              onClick={() => setActiveTab('habits')}
              className="text-xs font-semibold text-fuchsia-600 hover:text-purple-700 transition-colors"
            >
              Open Habits →
            </button>
          </div>

          <div className="space-y-3.5">
            {habitsList.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No habits added yet.</p>
            ) : (
              habitsList.slice(0, 4).map((h) => {
                const targetDays = h.targetDaysPerWeek || 7;
                const ratio = Math.min(100, Math.round((h.currentStreak / 21) * 100));

                return (
                  <div key={h.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: h.color || '#a855f7' }} />
                        {h.name}
                      </span>
                      <span className="font-extrabold text-pink-600 flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 fill-pink-500" />
                        {h.currentStreak} Days
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-purple-50 overflow-hidden border border-purple-100">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(10, ratio)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Goals Roadmap Progress */}
        <div className="bg-white border border-purple-100 rounded-2xl p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-purple-950 flex items-center gap-2">
                <Award className="w-4 h-4 text-pink-600" />
                <span>Strategic Goals Fulfillment</span>
              </h3>
              <p className="text-xs text-slate-500">Live progress towards defined milestones</p>
            </div>
            <button
              onClick={() => setActiveTab('goals')}
              className="text-xs font-semibold text-pink-600 hover:text-purple-700 transition-colors"
            >
              Manage Goals →
            </button>
          </div>

          <div className="space-y-3.5">
            {goalsList.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No goals created yet.</p>
            ) : (
              goalsList.slice(0, 4).map((g) => {
                const pct = Math.min(100, Math.round((g.currentValue / (g.targetValue || 1)) * 100));

                return (
                  <div key={g.id} className="p-3 rounded-xl bg-purple-50/50 border border-purple-100 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-purple-950 truncate max-w-[200px]">{g.title}</span>
                      <span className="font-extrabold text-purple-700">
                        {g.currentValue} / {g.targetValue} {g.unit === '$' ? 'Money' : g.unit} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white overflow-hidden border border-purple-200">
                      <div
                        className="h-full bg-gradient-to-r from-purple-600 to-pink-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
