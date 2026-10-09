import React from 'react';
import { NoticeBlock as NoticeBlockType } from '../../lib/assistantTypes.ts';
import { AlertCircle, Info } from 'lucide-react';

interface NoticeBlockProps {
  block: NoticeBlockType;
}

export const NoticeBlock: React.FC<NoticeBlockProps> = ({ block }) => {
  const isWarn = block.tone === 'warn';

  return (
    <div
      className={`p-3 my-2 rounded-xl border text-xs flex items-start gap-2.5 leading-relaxed ${
        isWarn
          ? 'bg-amber-50/90 border-amber-200 text-amber-900'
          : 'bg-purple-50/90 border-purple-200 text-purple-900'
      }`}
    >
      {isWarn ? (
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
      ) : (
        <Info className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
      )}
      <div className="flex-1 whitespace-pre-wrap">{block.text}</div>
    </div>
  );
};
