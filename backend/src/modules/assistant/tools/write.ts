/**
 * Write preparation tools: propose_entry and propose_delete
 *
 * CRITICAL ARCHITECTURAL GUARANTEE:
 * These tools perform ZERO database mutations. They prepare strongly validated payloads
 * and confirmation cards for explicit human approval via the existing REST API.
 *
 * IMPORTANT SIDE EFFECT NOTICE:
 * In OmniLife Studio, creating a study session automatically increments all matching study goals,
 * and creating an investment/savings transaction automatically increments all matching finance goals.
 * Deleting a record does NOT reverse these goal increments (existing route behaviour).
 */

import { ToolContext, ToolResult, ToolDefinition, AssistantModule } from '../types.ts';
import { parseDate, formatDate } from '../dates.ts';
import { sanitizeLabel, sanitizeText, sanitizeNotes } from '../validate.ts';
import { createConfirmEntryBlock, createConfirmDeleteBlock } from '../blocks.ts';
import { defaultRepository, AssistantRepository } from './read.ts';

let activeWriteRepository: AssistantRepository = defaultRepository;

export function setWriteAssistantRepository(repo: AssistantRepository): void {
  activeWriteRepository = repo;
}

export function resetWriteAssistantRepository(): void {
  activeWriteRepository = defaultRepository;
}

const VALID_FINANCE_TYPES = ['expense', 'income', 'investment', 'savings'];
const VALID_TECHNIQUES = [
  'Deep Work',
  'Pomodoro',
  'Active Recall',
  'Feynman Method',
  'Spaced Repetition',
  'Problem Sets',
];

