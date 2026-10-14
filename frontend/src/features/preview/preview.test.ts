import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveAppMode, AuthStateForAppMode } from './resolveAppMode.ts';
import {
  getTabLabel,
  formatTabAuthReason,
  formatShortcutAuthReason,
  formatCardAuthReason,
  formatChartLinkAuthReason,
  requestAuthAction,
  closeAuthModalAction,
  consumeIntendedTabAction,
  INITIAL_AUTH_GATE_STATE,
} from './authGate.ts';
import {
  PREVIEW_METRICS,
  PREVIEW_RECENT_STUDY,
  PREVIEW_RECENT_FINANCE,
  PREVIEW_HABITS,
  PREVIEW_GOALS,
  PREVIEW_DASHBOARD_DATA,
} from './previewData.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('1. resolveAppMode pure logic', () => {
  it('returns "booting" while loading is true regardless of user or registration status', () => {
    // Case A: loading with no user
    const stateA: AuthStateForAppMode = { loading: true, user: null, isRegistered: false };
    assert.equal(resolveAppMode(stateA), 'booting');

    // Case B: loading with signed-in & registered user (MUST NOT flash preview)
    const stateB: AuthStateForAppMode = { loading: true, user: { uid: 'u1' }, isRegistered: true };
    assert.equal(resolveAppMode(stateB), 'booting');

    // Case C: loading with signed-in but unregistered user
    const stateC: AuthStateForAppMode = { loading: true, user: { uid: 'u2' }, isRegistered: false };
    assert.equal(resolveAppMode(stateC), 'booting');
  });

  it('returns "locked-preview" when signed out (user is null, not loading)', () => {
    const state: AuthStateForAppMode = { loading: false, user: null, isRegistered: false };
    assert.equal(resolveAppMode(state), 'locked-preview');
  });

  it('returns "locked-preview" when signed in with Firebase but not registered in PostgreSQL', () => {
    const state: AuthStateForAppMode = {
      loading: false,
      user: { uid: 'unregistered_123', email: 'guest@example.com' },
      isRegistered: false,
    };
    assert.equal(resolveAppMode(state), 'locked-preview');
  });

  it('returns "app" ONLY when signed in and verified registered', () => {
    const state: AuthStateForAppMode = {
      loading: false,
      user: { uid: 'reg_456', email: 'registered@example.com' },
      isRegistered: true,
    };
    assert.equal(resolveAppMode(state), 'app');
  });

  it('defensively returns "locked-preview" if isRegistered is true but user object is missing', () => {
    const state: AuthStateForAppMode = { loading: false, user: null, isRegistered: true };
    assert.equal(resolveAppMode(state), 'locked-preview');
  });
});

