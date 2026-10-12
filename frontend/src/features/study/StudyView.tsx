import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Plus,
  Clock,
  Zap,
  Target,
  Trash2,
  Search,
  Filter,
  Flame,
  CheckCircle,
  Database
} from 'lucide-react';
import { StudySession } from '../../types/index.ts';
import { useAuth } from '../auth/AuthContext.tsx';
import { apiFetch, getLocalDateString } from '../../services/apiClient.ts';
import { AlertBanner } from '../../components/AlertBanner.tsx';

export const StudyView: React.FC = () => {
  const { getAuthHeaders } = useAuth();
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('all');

  // Input form state
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [technique, setTechnique] = useState('Deep Work');
  const [focusScore, setFocusScore] = useState(8);
  const [energyScore, setEnergyScore] = useState(8);
  const [date, setDate] = useState(() => getLocalDateString());
  const [notes, setNotes] = useState('');

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<StudySession[]>('/api/study', {
        headers: getAuthHeaders(),
      });
      setSessions(data);
    } catch (e: any) {
      console.error('Failed to load study sessions:', e);
      setError(e.message || 'Failed to load study sessions from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !topic.trim() || !durationMinutes) return;

    setError(null);
    setSubmitting(true);
    try {
      const newRecord = await apiFetch<StudySession>('/api/study', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: subject.trim(),
          topic: topic.trim(),
          durationMinutes: parseInt(durationMinutes, 10),
          technique,
          focusScore,
          energyScore,
          date,
          notes: notes.trim(),
        }),
      });

      setSessions([newRecord, ...sessions]);
      setTopic('');
      setNotes('');
    } catch (err: any) {
      console.error('Error adding study session:', err);
      setError(err.message || 'Failed to save study session to database.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`/api/study/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      setSessions(sessions.filter((s) => s.id !== id));
    } catch (err: any) {
      console.error('Failed to delete study record:', err);
      setError(err.message || 'Failed to delete study record from database.');
    }
  };

  // Metrics
  const totalMinutes = sessions.reduce((acc, s) => acc + s.durationMinutes, 0);
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
  const avgFocus = sessions.length
    ? Math.round((sessions.reduce((acc, s) => acc + s.focusScore, 0) / sessions.length) * 10) / 10
    : 0;
  const deepWorkHours = Math.round(
    (sessions.filter((s) => s.technique === 'Deep Work').reduce((acc, s) => acc + s.durationMinutes, 0) / 60) * 10
  ) / 10;

  const allSubjects = Array.from(new Set(sessions.map((s) => s.subject)));

  const filteredSessions = sessions.filter((s) => {
    const matchesSearch =
      s.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.notes && s.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSubject = selectedSubjectFilter === 'all' || s.subject === selectedSubjectFilter;
    return matchesSearch && matchesSubject;
  });

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-purple-950 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-purple-600" />
          <span>Study &amp; Learning Tracker</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Log intentional learning sessions with cognitive metrics, technique classification, and PostgreSQL persistence.
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
              fetchSessions();
            },
          }}
        />
      )}

      {/* Top Study Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-purple-100 rounded-2xl p-5 shadow-xs">
          <p className="text-xs text-purple-700 font-bold uppercase tracking-wider">Total Study Time</p>
          <p className="text-2xl font-black text-purple-950 mt-1">{totalHours} hrs</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{totalMinutes} recorded mins</p>
        </div>
        <div className="bg-white border border-purple-100 rounded-2xl p-5 shadow-xs">
          <p className="text-xs text-pink-600 font-bold uppercase tracking-wider">Total Sessions</p>
          <p className="text-2xl font-black text-pink-600 mt-1">{sessions.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Logged in database</p>
        </div>
        <div className="bg-white border border-purple-100 rounded-2xl p-5 shadow-xs">
          <p className="text-xs text-fuchsia-600 font-bold uppercase tracking-wider">Avg Focus Level</p>
          <p className="text-2xl font-black text-fuchsia-900 mt-1">{avgFocus} / 10</p>
          <p className="text-[11px] text-slate-400 mt-0.5">High cognitive depth</p>
        </div>
        <div className="bg-white border border-purple-100 rounded-2xl p-5 shadow-xs">
          <p className="text-xs text-purple-800 font-bold uppercase tracking-wider">Deep Work Volume</p>
          <p className="text-2xl font-black text-purple-900 mt-1">{deepWorkHours} hrs</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Distraction-free state</p>
        </div>
      </div>

      {/* Session Input Form */}
      <div className="bg-white border border-purple-100 rounded-2xl p-5 sm:p-6 shadow-sm">
        <h3 className="text-base font-bold text-purple-950 flex items-center gap-2 mb-4">
          <Plus className="w-4 h-4 text-purple-600" />
          <span>Record New Study Session</span>
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject / Domain</label>
              <input
                type="text"
                placeholder="e.g., Computer Science, Finance, Biology"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Specific Topic</label>
              <input
                type="text"
                placeholder="e.g., Neural Networks, Valuation Models"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Duration (Minutes)</label>
              <input
                type="number"
                min="5"
                max="600"
                step="5"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Study Technique</label>
              <select
                value={technique}
                onChange={(e) => setTechnique(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 focus:outline-none focus:border-purple-600"
              >
                <option value="Deep Work">Deep Work (Distraction Free)</option>
                <option value="Pomodoro">Pomodoro (25m Focus / 5m Rest)</option>
                <option value="Active Recall">Active Recall &amp; Testing</option>
                <option value="Feynman Method">Feynman Method (Teaching)</option>
                <option value="Spaced Repetition">Spaced Repetition Flashcards</option>
                <option value="Problem Sets">Problem Sets &amp; Coding</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Focus Score: <span className="text-purple-700 font-extrabold">{focusScore} / 10</span>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={focusScore}
                onChange={(e) => setFocusScore(parseInt(e.target.value, 10))}
                className="w-full accent-purple-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 focus:outline-none focus:border-purple-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Key Insights &amp; Takeaways (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Mastered Backpropagation equations; implemented vectorized cost function in Python."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-600"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white text-xs font-bold shadow-md shadow-pink-500/20 transition-all disabled:opacity-50"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{submitting ? 'Saving to Database...' : 'Save Study Record'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-purple-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search subjects, topics, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-purple-100 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-purple-500" />
          <select
            value={selectedSubjectFilter}
            onChange={(e) => setSelectedSubjectFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-purple-100 rounded-lg text-slate-700 focus:outline-none focus:border-purple-600"
          >
            <option value="all">All Subjects ({sessions.length})</option>
            {allSubjects.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Study Records List */}
      <div className="bg-white border border-purple-100 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-purple-50 flex items-center justify-between bg-purple-50/40">
          <h3 className="text-sm font-bold text-purple-950">Study Sessions History</h3>
          <span className="text-xs text-purple-700 font-mono font-semibold">
            Showing {filteredSessions.length} record(s)
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading records from PostgreSQL...</div>
        ) : filteredSessions.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No study sessions found matching criteria. Add one above!
          </div>
        ) : (
          <div className="divide-y divide-purple-50">
            {filteredSessions.map((item) => (
              <div
                key={item.id}
                className="p-4 hover:bg-purple-50/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-purple-900 bg-purple-100 border border-purple-200 px-2.5 py-0.5 rounded">
                      {item.subject}
                    </span>
                    <span className="text-xs font-bold text-slate-800">{item.topic}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-pink-50 text-pink-700 font-semibold border border-pink-100">
                      {item.technique}
                    </span>
                  </div>

                  {item.notes && (
                    <p className="text-xs text-slate-500 italic">"{item.notes}"</p>
                  )}

                  <div className="flex items-center gap-4 text-[11px] text-slate-400">
                    <span>Date: {item.date}</span>
                    <span>Energy: {item.energyScore}/10</span>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-4">
                  <div className="text-right">
                    <span className="text-sm font-black text-purple-950">
                      {item.durationMinutes} mins
                    </span>
                    <div className="text-[11px] font-bold text-pink-600">
                      Focus: {item.focusScore}/10
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-slate-400 hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-50"
                    title="Delete record"
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
