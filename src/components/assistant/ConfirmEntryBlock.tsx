import React, { useState } from 'react';
import { Check, X, RotateCcw, Loader2 } from 'lucide-react';
import { ConfirmEntryBlock as ConfirmEntryBlockType } from '../../lib/assistantTypes.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { CardState } from './BlockRenderer.tsx';

interface ConfirmEntryBlockProps {
  block: ConfirmEntryBlockType;
  cardState?: CardState;
  onStateChange: (blockId: string, state: CardState) => void;
  onDataChanged?: () => void;
  onAppendMessage?: (text: string) => void;
}

const MODULE_ENDPOINTS: Record<string, string> = {
  finance: '/api/finance',
  study: '/api/study',
  habit: '/api/habits',
  goal: '/api/goals',
};

export const ConfirmEntryBlock: React.FC<ConfirmEntryBlockProps> = ({
  block,
  cardState,
  onStateChange,
  onDataChanged,
  onAppendMessage,
}) => {
  const { getAuthHeaders } = useAuth();
  const status = cardState?.status || 'idle';
  const isSaving = status === 'saving';

  const handleSave = async () => {
    if (isSaving || status === 'saved') return;

    onStateChange(block.id, { status: 'saving' });

    try {
      const endpoint = MODULE_ENDPOINTS[block.module];
      if (!endpoint) throw new Error('Unknown module endpoint');

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(block.payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      onStateChange(block.id, { status: 'saved' });
      onDataChanged?.();

      // Conversation truthfulness: append local assistant message
      const summaryText = block.summary.map(s => `${s.label}: ${s.value}`).join(', ');
      onAppendMessage?.(`Saved ${block.module} record: ${summaryText}.`);
    } catch (err: any) {
      onStateChange(block.id, { status: 'error', error: err.message || 'Failed to save' });
    }
  };

  const handleCancel = () => {
    if (isSaving || status === 'saved') return;
    onStateChange(block.id, { status: 'cancelled' });
    onAppendMessage?.(`Cancelled proposal for ${block.title}.`);
  };

  return (
    <div className="bg-white border border-purple-200/90 rounded-xl p-3.5 my-2 shadow-sm text-xs">
      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-purple-100">
        <h4 className="font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
          <span>{block.title}</span>
        </h4>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 uppercase">
          {block.module}
        </span>
      </div>

      {/* Summary Rows */}
      <div className="space-y-1.5 mb-3 bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
        {block.summary.map((item, idx) => (
          <div key={idx} className="flex justify-between items-baseline gap-2">
            <span className="text-slate-500 font-medium text-[11px] shrink-0">{item.label}:</span>
            <span className="text-slate-800 font-semibold text-[11px] text-right truncate">
              {item.value}
            </span>
          </div>
        ))}
      </div>

      {/* Error display if present */}
      {status === 'error' && (
        <div className="text-[11px] text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200 mb-2.5 flex items-center justify-between">
          <span>{cardState?.error || 'Save failed'}</span>
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded font-semibold transition-colors text-[10px]"
          >
            <RotateCcw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {/* State Badge or Actions */}
      {status === 'saved' ? (
        <div className="w-full py-2 bg-emerald-50 text-emerald-800 font-bold rounded-lg border border-emerald-200 flex items-center justify-center gap-1.5 text-xs">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Saved ✓</span>
        </div>
      ) : status === 'cancelled' ? (
        <div className="w-full py-1.5 bg-slate-100 text-slate-500 font-semibold rounded-lg text-center text-xs">
          Cancelled
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-2 px-3 bg-gradient-to-r from-purple-700 to-fuchsia-600 hover:from-purple-800 hover:to-fuchsia-700 text-white font-bold rounded-lg shadow-xs hover:shadow transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Confirm &amp; Save</span>
              </>
            )}
          </button>
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>
        </div>
      )}
    </div>
  );
};
