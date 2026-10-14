import React, { useState } from 'react';
import { Trash2, AlertTriangle, Check, X, RotateCcw, Loader2 } from 'lucide-react';
import { ConfirmDeleteBlock as ConfirmDeleteBlockType } from '../../types/assistant.ts';
import { authedFetch } from '../../services/apiClient.ts';
import { CardState } from './BlockRenderer.tsx';

interface ConfirmDeleteBlockProps {
  block: ConfirmDeleteBlockType;
  cardState?: CardState;
  onStateChange: (blockId: string, state: CardState) => void;
  onDataChanged?: () => void;
  onAppendMessage?: (text: string) => void;
}

const MODULE_DELETE_BASE: Record<string, string> = {
  finance: '/api/finance',
  study: '/api/study',
  habit: '/api/habits',
  goal: '/api/goals',
};

export const ConfirmDeleteBlock: React.FC<ConfirmDeleteBlockProps> = ({
  block,
  cardState,
  onStateChange,
  onDataChanged,
  onAppendMessage,
}) => {
  const status = cardState?.status || 'idle';
  const isDeleting = status === 'deleting';
  const [failedIds, setFailedIds] = useState<number[]>([]);

  const handleDelete = async () => {
    if (isDeleting || status === 'deleted') return;

    onStateChange(block.id, { status: 'deleting' });

    const baseEndpoint = MODULE_DELETE_BASE[block.module];
    const idsToDelete = failedIds.length > 0 ? failedIds : block.entries.map(e => e.id);

    let successCount = 0;
    const currentFailed: number[] = [];

    // Sequential requests
    for (const id of idsToDelete) {
      try {
        const res = await authedFetch(`${baseEndpoint}/${id}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          successCount++;
        } else {
          currentFailed.push(id);
        }
      } catch (e) {
        currentFailed.push(id);
      }
    }

    if (successCount > 0) {
      onDataChanged?.();
    }

    if (currentFailed.length === 0) {
      onStateChange(block.id, { status: 'deleted' });
      onAppendMessage?.(`Deleted ${successCount} ${block.module} record${successCount > 1 ? 's' : ''}.`);
    } else {
      setFailedIds(currentFailed);
      const msg = `Deleted ${successCount} of ${idsToDelete.length}; ${currentFailed.length} failed.`;
      onStateChange(block.id, { status: 'error', error: msg });
    }
  };

  const handleCancel = () => {
    if (isDeleting || status === 'deleted') return;
    onStateChange(block.id, { status: 'cancelled' });
    onAppendMessage?.(`Cancelled deletion of ${block.entries.length} ${block.module} records.`);
  };

  return (
    <div className="bg-white border border-rose-200 rounded-xl p-3.5 my-2 shadow-sm text-xs">
      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-rose-100">
        <h4 className="font-bold text-rose-900 tracking-tight flex items-center gap-1.5">
          <Trash2 className="w-4 h-4 text-rose-600" />
          <span>{block.title}</span>
        </h4>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 uppercase">
          Delete
        </span>
      </div>

      {/* Warning notice */}
      <div className="p-2 mb-2.5 bg-rose-50/70 border border-rose-200 rounded-lg text-[11px] text-rose-800 flex items-start gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
        <span>{block.warning}</span>
      </div>

      {/* List of entries to delete */}
      <div className="space-y-1.5 mb-3 bg-slate-50/70 p-2.5 rounded-lg border border-slate-100 max-h-40 overflow-y-auto">
        {block.entries.map((entry, idx) => (
          <div key={idx} className="flex justify-between items-center text-[11px] text-slate-700 py-0.5">
            <span className="font-medium truncate flex-1 pr-2" title={entry.description}>
              {entry.date ? `${entry.date} · ` : ''}{entry.description}
            </span>
            {entry.amountText && (
              <span className="font-bold text-rose-700 shrink-0">{entry.amountText}</span>
            )}
          </div>
        ))}
      </div>

      {/* Error state */}
      {status === 'error' && (
        <div className="text-[11px] text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200 mb-2.5 flex items-center justify-between">
          <span>{cardState?.error || 'Deletion failed'}</span>
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded font-semibold transition-colors text-[10px]"
          >
            <RotateCcw className="w-3 h-3" /> Retry Failed
          </button>
        </div>
      )}

      {/* Status or Action buttons */}
      {status === 'deleted' ? (
        <div className="w-full py-2 bg-emerald-50 text-emerald-800 font-bold rounded-lg border border-emerald-200 flex items-center justify-center gap-1.5 text-xs">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Deleted Successfully</span>
        </div>
      ) : status === 'cancelled' ? (
        <div className="w-full py-1.5 bg-slate-100 text-slate-500 font-semibold rounded-lg text-center text-xs">
          Cancelled
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-xs hover:shadow transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete {block.entries.length} {block.entries.length === 1 ? 'Record' : 'Records'}</span>
              </>
            )}
          </button>
          <button
            onClick={handleCancel}
            disabled={isDeleting}
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
