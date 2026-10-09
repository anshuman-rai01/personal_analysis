/**
 * Read tools: build_report, list_entries, get_forecast
 */

import { db } from '../../db/index.ts';
import {
  financeTransactions,
  studySessions,
  habits,
  habitLogs,
  goals,
} from '../../db/schema.ts';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { ToolContext, ToolResult, ToolDefinition, Block } from '../types.ts';
import { resolvePeriodDates, parseDate, addDays, formatDate, createWeekBuckets, ReportPeriod } from '../dates.ts';
import { sanitizeLabel } from '../validate.ts';
import {
  createMetricsBlock,
  createChartBlock,
  createTableBlock,
  createNoticeBlock,
} from '../blocks.ts';
import {
  computeSingleForecast,
  computeFinancesForecast,
  FinanceTx,
  ForecastSeriesType,
} from '../forecast.ts';

// Repository interface for database dependency injection / unit testing
export interface AssistantRepository {
  getFinanceTransactions(uid: string, startDate?: string, endDate?: string): Promise<any[]>;
  getStudySessions(uid: string, startDate?: string, endDate?: string): Promise<any[]>;
  getHabits(uid: string): Promise<any[]>;
  getHabitLogs(uid: string, startDate?: string, endDate?: string): Promise<any[]>;
  getGoals(uid: string): Promise<any[]>;
}

export const defaultRepository: AssistantRepository = {
  async getFinanceTransactions(uid, startDate, endDate) {
    const conditions = [eq(financeTransactions.userId, uid)];
    if (startDate) conditions.push(gte(financeTransactions.date, startDate));
    if (endDate) conditions.push(lte(financeTransactions.date, endDate));
    return await db.select().from(financeTransactions).where(and(...conditions)).orderBy(desc(financeTransactions.date), desc(financeTransactions.id));
  },
  async getStudySessions(uid, startDate, endDate) {
    const conditions = [eq(studySessions.userId, uid)];
    if (startDate) conditions.push(gte(studySessions.date, startDate));
    if (endDate) conditions.push(lte(studySessions.date, endDate));
    return await db.select().from(studySessions).where(and(...conditions)).orderBy(desc(studySessions.date), desc(studySessions.id));
  },
  async getHabits(uid) {
    return await db.select().from(habits).where(eq(habits.userId, uid)).orderBy(desc(habits.id));
  },
  async getHabitLogs(uid, startDate, endDate) {
    const conditions = [eq(habitLogs.userId, uid)];
    if (startDate) conditions.push(gte(habitLogs.date, startDate));
    if (endDate) conditions.push(lte(habitLogs.date, endDate));
    return await db.select().from(habitLogs).where(and(...conditions)).orderBy(desc(habitLogs.date));
  },
  async getGoals(uid) {
    return await db.select().from(goals).where(eq(goals.userId, uid)).orderBy(desc(goals.id));
  },
};

let activeRepository: AssistantRepository = defaultRepository;

export function setAssistantRepository(repo: AssistantRepository): void {
  activeRepository = repo;
}

export function resetAssistantRepository(): void {
  activeRepository = defaultRepository;
}

