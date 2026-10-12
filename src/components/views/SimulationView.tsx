import React, { useEffect, useState } from 'react';
import {
  SlidersHorizontal,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Save,
  CheckCircle,
  Zap,
  Trash2,
  Database,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
  Award
} from 'lucide-react';
import { SimulationResult, SavedScenario } from '../../types/index.ts';
import { useAuth } from '../../context/AuthContext.tsx';

export const SimulationView: React.FC = () => {
  const { getAuthHeaders } = useAuth();
  const [scenarioType, setScenarioType] = useState<'study_career' | 'wealth_accumulation' | 'lifestyle_habits'>('study_career');
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [saving, setSaving] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sliders for Study & Career
  const [studyHours, setStudyHours] = useState(5.0);
  const [deepWorkRatio, setDeepWorkRatio] = useState(0.75);
  const [sleepHours, setSleepHours] = useState(7.5);
  const [distractions, setDistractions] = useState(3);

  // Sliders for Wealth (Money) Accumulation
  const [savingsRate, setSavingsRate] = useState(30.0);
  const [cutDiscretionary, setCutDiscretionary] = useState(20.0);
  const [expectedReturn, setExpectedReturn] = useState(8.5);
  const [startingCapital, setStartingCapital] = useState(12000);
  const [monthlyIncome, setMonthlyIncome] = useState(5500);

  // Sliders for Lifestyle & Habits
  const [consistencyPct, setConsistencyPct] = useState(85.0);
  const [morningRoutine, setMorningRoutine] = useState(80.0);
  const [screenTimeLimit, setScreenTimeLimit] = useState(3.0);

  const executeSimulation = async () => {
    try {
      let params = {};
      if (scenarioType === 'study_career') {
        params = {
          study_hours: studyHours,
          deep_work_ratio: deepWorkRatio,
          sleep_hours: sleepHours,
          distractions,
        };
      } else if (scenarioType === 'wealth_accumulation') {
        params = {
          savings_rate: savingsRate,
          cut_discretionary: cutDiscretionary,
          expected_return: expectedReturn,
          starting_capital: startingCapital,
          monthly_income: monthlyIncome,
        };
      } else {
        params = {
          consistency_pct: consistencyPct,
          morning_routine: morningRoutine,
          screen_time_limit: screenTimeLimit,
        };
      }

      const res = await fetch('/api/simulation/run', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ scenarioType, params }),
      });

      if (res.ok) {
        const data = await res.json();
        setSimulationResult(data);
      }
    } catch (e) {
      console.error('Failed to run simulation:', e);
    }
  };

  const fetchSavedScenarios = async () => {
    try {
      const res = await fetch('/api/simulation/saved', { headers: getAuthHeaders() });
      if (res.ok) {
        setSavedScenarios(await res.json());
      }
    } catch (e) {
      console.error('Failed to load saved scenarios:', e);
    }
  };

  useEffect(() => {
    executeSimulation();
    fetchSavedScenarios();
  }, [
    scenarioType,
    studyHours,
    deepWorkRatio,
    sleepHours,
    distractions,
    savingsRate,
    cutDiscretionary,
    expectedReturn,
    startingCapital,
    monthlyIncome,
    consistencyPct,
    morningRoutine,
    screenTimeLimit,
  ]);

  const handleSaveScenario = async () => {
    if (!simulationResult) return;
    setSaving(true);
    try {
      const finalName = scenarioName.trim() || `Scenario: ${scenarioType.replace('_', ' ').toUpperCase()}`;
      const res = await fetch('/api/simulation/save', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: finalName,
          category: scenarioType,
          parameters: {
            studyHours,
            deepWorkRatio,
            sleepHours,
            distractions,
            savingsRate,
            expectedReturn,
            consistencyPct,
          },
          projections: simulationResult.projected_chart,
          riskScore: simulationResult.risk_score,
          recommendations: simulationResult.recommendations,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setScenarioName('');
        fetchSavedScenarios();
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save scenario:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSaved = async (id: number) => {
    try {
      const res = await fetch(`/api/simulation/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setSavedScenarios(savedScenarios.filter((s) => s.id !== id));
      }
    } catch (err) {
      console.error('Delete scenario failed:', err);
    }
  };

  // Structured recommendations tailored to slider inputs
  const structuredRecommendations = [
    ...(simulationResult?.recommendations || []).map((text, i) => ({
      id: i,
      title: i === 0 ? 'Primary Strategic Focus' : `Optimization Lever #${i + 1}`,
      badge: i === 0 ? 'High Impact' : 'Strategic Action',
      badgeColor: i === 0 ? 'bg-pink-100 text-pink-700 border-pink-200' : 'bg-purple-100 text-purple-700 border-purple-200',
      action: text,
      gainEstimate: scenarioType === 'study_career'
        ? `+${Math.round(deepWorkRatio * 25)}% Skill Velocity`
        : scenarioType === 'wealth_accumulation'
        ? `+Money ${(cutDiscretionary * 120).toLocaleString()} Annual Surplus`
        : `+${Math.round(consistencyPct * 0.4)}% Consistency Index`,
    })),
    {
      id: 99,
      title: 'Risk Guardrail & Stability',
      badge: simulationResult?.risk_level === 'High' ? 'Risk Alert' : 'Recommended Pace',
      badgeColor: simulationResult?.risk_level === 'High' ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200',
      action: scenarioType === 'study_career'
        ? studyHours > 7
          ? 'High burnout risk detected. Cap intensive study blocks to 90 minutes followed by complete cognitive disengagement.'
          : 'Sustainable schedule maintained. Current sleep to study ratio supports memory consolidation.'
        : scenarioType === 'wealth_accumulation'
        ? savingsRate > 45
          ? 'High frugality fatigue threshold. Maintain at least 15% flexible budget to prevent sudden lifestyle relapse.'
          : 'Healthy compounding rate. Dollar-cost average into diversified broad assets on a fixed bi-weekly cycle.'
        : 'Protect the morning 60-minute window without phone notifications to anchor day-long dopamine.',
      gainEstimate: 'Long-term Sustainability',
    },
  ];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-purple-950 flex items-center gap-2">
            <SlidersHorizontal className="w-6 h-6 text-pink-600" />
            <span>What-If Decision Simulation Engine</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Simulate life choices using dynamic sliders, project trajectory curves vs baselines, and receive strategic recommendations.
          </p>
        </div>

        {/* Scenario Switcher Tabs */}
        <div className="inline-flex rounded-xl bg-white p-1 border border-purple-200 shadow-xs">
          <button
            onClick={() => setScenarioType('study_career')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              scenarioType === 'study_career'
                ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-purple-700'
            }`}
          >
            Study &amp; Skill Mastery
          </button>
          <button
            onClick={() => setScenarioType('wealth_accumulation')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              scenarioType === 'wealth_accumulation'
                ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-purple-700'
            }`}
          >
            Money &amp; Wealth
          </button>
          <button
            onClick={() => setScenarioType('lifestyle_habits')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              scenarioType === 'lifestyle_habits'
                ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-purple-700'
            }`}
          >
            Habit Compounding
          </button>
        </div>
      </div>

      {/* Main Grid: Decision Sliders on Left, Charts & Risk on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sliders Configuration Column */}
        <div className="lg:col-span-5 bg-white border border-purple-100 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
          <div>
            <h3 className="text-sm font-bold text-purple-950 flex items-center gap-2">
              <Zap className="w-4 h-4 text-pink-600" />
              <span>Interactive Decision Sliders</span>
            </h3>
            <p className="text-xs text-slate-500">Tweak parameters to recalculate projections and recommendations.</p>
          </div>

          {/* Scenario 1: Study & Career Sliders */}
          {scenarioType === 'study_career' && (
            <div className="space-y-4 pt-1">
              <div>
                <div className="flex justify-between text-xs mb-1 font-semibold">
                  <span className="text-slate-700">Daily Study Hours</span>
                  <span className="font-extrabold text-purple-700">{studyHours} hrs/day</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={studyHours}
                  onChange={(e) => setStudyHours(parseFloat(e.target.value))}
                  className="w-full accent-purple-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                  <span>1 hr (Low)</span>
                  <span>5 hrs (Optimal)</span>
                  <span>10 hrs (Burnout territory)</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1 font-semibold">
                  <span className="text-slate-700">Deep Work Ratio</span>
                  <span className="font-extrabold text-pink-600">{Math.round(deepWorkRatio * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="1.0"
                  step="0.05"
                  value={deepWorkRatio}
                  onChange={(e) => setDeepWorkRatio(parseFloat(e.target.value))}
                  className="w-full accent-pink-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1 font-semibold">
                  <span className="text-slate-700">Nightly Sleep Duration</span>
                  <span className="font-extrabold text-purple-800">{sleepHours} hrs</span>
                </div>
                <input
                  type="range"
                  min="4.5"
                  max="9.5"
                  step="0.5"
                  value={sleepHours}
                  onChange={(e) => setSleepHours(parseFloat(e.target.value))}
                  className="w-full accent-purple-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1 font-semibold">
                  <span className="text-slate-700">Daily Distractions</span>
                  <span className="font-extrabold text-rose-500">{distractions} interruptions</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  step="1"
                  value={distractions}
                  onChange={(e) => setDistractions(parseInt(e.target.value, 10))}
                  className="w-full accent-rose-500"
                />
              </div>
            </div>
          )}

          {/* Scenario 2: Wealth (Money) Sliders */}
          {scenarioType === 'wealth_accumulation' && (
            <div className="space-y-4 pt-1">
              <div>
                <div className="flex justify-between text-xs mb-1 font-semibold">
                  <span className="text-slate-700">Monthly Money Savings Rate</span>
                  <span className="font-extrabold text-pink-600">{savingsRate}% of income</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="2"
                  value={savingsRate}
                  onChange={(e) => setSavingsRate(parseFloat(e.target.value))}
                  className="w-full accent-pink-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1 font-semibold">
                  <span className="text-slate-700">Discretionary Expense Cut</span>
                  <span className="font-extrabold text-purple-700">{cutDiscretionary}% reduction</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={cutDiscretionary}
                  onChange={(e) => setCutDiscretionary(parseFloat(e.target.value))}
                  className="w-full accent-purple-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1 font-semibold">
                  <span className="text-slate-700">Expected Annual Return</span>
                  <span className="font-extrabold text-fuchsia-600">{expectedReturn}%</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="16"
                  step="0.5"
                  value={expectedReturn}
                  onChange={(e) => setExpectedReturn(parseFloat(e.target.value))}
                  className="w-full accent-fuchsia-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1 font-semibold">
                  <span className="text-slate-700">Starting Money Capital</span>
                  <span className="font-extrabold text-purple-950">Money {startingCapital.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="2000"
                  max="80000"
                  step="2000"
                  value={startingCapital}
                  onChange={(e) => setStartingCapital(parseFloat(e.target.value))}
                  className="w-full accent-purple-600"
                />
              </div>
            </div>
          )}

          {/* Scenario 3: Lifestyle Sliders */}
          {scenarioType === 'lifestyle_habits' && (
            <div className="space-y-4 pt-1">
              <div>
                <div className="flex justify-between text-xs mb-1 font-semibold">
                  <span className="text-slate-700">Habit Consistency Rate</span>
                  <span className="font-extrabold text-purple-700">{consistencyPct}%</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="100"
                  step="2"
                  value={consistencyPct}
                  onChange={(e) => setConsistencyPct(parseFloat(e.target.value))}
                  className="w-full accent-purple-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1 font-semibold">
                  <span className="text-slate-700">Morning Routine Adherence</span>
                  <span className="font-extrabold text-pink-600">{morningRoutine}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={morningRoutine}
                  onChange={(e) => setMorningRoutine(parseFloat(e.target.value))}
                  className="w-full accent-pink-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1 font-semibold">
                  <span className="text-slate-700">Screen Time Limit (Hours)</span>
                  <span className="font-extrabold text-fuchsia-600">{screenTimeLimit} hrs/day max</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="0.5"
                  value={screenTimeLimit}
                  onChange={(e) => setScreenTimeLimit(parseFloat(e.target.value))}
                  className="w-full accent-fuchsia-500"
                />
              </div>
            </div>
          )}

          {/* Save Scenario to PostgreSQL form */}
          <div className="pt-4 border-t border-purple-100">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Scenario Name (e.g. Aggressive Money Growth)"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-purple-100 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:border-pink-500"
              />
              <button
                onClick={handleSaveScenario}
                disabled={saving}
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save'}</span>
              </button>
            </div>
            {saveSuccess && (
              <p className="text-[11px] text-emerald-600 mt-1.5 font-bold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Saved successfully to PostgreSQL!</span>
              </p>
            )}
          </div>
        </div>

        {/* Projection Chart & Risk Analysis Column */}
        <div className="lg:col-span-7 space-y-6">
          {/* Simulation Projected Chart */}
          <div className="bg-white border border-purple-100 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-purple-950 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-pink-600" />
                  <span>Projected Trajectory vs Baseline</span>
                </h3>
                <p className="text-xs text-slate-500">Comparing your simulated decision against status-quo baseline.</p>
              </div>

              {simulationResult && (
                <div
                  className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                    simulationResult.risk_level === 'High'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : simulationResult.risk_level === 'Moderate'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Risk: {simulationResult.risk_level} ({simulationResult.risk_score}/100)</span>
                </div>
              )}
            </div>

            {/* SVG Comparison Graph */}
            {simulationResult && simulationResult.projected_chart && (
              <div className="h-60 relative flex flex-col justify-end pt-4">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 500 200">
                  <defs>
                    <linearGradient id="simPurplePinkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#ec4899" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#a855f7" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal gridlines */}
                  {[40, 80, 120, 160].map((y) => (
                    <line
                      key={y}
                      x1="20"
                      y1={y}
                      x2="480"
                      y2={y}
                      stroke="#f1f5f9"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                  ))}

                  {/* Draw Baseline and Simulated Paths */}
                  {(() => {
                    const simPts = simulationResult.projected_chart.simulated || [];
                    const basePts = simulationResult.projected_chart.baseline || [];
                    if (simPts.length < 2) return null;

                    const maxVal = Math.max(...simPts, ...basePts, 1);
                    const minVal = Math.min(...simPts, ...basePts, 0);
                    const range = maxVal - minVal || 1;
                    const stepX = 460 / (simPts.length - 1);

                    const simCoords = simPts.map((val, idx) => {
                      const x = 20 + idx * stepX;
                      const y = 175 - ((val - minVal) / range) * 145;
                      return { x, y, val };
                    });

                    const baseCoords = basePts.map((val, idx) => {
                      const x = 20 + idx * stepX;
                      const y = 175 - ((val - minVal) / range) * 145;
                      return { x, y, val };
                    });

                    const simPathStr = `M ${simCoords.map((c) => `${c.x},${c.y}`).join(' L ')}`;
                    const basePathStr = `M ${baseCoords.map((c) => `${c.x},${c.y}`).join(' L ')}`;
                    const simArea = `${simPathStr} L ${simCoords[simCoords.length - 1].x},175 L 20,175 Z`;

                    return (
                      <>
                        <path d={simArea} fill="url(#simPurplePinkGrad)" />
                        <path
                          d={basePathStr}
                          fill="none"
                          stroke="#94a3b8"
                          strokeWidth="2"
                          strokeDasharray="5 5"
                        />
                        <path
                          d={simPathStr}
                          fill="none"
                          stroke="#ec4899"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                        />

                        {simCoords.map((c, idx) => (
                          <g key={idx}>
                            <circle cx={c.x} cy={c.y} r="5" fill="#ec4899" stroke="#fff" strokeWidth="2" />
                            <text
                              x={c.x}
                              y={c.y - 8}
                              textAnchor="middle"
                              fill="#7e22ce"
                              fontSize="10"
                              fontWeight="bold"
                              fontFamily="sans-serif"
                            >
                              {scenarioType === 'wealth_accumulation' ? `Money ${(c.val / 1000).toFixed(0)}k` : c.val}
                            </text>
                          </g>
                        ))}
                      </>
                    );
                  })()}
                </svg>

                {/* X-axis time points */}
                <div className="flex justify-between text-[11px] text-slate-500 font-bold pt-2 border-t border-purple-50">
                  {(simulationResult.projected_chart.months ||
                    simulationResult.projected_chart.years ||
                    simulationResult.projected_chart.weeks ||
                    [1, 2, 3, 4, 5, 6]
                  ).map((t, i) => (
                    <span key={i}>
                      {scenarioType === 'wealth_accumulation'
                        ? `Yr ${t}`
                        : scenarioType === 'lifestyle_habits'
                        ? `Wk ${t}`
                        : `Mo ${t}`}
                    </span>
                  ))}
                </div>

                <div className="mt-2 flex items-center justify-center gap-6 text-xs text-slate-600 font-medium">
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-1 bg-pink-500 rounded-full" /> Simulated Trajectory
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-0.5 border-t-2 border-dashed border-slate-400" /> Status Quo Baseline
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* COMPREHENSIVE RECOMMENDATIONS & STRATEGIC PLAYBOOK */}
          <div className="bg-white border border-purple-100 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-purple-950 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-pink-600" />
                <span>Simulated Recommendations &amp; Strategic Levers</span>
              </h3>
              <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                Decision Guidance
              </span>
            </div>

            <div className="space-y-3">
              {structuredRecommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="p-4 rounded-xl bg-purple-50/40 border border-purple-100 space-y-2 hover:bg-purple-50/70 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${rec.badgeColor}`}>
                        {rec.badge}
                      </span>
                      <span className="text-xs font-bold text-purple-950">{rec.title}</span>
                    </div>
                    <span className="text-[11px] font-extrabold text-pink-600 bg-white px-2 py-0.5 rounded-md border border-purple-100 shadow-2xs">
                      {rec.gainEstimate}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">{rec.action}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Saved Scenarios Vault */}
      <div className="bg-white border border-purple-100 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-purple-50 flex items-center justify-between bg-purple-50/40">
          <h3 className="text-sm font-bold text-purple-950 flex items-center gap-2">
            <Database className="w-4 h-4 text-purple-600" />
            <span>Saved Scenarios Vault (Stored in PostgreSQL)</span>
          </h3>
          <span className="text-xs text-purple-700 font-mono font-bold">
            {savedScenarios.length} Saved Scenarios
          </span>
        </div>

        {savedScenarios.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No scenarios saved yet. Use the Save button above to store a scenario in PostgreSQL!
          </div>
        ) : (
          <div className="divide-y divide-purple-50">
            {savedScenarios.map((sc) => (
              <div key={sc.id} className="p-4 hover:bg-purple-50/30 transition-colors flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-purple-950">{sc.name}</h4>
                  <p className="text-[11px] text-slate-500 capitalize">{sc.category.replace('_', ' ')} · Created {new Date(sc.createdAt).toLocaleDateString()}</p>
                  <p className="text-xs text-slate-600 mt-1 italic line-clamp-1">{sc.recommendations}</p>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                    sc.riskScore > 60
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    Risk: {sc.riskScore}/100
                  </span>

                  <button
                    onClick={() => handleDeleteSaved(sc.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-50"
                    title="Delete scenario"
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