describe('2. Auth Gate pure intent mapping & state transitions', () => {
  it('maps each active tab to its human-readable label and auth reason', () => {
    assert.equal(getTabLabel('dashboard'), 'Dashboard');
    assert.equal(getTabLabel('forecasting'), 'Forecasting (ML)');
    assert.equal(getTabLabel('simulation'), 'Simulation');
    assert.equal(getTabLabel('study'), 'Study');
    assert.equal(getTabLabel('finance'), 'Finance (Money)');
    assert.equal(getTabLabel('habits'), 'Habits');
    assert.equal(getTabLabel('goals'), 'Goals');
    assert.equal(getTabLabel('assistant'), 'AI Assistant');

    assert.equal(formatTabAuthReason('forecasting'), 'Sign in to use Forecasting (ML)');
    assert.equal(formatTabAuthReason('simulation'), 'Sign in to use Simulation');
    assert.equal(formatTabAuthReason('study'), 'Sign in to use Study');
    assert.equal(formatTabAuthReason('finance'), 'Sign in to use Finance (Money)');
    assert.equal(formatTabAuthReason('assistant'), 'Sign in to use AI Assistant');
  });

  it('maps hero shortcuts to context reasons', () => {
    assert.equal(formatShortcutAuthReason('forecasting'), 'Sign in to use Forecasting (ML)');
    assert.equal(formatShortcutAuthReason('simulation'), 'Sign in to use What-If Simulation');
    assert.equal(formatShortcutAuthReason('assistant'), 'Sign in to use AI Assistant');
    assert.equal(formatShortcutAuthReason('quick-log'), 'Sign in to log new activity');
  });

  it('maps cards and chart links to context reasons', () => {
    assert.equal(formatCardAuthReason('study'), 'Sign in to access Study & Learning');
    assert.equal(formatCardAuthReason('finance'), 'Sign in to access Finance & Money');
    assert.equal(formatChartLinkAuthReason('study'), 'Sign in to view Study Log');
    assert.equal(formatChartLinkAuthReason('finance'), 'Sign in to view Ledger');
  });

  it('opens modal, stores context reason, and retains intended tab on requestAuthAction', () => {
    const s0 = INITIAL_AUTH_GATE_STATE;
    assert.equal(s0.isModalOpen, false);
    assert.equal(s0.intendedTab, null);

    const s1 = requestAuthAction(s0, {
      reason: 'Sign in to use Forecasting (ML)',
      intendedTab: 'forecasting',
      initialMode: 'login',
    });

    assert.equal(s1.isModalOpen, true);
    assert.equal(s1.contextReason, 'Sign in to use Forecasting (ML)');
    assert.equal(s1.intendedTab, 'forecasting');
    assert.equal(s1.initialMode, 'login');
  });

  it('opens modal directly on register tab when requested', () => {
    const s0 = INITIAL_AUTH_GATE_STATE;
    const s1 = requestAuthAction(s0, {
      reason: 'Create a free account to track your life data',
      initialMode: 'register',
    });

    assert.equal(s1.isModalOpen, true);
    assert.equal(s1.initialMode, 'register');
  });

  it('clears pending intent and context when closing modal (Section 1 & 6 requirement)', () => {
    const s0 = requestAuthAction(INITIAL_AUTH_GATE_STATE, {
      reason: 'Sign in to use Forecasting (ML)',
      intendedTab: 'forecasting',
    });
    assert.equal(s0.isModalOpen, true);
    assert.equal(s0.intendedTab, 'forecasting');

    const sClosed = closeAuthModalAction(s0);
    assert.equal(sClosed.isModalOpen, false);
    assert.equal(sClosed.contextReason, '');
    assert.equal(sClosed.intendedTab, null);
    assert.equal(sClosed.initialMode, 'login');
  });

  it('consumes intended tab on successful login redirect and resets intent', () => {
    const sOpen = requestAuthAction(INITIAL_AUTH_GATE_STATE, {
      reason: 'Sign in to use Simulation',
      intendedTab: 'simulation',
    });

    const { targetTab, nextState } = consumeIntendedTabAction(sOpen);
    assert.equal(targetTab, 'simulation');
    assert.equal(nextState.intendedTab, null);

    // Default fallback when no tab was explicitly selected
    const sNoTab = requestAuthAction(INITIAL_AUTH_GATE_STATE, {});
    const resNoTab = consumeIntendedTabAction(sNoTab);
    assert.equal(resNoTab.targetTab, 'dashboard');
  });
});

