import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReportTool,
  listEntriesTool,
  getForecastTool,
  setAssistantRepository,
  AssistantRepository,
  resetAssistantRepository,
} from './tools/read.ts';
import { ToolContext, TableBlock, ChartBlock, MetricsBlock, NoticeBlock } from './types.ts';

class StubRepository implements AssistantRepository {
  public finances: any[] = [];
  public study: any[] = [];
  public habits: any[] = [];
  public habitLogs: any[] = [];
  public goals: any[] = [];

  async getFinanceTransactions(uid: string, startDate?: string, endDate?: string) {
    return this.finances.filter(f => {
      if (startDate && f.date < startDate) return false;
      if (endDate && f.date > endDate) return false;
      return true;
    });
  }

  async getStudySessions(uid: string, startDate?: string, endDate?: string) {
    return this.study.filter(s => {
      if (startDate && s.date < startDate) return false;
      if (endDate && s.date > endDate) return false;
      return true;
    });
  }

  async getHabits() {
    return this.habits;
  }

  async getHabitLogs(uid: string, startDate?: string, endDate?: string) {
    return this.habitLogs.filter(h => {
      if (startDate && h.date < startDate) return false;
      if (endDate && h.date > endDate) return false;
      return true;
    });
  }

  async getGoals() {
    return this.goals;
  }
}

describe('Read Tools (read.ts)', () => {
  let stubRepo: StubRepository;
  const context: ToolContext = {
    uid: 'user_123',
    authenticated: true,
    clientDate: '2026-10-10',
  };

  beforeEach(() => {
    stubRepo = new StubRepository();
    setAssistantRepository(stubRepo);
  });

  describe('build_report', () => {
    it('returns single notice block if no data exists in range', async () => {
      const res = await buildReportTool.execute({ period: 'last_7_days' }, context);
      assert.equal(res.data.status, 'no_data');
      assert.equal(res.blocks?.length, 1);
      assert.equal(res.blocks?.[0].type, 'notice');
    });

    it('computes metrics and daily zero-filled chart for spans <= 31 days', async () => {
      stubRepo.finances = [
        { id: 1, type: 'income', category: 'Salary', amount: 50000, date: '2026-10-08' },
        { id: 2, type: 'expense', category: 'Food', amount: 1200, date: '2026-10-09' },
        { id: 3, type: 'expense', category: 'Food', amount: 800, date: '2026-10-10' },
        { id: 4, type: 'investment', category: 'Mutual Funds', amount: 5000, date: '2026-10-10' },
      ];
      stubRepo.study = [
        { id: 1, subject: 'ML', topic: 'Ridge', durationMinutes: 120, focusScore: 8, date: '2026-10-09' },
      ];
      stubRepo.habitLogs = [
        { id: 1, completed: 1, date: '2026-10-09' },
        { id: 2, completed: 1, date: '2026-10-10' },
      ];

      const res = await buildReportTool.execute({ period: 'last_7_days' }, context);
      assert.equal(res.data.status, 'ok');
      assert.equal(res.data.income, 50000);
      assert.equal(res.data.expenses, 2000);
      assert.equal(res.data.net, 48000);
      assert.equal(res.data.investmentAndSavings, 5000);
      assert.equal(res.data.studyHours, 2);
      assert.equal(res.data.habitCompletions, 2);

      // Verify blocks
      assert.ok(res.blocks && res.blocks.length >= 2);
      const metricsBlock = res.blocks[0] as MetricsBlock;
      assert.equal(metricsBlock.type, 'metrics');

      const chartBlock = res.blocks[1] as ChartBlock;
      assert.equal(chartBlock.type, 'chart');
      assert.equal(chartBlock.xFormat, 'date');
      // 7 days in last_7_days span
      assert.equal(chartBlock.data.length, 7);
    });

    it('buckets by week when span exceeds 31 days', async () => {
      stubRepo.finances = [
        { id: 1, type: 'expense', category: 'Food', amount: 500, date: '2026-09-01' },
      ];

      const res = await buildReportTool.execute(
        { period: 'custom', startDate: '2026-08-15', endDate: '2026-10-01' },
        context
      );
      assert.equal(res.data.status, 'ok');

      const chartBlock = res.blocks?.find(b => b.type === 'chart') as ChartBlock;
      assert.ok(chartBlock);
      assert.equal(chartBlock.xFormat, 'category');
      assert.match(chartBlock.title, /weekly/i);
    });
  });

  describe('list_entries', () => {
    it('returns table block without id column', async () => {
      stubRepo.finances = [
        { id: 101, title: 'Laptop Charger', category: 'Tech', type: 'expense', amount: 1500, date: '2026-10-10' },
      ];

      const res = await listEntriesTool.execute(
        { module: 'finance', startDate: '2026-10-10', endDate: '2026-10-10' },
        context
      );

      assert.equal(res.data.status, 'ok');
      assert.equal(res.data.count, 1);
      // Model receives id
      assert.equal((res.data.entries as any[])[0].id, 101);

      // Client table block must NOT have an id column
      const tableBlock = res.blocks?.find(b => b.type === 'table') as TableBlock;
      assert.ok(tableBlock);
      const idCol = tableBlock.columns.find(c => c.key.toLowerCase() === 'id');
      assert.equal(idCol, undefined, 'Table block must not expose an ID column');
    });

    it('filters by search text substring', async () => {
      stubRepo.study = [
        { id: 1, subject: 'Machine Learning', topic: 'Optimization', durationMinutes: 60, focusScore: 9, date: '2026-10-10' },
        { id: 2, subject: 'Calculus', topic: 'Derivatives', durationMinutes: 45, focusScore: 7, date: '2026-10-10' },
      ];

      const res = await listEntriesTool.execute(
        { module: 'study', text: 'machine', startDate: '2026-10-10', endDate: '2026-10-10' },
        context
      );

      assert.equal(res.data.count, 1);
      assert.match((res.data.entries as any[])[0].label, /Machine Learning/);
    });

    it('rejects dates in the future or spans > 62 days', async () => {
      const resFuture = await listEntriesTool.execute(
        { module: 'finance', startDate: '2026-10-10', endDate: '2026-10-15' },
        context
      );
      assert.equal(resFuture.data.status, 'error');
      assert.match(String(resFuture.data.error), /future/i);

      const resWide = await listEntriesTool.execute(
        { module: 'finance', startDate: '2026-06-01', endDate: '2026-10-01' },
        context
      );
      assert.equal(resWide.data.status, 'error');
      assert.match(String(resWide.data.error), /62 days/i);
    });
  });

  describe('get_forecast', () => {
    it('returns insufficient_data notice if transactions < 14 distinct days', async () => {
      stubRepo.finances = [
        { id: 1, type: 'expense', amount: 500, date: '2026-10-01' },
        { id: 2, type: 'expense', amount: 500, date: '2026-10-02' },
      ];

      const res = await getForecastTool.execute({ series: 'expenses', horizonDays: 30 }, context);
      assert.equal(res.data.status, 'insufficient_data');
      assert.equal(res.blocks?.length, 1);
      assert.equal(res.blocks?.[0].type, 'notice');
    });
  });
});
