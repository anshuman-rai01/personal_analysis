import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  Upload,
  Play,
  CheckCircle2,
  Sparkles,
  BarChart3,
  AlertCircle,
  RefreshCw,
  FileCheck
} from 'lucide-react';
import { ForecastModelResult } from '../../types/index.ts';
import { useAuth } from '../auth/AuthContext.tsx';

export const ForecastingView: React.FC = () => {
  const { getAuthHeaders } = useAuth();
  const [selectedDataset, setSelectedDataset] = useState<'study' | 'finance' | 'habits'>('study');
  const [modelResult, setModelResult] = useState<ForecastModelResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [customCsvContent, setCustomCsvContent] = useState<string | null>(null);

  const datasetNames = {
    study: {
      name: 'Study & Learning Predictive Model',
      target: 'Exam Readiness & Skill Mastery Score',
    },
    finance: {
      name: 'Money Growth & Asset Compounding Model',
      target: 'Net Worth Annual Growth Rate (%)',
    },
    habits: {
      name: 'Habit Compounding & Momentum Model',
      target: 'Weekly Habit Completion Rate (%)',
    },
  };

  const trainModel = async (useCustom = false) => {
    setLoading(true);
    setUploadError(null);
    try {
      const res = await fetch('/api/ml/train', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          datasetType: selectedDataset,
          customCsvContent: useCustom ? customCsvContent : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to train ML model');
      }

      const data = await res.json();
      setModelResult(data);
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    trainModel(false);
    setCustomCsvContent(null);
    setUploadedFileName(null);
  }, [selectedDataset]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setUploadError('Please select a valid .csv file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCustomCsvContent(text);
      setUploadedFileName(file.name);
      setUploadError(null);
    };
    reader.readAsText(file);
  };

  const currentMeta = datasetNames[selectedDataset];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-purple-950 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-pink-600" />
            <span>Forecasting &amp; Machine Learning Engine</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Multivariate statistical forecasting trained with 1,200 records and 6 feature matrices via Python backend.
          </p>
        </div>

        {/* Dataset Switcher Tabs */}
        <div className="inline-flex rounded-xl bg-white p-1 border border-purple-200 shadow-xs">
          {(['study', 'finance', 'habits'] as const).map((key) => (
            <button
              key={key}
              onClick={() => setSelectedDataset(key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                selectedDataset === key
                  ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-purple-700'
              }`}
            >
              {key === 'finance' ? 'Money' : key}
            </button>
          ))}
        </div>
      </div>

      {/* Model Training & Import Card in White, Purple & Pink */}
      <div className="bg-white border border-purple-100 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-purple-950">{currentMeta.name}</span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800">
                1,200 Records
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-pink-100 text-pink-700">
                6 Features
              </span>
            </div>
            <p className="text-xs text-slate-600">
              <span className="font-bold text-purple-900">Target Outcome:</span> {currentMeta.target}
            </p>
            <p className="text-xs text-slate-500">
              Import a custom CSV file to train on your own data, or click Train Model to run the 1,200-record model.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Import CSV input */}
            <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-bold border border-purple-200 cursor-pointer transition-colors shadow-xs">
              <Upload className="w-3.5 h-3.5 text-pink-600" />
              <span>{uploadedFileName ? `Imported: ${uploadedFileName}` : 'Import CSV'}</span>
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>

            <button
              onClick={() => trainModel(!!customCsvContent)}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white text-xs font-bold shadow-md shadow-pink-500/20 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Training ML Model in Python...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>{customCsvContent ? 'Train on Imported CSV' : 'Train Model'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {uploadError && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {uploadedFileName && !uploadError && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <FileCheck className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            <span>CSV "{uploadedFileName}" loaded and ready for model training.</span>
          </div>
        )}
      </div>

      {/* Model Performance & Metrics */}
      {modelResult && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-purple-100 rounded-2xl p-5 shadow-xs">
            <p className="text-xs text-purple-700 font-bold uppercase tracking-wider">Model Accuracy (R²)</p>
            <p className="text-2xl font-black text-purple-950 mt-1">
              {(modelResult.r2_score * 100).toFixed(1)}%
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">High fit quality</p>
          </div>

          <div className="bg-white border border-purple-100 rounded-2xl p-5 shadow-xs">
            <p className="text-xs text-pink-600 font-bold uppercase tracking-wider">Mean Error (MAE)</p>
            <p className="text-2xl font-black text-pink-600 mt-1">±{modelResult.mae}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Average residual delta</p>
          </div>

          <div className="bg-white border border-purple-100 rounded-2xl p-5 shadow-xs">
            <p className="text-xs text-fuchsia-600 font-bold uppercase tracking-wider">Variance (MSE)</p>
            <p className="text-2xl font-black text-fuchsia-900 mt-1">{modelResult.mse}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Statistical variance</p>
          </div>

          <div className="bg-white border border-purple-100 rounded-2xl p-5 shadow-xs">
            <p className="text-xs text-slate-600 font-bold uppercase tracking-wider">Trained Records</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {modelResult.record_count.toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">6 features processed</p>
          </div>
        </div>
      )}

      {/* Visualizations: Feature Importances & Forecasting Projections */}
      {modelResult && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Feature Importance Bar Chart */}
          <div className="bg-white border border-purple-100 rounded-2xl p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-purple-950 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                  <span>Feature Importances (Weight Impact)</span>
                </h3>
                <p className="text-xs text-slate-500">Relative weight contribution of each of the 6 features</p>
              </div>
            </div>

            <div className="space-y-3.5 mt-4">
              {Object.entries(modelResult.feature_importances || {}).map(([feat, pct]) => (
                <div key={feat} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="font-mono text-purple-900">{feat}</span>
                    <span className="text-pink-600 font-extrabold">{pct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-purple-50 overflow-hidden border border-purple-100">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Multi-Period Forecasting Chart with Confidence Interval */}
          <div className="bg-white border border-purple-100 rounded-2xl p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-purple-950 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-pink-600" />
                  <span>Projected Forecast Trajectory</span>
                </h3>
                <p className="text-xs text-slate-500">Multi-step prediction with 95% confidence intervals (7d to 365d)</p>
              </div>
            </div>

            {/* SVG Forecast Graph */}
            <div className="mt-2 h-56 relative flex items-end">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 500 200">
                <defs>
                  <linearGradient id="forecastLightGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#ec4899" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0.03" />
                  </linearGradient>
                </defs>

                {/* Grid horizontal lines */}
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

                {/* Shaded confidence interval band */}
                {(() => {
                  const points = modelResult.forecast_series || [];
                  if (points.length < 2) return null;
                  const stepX = 460 / (points.length - 1);

                  const upperCoords = points.map((p, idx) => {
                    const x = 20 + idx * stepX;
                    const y = Math.max(10, Math.min(190, 180 - p.confidence_upper * 1.5));
                    return `${x},${y}`;
                  });

                  const lowerCoords = points
                    .slice()
                    .reverse()
                    .map((p, idx) => {
                      const origIdx = points.length - 1 - idx;
                      const x = 20 + origIdx * stepX;
                      const y = Math.max(10, Math.min(190, 180 - p.confidence_lower * 1.5));
                      return `${x},${y}`;
                    });

                  const areaPath = `M ${upperCoords.join(' L ')} L ${lowerCoords.join(' L ')} Z`;

                  const lineCoords = points
                    .map((p, idx) => {
                      const x = 20 + idx * stepX;
                      const y = Math.max(10, Math.min(190, 180 - p.projected_value * 1.5));
                      return `${x},${y}`;
                    })
                    .join(' L ');

                  return (
                    <>
                      <path d={areaPath} fill="url(#forecastLightGrad)" />
                      <path
                        d={`M ${lineCoords}`}
                        fill="none"
                        stroke="#ec4899"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                      {points.map((p, idx) => {
                        const x = 20 + idx * stepX;
                        const y = Math.max(10, Math.min(190, 180 - p.projected_value * 1.5));
                        return (
                          <g key={idx}>
                            <circle cx={x} cy={y} r="4.5" fill="#ec4899" stroke="#fff" strokeWidth="2" />
                            <text
                              x={x}
                              y={y - 8}
                              textAnchor="middle"
                              fill="#a855f7"
                              fontSize="10"
                              fontWeight="bold"
                              fontFamily="sans-serif"
                            >
                              {p.projected_value}
                            </text>
                          </g>
                        );
                      })}
                    </>
                  );
                })()}
              </svg>
            </div>

            {/* X-axis labels */}
            <div className="flex justify-between text-[11px] text-slate-500 font-bold pt-2 border-t border-purple-50">
              {(modelResult.forecast_series || []).map((s) => (
                <span key={s.horizon_days}>{s.horizon_days}d</span>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-center gap-6 text-xs text-slate-600 font-medium">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-pink-500" /> Projected Mean
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-pink-200 border border-pink-400" /> 95% Confidence Band
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
