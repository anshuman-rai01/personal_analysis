/**
 * Central tool registry for the OmniLife Assistant
 */

import { ToolDefinition } from '../types.ts';
import { buildReportTool, listEntriesTool, getForecastTool } from './read.ts';

export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  build_report: buildReportTool,
  list_entries: listEntriesTool,
  get_forecast: getForecastTool,
};

export function registerTool(tool: ToolDefinition): void {
  TOOL_REGISTRY[tool.declaration.name] = tool;
}