// ---------------- 1. propose_entry ----------------
export const proposeEntryTool: ToolDefinition = {
  declaration: {
    name: 'propose_entry',
    description: 'Prepares a structured record proposal for user confirmation before saving.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        module: {
          type: 'string',
          enum: ['finance', 'study', 'habit', 'goal'],
          description: 'The target module to create a record in.',
        },
        type: { type: 'string', description: 'Finance transaction type (income, expense, investment, savings).' },
        title: { type: 'string', description: 'Title of transaction or goal.' },
        amount: { type: 'number', description: 'Monetary amount in INR.' },
        category: { type: 'string', description: 'Category name.' },
        paymentMethod: { type: 'string', description: 'Payment method.' },
        subject: { type: 'string', description: 'Study subject.' },
        topic: { type: 'string', description: 'Study topic.' },
        durationMinutes: { type: 'integer', description: 'Study duration in minutes (5 to 720).' },
        technique: { type: 'string', description: 'Study technique.' },
        focusScore: { type: 'integer', description: 'Focus rating (1 to 10).' },
        energyScore: { type: 'integer', description: 'Energy rating (1 to 10).' },
        name: { type: 'string', description: 'Habit name.' },
        frequency: { type: 'string', description: 'Habit frequency (e.g. daily).' },
        targetDaysPerWeek: { type: 'integer', description: 'Target days per week (1 to 7).' },
        unit: { type: 'string', description: 'Goal measurement unit.' },
        targetValue: { type: 'number', description: 'Goal target numeric value.' },
        deadline: { type: 'string', description: 'Goal deadline date (YYYY-MM-DD).' },
        date: { type: 'string', description: 'Entry date (YYYY-MM-DD).' },
        notes: { type: 'string', description: 'Additional notes (max 500 chars).' },
      },
      required: ['module'],
    },
  },
  validateArgs: (args: Record<string, unknown>) => {
    const validModules = ['finance', 'study', 'habit', 'goal'];
    if (typeof args.module !== 'string' || !validModules.includes(args.module)) {
      return { valid: false, errors: ['module must be one of: ' + validModules.join(', ')] };
    }
    return { valid: true, sanitized: args };
  },
  execute: async (args: any, context: ToolContext): Promise<ToolResult> => {
    const module = args.module as AssistantModule;
    const missing: string[] = [];

    // Helper for date validation (not in future unless goal deadline)
    const validateEntryDate = (dStr: unknown, allowFuture: boolean = false): string | null => {
      if (typeof dStr !== 'string') return null;
      const parsed = parseDate(dStr);
      if (!parsed) return null;
      if (!allowFuture) {
        const clientDate = parseDate(context.clientDate);
        if (clientDate && parsed > clientDate) return null;
      }
      return dStr;
    };

    if (module === 'finance') {
      if (!args.title || typeof args.title !== 'string' || !args.title.trim()) missing.push('title');
      if (args.amount === undefined || typeof args.amount !== 'number' || isNaN(args.amount) || args.amount <= 0) missing.push('amount');
      if (!args.type || typeof args.type !== 'string' || !VALID_FINANCE_TYPES.includes(args.type)) missing.push('type');

      if (missing.length > 0) {
        return { data: { status: 'needs_more_info', missing } };
      }

      if (args.amount > 100000000) {
        return { data: { status: 'error', error: 'amount exceeds maximum allowable limit (₹10,00,00,000).' } };
      }

      const isDateSupplied = typeof args.date === 'string';
      const validDate = isDateSupplied ? validateEntryDate(args.date, false) : context.clientDate;
      if (!validDate) {
        return { data: { status: 'error', error: 'Invalid transaction date. Date cannot be in the future.' } };
      }

      const title = sanitizeText(args.title, 120);
      const isCatSupplied = typeof args.category === 'string' && args.category.trim().length > 0;
      const category = isCatSupplied ? sanitizeText(args.category, 60) : 'General';
      const isPaymentSupplied = typeof args.paymentMethod === 'string' && args.paymentMethod.trim().length > 0;
      const paymentMethod = isPaymentSupplied ? sanitizeText(args.paymentMethod, 60) : 'Bank Transfer';
      const notes = sanitizeNotes(args.notes) || '';

      const payload = {
        title,
        type: args.type,
        category,
        amount: args.amount,
        paymentMethod,
        date: validDate,
        notes,
      };

      const summary = [
        { label: 'Amount', value: `₹${args.amount.toLocaleString('en-IN')}` },
        { label: 'Type', value: args.type[0].toUpperCase() + args.type.slice(1) },
        { label: 'Title', value: title },
        { label: 'Category', value: isCatSupplied ? category : `${category} (default)` },
        { label: 'Payment Method', value: isPaymentSupplied ? paymentMethod : `${paymentMethod} (default)` },
        { label: 'Date', value: isDateSupplied ? validDate : `${validDate} (today)` },
      ];

      const block = createConfirmEntryBlock(
        'conf_entry_' + Date.now(),
        `Save ${args.type[0].toUpperCase() + args.type.slice(1)}: ₹${args.amount.toLocaleString('en-IN')}`,
        'finance',
        summary,
        payload
      );

      return {
        data: {
          status: 'awaiting_confirmation',
          module: 'finance',
          summary: summary.map(s => `${s.label}: ${s.value}`).join(', '),
        },
        blocks: [block],
      };
    }

    if (module === 'study') {
      if (!args.subject || typeof args.subject !== 'string' || !args.subject.trim()) missing.push('subject');
      if (!args.topic || typeof args.topic !== 'string' || !args.topic.trim()) missing.push('topic');
      if (args.durationMinutes === undefined || typeof args.durationMinutes !== 'number' || isNaN(args.durationMinutes) || args.durationMinutes < 5 || args.durationMinutes > 720) {
        missing.push('durationMinutes');
      }

      if (missing.length > 0) {
        return { data: { status: 'needs_more_info', missing } };
      }

      const isDateSupplied = typeof args.date === 'string';
      const validDate = isDateSupplied ? validateEntryDate(args.date, false) : context.clientDate;
      if (!validDate) {
        return { data: { status: 'error', error: 'Invalid study date. Date cannot be in the future.' } };
      }

      const subject = sanitizeText(args.subject, 120);
      const topic = sanitizeText(args.topic, 120);
      const durationMinutes = Math.floor(args.durationMinutes);

      const isTechSupplied = typeof args.technique === 'string' && VALID_TECHNIQUES.includes(args.technique);
      const technique = isTechSupplied ? args.technique : 'Pomodoro';

      const isFocusSupplied = typeof args.focusScore === 'number' && args.focusScore >= 1 && args.focusScore <= 10;
      const focusScore = isFocusSupplied ? Math.floor(args.focusScore) : 7;

      const isEnergySupplied = typeof args.energyScore === 'number' && args.energyScore >= 1 && args.energyScore <= 10;
      const energyScore = isEnergySupplied ? Math.floor(args.energyScore) : 7;

      const notes = sanitizeNotes(args.notes) || '';

      const payload = {
        subject,
        topic,
        durationMinutes,
        technique,
        focusScore,
        energyScore,
        date: validDate,
        notes,
      };

      const summary = [
        { label: 'Subject', value: subject },
        { label: 'Topic', value: topic },
        { label: 'Duration', value: `${durationMinutes} mins` },
        { label: 'Technique', value: isTechSupplied ? technique : `${technique} (default)` },
        { label: 'Focus Score', value: isFocusSupplied ? `${focusScore}/10` : `${focusScore}/10 (default)` },
        { label: 'Date', value: isDateSupplied ? validDate : `${validDate} (today)` },
      ];

      const block = createConfirmEntryBlock(
        'conf_entry_' + Date.now(),
        `Log Study: ${subject} (${durationMinutes}m)`,
        'study',
        summary,
        payload
      );

      return {
        data: {
          status: 'awaiting_confirmation',
          module: 'study',
          summary: summary.map(s => `${s.label}: ${s.value}`).join(', '),
        },
        blocks: [block],
      };
    }

    if (module === 'habit') {
      if (!args.name || typeof args.name !== 'string' || !args.name.trim()) missing.push('name');
      if (missing.length > 0) {
        return { data: { status: 'needs_more_info', missing } };
      }

      const name = sanitizeText(args.name, 120);
      const isCatSupplied = typeof args.category === 'string' && args.category.trim().length > 0;
      const category = isCatSupplied ? sanitizeText(args.category, 60) : 'Productivity';
      const isFreqSupplied = typeof args.frequency === 'string' && args.frequency.trim().length > 0;
      const frequency = isFreqSupplied ? sanitizeText(args.frequency, 40) : 'daily';
      const isTargetSupplied = typeof args.targetDaysPerWeek === 'number' && args.targetDaysPerWeek >= 1 && args.targetDaysPerWeek <= 7;
      const targetDaysPerWeek = isTargetSupplied ? Math.floor(args.targetDaysPerWeek) : 7;

      const payload = {
        name,
        category,
        frequency,
        targetDaysPerWeek,
      };

      const summary = [
        { label: 'Habit Name', value: name },
        { label: 'Category', value: isCatSupplied ? category : `${category} (default)` },
        { label: 'Frequency', value: isFreqSupplied ? frequency : `${frequency} (default)` },
        { label: 'Target Days', value: isTargetSupplied ? `${targetDaysPerWeek} days/week` : `${targetDaysPerWeek} days/week (default)` },
      ];

      const block = createConfirmEntryBlock(
        'conf_entry_' + Date.now(),
        `Create Habit: ${name}`,
        'habit',
        summary,
        payload
      );

      return {
        data: {
          status: 'awaiting_confirmation',
          module: 'habit',
          summary: summary.map(s => `${s.label}: ${s.value}`).join(', '),
        },
        blocks: [block],
      };
    }

    if (module === 'goal') {
      if (!args.title || typeof args.title !== 'string' || !args.title.trim()) missing.push('title');
      if (args.targetValue === undefined || typeof args.targetValue !== 'number' || isNaN(args.targetValue) || args.targetValue <= 0) missing.push('targetValue');
      if (!args.deadline || typeof args.deadline !== 'string' || !args.deadline.trim()) missing.push('deadline');

      if (missing.length > 0) {
        return { data: { status: 'needs_more_info', missing } };
      }

      const validDeadline = validateEntryDate(args.deadline, true);
      if (!validDeadline) {
        return { data: { status: 'error', error: 'Invalid deadline date format (must be YYYY-MM-DD).' } };
      }

      const title = sanitizeText(args.title, 120);
      const isModSupplied = typeof args.module === 'string' && ['study', 'finance', 'habits', 'personal', 'career'].includes(args.module);
      const goalModule = isModSupplied ? args.module : 'personal';
      const isUnitSupplied = typeof args.unit === 'string' && args.unit.trim().length > 0;
      const unit = isUnitSupplied ? sanitizeText(args.unit, 40) : 'Units';

      const payload = {
        title,
        module: goalModule,
        targetValue: args.targetValue,
        unit,
        deadline: validDeadline,
      };

      const summary = [
        { label: 'Goal Title', value: title },
        { label: 'Target Value', value: `${args.targetValue.toLocaleString()} ${unit}` },
        { label: 'Module', value: isModSupplied ? goalModule : `${goalModule} (default)` },
        { label: 'Deadline', value: validDeadline },
      ];

      const block = createConfirmEntryBlock(
        'conf_entry_' + Date.now(),
        `Set Goal: ${title}`,
        'goal',
        summary,
        payload
      );

      return {
        data: {
          status: 'awaiting_confirmation',
          module: 'goal',
          summary: summary.map(s => `${s.label}: ${s.value}`).join(', '),
        },
        blocks: [block],
      };
    }

    return { data: { status: 'error', error: 'Unknown module' } };
  },
};

