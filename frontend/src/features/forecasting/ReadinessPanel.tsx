import React from 'react';
import { Lock, CheckCircle2, AlertCircle, Info, Sparkles, BookOpen, Coins, Flame } from 'lucide-react';
import { ForecastReadiness, ModuleReadiness } from './useForecastReadiness.ts';

export interface ReadinessPanelProps {
  readiness: ForecastReadiness | null;
  activeModule?: 'study' | 'finance' | 'habits';
  onModuleSelect?: (module: 'study' | 'finance' | 'habits') => void;
  title?: string;
  description?: string;
  showAllModules?: boolean;
  className?: string;
}

export const ReadinessPanel: React.FC<ReadinessPanelProps> = ({
  readiness,
  activeModule,
  onModuleSelect,
  title,
  description,
  showAllModules = true,
  className = '',
}) => {
  if (!readiness) {
    return (
      <div className={`p-6 rounded-2xl bg-white/80 border border-purple-100 shadow-sm animate-pulse ${className}`}>
        <div className="h-6 w-48 bg-purple-100 rounded mb-4" />
        <div className="h-4 w-full bg-purple-50 rounded mb-2" />
        <div className="h-4 w-3/4 bg-purple-50 rounded" />
      </div>
    );
  }

  const moduleMeta: Record<
    'study' | 'finance' | 'habits',
    { name: string; icon: React.ReactNode; color: string; barColor: string }
  > = {
    study: {
      name: 'Study & Learning',
      icon: <BookOpen className="w-4 h-4 text-purple-600" />,
      color: 'border-purple-200 bg-purple-50/50',
      barColor: 'from-purple-500 to-indigo-600',
    },
    finance: {
      name: 'Money & Wealth',
      icon: <Coins className="w-4 h-4 text-emerald-600" />,
      color: 'border-emerald-200 bg-emerald-50/50',
      barColor: 'from-emerald-500 to-teal-600',
    },
    habits: {
      name: 'Lifestyle & Habits',
      icon: <Flame className="w-4 h-4 text-pink-600" />,
      color: 'border-pink-200 bg-pink-50/50',
      barColor: 'from-pink-500 to-rose-600',
    },
  };

  const renderModuleCard = (modKey: 'study' | 'finance' | 'habits', mod: ModuleReadiness) => {
    const meta = moduleMeta[modKey];
    const isSelected = activeModule === modKey;
    const progressPct = Math.min(100, Math.round((mod.distinctDays / mod.required) * 100));

    return (
      <div
        key={modKey}
        onClick={() => onModuleSelect && onModuleSelect(modKey)}
        className={`p-4 rounded-xl border transition-all ${
          isSelected
            ? 'ring-2 ring-purple-500 border-purple-300 bg-purple-50/40 shadow-sm'
            : 'border-purple-100/80 bg-white hover:border-purple-200'
        } ${onModuleSelect ? 'cursor-pointer' : ''}`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-white shadow-xs border border-purple-100">
              {meta.icon}
            </div>
            <span className="font-semibold text-sm text-purple-950">{meta.name}</span>
          </div>

          {mod.allowed ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Unlocked</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900">
              <Lock className="w-3.5 h-3.5 text-amber-700" />
              <span>{mod.remaining} days left</span>
            </span>
          )}
        </div>

        {/* Semantic Accessible Progress Bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs font-medium text-purple-900/80 mb-1">
            <span>Progress toward calibration</span>
            <span className="font-bold text-purple-950">
              {mod.distinctDays} / {mod.required} active days
            </span>
          </div>

          <div
            className="w-full h-2.5 bg-purple-100/70 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={mod.distinctDays}
            aria-valuemin={0}
            aria-valuemax={mod.required}
            aria-label={`${meta.name} data readiness progress`}
          >
            <div
              className={`h-full bg-gradient-to-r ${meta.barColor} rounded-full transition-all duration-500`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Confidence Tier Description */}
        <div className="mt-2.5 text-[11px] text-purple-700/80 flex items-center justify-between">
          <span>{mod.totalRecords} total records logged</span>
          {mod.status === 'low_confidence' && (
            <span className="text-purple-600 font-medium">
              Low confidence (28+ days for reliable)
            </span>
          )}
          {mod.status === 'reliable' && (
            <span className="text-emerald-700 font-medium">Reliable sample size</span>
          )}
        </div>
      </div>
    );
  };

  const activeModData = activeModule ? readiness.modules[activeModule] : null;

  return (
    <div
      className={`p-6 rounded-2xl bg-gradient-to-br from-purple-50/90 via-white to-pink-50/70 border border-purple-200/80 shadow-xs space-y-5 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-purple-100/80 text-purple-800 shrink-0 mt-0.5">
          <Lock className="w-5 h-5 text-purple-900" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-purple-950">
            {title || 'Minimum Data Threshold Required'}
          </h3>
          <p className="text-xs sm:text-sm text-purple-800/80 mt-1">
            {description ||
              'OmniLife predictive forecasting and what-if simulation require at least 14 distinct active days of activity to calibrate mathematical models and projections.'}
          </p>
        </div>
      </div>

      {showAllModules ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {renderModuleCard('study', readiness.modules.study)}
          {renderModuleCard('finance', readiness.modules.finance)}
          {renderModuleCard('habits', readiness.modules.habits)}
        </div>
      ) : activeModData && activeModule ? (
        <div className="max-w-md">{renderModuleCard(activeModule, activeModData)}</div>
      ) : null}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-purple-100 text-xs text-purple-700">
        <div className="flex items-center gap-1.5">
          <Info className="w-4 h-4 text-purple-500 shrink-0" />
          <span>
            Threshold: <strong>14 active days</strong> unlocks predictions · <strong>28 active days</strong> delivers high reliability.
          </span>
        </div>
        <span className="italic text-purple-500">
          Or import a CSV with 14+ rows for custom training.
        </span>
      </div>
    </div>
  );
};
