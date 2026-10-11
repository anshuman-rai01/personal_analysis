import React, { useEffect, useState } from 'react';
import {
  Target,
  Plus,
  CheckCircle,
  Clock,
  Trash2,
  Trophy,
  Sparkles,
  BookOpen,
  Coins,
  Flame,
  Database
} from 'lucide-react';
import { Goal, GoalMilestone } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import confetti from 'canvas-confetti';
import { apiFetch } from '../lib/apiClient.ts';
import { AlertBanner } from './common/AlertBanner.tsx';

export const GoalsView: React.FC = () => {
  const { getAuthHeaders } = useAuth();
  const [goalsList, setGoalsList] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Goal Form state
  const [title, setTitle] = useState('');
  const [module, setModule] = useState<'study' | 'finance' | 'habits' | 'career' | 'personal'>('study');
  const [targetValue, setTargetValue] = useState('100');
  const [currentValue, setCurrentValue] = useState('0');
  const [unit, setUnit] = useState('Hours');
  const [deadline, setDeadline] = useState('2026-12-31');
  const [milestonesInput, setMilestonesInput] = useState('Phase 1 Foundation, Phase 2 Applied Projects, Phase 3 Mastery Review');

  const fetchGoals = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Goal[]>('/api/goals', {
        headers: getAuthHeaders(),
      });
      setGoalsList(data);
    } catch (e: any) {
      console.error('Failed to load goals:', e);
      setError(e.message || 'Failed to load goals from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !targetValue) return;

    setError(null);
    setSubmitting(true);
    try {
      const parsedMilestones = milestonesInput
        .split(',')
        .map((s, idx) => ({ id: idx + 1, text: s.trim(), done: false }))
        .filter((m) => m.text.length > 0);

      const newGoal = await apiFetch<Goal>('/api/goals', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          module,
          targetValue: parseFloat(targetValue),
          currentValue: parseFloat(currentValue || '0'),
          unit: unit === '$' ? 'Money' : unit,
          deadline,
          milestones: parsedMilestones,
        }),
      });

      setGoalsList([newGoal, ...goalsList]);
      setTitle('');
    } catch (e: any) {
      console.error('Create goal failed:', e);
      setError(e.message || 'Failed to create goal in database.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleMilestone = async (goal: Goal, milestoneId: number) => {
    let milestones: GoalMilestone[] = [];
    try {
      milestones = typeof goal.milestones === 'string' ? JSON.parse(goal.milestones) : goal.milestones || [];
    } catch {
      milestones = [];
    }

    const updatedMilestones = milestones.map((m) =>
      m.id === milestoneId ? { ...m, done: !m.done } : m
    );

    const completedCount = updatedMilestones.filter((m) => m.done).length;
    const progressFraction = updatedMilestones.length ? completedCount / updatedMilestones.length : 0;
    const newCurrent = Math.round(goal.targetValue * progressFraction * 10) / 10;
    const isAchieved = progressFraction >= 1.0;

    if (isAchieved && goal.status !== 'achieved') {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }

    try {
      const updated = await apiFetch<Goal>(`/api/goals/${goal.id}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          milestones: updatedMilestones,
          currentValue: newCurrent,
          status: isAchieved ? 'achieved' : 'in_progress',
        }),
      });

      setGoalsList(goalsList.map((g) => (g.id === goal.id ? updated : g)));
    } catch (e: any) {
      console.error('Failed to update goal milestone:', e);
      setError(e.message || 'Failed to update goal milestone in database.');
    }
  };

  const handleDeleteGoal = async (id: number) => {
    try {
      await apiFetch(`/api/goals/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      setGoalsList(goalsList.filter((g) => g.id !== id));
    } catch (e: any) {
      console.error('Failed to delete goal:', e);
      setError(e.message || 'Failed to delete goal from database.');
    }
  };

  const achievedCount = goalsList.filter((g) => g.status === 'achieved').length;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-purple-950 flex items-center gap-2">
          <Target className="w-6 h-6 text-pink-600" />
          <span>Strategic Goals &amp; Milestone Roadmaps</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Define objective targets across Study, Money, and Habits with executable milestone roadmaps in PostgreSQL.
        </p>
      </div>

      {error && (
        <AlertBanner
          message="Database operation failed"
          details={error}
          variant="error"
          onDismiss={() => setError(null)}
          action={{
            label: 'Retry Loading',
            onClick: () => {
              setError(null);
              fetchGoals();
            },
          }}
        />
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-purple-100 rounded-2xl p-5 shadow-xs">
          <p className="text-xs text-purple-700 font-bold uppercase tracking-wider">Total Goals</p>
          <p className="text-2xl font-black text-purple-950 mt-1">{goalsList.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Defined roadmaps</p>
        </div>

        <div className="bg-white border border-purple-100 rounded-2xl p-5 shadow-xs">
          <p className="text-xs text-pink-600 font-bold uppercase tracking-wider">In Flight</p>
          <p className="text-2xl font-black text-pink-600 mt-1">
            {goalsList.filter((g) => g.status === 'in_progress').length}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Active progress</p>
        </div>

        <div className="bg-white border border-purple-100 rounded-2xl p-5 shadow-xs">
          <p className="text-xs text-fuchsia-600 font-bold uppercase tracking-wider">Achieved Goals</p>
          <div className="flex items-center gap-2 mt-1">
            <Trophy className="w-5 h-5 text-amber-500" />
            <p className="text-2xl font-black text-fuchsia-900">{achievedCount}</p>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">100% completed</p>
        </div>

        <div className="bg-white border border-purple-100 rounded-2xl p-5 shadow-xs">
          <p className="text-xs text-purple-800 font-bold uppercase tracking-wider">Achievement Rate</p>
          <p className="text-2xl font-black text-purple-900 mt-1">
            {goalsList.length ? Math.round((achievedCount / goalsList.length) * 100) : 0}%
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Success velocity</p>
        </div>
      </div>

      {/* Creation Form */}
      <div className="bg-white border border-purple-100 rounded-2xl p-5 sm:p-6 shadow-sm">
        <h3 className="text-base font-bold text-purple-950 flex items-center gap-2 mb-4">
          <Plus className="w-4 h-4 text-pink-600" />
          <span>Create New Target Goal</span>
        </h3>

        <form onSubmit={handleCreateGoal} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Goal Title</label>
              <input
                type="text"
                placeholder="e.g., Complete 100h of Machine Learning, Build 20,000 Money Buffer"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-pink-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Module Alignment</label>
              <select
                value={module}
                onChange={(e) => setModule(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 focus:outline-none focus:border-pink-500"
              >
                <option value="study">Study &amp; Academics</option>
                <option value="finance">Money &amp; Wealth</option>
                <option value="habits">Habits &amp; Lifestyle</option>
                <option value="career">Career &amp; Projects</option>
                <option value="personal">Personal Development</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Value</label>
              <input
                type="number"
                step="any"
                min="1"
                placeholder="e.g., 100"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-pink-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Unit</label>
              <input
                type="text"
                placeholder="e.g., Hours, Money, Days, Books"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-pink-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Milestones Checklist (Comma-separated)
            </label>
            <input
              type="text"
              placeholder="e.g., Read foundational paper, Build prototype, Train benchmark model, Release demo"
              value={milestonesInput}
              onChange={(e) => setMilestonesInput(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-pink-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white text-xs font-bold shadow-md shadow-pink-500/20 transition-all disabled:opacity-50"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{submitting ? 'Creating Goal...' : 'Save Goal to Database'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Goal Cards Grid */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading goals from PostgreSQL...</div>
        ) : goalsList.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No goals created yet. Set your first milestone above!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {goalsList.map((goal) => {
              const pct = Math.min(100, Math.round((goal.currentValue / (goal.targetValue || 1)) * 100));
              let milestones: GoalMilestone[] = [];
              try {
                milestones = typeof goal.milestones === 'string' ? JSON.parse(goal.milestones) : goal.milestones || [];
              } catch {
                milestones = [];
              }

              return (
                <div
                  key={goal.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    goal.status === 'achieved'
                      ? 'bg-gradient-to-br from-pink-50/60 to-purple-50/60 border-pink-300 shadow-sm'
                      : 'bg-white border-purple-100 hover:border-purple-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                          {goal.module === 'finance' ? 'Money' : goal.module}
                        </span>
                        {goal.status === 'achieved' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 border border-pink-200">
                            Achieved
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-bold text-purple-950 mt-1.5">{goal.title}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Deadline: {goal.deadline}</p>
                    </div>

                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                      title="Delete goal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-semibold">Progress</span>
                      <span className="font-bold text-purple-900">
                        {goal.currentValue} / {goal.targetValue} {goal.unit === '$' ? 'Money' : goal.unit} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden border border-purple-100">
                      <div
                        className="h-full bg-gradient-to-r from-purple-600 to-pink-500 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Milestones Checklist */}
                  {milestones.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-purple-100 space-y-2">
                      <p className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">
                        Milestones Checklist
                      </p>
                      <div className="space-y-1.5">
                        {milestones.map((m) => (
                          <div
                            key={m.id}
                            onClick={() => handleToggleMilestone(goal, m.id)}
                            className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50/80 hover:bg-purple-50 cursor-pointer border border-purple-100/60 transition-colors group"
                          >
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                m.done
                                  ? 'bg-pink-500 border-pink-500 text-white'
                                  : 'border-slate-300 group-hover:border-purple-500'
                              }`}
                            >
                              {m.done && <CheckCircle className="w-3.5 h-3.5" />}
                            </div>
                            <span
                              className={`text-xs ${
                                m.done ? 'line-through text-slate-400' : 'text-slate-700 font-medium'
                              }`}
                            >
                              {m.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
