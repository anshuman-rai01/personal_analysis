/**
 * Pure block builder functions
 */

import {
  MetricsBlock,
  MetricsItem,
  ChartBlock,
  ChartSeries,
  TableBlock,
  TableColumn,
  NoticeBlock,
  ConfirmEntryBlock,
  ConfirmDeleteBlock,
  AssistantModule,
} from './types.ts';

export function createMetricsBlock(
  id: string,
  items: MetricsItem[],
  title?: string
): MetricsBlock {
  return {
    type: 'metrics',
    id,
    title,
    items: items.slice(0, 6),
  };
}

export function createChartBlock(
  id: string,
  options: {
    title: string;
    subtitle?: string;
    kind: 'line' | 'bar';
    xFormat: 'date' | 'category';
    yFormat: 'currency' | 'number';
    series: ChartSeries[];
    band?: { lowerKey: string; upperKey: string };
    data: Record<string, string | number>[];
  }
): ChartBlock {
  return {
    type: 'chart',
    id,
    title: options.title,
    subtitle: options.subtitle,
    kind: options.kind,
    xFormat: options.xFormat,
    yFormat: options.yFormat,
    series: options.series.slice(0, 3),
    band: options.band,
    data: options.data.slice(0, 120),
  };
}

export function createTableBlock(
  id: string,
  columns: TableColumn[],
  rows: Record<string, string | number>[],
  title?: string
): TableBlock {
  return {
    type: 'table',
    id,
    title,
    columns: columns.slice(0, 6),
    rows: rows.slice(0, 20),
  };
}

export function createNoticeBlock(
  id: string,
  text: string,
  tone: 'info' | 'warn' = 'info'
): NoticeBlock {
  return {
    type: 'notice',
    id,
    tone,
    text,
  };
}

export function createConfirmEntryBlock(
  id: string,
  title: string,
  module: AssistantModule,
  summary: { label: string; value: string }[],
  payload: Record<string, unknown>
): ConfirmEntryBlock {
  return {
    type: 'confirm_entry',
    id,
    title,
    module,
    summary,
    payload,
  };
}

export function createConfirmDeleteBlock(
  id: string,
  title: string,
  module: AssistantModule,
  entries: { id: number; date?: string; description: string; amountText?: string }[],
  warning: string
): ConfirmDeleteBlock {
  return {
    type: 'confirm_delete',
    id,
    title,
    module,
    entries: entries.slice(0, 10),
    warning,
  };
}
