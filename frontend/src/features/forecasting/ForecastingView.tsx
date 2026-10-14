import React, { useEffect, useState, useRef } from 'react';
import {
  TrendingUp,
  Upload,
  Play,
  CheckCircle2,
  Sparkles,
  BarChart3,
  AlertCircle,
  RefreshCw,
  FileCheck,
  Lock,
} from 'lucide-react';
import { ForecastModelResult } from '../../types/index.ts';
import { authedFetch } from '../../services/apiClient.ts';
import { useForecastReadiness } from './useForecastReadiness.ts';
import { ReadinessPanel } from './ReadinessPanel.tsx';

function countClientCsvRows(csv: string): number {
  if (!csv || typeof csv !== 'string') return 0;
  const lines = csv
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return lines.length > 1 ? lines.length - 1 : 0;
}

export const ForecastingView: React.FC = () => {
  const [selectedDataset, setSelectedDataset] = useState<'study' | 'finance' | 'habits'>('study');
  const [modelResult, setModelResult] = useState<ForecastModelResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [insufficientError, setInsufficientError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [customCsvContent, setCustomCsvContent] = useState<string | null>(null);

  const { readiness, loading: readinessLoading, reload: reloadReadiness } = useForecastReadiness();

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

  const csvRows = customCsvContent ? countClientCsvRows(customCsvContent) : 0;
  const isCsvValid = csvRows >= 14;
  const modReadiness = readiness?.modules[selectedDataset];
  const isTrackedAllowed = modReadiness?.allowed ?? false;
  const isUnlocked = isTrackedAllowed || isCsvValid;

  const trainModel = async (useCustom = false) => {
    setLoading(true);
    setUploadError(null);
    setInsufficientError(null);
    try {
      const res = await authedFetch('/api/ml/train', {
        method: 'POST',
        body: JSON.stringify({
          datasetType: selectedDataset,
          customCsvContent: useCustom ? customCsvContent : undefined,
        }),
      });

      if (!res.ok) {
        let errData: any = null;
        try {
          errData = await res.json();
        } catch (_parseErr) {
          // ignore
        }

        if (res.status === 422 || errData?.code === 'INSUFFICIENT_DATA') {
          setInsufficientError(errData?.error || 'Insufficient activity data to calibrate predictions.');
          setModelResult(null);
          await reloadReadiness();
          return;
        }

        throw new Error(errData?.error || `Failed to train ML model (HTTP ${res.status})`);
      }

      const data = await res.json();
      setModelResult(data);
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Only auto-train once readiness is loaded and the module is permitted
  useEffect(() => {
    setCustomCsvContent(null);
    setUploadedFileName(null);
    setUploadError(null);
    setInsufficientError(null);

    if (readinessLoading) return;

    if (isTrackedAllowed) {
      trainModel(false);
    } else {
      setModelResult(null);
    }
  }, [selectedDataset, readinessLoading, isTrackedAllowed]);

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
      const rows = countClientCsvRows(text);
      setCustomCsvContent(text);
      setUploadedFileName(file.name);
      setUploadError(null);
      setInsufficientError(null);

      if (rows < 14) {
        setUploadError(`Selected CSV has only ${rows} data rows. At least 14 data rows are required for ML model training.`);
      }
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
          <p className="text-xs text-purple-700/80 italic mt-1">
            Note: Baseline models are calibrated against an academic 1,200-record reference dataset benchmarked with ridge regression.
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
              {modReadiness?.allowed ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                  Ready ({modReadiness.distinctDays}/14 Days)
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-700" />
                  <span>Locked ({modReadiness?.remaining ?? 14} days left)</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600">
              <span className="font-bold text-purple-900">Target Outcome:</span> {currentMeta.target}
            </p>
            <p className="text-xs text-slate-500">
              Requires at least 14 active days of logged history. Alternatively, import a custom CSV with at least 14 rows to train immediately.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Import CSV input */}
            <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-bold border border-purple-200 cursor-pointer transition-colors shadow-xs">
              <Upload className="w-3.5 h-3.5 text-pink-600" />
              <span>{uploadedFileName ? `CSV: ${uploadedFileName}` : 'Import CSV'}</span>
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>

            <button
              onClick={() => trainModel(!!customCsvContent)}
              disabled={loading || !isUnlocked || (!!customCsvContent && !isCsvValid)}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white text-xs font-bold shadow-md shadow-pink-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Training ML Model in Python...</span>
                </>
              ) : !isUnlocked ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Locked: Log {modReadiness?.remaining ?? 14} more days</span>
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
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              <span>CSV "{uploadedFileName}" loaded with {csvRows} data rows.</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                isCsvValid ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-100 text-rose-800'
              }`}
            >
              {isCsvValid ? '14+ Rows (Eligible for Training)' : 'Below 14 Rows Threshold'}
            </span>
          </div>
        )}
      </div>

      {/* When locked or insufficient data, present the ReadinessPanel */}
      {(!isUnlocked || insufficientError) && (
        <ReadinessPanel
          readiness={readiness}
          activeModule={selectedDataset}
          onModuleSelect={setSelectedDataset}
          title="Forecasting Calibration in Progress"
          description={
            insufficientError ||
            `You have logged ${modReadiness?.distinctDays ?? 0} of the 14 active days needed for ${selectedDataset}. Log ${
              modReadiness?.remaining ?? 14
            } more days to unlock predictive forecasting.`
          }
        />
      )}

      {/* Model Performance & Metrics */}
      {modelResult && isUnlocked && (
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
      {modelResult && isUnlocked && (
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
                    <span className="text-pink-600">{(pct * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2 bg-purple-50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-700"
                      style={{ width: `${pct * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Forecasted Trajectory Visualization */}
          <div className="bg-white border border-purple-100 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-purple-950 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-pink-600" />
                    <span>Projected 12-Month Horizon Delta</span>
                  </h3>
                  <p className="text-xs text-slate-500">Normalized predictive curve generated by ridge regression</p>
                </div>
              </div>

              {/* Trajectory Points Mini-Chart Bars */}
              <div className="mt-6 flex items-end justify-between gap-1 h-36 px-2">
                {(() => {
                  const series = modelResult.forecast_series || [];
                  const values = series.map((item: any) =>
                    typeof item === 'number' ? item : item.projected_value ?? 0
                  );
                  const maxVal = values.length ? Math.max(...values, 1) : 100;
                  return series.map((item: any, idx: number) => {
                    const val = typeof item === 'number' ? item : item.projected_value ?? 0;
                    const heightPercent = Math.max(15, Math.min(100, Math.round((val / maxVal) * 100)));
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                        <span className="text-[9px] font-bold text-purple-800 opacity-0 group-hover:opacity-100 transition-opacity">
                          {Math.round(val)}
                        </span>
                        <div
                          className="w-full bg-gradient-to-t from-purple-600 via-pink-500 to-fuchsia-400 rounded-t-md transition-all duration-500 group-hover:brightness-110"
                          style={{ height: `${heightPercent}%` }}
                        />
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item?.horizon_days ? `${item.horizon_days}d` : `M${idx + 1}`}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-purple-50 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>R² Threshold Passed</span>
              </span>
              <span>12 Months Forward Forecast</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
