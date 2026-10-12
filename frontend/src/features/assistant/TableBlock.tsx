import React from 'react';
import { TableBlock as TableBlockType, TableColumn } from '../../types/assistant.ts';

interface TableBlockProps {
  block: TableBlockType;
}

function formatTableCell(value: any, column: TableColumn): string {
  if (value === undefined || value === null) return '-';
  if (column.format === 'currency' && typeof value === 'number') {
    return `₹${value.toLocaleString('en-IN')}`;
  }
  if (column.format === 'date' && typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }
  }
  if (column.format === 'number' && typeof value === 'number') {
    return value.toLocaleString();
  }
  return String(value);
}

export const TableBlock: React.FC<TableBlockProps> = ({ block }) => {
  if (!block || !block.columns || !block.rows || block.rows.length === 0) return null;

  return (
    <div className="bg-white border border-purple-100 rounded-xl my-2 overflow-hidden shadow-xs">
      {block.title && (
        <div className="px-3 py-2 border-b border-purple-50 bg-slate-50/50">
          <h4 className="text-xs font-bold text-slate-800">{block.title}</h4>
        </div>
      )}
      <div className="overflow-x-auto max-h-60 scrollbar-thin">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-purple-50/60 border-b border-purple-100 text-purple-950 font-semibold sticky top-0">
            <tr>
              {block.columns.map(col => (
                <th
                  key={col.key}
                  className={`px-2.5 py-1.5 whitespace-nowrap ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {block.rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-purple-50/30 transition-colors">
                {block.columns.map(col => (
                  <td
                    key={col.key}
                    className={`px-2.5 py-1.5 text-slate-700 whitespace-nowrap ${
                      col.align === 'right' ? 'text-right font-medium' : 'text-left'
                    }`}
                  >
                    {formatTableCell(row[col.key], col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-1 bg-slate-50/50 border-t border-slate-100 text-[10px] text-slate-400 text-right">
        {block.rows.length} {block.rows.length === 1 ? 'record' : 'records'}
      </div>
    </div>
  );
};