describe('3. Preview Fixtures Invariant Guarantees', () => {
  it('satisfies dashboard metrics invariants (valid percentages, positive numbers, no NaN)', () => {
    const m = PREVIEW_METRICS;
    assert.ok(m.synergyIndex >= 0 && m.synergyIndex <= 100, 'synergyIndex must be between 0 and 100');
    assert.ok(m.finance.savingsRate >= 0 && m.finance.savingsRate <= 100, 'savingsRate must be between 0 and 100');
    assert.ok(m.study.totalHours > 0, 'study totalHours must be > 0');
    assert.ok(m.study.avgFocus >= 1 && m.study.avgFocus <= 10, 'avgFocus must be between 1 and 10');
    assert.ok(m.finance.totalIncome > 0, 'totalIncome must be > 0');
    assert.ok(m.finance.totalExpenses > 0, 'totalExpenses must be > 0');
    assert.ok(m.habits.maxStreak > 0, 'maxStreak must be > 0');
    assert.ok(m.goals.total > 0, 'goals total must be > 0');

    // NaN verification
    assert.equal(Number.isNaN(m.synergyIndex), false);
    assert.equal(Number.isNaN(m.finance.netSavings), false);
    assert.equal(Number.isNaN(m.finance.savingsRate), false);
    assert.equal(Number.isNaN(m.study.totalHours), false);
  });

  it('satisfies study session invariants (positive durations, valid focus scores, non-empty subjects)', () => {
    assert.ok(PREVIEW_RECENT_STUDY.length >= 5, 'must have at least 5 study sessions');
    for (const s of PREVIEW_RECENT_STUDY) {
      assert.ok(s.durationMinutes > 0, `durationMinutes must be positive, got ${s.durationMinutes}`);
      assert.ok(s.focusScore >= 1 && s.focusScore <= 10, `focusScore in 1..10, got ${s.focusScore}`);
      assert.ok(s.subject.trim().length > 0, 'subject must not be empty');
      assert.equal(Number.isNaN(s.durationMinutes), false);
    }
  });

  it('satisfies finance transaction invariants (positive amounts, valid categories)', () => {
    assert.ok(PREVIEW_RECENT_FINANCE.length >= 3, 'must have at least 3 finance transactions');
    for (const f of PREVIEW_RECENT_FINANCE) {
      assert.ok(f.amount > 0, `amount must be positive, got ${f.amount}`);
      assert.ok(['income', 'expense', 'investment', 'savings'].includes(f.type));
      assert.ok(f.title.trim().length > 0);
      assert.equal(Number.isNaN(f.amount), false);
    }
  });

  it('satisfies habit streaks invariants (non-negative streaks)', () => {
    assert.ok(PREVIEW_HABITS.length >= 3);
    for (const h of PREVIEW_HABITS) {
      assert.ok(h.currentStreak >= 0);
      assert.ok(h.longestStreak >= h.currentStreak);
      assert.ok(h.name.trim().length > 0);
    }
  });

  it('satisfies goal invariants (positive targetValue, valid progress ratio)', () => {
    assert.ok(PREVIEW_GOALS.length >= 3);
    for (const g of PREVIEW_GOALS) {
      assert.ok(g.targetValue > 0);
      assert.ok(g.currentValue >= 0);
      assert.ok(g.title.trim().length > 0);
      const ratio = g.currentValue / g.targetValue;
      assert.equal(Number.isNaN(ratio), false);
    }
  });

  it('contains neutral values and strictly NO real user names or emails', () => {
    const rawJson = JSON.stringify(PREVIEW_DASHBOARD_DATA);
    assert.equal(/@example\.com|@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i.test(rawJson), false, 'No emails allowed in preview');
    assert.equal(rawJson.includes('Anshuman'), false, 'No real personal names allowed');
  });

  it('enforces import boundary: no module under authenticated app imports previewData fixtures', () => {
    const srcDir = path.resolve(__dirname, '../../');
    const authAppDirs = ['features/study', 'features/finance', 'features/habits', 'features/goals', 'features/forecasting', 'features/simulation'];

    for (const relDir of authAppDirs) {
      const fullDir = path.join(srcDir, relDir);
      if (!fs.existsSync(fullDir)) continue;

      const files = fs.readdirSync(fullDir, { recursive: true }) as string[];
      for (const file of files) {
        if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
        const filePath = path.join(fullDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        assert.equal(
          content.includes('previewData') || content.includes('PREVIEW_'),
          false,
          `Authenticated app module ${file} must NEVER import preview fixtures`
        );
      }
    }
  });
});
