import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { ChartBlock as ChartBlockType, SeriesRole } from '../../types/assistant.ts';

interface ChartBlockProps {
  block: ChartBlockType;
}

const ROLE_COLORS: Record<SeriesRole, string> = {
  income: '#10b981', // green
  expense: '#ef4444', // red
  savings: '#a855f7', // purple
  forecast: '#3b82f6', // blue
  neutral: '#6b7280', // gray
};

function formatCompactINR(val: number): string {
  if (Math.abs(val) >= 10000000) {
    return `₹${(val / 10000000).toFixed(1)}Cr`;
  }
  if (Math.abs(val) >= 100000) {
    return `₹${(val / 100000).toFixed(1)}L`;
  }
  if (Math.abs(val) >= 1000) {
    return `₹${(val / 1000).toFixed(0)}K`;
  }
  return `₹${val}`;
}

function formatDateTick(tick: string): string {
  if (typeof tick !== 'string') return String(tick);
  // Match YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(tick)) {
    const [y, m, d] = tick.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
  // Truncate long category string
  return tick.length > 10 ? tick.slice(0, 9) + '…' : tick;
}

export const ChartBlock: React.FC<ChartBlockProps> = ({ block }) => {
  if (!block || !block.data || block.data.length === 0 || !block.series || block.series.length === 0) {
    return null;
  }

  const isCurrency = block.yFormat === 'currency';

  // Format tooltip values
  const tooltipFormatter = (value: any, name: any) => {
    if (typeof value === 'number') {
      if (isCurrency) {
        return [`₹${value.toLocaleString('en-IN')}`, name];
      }
      return [value.toLocaleString(), name];
    }
    return [value, name];
  };

  return (
    <div className="bg-white border border-purple-100 rounded-xl p-3 my-2 shadow-xs">
      <div className="mb-2">
        <h4 className="text-xs font-bold text-slate-800 tracking-tight">{block.title}</h4>
        {block.subtitle && (
          <p className="text-[10px] text-slate-500 mt-0.5">{block.subtitle}</p>
        )}
      </div>

      <div className="w-full h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={block.data}
            margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="x"
              tickFormatter={formatDateTick}
              tick={{ fontSize: 9, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              tickFormatter={isCurrency ? formatCompactINR : val => `${val}`}
              tick={{ fontSize: 9, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <Tooltip
              formatter={tooltipFormatter}
              labelFormatter={label => (typeof label === 'string' ? formatDateTick(label) : label)}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '11px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }}
              iconType="circle"
              iconSize={8}
            />

            {/* Shaded confidence / variability band if specified */}
            {block.band && (
              <Area
                dataKey={(entry: any) => [entry[block.band!.lowerKey], entry[block.band!.upperKey]]}
                name="Variability Band"
                fill="#3b82f6"
                fillOpacity={0.12}
                stroke="none"
                isAnimationActive={false}
              />
            )}

            {/* Series renders as Bars or Lines */}
            {block.series.map(s => {
              const color = ROLE_COLORS[s.role] || ROLE_COLORS.neutral;
              if (block.kind === 'bar') {
                return (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    fill={color}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={28}
                  />
                );
              }
              return (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={color}
                  strokeWidth={2}
                  dot={{ r: 2, fill: color }}
                  activeDot={{ r: 4 }}
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
