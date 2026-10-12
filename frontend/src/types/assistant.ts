/**
 * Frontend types for OmniLife Assistant blocks and chat interactions
 */

export type MetricsTone = 'neutral' | 'ok' | 'warn' | 'danger';
export type MetricsFormat = 'currency' | 'number' | 'percent';

export interface MetricsItem {
  label: string;
  value: number;
  format: MetricsFormat;
  tone?: MetricsTone;
}

export interface MetricsBlock {
  type: 'metrics';
  id: string;
  title?: string;
  items: MetricsItem[];
}

export type SeriesRole = 'income' | 'expense' | 'savings' | 'forecast' | 'neutral';

export interface ChartSeries {
  key: string;
  label: string;
  role: SeriesRole;
}

export interface ChartBlock {
  type: 'chart';
  id: string;
  title: string;
  subtitle?: string;
  kind: 'line' | 'bar';
  xFormat: 'date' | 'category';
  yFormat: 'currency' | 'number';
  series: ChartSeries[];
  band?: { lowerKey: string; upperKey: string };
  data: Record<string, string | number>[];
}

export type ColumnFormat = 'text' | 'date' | 'currency' | 'number';
export type ColumnAlign = 'left' | 'right';

export interface TableColumn {
  key: string;
  label: string;
  format: ColumnFormat;
  align?: ColumnAlign;
}

export interface TableBlock {
  type: 'table';
  id: string;
  title?: string;
  columns: TableColumn[];
  rows: Record<string, string | number>[];
}

export interface NoticeBlock {
  type: 'notice';
  id: string;
  tone: 'info' | 'warn';
  text: string;
}

export type AssistantModule = 'finance' | 'study' | 'habit' | 'goal';

export interface ConfirmEntrySummaryItem {
  label: string;
  value: string;
}

export interface ConfirmEntryBlock {
  type: 'confirm_entry';
  id: string;
  title: string;
  module: AssistantModule;
  summary: ConfirmEntrySummaryItem[];
  payload: Record<string, unknown>;
}

export interface ConfirmDeleteEntryItem {
  id: number;
  date?: string;
  description: string;
  amountText?: string;
}

export interface ConfirmDeleteBlock {
  type: 'confirm_delete';
  id: string;
  title: string;
  module: AssistantModule;
  entries: ConfirmDeleteEntryItem[];
  warning: string;
}

export type Block =
  | MetricsBlock
  | ChartBlock
  | TableBlock
  | NoticeBlock
  | ConfirmEntryBlock
  | ConfirmDeleteBlock;

export interface AssistantChatResponse {
  id: string;
  text: string;
  blocks: Block[];
  outcome: 'ok' | 'degraded' | 'unavailable';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  blocks?: Block[];
  outcome?: 'ok' | 'degraded' | 'unavailable';
  isError?: boolean;
}
