import React from 'react';
import { Block } from '../../types/assistant.ts';
import { NoticeBlock } from './NoticeBlock.tsx';
import { MetricsBlock } from './MetricsBlock.tsx';
import { ChartBlock } from './ChartBlock.tsx';
import { TableBlock } from './TableBlock.tsx';
import { ConfirmEntryBlock } from './ConfirmEntryBlock.tsx';
import { ConfirmDeleteBlock } from './ConfirmDeleteBlock.tsx';

export interface CardState {
  status: 'idle' | 'saving' | 'saved' | 'deleting' | 'deleted' | 'cancelled' | 'error';
  error?: string;
  successMessage?: string;
}

interface BlockRendererProps {
  block: Block;
  cardState?: CardState;
  onStateChange?: (blockId: string, state: CardState) => void;
  onDataChanged?: () => void;
  onAppendMessage?: (text: string) => void;
  renderCustomBlock?: (type: string, props: any) => React.ReactNode;
}

export const BlockRenderer: React.FC<BlockRendererProps> = ({
  block,
  cardState,
  onStateChange,
  onDataChanged,
  onAppendMessage,
  renderCustomBlock,
}) => {
  if (!block || !block.type) return null;

  switch (block.type) {
    case 'metrics':
      return <MetricsBlock block={block} />;

    case 'chart':
      return <ChartBlock block={block} />;

    case 'table':
      return <TableBlock block={block} />;

    case 'notice':
      return <NoticeBlock block={block} />;

    case 'confirm_entry':
      return (
        <ConfirmEntryBlock
          block={block}
          cardState={cardState}
          onStateChange={onStateChange || (() => {})}
          onDataChanged={onDataChanged}
          onAppendMessage={onAppendMessage}
        />
      );

    case 'confirm_delete':
      return (
        <ConfirmDeleteBlock
          block={block}
          cardState={cardState}
          onStateChange={onStateChange || (() => {})}
          onDataChanged={onDataChanged}
          onAppendMessage={onAppendMessage}
        />
      );

    default:
      if (renderCustomBlock) {
        return <>{renderCustomBlock((block as any).type, { block, cardState, onStateChange, onDataChanged, onAppendMessage })}</>;
      }
      return null;
  }
};