// ---------------- 1. build_report ----------------
export const buildReportTool: ToolDefinition = {
  declaration: {
    name: 'build_report',
    description: 'Generates a financial and activity report with metrics and visualizations across a time period.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['last_7_days', 'last_30_days', 'this_month', 'last_month', 'custom'],
          description: 'Time window for the report. Default is last_7_days.',
        },
        startDate: {
          type: 'string',
          description: 'YYYY-MM-DD starting date (only for custom period).',
        },
        endDate: {
          type: 'string',
          description: 'YYYY-MM-DD ending date (only for custom period).',
        },
      },
    },
  },
  validateArgs: (args: Record<string, unknown>) => {
    const period = (args.period as ReportPeriod) || 'last_7_days';
    const validPeriods = ['last_7_days', 'last_30_days', 'this_month', 'last_month', 'custom'];
    if (!validPeriods.includes(period)) {
      return { valid: false, errors: ['period must be one of: ' + validPeriods.join(', ')] };
    }
    return {
      valid: true,
      sanitized: {
        period,
        startDate: typeof args.startDate === 'string' ? args.startDate : undefined,
        endDate: typeof args.endDate === 'string' ? args.endDate : undefined,
      },
    };
  },
  execute: async (args: any, context: ToolContext): Promise<ToolResult> => {
    const periodResolution = resolvePeriodDates(
      args.period,
      context.clientDate,
      args.startDate,
      args.endDate
    );

    if (periodResolution.error) {
      return {
        data: { status: 'error', error: periodResolution.error },
      };
    }

    const { startDate, endDate } = periodResolution;

    const [finances, study, habitRecords] = await Promise.all([
      activeRepository.getFinanceTransactions(context.uid, startDate, endDate),
      activeRepository.getStudySessions(context.uid, startDate, endDate),
      activeRepository.getHabitLogs(context.uid, startDate, endDate),
    ]);

    const hasAnyData = finances.length > 0 || study.length > 0 || habitRecords.length > 0;
    if (!hasAnyData) {
      const notice = createNoticeBlock(
        'rep_notice_' + Date.now(),
        `No financial transactions, study sessions, or habit activity found between ${startDate} and ${endDate}.`,
        'info'
      );
      return {
        data: {
          status: 'no_data',
          period: args.period,
          startDate,
          endDate,
        },
        blocks: [notice],
      };
    }

    // Compute finance metrics
    let incomeTotal = 0;
    let expenseTotal = 0;
    let savingsAndInvestmentTotal = 0;
    const categoryExpenseMap = new Map<string, number>();

    for (const f of finances) {
      const amt = Number(f.amount) || 0;
      if (f.type === 'income') {
        incomeTotal += amt;
      } else if (f.type === 'expense') {
        expenseTotal += amt;
        const cat = f.category || 'General';
        categoryExpenseMap.set(cat, (categoryExpenseMap.get(cat) || 0) + amt);
      } else if (f.type === 'savings' || f.type === 'investment') {
        savingsAndInvestmentTotal += amt;
      }
    }

    const netSavings = incomeTotal - expenseTotal;

    // Top 5 expense categories
    const topCategories = Array.from(categoryExpenseMap.entries())
      .map(([cat, amount]) => ({
        category: sanitizeLabel(cat),
        amount,
        sharePct: expenseTotal > 0 ? Math.round((amount / expenseTotal) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Study metrics
    const totalStudyMinutes = study.reduce((acc, s) => acc + (Number(s.durationMinutes) || 0), 0);
    const studyHours = Math.round((totalStudyMinutes / 60) * 10) / 10;

    // Habit metrics
    const habitCompletions = habitRecords.filter(h => h.completed === 1).length;

    // Build Blocks
    const blocks: Block[] = [];

    // 1. Metrics Block
    blocks.push(
      createMetricsBlock('rep_metrics_' + Date.now(), [
        {
          label: 'Total Inflow',
          value: Math.round(incomeTotal),
          format: 'currency',
          tone: incomeTotal > 0 ? 'ok' : 'neutral',
        },
        {
          label: 'Total Expenses',
          value: Math.round(expenseTotal),
          format: 'currency',
          tone: expenseTotal > 0 ? 'warn' : 'neutral',
        },
        {
          label: 'Net Surplus',
          value: Math.round(netSavings),
          format: 'currency',
          tone: netSavings >= 0 ? 'ok' : 'danger',
        },
        {
          label: 'Savings & Invested',
          value: Math.round(savingsAndInvestmentTotal),
          format: 'currency',
          tone: 'neutral',
        },
        {
          label: 'Study Hours',
          value: studyHours,
          format: 'number',
          tone: 'ok',
        },
        {
          label: 'Habit Check-ins',
          value: habitCompletions,
          format: 'number',
          tone: 'ok',
        },
      ])
    );

    // 2. Bar chart of income vs expense
    const startObj = parseDate(startDate) || new Date();
    const endObj = parseDate(endDate) || new Date();
    const spanDays = Math.round((endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (spanDays > 31) {
      // Weekly buckets
      const buckets = createWeekBuckets(startDate, endDate);
      const chartData: Record<string, string | number>[] = [];

      for (const bucket of buckets) {
        let bIncome = 0;
        let bExpense = 0;
        for (const f of finances) {
          if (f.date >= bucket.startDate && f.date <= bucket.endDate) {
            const amt = Number(f.amount) || 0;
            if (f.type === 'income') bIncome += amt;
            if (f.type === 'expense') bExpense += amt;
          }
        }
        chartData.push({
          x: bucket.label,
          income: Math.round(bIncome),
          expenses: Math.round(bExpense),
        });
      }

      blocks.push(
        createChartBlock('rep_chart_weekly_' + Date.now(), {
          title: 'Income vs Expense (Weekly Buckets)',
          kind: 'bar',
          xFormat: 'category',
          yFormat: 'currency',
          series: [
            { key: 'income', label: 'Income', role: 'income' },
            { key: 'expenses', label: 'Expenses', role: 'expense' },
          ],
          data: chartData,
        })
      );
    } else {
      // Daily series zero-filled
      const dailyMap = new Map<string, { income: number; expenses: number }>();
      let c = new Date(startObj);
      while (c <= endObj) {
        dailyMap.set(formatDate(c), { income: 0, expenses: 0 });
        c = addDays(c, 1);
      }

      for (const f of finances) {
        const item = dailyMap.get(f.date);
        if (item) {
          const amt = Number(f.amount) || 0;
          if (f.type === 'income') item.income += amt;
          if (f.type === 'expense') item.expenses += amt;
        }
      }

      const chartData = Array.from(dailyMap.entries()).map(([dStr, val]) => ({
        x: dStr,
        income: Math.round(val.income),
        expenses: Math.round(val.expenses),
      }));

      blocks.push(
        createChartBlock('rep_chart_daily_' + Date.now(), {
          title: 'Daily Income vs Expenses',
          kind: 'bar',
          xFormat: 'date',
          yFormat: 'currency',
          series: [
            { key: 'income', label: 'Income', role: 'income' },
            { key: 'expenses', label: 'Expenses', role: 'expense' },
          ],
          data: chartData,
        })
      );
    }

    // 3. Category chart if expenses exist
    if (topCategories.length > 0) {
      blocks.push(
        createChartBlock('rep_chart_cat_' + Date.now(), {
          title: 'Top Expense Categories',
          kind: 'bar',
          xFormat: 'category',
          yFormat: 'currency',
          series: [{ key: 'amount', label: 'Amount', role: 'expense' }],
          data: topCategories.map(c => ({
            x: c.category,
            amount: Math.round(c.amount),
          })),
        })
      );
    }

    return {
      data: {
        status: 'ok',
        period: args.period,
        startDate,
        endDate,
        income: Math.round(incomeTotal),
        expenses: Math.round(expenseTotal),
        net: Math.round(netSavings),
        investmentAndSavings: Math.round(savingsAndInvestmentTotal),
        studyHours,
        habitCompletions,
        topExpenseCategories: topCategories,
      },
      blocks,
    };
  },
};

// ---------------- 2. list_entries ----------------
export const listEntriesTool: ToolDefinition = {
  declaration: {
    name: 'list_entries',
    description: 'Lists records from study, finance, habits, or goals with optional date and text filters.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        module: {
          type: 'string',
          enum: ['finance', 'study', 'habit', 'goal'],
          description: 'Module to query.',
        },
        type: {
          type: 'string',
          enum: ['income', 'expense', 'investment', 'savings'],
          description: 'Transaction type filter (finance module only).',
        },
        text: {
          type: 'string',
          description: 'Case-insensitive substring search in record titles or subjects (max 60 chars).',
        },
        startDate: {
          type: 'string',
          description: 'YYYY-MM-DD start date (defaults to clientDate for finance/study).',
        },
        endDate: {
          type: 'string',
          description: 'YYYY-MM-DD end date (defaults to clientDate for finance/study).',
        },
        limit: {
          type: 'integer',
          description: 'Maximum items to return (1 to 20, default 10).',
        },
      },
      required: ['module'],
    },
  },
  validateArgs: (args: Record<string, unknown>) => {
    const validModules = ['finance', 'study', 'habit', 'goal'];
    if (typeof args.module !== 'string' || !validModules.includes(args.module)) {
      return { valid: false, errors: ['module must be one of: ' + validModules.join(', ')] };
    }
    const limit = typeof args.limit === 'number' && args.limit > 0 ? Math.min(20, Math.floor(args.limit)) : 10;
    const text = typeof args.text === 'string' ? args.text.trim().slice(0, 60) : undefined;
    const type = typeof args.type === 'string' ? args.type : undefined;

    return {
      valid: true,
      sanitized: {
        module: args.module,
        type,
        text,
        startDate: typeof args.startDate === 'string' ? args.startDate : undefined,
        endDate: typeof args.endDate === 'string' ? args.endDate : undefined,
        limit,
      },
    };
  },
  execute: async (args: any, context: ToolContext): Promise<ToolResult> => {
    const { module, type, text, limit } = args;
    const startDate = args.startDate || context.clientDate;
    const endDate = args.endDate || context.clientDate;

    // Validate date constraints for date-scoped modules
    if (module === 'finance' || module === 'study') {
      const s = parseDate(startDate);
      const e = parseDate(endDate);
      const c = parseDate(context.clientDate);
      if (!s || !e || !c) {
        return { data: { status: 'error', error: 'Invalid dates provided.' } };
      }
      if (s > e) {
        return { data: { status: 'error', error: 'startDate cannot be after endDate.' } };
      }
      if (e > c) {
        return { data: { status: 'error', error: 'Date cannot be in the future.' } };
      }
      const span = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (span > 62) {
        return { data: { status: 'error', error: 'Date range cannot exceed 62 days.' } };
      }
    }

    const blocks: Block[] = [];
    const entriesToModel: any[] = [];
    const tableRows: Record<string, string | number>[] = [];

    if (module === 'finance') {
      const rows = await activeRepository.getFinanceTransactions(context.uid, startDate, endDate);
      let filtered = rows;
      if (type) {
        filtered = filtered.filter(f => f.type === type);
      }
      if (text) {
        const lower = text.toLowerCase();
        filtered = filtered.filter(f => f.title?.toLowerCase().includes(lower));
      }
      const sliced = filtered.slice(0, limit);

      for (const f of sliced) {
        const label = sanitizeLabel(f.title);
        entriesToModel.push({
          id: f.id,
          date: f.date,
          label,
          type: f.type,
          amount: f.amount,
        });
        tableRows.push({
          Date: f.date,
          Title: label,
          Category: sanitizeLabel(f.category),
          Type: f.type,
          Amount: f.amount,
        });
      }

      if (tableRows.length > 0) {
        blocks.push(
          createTableBlock(
            'list_fin_' + Date.now(),
            [
              { key: 'Date', label: 'Date', format: 'date' },
              { key: 'Title', label: 'Title', format: 'text' },
              { key: 'Category', label: 'Category', format: 'text' },
              { key: 'Type', label: 'Type', format: 'text' },
              { key: 'Amount', label: 'Amount', format: 'currency', align: 'right' },
            ],
            tableRows,
            'Finance Transactions'
          )
        );
      }
    } else if (module === 'study') {
      const rows = await activeRepository.getStudySessions(context.uid, startDate, endDate);
      let filtered = rows;
      if (text) {
        const lower = text.toLowerCase();
        filtered = filtered.filter(s => s.subject?.toLowerCase().includes(lower) || s.topic?.toLowerCase().includes(lower));
      }
      const sliced = filtered.slice(0, limit);

      for (const s of sliced) {
        const label = sanitizeLabel(`${s.subject}: ${s.topic}`);
        entriesToModel.push({
          id: s.id,
          date: s.date,
          label,
          duration: s.durationMinutes,
        });
        tableRows.push({
          Date: s.date,
          Subject: sanitizeLabel(s.subject),
          Topic: sanitizeLabel(s.topic),
          'Duration (m)': s.durationMinutes,
          Focus: s.focusScore,
        });
      }

      if (tableRows.length > 0) {
        blocks.push(
          createTableBlock(
            'list_std_' + Date.now(),
            [
              { key: 'Date', label: 'Date', format: 'date' },
              { key: 'Subject', label: 'Subject', format: 'text' },
              { key: 'Topic', label: 'Topic', format: 'text' },
              { key: 'Duration (m)', label: 'Duration (m)', format: 'number', align: 'right' },
              { key: 'Focus', label: 'Focus (1-10)', format: 'number', align: 'right' },
            ],
            tableRows,
            'Study Sessions'
          )
        );
      }
    } else if (module === 'habit') {
      const rows = await activeRepository.getHabits(context.uid);
      let filtered = rows;
      if (text) {
        const lower = text.toLowerCase();
        filtered = filtered.filter(h => h.name?.toLowerCase().includes(lower));
      }
      const sliced = filtered.slice(0, limit);

      for (const h of sliced) {
        const label = sanitizeLabel(h.name);
        entriesToModel.push({
          id: h.id,
          label,
          currentStreak: h.currentStreak,
        });
        tableRows.push({
          Name: label,
          Category: sanitizeLabel(h.category),
          Frequency: h.frequency,
          Streak: h.currentStreak,
        });
      }

      if (tableRows.length > 0) {
        blocks.push(
          createTableBlock(
            'list_hab_' + Date.now(),
            [
              { key: 'Name', label: 'Habit Name', format: 'text' },
              { key: 'Category', label: 'Category', format: 'text' },
              { key: 'Frequency', label: 'Frequency', format: 'text' },
              { key: 'Streak', label: 'Current Streak', format: 'number', align: 'right' },
            ],
            tableRows,
            'Habits'
          )
        );
      }
    } else if (module === 'goal') {
      const rows = await activeRepository.getGoals(context.uid);
      let filtered = rows;
      if (text) {
        const lower = text.toLowerCase();
        filtered = filtered.filter(g => g.title?.toLowerCase().includes(lower));
      }
      const sliced = filtered.slice(0, limit);

      for (const g of sliced) {
        const label = sanitizeLabel(g.title);
        entriesToModel.push({
          id: g.id,
          label,
          targetValue: g.targetValue,
          currentValue: g.currentValue,
        });
        tableRows.push({
          Title: label,
          Module: g.module,
          Progress: `${g.currentValue}/${g.targetValue} ${g.unit || ''}`,
          Deadline: g.deadline,
        });
      }

      if (tableRows.length > 0) {
        blocks.push(
          createTableBlock(
            'list_goal_' + Date.now(),
            [
              { key: 'Title', label: 'Goal Title', format: 'text' },
              { key: 'Module', label: 'Module', format: 'text' },
              { key: 'Progress', label: 'Progress', format: 'text' },
              { key: 'Deadline', label: 'Deadline', format: 'date' },
            ],
            tableRows,
            'Goals'
          )
        );
      }
    }

    if (tableRows.length === 0) {
      blocks.push(
        createNoticeBlock(
          'list_empty_' + Date.now(),
          `No matching ${module} entries found.`,
          'info'
        )
      );
    }

    return {
      data: {
        status: 'ok',
        count: entriesToModel.length,
        truncated: false,
        entries: entriesToModel,
      },
      blocks,
    };
  },
};

// ---------------- 3. get_forecast ----------------
export const getForecastTool: ToolDefinition = {
  declaration: {
    name: 'get_forecast',
    description: 'Forecasts expenses, income, savings, or net finances over a time horizon using user history.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        series: {
          type: 'string',
          enum: ['expenses', 'income', 'savings', 'finances'],
          description: 'The series to forecast. Default is finances.',
        },
        horizonDays: {
          type: 'integer',
          description: 'Forecast horizon in days (1 to 90, default 30).',
        },
      },
    },
  },
  validateArgs: (args: Record<string, unknown>) => {
    const validSeries = ['expenses', 'income', 'savings', 'finances'];
    const series = (args.series as ForecastSeriesType) || 'finances';
    if (!validSeries.includes(series)) {
      return { valid: false, errors: ['series must be one of: ' + validSeries.join(', ')] };
    }
    const horizonDays =
      typeof args.horizonDays === 'number' && args.horizonDays > 0
        ? Math.min(90, Math.max(1, Math.floor(args.horizonDays)))
        : 30;

    return {
      valid: true,
      sanitized: { series, horizonDays },
    };
  },
  execute: async (args: any, context: ToolContext): Promise<ToolResult> => {
    const { series, horizonDays } = args;

    // Fetch user's financial transactions
    const rawTransactions = await activeRepository.getFinanceTransactions(context.uid);
    const txs: FinanceTx[] = rawTransactions.map(t => ({
      date: t.date,
      type: t.type,
      amount: Number(t.amount) || 0,
    }));

    const blocks: Block[] = [];

    if (series === 'finances') {
      const forecast = computeFinancesForecast(txs, horizonDays, context.clientDate);

      if (forecast.status === 'insufficient_data') {
        const notice = createNoticeBlock(
          'fc_notice_' + Date.now(),
          forecast.note || 'Insufficient financial history to compute reliable forecasts (at least 14 active days required).',
          'warn'
        );
        return {
          data: {
            status: 'insufficient_data',
            series: 'finances',
            note: forecast.note,
          },
          blocks: [notice],
        };
      }

      // If both income and expenses available
      if (forecast.incomeResult?.status === 'ok' && forecast.expenseResult?.status === 'ok') {
        const inc = forecast.incomeResult;
        const exp = forecast.expenseResult;
        const net = forecast.netPredicted || 0;

        blocks.push(
          createMetricsBlock('fc_metrics_' + Date.now(), [
            {
              label: 'Expected Income',
              value: inc.predictedTotal || 0,
              format: 'currency',
              tone: 'ok',
            },
            {
              label: 'Expected Expenses',
              value: exp.predictedTotal || 0,
              format: 'currency',
              tone: 'danger',
            },
            {
              label: 'Projected Net',
              value: net,
              format: 'currency',
              tone: net >= 0 ? 'ok' : 'danger',
            },
          ])
        );

        // Chart with 2 lines, no band
        const chartData = (exp.dailyPoints || []).map((p, idx) => {
          const incPt = inc.dailyPoints?.[idx];
          return {
            x: p.date,
            income: incPt ? incPt.predicted : 0,
            expense: p.predicted,
          };
        });

        blocks.push(
          createChartBlock('fc_chart_fin_' + Date.now(), {
            title: `Finances Forecast (${horizonDays} Days)`,
            subtitle: `Projected Net: ₹${net.toLocaleString('en-IN')} · Reliability: ${forecast.reliability}`,
            kind: 'line',
            xFormat: 'date',
            yFormat: 'currency',
            series: [
              { key: 'income', label: 'Expected Income', role: 'income' },
              { key: 'expense', label: 'Expected Expense', role: 'expense' },
            ],
            data: chartData,
          })
        );

        return {
          data: {
            status: 'ok',
            series: 'finances',
            reliability: forecast.reliability,
            horizonDays,
            expectedIncome: inc.predictedTotal,
            expectedExpenses: exp.predictedTotal,
            projectedNet: net,
          },
          blocks,
        };
      }

      // Only one was available
      const single = forecast.incomeResult?.status === 'ok' ? forecast.incomeResult : forecast.expenseResult!;
      const isInc = single.series === 'income';

      if (forecast.note) {
        blocks.push(createNoticeBlock('fc_note_' + Date.now(), forecast.note, 'info'));
      }

      blocks.push(
        createMetricsBlock('fc_metrics_single_' + Date.now(), [
          {
            label: isInc ? 'Expected Income' : 'Expected Expenses',
            value: single.predictedTotal || 0,
            format: 'currency',
            tone: isInc ? 'ok' : 'danger',
          },
          {
            label: 'Daily Average',
            value: single.dailyAverage || 0,
            format: 'currency',
            tone: 'neutral',
          },
          {
            label: 'Trailing Actual',
            value: single.trailingActualTotal || 0,
            format: 'currency',
            tone: 'neutral',
          },
        ])
      );

      blocks.push(
        createChartBlock('fc_chart_single_' + Date.now(), {
          title: `${isInc ? 'Income' : 'Expense'} Forecast (${horizonDays} Days)`,
          subtitle: `Reliability: ${single.reliability}`,
          kind: 'line',
          xFormat: 'date',
          yFormat: 'currency',
          series: [{ key: 'predicted', label: 'Predicted', role: isInc ? 'income' : 'expense' }],
          band: { lowerKey: 'lower', upperKey: 'upper' },
          data: (single.dailyPoints || []).map(p => ({
            x: p.date,
            predicted: p.predicted,
            lower: p.lower,
            upper: p.upper,
          })),
        })
      );

      return {
        data: {
          status: 'ok',
          series: 'finances',
          note: forecast.note,
          availableSeries: single.series,
          reliability: single.reliability,
          horizonDays,
          predictedTotal: single.predictedTotal,
        },
        blocks,
      };
    }

    // Single series: expenses | income | savings
    const forecast = computeSingleForecast(txs, series, horizonDays, context.clientDate);

    if (forecast.status === 'insufficient_data') {
      const notice = createNoticeBlock(
        'fc_insuf_' + Date.now(),
        `Insufficient transaction history for ${series} (${forecast.activeDays} active days logged; at least 14 required for statistical estimation).`,
        'warn'
      );
      return {
        data: {
          status: 'insufficient_data',
          series,
          activeDays: forecast.activeDays,
          requiredDays: 14,
        },
        blocks: [notice],
      };
    }

    blocks.push(
      createMetricsBlock('fc_metrics_' + Date.now(), [
        {
          label: `Predicted ${series[0].toUpperCase() + series.slice(1)}`,
          value: forecast.predictedTotal || 0,
          format: 'currency',
          tone: series === 'income' ? 'ok' : series === 'expenses' ? 'danger' : 'neutral',
        },
        {
          label: 'Daily Average',
          value: forecast.dailyAverage || 0,
          format: 'currency',
          tone: 'neutral',
        },
        {
          label: `Trailing ${horizonDays}d Actual`,
          value: forecast.trailingActualTotal || 0,
          format: 'currency',
          tone: 'neutral',
        },
      ])
    );

    blocks.push(
      createChartBlock('fc_chart_' + Date.now(), {
        title: `${series[0].toUpperCase() + series.slice(1)} Forecast (${horizonDays} Days)`,
        subtitle: `Reliability: ${forecast.reliability} · Active Days: ${forecast.activeDays}`,
        kind: 'line',
        xFormat: 'date',
        yFormat: 'currency',
        series: [
          {
            key: 'predicted',
            label: 'Forecast',
            role: series === 'income' ? 'income' : series === 'expenses' ? 'expense' : 'savings',
          },
        ],
        band: { lowerKey: 'lower', upperKey: 'upper' },
        data: (forecast.dailyPoints || []).map(p => ({
          x: p.date,
          predicted: p.predicted,
          lower: p.lower,
          upper: p.upper,
        })),
      })
    );

    return {
      data: {
        status: 'ok',
        series,
        reliability: forecast.reliability,
        activeDays: forecast.activeDays,
        horizonDays,
        predictedTotal: forecast.predictedTotal,
        dailyAverage: forecast.dailyAverage,
        trailingActualTotal: forecast.trailingActualTotal,
      },
      blocks,
    };
  },
};
