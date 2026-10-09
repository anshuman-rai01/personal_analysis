import React from 'react';
import { MetricsBlock as MetricsBlockType, MetricsItem } from '../../lib/assistantTypes.ts';

interface MetricsBlockProps {
  block: MetricsBlockType;
}

function formatMetricValue(item: MetricsItem): string {
  if (item.format === 'currency') {
    return `₹${item.value.toLocaleString('en-IN')}`;
  }
  if (item.format === 'percent') {
    return `${item.value}%`;
  }
  return item.value.toLocaleString();
}

export const MetricsBlock: React.FC<MetricsBlockProps> = ({ block }) => {
  if (!block || !block.items || block.items.length === 0) return null;

  return (
    <div className="bg-white border border-purple-100 rounded-xl p-3 my-2 shadow-xs">
      {block.title && (
        <h4 className="text-xs font-bold text-slate-800 mb-2">{block.title}</h4>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {block.items.map((item, idx) => {
          let toneBadge = 'bg-slate-50 border-slate-200 text-slate-800';
          let valColor = 'text-slate-900';

          if (item.tone === 'ok') {
            toneBadge = 'bg-emerald-50/70 border-emerald-200 text-emerald-900';
            valColor = 'text-emerald-700';
          } else if (item.tone === 'danger') {
            toneBadge = 'bg-rose-50/70 border-rose-200 text-rose-900';
            valColor = 'text-rose-700';
          } else if (item.tone === 'warn') {
            toneBadge = 'bg-amber-50/70 border-amber-200 text-amber-900';
            valColor = 'text-amber-700';
          }

          return (
            <div
              key={idx}
              className={`p-2 rounded-lg border flex flex-col justify-between ${toneBadge}`}
            >
              <span className="text-[10px] font-medium text-slate-500 truncate" title={item.label}>
                {item.label}
              </span>
              <span className={`text-xs font-extrabold tracking-tight mt-0.5 truncate ${valColor}`}>
                {formatMetricValue(item)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
