import React from 'react';
import { Block } from '../../lib/assistantTypes.ts';
import { NoticeBlock } from './NoticeBlock.tsx';

export interface CardState {
  status: 'idle' | 'saving' | 'saved' | 'deleting' | 'deleted' | 'cancelled' | 'error';
  error?: string;
  successMessage?: string;
}

interface BlockRendererProps {
  block: Block;
  cardState?: CardState;
  onConfirmEntry?: (block: Extract<Block, { type: 'confirm_entry' }>) => Promise<void>;
  onConfirmDelete?: (block: Extract<Block, { type: 'confirm_delete' }>) => Promise<void>;
  onCancelCard?: (blockId: string) => void;
  renderCustomBlock?: (type: string, props: any) => React.ReactNode;
}

export const BlockRenderer: React.FC<BlockRendererProps> = ({
  block,
  cardState,
  onConfirmEntry,
  onConfirmDelete,
  onCancelCard,
  renderCustomBlock,
}) => {
  // Registry-based rendering
  if (!block || !block.type) return null;

  switch (block.type) {
    case 'notice':
      return <NoticeBlock block={block} />;

    default:
      if (renderCustomBlock) {
        return <>{renderCustomBlock(block.type, { block, cardState, onConfirmEntry, onConfirmDelete, onCancelCard })}</>;
      }
      return null;
  }
};
