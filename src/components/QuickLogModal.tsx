import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Coins,
  CheckCircle2,
  Database,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch, getLocalDateString } from '../lib/apiClient.ts';
import { AlertBanner } from './common/AlertBanner.tsx';

interface QuickLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const QuickLogModal: React.FC<QuickLogModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { getAuthHeaders } = useAuth();
  const [activeType, setActiveType] = useState<'study' | 'finance' | 'habit'>('study');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Study fields
  const [studySubject, setStudySubject] = useState('');
  const [studyTopic, setStudyTopic] = useState('');
  const [studyDuration, setStudyDuration] = useState('45');
  const [studyTechnique, setStudyTechnique] = useState('Deep Work');

  // Finance fields
  const [financeTitle, setFinanceTitle] = useState('');
  const [financeAmount, setFinanceAmount] = useState('');
  const [financeType, setFinanceType] = useState('expense');
  const [financeCategory, setFinanceCategory] = useState('Food');

  // Habit fields
  const [habitName, setHabitName] = useState('');
  const [habitCategory, setHabitCategory] = useState('Productivity');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const today = getLocalDateString();
      if (activeType === 'study') {
        if (!studySubject || !studyTopic) return;
        await apiFetch('/api/study', {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subject: studySubject,
            topic: studyTopic,
            durationMinutes: parseInt(studyDuration, 10),
            technique: studyTechnique,
            focusScore: 8,
            energyScore: 8,
            date: today,
          }),
        });
      } else if (activeType === 'finance') {
        if (!financeTitle || !financeAmount) return;
        await apiFetch('/api/finance', {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: financeTitle,
            type: financeType,
            amount: parseFloat(financeAmount),
            category: financeCategory,
            paymentMethod: 'Bank Transfer',
            date: today,
          }),
        });
      } else {
        if (!habitName) return;
        await apiFetch('/api/habits', {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: habitName,
            category: habitCategory,
            frequency: 'daily',
            targetDaysPerWeek: 7,
            color: '#a855f7',
            icon: 'sparkles',
          }),
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Quick log failed:', err);
      setError(err.message || 'Failed to save record to database.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-white border border-purple-100 rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-pink-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-purple-950">Quick Activity Log</h3>
              <p className="text-xs text-slate-500">Instantly record to PostgreSQL database</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <AlertBanner
            message="Failed to save record"
            details={error}
            variant="error"
            onDismiss={() => setError(null)}
          />
        )}

        {/* Type Switcher */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-purple-50/60 rounded-xl border border-purple-100">
          <button
            type="button"
            onClick={() => { setActiveType('study'); setError(null); }}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
              activeType === 'study'
                ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-purple-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Study</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveType('finance'); setError(null); }}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
              activeType === 'finance'
                ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-purple-800'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Money</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveType('habit'); setError(null); }}
            className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
              activeType === 'habit'
                ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-purple-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Habit</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {activeType === 'study' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Mathematics, System Design"
                  value={studySubject}
                  onChange={(e) => setStudySubject(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Topic</label>
                <input
                  type="text"
                  placeholder="e.g. Linear Algebra, Cache Invalidation"
                  value={studyTopic}
                  onChange={(e) => setStudyTopic(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    value={studyDuration}
                    onChange={(e) => setStudyDuration(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 focus:outline-none focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Technique</label>
                  <select
                    value={studyTechnique}
                    onChange={(e) => setStudyTechnique(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 focus:outline-none focus:border-purple-600"
                  >
                    <option value="Deep Work">Deep Work</option>
                    <option value="Pomodoro">Pomodoro</option>
                    <option value="Active Recall">Active Recall</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {activeType === 'finance' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Title</label>
                <input
                  type="text"
                  placeholder="e.g. Freelance Invoice, Team Lunch"
                  value={financeTitle}
                  onChange={(e) => setFinanceTitle(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-pink-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (Money)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 85.00"
                    value={financeAmount}
                    onChange={(e) => setFinanceAmount(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 focus:outline-none focus:border-pink-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Type</label>
                  <select
                    value={financeType}
                    onChange={(e) => setFinanceType(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 focus:outline-none focus:border-pink-500"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                    <option value="investment">Investment</option>
                    <option value="savings">Savings</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {activeType === 'habit' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Habit Name</label>
                <input
                  type="text"
                  placeholder="e.g. 10,000 Steps, Journaling, Duolingo"
                  value={habitName}
                  onChange={(e) => setHabitName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={habitCategory}
                  onChange={(e) => setHabitCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 focus:outline-none focus:border-purple-600"
                >
                  <option value="Productivity">Productivity</option>
                  <option value="Health">Health &amp; Wellness</option>
                  <option value="Fitness">Fitness</option>
                  <option value="Mindfulness">Mindfulness</option>
                </select>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-purple-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white disabled:opacity-50 shadow-md shadow-pink-500/20"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{submitting ? 'Saving...' : 'Save to Database'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
