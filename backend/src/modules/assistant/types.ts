/**
 * Type definitions for the OmniLife Assistant
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
  items: MetricsItem[]; // 1-6 items
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
  series: ChartSeries[]; // 1-3 series
  band?: { lowerKey: string; upperKey: string };
  data: Record<string, string | number>[]; // each row has "x" plus one numeric per series key; at most 120 rows
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
  columns: TableColumn[]; // 2-6 columns
  rows: Record<string, string | number>[]; // at most 20 rows
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

export interface ToolContext {
  uid: string;
  clientDate: string;
}

export interface ToolResult {
  data: Record<string, unknown>;
  blocks?: Block[];
}

export interface ToolDeclaration {
  name: string;
  description: string;
  parametersJsonSchema: Record<string, unknown>;
}

export interface ToolDefinition {
  declaration: ToolDeclaration;
  validateArgs: (args: Record<string, unknown>) => {
    valid: boolean;
    errors?: string[];
    sanitized?: Record<string, unknown>;
  };
  execute: (args: any, context: ToolContext) => Promise<ToolResult>;
}

export interface ToolCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
}

export interface LLMMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface LLMGenerateParams {
  system: string;
  messages: LLMMessage[];
  tools?: ToolDeclaration[];
  rawContents?: any[];
  model?: string;
}

export interface LLMGenerateResult {
  text?: string;
  toolCalls?: ToolCall[];
  raw?: any; // Raw candidate content to replay exactly for thought signatures
}

export interface LLMClient {
  generate(params: LLMGenerateParams): Promise<LLMGenerateResult>;
}

export type AssistantOutcome = 'ok' | 'degraded' | 'unavailable';

export interface AssistantChatResponse {
  id: string;
  text: string;
  blocks: Block[];
  outcome: AssistantOutcome;
}
