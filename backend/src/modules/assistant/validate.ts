/**
 * Request, block, and argument validation utilities (hand-written, no external schema deps)
 */

import { LLMMessage, Block, MetricsBlock, ChartBlock, TableBlock, NoticeBlock, ConfirmEntryBlock, ConfirmDeleteBlock } from './types.ts';
import { validateClientDate } from './dates.ts';

export function sanitizeLabel(input: unknown): string {
  if (typeof input !== 'string') return '';
  // Strip ASCII control characters 0x00-0x1F and 0x7F
  const cleaned = input.replace(/[\x00-\x1F\x7F]/g, '').trim();
  return cleaned.slice(0, 40);
}

export function sanitizeText(input: unknown, maxLen: number = 120): string {
  if (typeof input !== 'string') return '';
  const cleaned = input.replace(/[\x00-\x1F\x7F]/g, '').trim();
  return cleaned.slice(0, maxLen);
}

export function sanitizeNotes(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  const cleaned = input.replace(/[\x00-\x1F\x7F]/g, '').trim();
  return cleaned.slice(0, 500) || undefined;
}

export interface ChatRequestValidationResult {
  valid: boolean;
  error?: string;
  messages?: LLMMessage[];
  clientDate?: string;
}

export function validateChatRequest(body: unknown, serverDate: Date = new Date()): ChatRequestValidationResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, error: 'Request body must be a JSON object.' };
  }

  const payload = body as Record<string, unknown>;

  if (!Array.isArray(payload.messages)) {
    return { valid: false, error: 'messages must be an array.' };
  }

  if (payload.messages.length < 1 || payload.messages.length > 12) {
    return { valid: false, error: 'messages must contain between 1 and 12 entries.' };
  }

  let totalChars = 0;
  const validatedMessages: LLMMessage[] = [];

  for (let i = 0; i < payload.messages.length; i++) {
    const msg = payload.messages[i];
    if (!msg || typeof msg !== 'object') {
      return { valid: false, error: `Message at index ${i} is invalid.` };
    }

    const { role, text } = msg as Record<string, unknown>;

    // Reject any role other than 'user' or 'assistant' (specifically 'system')
    if (role !== 'user' && role !== 'assistant') {
      return { valid: false, error: `Invalid role "${role}". Only "user" and "assistant" are permitted.` };
    }

    if (typeof text !== 'string') {
      return { valid: false, error: `Message text at index ${i} must be a string.` };
    }

    const textLen = text.length;
    if (textLen < 1 || textLen > 2000) {
      return { valid: false, error: `Message text at index ${i} must be between 1 and 2000 characters.` };
    }

    totalChars += textLen;
    validatedMessages.push({ role, text });
  }

  if (totalChars > 8000) {
    return { valid: false, error: `Total message characters (${totalChars}) exceed the 8000 character maximum.` };
  }

  const lastMessage = validatedMessages[validatedMessages.length - 1];
  if (lastMessage.role !== 'user') {
    return { valid: false, error: 'The last message in the sequence must have role "user".' };
  }

  const resolvedDate = validateClientDate(payload.clientDate, serverDate);

  return {
    valid: true,
    messages: validatedMessages,
    clientDate: resolvedDate,
  };
}

export function validateBlocks(blocks: Block[]): { valid: boolean; error?: string } {
  if (!Array.isArray(blocks)) {
    return { valid: false, error: 'Blocks must be an array.' };
  }

  if (blocks.length > 6) {
    return { valid: false, error: 'A response may contain at most 6 blocks.' };
  }

  for (const block of blocks) {
    if (!block || typeof block !== 'object' || !block.type || !block.id) {
      return { valid: false, error: 'Malformed block missing type or id.' };
    }

    switch (block.type) {
      case 'metrics': {
        const m = block as MetricsBlock;
        if (!Array.isArray(m.items) || m.items.length < 1 || m.items.length > 6) {
          return { valid: false, error: 'Metrics block must contain between 1 and 6 items.' };
        }
        for (const item of m.items) {
          if (typeof item.label !== 'string' || typeof item.value !== 'number' || !Number.isFinite(item.value)) {
            return { valid: false, error: 'Metric item contains invalid label or non-finite value.' };
          }
        }
        break;
      }
      case 'chart': {
        const c = block as ChartBlock;
        if (!['line', 'bar'].includes(c.kind)) return { valid: false, error: 'Invalid chart kind.' };
        if (!Array.isArray(c.series) || c.series.length < 1 || c.series.length > 3) {
          return { valid: false, error: 'Chart block must have 1 to 3 series.' };
        }
        if (!Array.isArray(c.data) || c.data.length > 120) {
          return { valid: false, error: 'Chart data must have at most 120 rows.' };
        }
        break;
      }
      case 'table': {
        const t = block as TableBlock;
        if (!Array.isArray(t.columns) || t.columns.length < 2 || t.columns.length > 6) {
          return { valid: false, error: 'Table block must have 2 to 6 columns.' };
        }
        if (!Array.isArray(t.rows) || t.rows.length > 20) {
          return { valid: false, error: 'Table block must have at most 20 rows.' };
        }
        break;
      }
      case 'notice': {
        const n = block as NoticeBlock;
        if (!['info', 'warn'].includes(n.tone) || typeof n.text !== 'string') {
          return { valid: false, error: 'Notice block must have valid tone and text.' };
        }
        break;
      }
      case 'confirm_entry': {
        const ce = block as ConfirmEntryBlock;
        if (!['finance', 'study', 'habit', 'goal'].includes(ce.module)) {
          return { valid: false, error: 'Confirm entry has invalid module.' };
        }
        if (!ce.payload || typeof ce.payload !== 'object') {
          return { valid: false, error: 'Confirm entry must contain payload object.' };
        }
        break;
      }
      case 'confirm_delete': {
        const cd = block as ConfirmDeleteBlock;
        if (!['finance', 'study', 'habit', 'goal'].includes(cd.module)) {
          return { valid: false, error: 'Confirm delete has invalid module.' };
        }
        if (!Array.isArray(cd.entries) || cd.entries.length < 1 || cd.entries.length > 10) {
          return { valid: false, error: 'Confirm delete must contain between 1 and 10 entries.' };
        }
        break;
      }
      default:
        return { valid: false, error: `Unknown block type: ${(block as any).type}` };
    }
  }

  return { valid: true };
}
