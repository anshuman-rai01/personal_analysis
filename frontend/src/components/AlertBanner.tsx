import React from 'react';
import { AlertTriangle, AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type AlertVariant = 'error' | 'warning' | 'info' | 'success';

interface AlertBannerProps {
  message: string;
  details?: string;
  variant?: AlertVariant;
  onDismiss?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  message,
  details,
  variant = 'error',
  onDismiss,
  action,
  className = '',
}) => {
  if (!message) return null;

  const styleMap = {
    error: {
      bg: 'bg-rose-50 border-rose-200 text-rose-800',
      icon: <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />,
      actionBtn: 'bg-rose-100 hover:bg-rose-200 text-rose-800 border-rose-300',
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200 text-amber-900',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />,
      actionBtn: 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300',
    },
    info: {
      bg: 'bg-blue-50 border-blue-200 text-blue-900',
      icon: <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />,
      actionBtn: 'bg-blue-100 hover:bg-blue-200 text-blue-900 border-blue-300',
    },
    success: {
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />,
      actionBtn: 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border-emerald-300',
    },
  }[variant];

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`border rounded-xl p-3.5 transition-all shadow-sm flex items-start gap-3 ${styleMap.bg} ${className}`}
    >
      {styleMap.icon}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-snug">{message}</p>
        {details && (
          <p className="text-xs mt-1 opacity-90 leading-relaxed font-mono break-words">
            {details}
          </p>
        )}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className={`mt-2 text-xs font-semibold px-2.5 py-1 rounded-lg border transition ${styleMap.actionBtn}`}
          >
            {action.label}
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss alert"
          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-black/5 transition"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
