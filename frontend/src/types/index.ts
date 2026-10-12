export interface StudySession {
  id: number;
  userId: string;
  subject: string;
  topic: string;
  durationMinutes: number;
  technique: string;
  focusScore: number;
  energyScore: number;
  date: string;
  notes?: string;
  createdAt?: string;
}

export interface FinanceTransaction {
  id: number;
  userId: string;
  title: string;
  type: 'income' | 'expense' | 'investment' | 'savings';
  category: string;
  amount: number;
  paymentMethod: string;
  date: string;
  notes?: string;
  createdAt?: string;
}

export interface Habit {
  id: number;
  userId: string;
  name: string;
  category: string;
  frequency: string;
  targetDaysPerWeek: number;
  currentStreak: number;
  longestStreak: number;
  color: string;
  icon: string;
  createdAt?: string;
}

export interface HabitLog {
  id: number;
  habitId: number;
  userId: string;
  date: string;
  completed: number;
  moodScore: number;
  durationMinutes: number;
  notes?: string;
}

export interface GoalMilestone {
  id: number;
  text: string;
  done: boolean;
}

export interface Goal {
  id: number;
  userId: string;
  title: string;
  module: 'study' | 'finance' | 'habits' | 'career' | 'personal';
  targetValue: number;
  currentValue: number;
  unit: string;
  deadline: string;
  milestones: string | GoalMilestone[];
  status: 'in_progress' | 'achieved' | 'paused';
  createdAt?: string;
}

export interface ForecastModelResult {
  dataset_type: string;
  record_count: number;
  features: string[];
  target: string;
  r2_score: number;
  mae: number;
  mse: number;
  weights: number[];
  intercept: number;
  feature_importances: Record<string, number>;
  sample_preview: any[];
  forecast_series: {
    horizon_days: number;
    projected_value: number;
    confidence_lower: number;
    confidence_upper: number;
  }[];
}

export interface SimulationResult {
  scenario: string;
  risk_score: number;
  risk_level: 'Low' | 'Moderate' | 'High';
  velocity_ratio?: number;
  surplus_10y?: number;
  projected_chart: {
    months?: number[];
    years?: number[];
    weeks?: number[];
    simulated: number[];
    baseline: number[];
  };
  recommendations: string[];
}

export interface SavedScenario {
  id: number;
  userId: string;
  name: string;
  category: string;
  parameters: string;
  projections: string;
  riskScore: number;
  recommendations: string;
  createdAt: string;
}

export interface DashboardMetrics {
  study: {
    totalHours: number;
    sessionsCount: number;
    avgFocus: number;
  };
  finance: {
    totalIncome: number;
    totalExpenses: number;
    totalInvested: number;
    netSavings: number;
    savingsRate: number;
  };
  habits: {
    activeCount: number;
    maxStreak: number;
  };
  goals: {
    total: number;
    inProgress: number;
    achieved: number;
  };
  synergyIndex: number;
}
