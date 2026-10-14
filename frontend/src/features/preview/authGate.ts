import { ActiveTab } from '../../components/Navbar.tsx';

export interface RequestAuthOptions {
  reason?: string;
  intendedTab?: ActiveTab;
  initialMode?: 'login' | 'register';
}

export interface AuthGateState {
  isModalOpen: boolean;
  contextReason: string;
  intendedTab: ActiveTab | null;
  initialMode: 'login' | 'register';
}

export const INITIAL_AUTH_GATE_STATE: AuthGateState = {
  isModalOpen: false,
  contextReason: '',
  intendedTab: null,
  initialMode: 'login',
};

/**
 * Returns a human-friendly display label for any navigation tab.
 */
export function getTabLabel(tab: ActiveTab): string {
  switch (tab) {
    case 'dashboard':
      return 'Dashboard';
    case 'study':
      return 'Study';
    case 'finance':
      return 'Finance (Money)';
    case 'habits':
      return 'Habits';
    case 'goals':
      return 'Goals';
    case 'forecasting':
      return 'Forecasting (ML)';
    case 'simulation':
      return 'Simulation';
    case 'assistant':
      return 'AI Assistant';
    default:
      return 'OmniLife';
  }
}

/**
 * Formats a short context line explaining what action requires authentication.
 */
export function formatTabAuthReason(tab: ActiveTab): string {
  return `Sign in to use ${getTabLabel(tab)}`;
}

export function formatShortcutAuthReason(
  shortcut: 'forecasting' | 'simulation' | 'assistant' | 'quick-log'
): string {
  switch (shortcut) {
    case 'forecasting':
      return 'Sign in to use Forecasting (ML)';
    case 'simulation':
      return 'Sign in to use What-If Simulation';
    case 'assistant':
      return 'Sign in to use AI Assistant';
    case 'quick-log':
      return 'Sign in to log new activity';
    default:
      return 'Sign in to unlock all features';
  }
}

export function formatCardAuthReason(card: 'study' | 'finance' | 'habits' | 'goals'): string {
  switch (card) {
    case 'study':
      return 'Sign in to access Study & Learning';
    case 'finance':
      return 'Sign in to access Finance & Money';
    case 'habits':
      return 'Sign in to access Habits & Streaks';
    case 'goals':
      return 'Sign in to access Target Goals';
  }
}

export function formatChartLinkAuthReason(chart: 'study' | 'finance' | 'habits' | 'goals'): string {
  switch (chart) {
    case 'study':
      return 'Sign in to view Study Log';
    case 'finance':
      return 'Sign in to view Ledger';
    case 'habits':
      return 'Sign in to open Habits';
    case 'goals':
      return 'Sign in to manage Goals';
  }
}

/**
 * Pure state transition functions for the Auth Gate.
 */
export function requestAuthAction(
  state: AuthGateState,
  options?: RequestAuthOptions
): AuthGateState {
  return {
    isModalOpen: true,
    contextReason: options?.reason || 'Sign in to unlock all features',
    intendedTab: options?.intendedTab !== undefined ? options.intendedTab : state.intendedTab,
    initialMode: options?.initialMode || 'login',
  };
}

export function closeAuthModalAction(_state: AuthGateState): AuthGateState {
  // Section 1 & 6 requirement: closing the modal clears pending intent
  return {
    isModalOpen: false,
    contextReason: '',
    intendedTab: null,
    initialMode: 'login',
  };
}

export function consumeIntendedTabAction(
  state: AuthGateState
): { targetTab: ActiveTab; nextState: AuthGateState } {
  const targetTab = state.intendedTab || 'dashboard';
  return {
    targetTab,
    nextState: {
      ...state,
      intendedTab: null,
    },
  };
}
