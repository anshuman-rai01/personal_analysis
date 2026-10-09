/**
 * Central tool registry for the OmniLife Assistant
 */

import { ToolDefinition } from '../types.ts';

export const TOOL_REGISTRY: Record<string, ToolDefinition> = {};

export function registerTool(tool: ToolDefinition): void {
  TOOL_REGISTRY[tool.declaration.name] = tool;
}
