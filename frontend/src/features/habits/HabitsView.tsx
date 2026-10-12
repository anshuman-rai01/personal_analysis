import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Plus,
  Flame,
  Calendar,
  Sparkles,
  Trash2,
  Check,
  Smile,
  Clock,
  Database
} from 'lucide-react';
import { Habit, HabitLog } from '../../types/index.ts';
import { useAuth } from '../auth/AuthContext.tsx';
import confetti from 'canvas-confetti';
import { apiFetch, getLocalDateString } from '../../services/apiClient.ts';
import { AlertBanner } from '../../components/AlertBanner.tsx';

export const HabitsView: React.FC = () => {
  const { getAuthHeaders } = useAuth();
  const [habitsList, setHabitsList] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Habit form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Productivity');
  const [frequency, setFrequency] = useState('daily');
  const [targetDaysPerWeek, setTargetDaysPerWeek] = useState(7);
  const [color, setColor] = useState('#a855f7');

  const past7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return getLocalDateString(d);
  });

  const fetchHabitsAndLogs = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ habits: Habit[]; logs: HabitLog[] }>('/api/habits', {
        headers: getAuthHeaders(),
      });
      setHabitsList(data.habits || []);
      setLogs(data.logs || []);
    } catch (e: any) {
      console.error('Failed to load habits:', e);
      setError(e.message || 'Failed to load habits from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHabitsAndLogs();
  }, []);

  const handleCreateHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setError(null);
    setSubmitting(true);
    try {
      const newHabit = await apiFetch<Habit>('/api/habits', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          category,
          frequency,
          targetDaysPerWeek,
          color,
          icon: 'sparkles',
        }),
      });

      setHabitsList([...habitsList, newHabit]);
      setName('');
    } catch (err: any) {
      console.error('Failed to create habit:', err);
      setError(err.message || 'Failed to create habit in database.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLog = async (habitId: number, dateStr: string) => {
    try {
      const result = await apiFetch<{ completed: number }>(`/api/habits/${habitId}/toggle`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ date: dateStr }),
      });

      if (result.completed === 1) {
        confetti({
          particleCount: 25,
          spread: 45,
          origin: { y: 0.8 },
        });
      }
      fetchHabitsAndLogs();
    } catch (e: any) {
      console.error('Failed to toggle habit:', e);
      setError(e.message || 'Failed to update habit check-in in database.');
    }
  };

  const handleDeleteHabit = async (id: number) => {
    try {
      await apiFetch(`/api/habits/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      setHabitsList(habitsList.filter((h) => h.id !== id));
      setLogs(logs.filter((l) => l.habitId !== id));
    } catch (err: any) {
      console.error('Failed to delete habit:', err);
      setError(err.message || 'Failed to delete habit from database.');
    }
  };

  const isCompletedOnDate = (habitId: number, dateStr: string) => {
    return logs.some((l) => l.habitId === habitId && l.date === dateStr && l.completed === 1);
  };

  const maxStreak = habitsList.reduce((acc, h) => Math.max(acc, h.currentStreak), 0);
  const totalCompletedLogs = logs.filter((l) => l.completed === 1).length;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-purple-950 flex items-center gap-2">
          <CheckCircle2 className="w-6 h-6 text-fuchsia-600" />
          <span>Habit Formation &amp; Routine Consistency</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Build unbreakable streaks, track 7-day completion matrices, and record daily logs in PostgreSQL.
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
              fetchHabitsAndLogs();
            },
          }}
        />
      )}

      {/* Top Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-purple-100 rounded-2xl p-5 shadow-xs">
          <p className="text-xs text-purple-700 font-bold uppercase tracking-wider">Active Routines</p>
          <p className="text-2xl font-black text-purple-950 mt-1">{habitsList.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Tracked daily</p>
        </div>

        <div className="bg-white border border-purple-100 rounded-2xl p-5 shadow-xs">
          <p className="text-xs text-fuchsia-600 font-bold uppercase tracking-wider">Current Max Streak</p>
          <div className="flex items-center gap-2 mt-1">
            <Flame className="w-5 h-5 text-fuchsia-600 fill-fuchsia-500" />
            <p className="text-2xl font-black text-fuchsia-600">{maxStreak} Days</p>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Compound momentum</p>
        </div>

        <div className="bg-white border border-purple-100 rounded-2xl p-5 shadow-xs">
          <p className="text-xs text-pink-600 font-bold uppercase tracking-wider">Total Check-Ins</p>
          <p className="text-2xl font-black text-pink-600 mt-1">{totalCompletedLogs}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Stored in database</p>
        </div>

        <div className="bg-white border border-purple-100 rounded-2xl p-5 shadow-xs">
          <p className="text-xs text-purple-800 font-bold uppercase tracking-wider">Consistency Rate</p>
          <p className="text-2xl font-black text-purple-900 mt-1">
            {habitsList.length ? Math.min(99, Math.round((totalCompletedLogs / (habitsList.length * 7 || 1)) * 100)) : 0}%
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">7-day performance</p>
        </div>
      </div>

      {/* Habit Creation Form */}
      <div className="bg-white border border-purple-100 rounded-2xl p-5 sm:p-6 shadow-sm">
        <h3 className="text-base font-bold text-purple-950 flex items-center gap-2 mb-4">
          <Plus className="w-4 h-4 text-fuchsia-600" />
          <span>Add New Daily Habit</span>
        </h3>

        <form onSubmit={handleCreateHabit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Habit Name</label>
            <input
              type="text"
              placeholder="e.g., Read 20 Pages, Meditate 15m, Morning Workout"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 focus:outline-none focus:border-purple-600"
            >
              <option value="Productivity">Productivity</option>
              <option value="Health">Health &amp; Wellness</option>
              <option value="Fitness">Fitness &amp; Exercise</option>
              <option value="Mindfulness">Mindfulness</option>
              <option value="Learning">Learning &amp; Reading</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Color Accent</label>
            <div className="flex items-center gap-2 pt-1">
              {['#a855f7', '#ec4899', '#7c3aed', '#f43f5e', '#3b82f6', '#10b981'].map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    color === c ? 'scale-110 border-slate-900' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white text-xs font-bold shadow-md shadow-pink-500/20 transition-all disabled:opacity-50"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{submitting ? 'Adding...' : 'Save Habit'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Habits 7-Day Matrix & Records */}
      <div className="bg-white border border-purple-100 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-purple-50 flex items-center justify-between bg-purple-50/40">
          <div>
            <h3 className="text-sm font-bold text-purple-950">Interactive 7-Day Consistency Matrix</h3>
            <p className="text-xs text-slate-500">Click any day circle to toggle check-in status directly into database.</p>
          </div>
          <span className="text-xs font-bold text-purple-700 font-mono">{habitsList.length} Habits</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading habits from PostgreSQL...</div>
        ) : habitsList.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No habits created yet. Define your first habit above!
          </div>
        ) : (
          <div className="divide-y divide-purple-50">
            {habitsList.map((habit) => (
              <div
                key={habit.id}
                className="p-4 hover:bg-purple-50/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Habit details */}
                <div className="flex items-center gap-3 min-w-[220px]">
                  <div
                    className="w-3 h-10 rounded-full flex-shrink-0"
                    style={{ backgroundColor: habit.color || '#a855f7' }}
                  />
                  <div>
                    <h4 className="text-sm font-bold text-purple-950">{habit.name}</h4>
                    <p className="text-[11px] text-slate-500 capitalize">{habit.category}</p>
                    <div className="flex items-center gap-1 text-[11px] text-fuchsia-600 font-bold mt-0.5">
                      <Flame className="w-3 h-3 fill-fuchsia-500" />
                      <span>{habit.currentStreak}d streak (Best: {habit.longestStreak}d)</span>
                    </div>
                  </div>
                </div>

                {/* 7-Day Check-in Row */}
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  {past7Days.map((dayStr, idx) => {
                    const isCompleted = isCompletedOnDate(habit.id, dayStr);
                    const isToday = idx === 6;
                    const dayLabel = new Date(dayStr + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'narrow',
                    });

                    return (
                      <button
                        key={dayStr}
                        onClick={() => handleToggleLog(habit.id, dayStr)}
                        className="flex flex-col items-center gap-1 group"
                        title={`${dayStr}: Click to toggle`}
                      >
                        <span className="text-[10px] text-slate-500 group-hover:text-purple-700 font-bold font-mono">
                          {dayLabel}
                        </span>
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                            isCompleted
                              ? 'bg-gradient-to-tr from-purple-600 to-pink-500 text-white font-bold shadow-md shadow-pink-500/30 scale-105'
                              : 'bg-slate-50 border border-purple-200 text-slate-400 hover:border-pink-400'
                          } ${isToday ? 'ring-2 ring-pink-500 ring-offset-2 ring-offset-white' : ''}`}
                        >
                          {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : <span className="text-xs">·</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Action button */}
                <div className="flex justify-end">
                  <button
                    onClick={() => handleDeleteHabit(habit.id)}
                    className="p-2 text-slate-400 hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-50"
                    title="Delete habit"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