// ---------------- 2. propose_delete ----------------
export const proposeDeleteTool: ToolDefinition = {
  declaration: {
    name: 'propose_delete',
    description: 'Prepares a record deletion proposal with verified database entries for user confirmation.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        module: {
          type: 'string',
          enum: ['finance', 'study', 'habit', 'goal'],
          description: 'The module of the records to delete.',
        },
        entryIds: {
          type: 'array',
          items: { type: 'integer' },
          description: 'Array of 1 to 10 record IDs to delete (obtained from list_entries).',
        },
      },
      required: ['module', 'entryIds'],
    },
  },
  validateArgs: (args: Record<string, unknown>) => {
    const validModules = ['finance', 'study', 'habit', 'goal'];
    if (typeof args.module !== 'string' || !validModules.includes(args.module)) {
      return { valid: false, errors: ['module must be one of: ' + validModules.join(', ')] };
    }
    if (!Array.isArray(args.entryIds) || args.entryIds.length < 1) {
      return { valid: false, errors: ['entryIds must be a non-empty array of integer IDs.'] };
    }
    if (args.entryIds.length > 10) {
      return { valid: false, errors: ['At most 10 entryIds can be proposed for deletion at once.'] };
    }
    const cleanIds: number[] = [];
    for (const id of args.entryIds) {
      if (typeof id === 'number' && Number.isInteger(id) && id > 0) {
        cleanIds.push(id);
      }
    }
    if (cleanIds.length === 0) {
      return { valid: false, errors: ['entryIds must contain valid positive integers.'] };
    }
    return {
      valid: true,
      sanitized: { module: args.module, entryIds: cleanIds },
    };
  },
  execute: async (args: any, context: ToolContext): Promise<ToolResult> => {
    const { module, entryIds } = args as { module: AssistantModule; entryIds: number[] };

    // Fetch user's existing records from database
    let userRecords: any[] = [];
    if (module === 'finance') {
      userRecords = await activeWriteRepository.getFinanceTransactions(context.uid);
    } else if (module === 'study') {
      userRecords = await activeWriteRepository.getStudySessions(context.uid);
    } else if (module === 'habit') {
      userRecords = await activeWriteRepository.getHabits(context.uid);
    } else if (module === 'goal') {
      userRecords = await activeWriteRepository.getGoals(context.uid);
    }

    const validEntries: { id: number; date?: string; description: string; amountText?: string }[] = [];
    const missingIds: number[] = [];

    for (const id of entryIds) {
      const match = userRecords.find(r => r.id === id);
      if (!match) {
        missingIds.push(id);
        continue;
      }

      if (module === 'finance') {
        validEntries.push({
          id: match.id,
          date: match.date,
          description: sanitizeLabel(match.title),
          amountText: `₹${Number(match.amount).toLocaleString('en-IN')}`,
        });
      } else if (module === 'study') {
        validEntries.push({
          id: match.id,
          date: match.date,
          description: sanitizeLabel(`${match.subject}: ${match.topic}`),
          amountText: `${match.durationMinutes}m`,
        });
      } else if (module === 'habit') {
        validEntries.push({
          id: match.id,
          description: sanitizeLabel(match.name),
          amountText: `${match.currentStreak}d streak`,
        });
      } else if (module === 'goal') {
        validEntries.push({
          id: match.id,
          description: sanitizeLabel(match.title),
          amountText: `${match.targetValue} ${match.unit || ''}`,
        });
      }
    }

    if (validEntries.length === 0) {
      return {
        data: {
          status: 'entry_not_found',
          error: 'None of the requested IDs were found in your records.',
          missingIds,
        },
      };
    }

    let warning = 'This permanently deletes the record and cannot be undone.';
    if (module === 'habit') {
      warning += ' Its check-in history is deleted too.';
    }

    const block = createConfirmDeleteBlock(
      'conf_del_' + Date.now(),
      `Delete ${validEntries.length} ${module} record${validEntries.length > 1 ? 's' : ''}`,
      module,
      validEntries,
      warning
    );

    return {
      data: {
        status: 'awaiting_confirmation',
        module,
        count: validEntries.length,
        deletedIds: validEntries.map(e => e.id),
        missingIds: missingIds.length > 0 ? missingIds : undefined,
      },
      blocks: [block],
    };
  },
};
