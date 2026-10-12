import { relations } from 'drizzle-orm';
import { doublePrecision, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Users table linked to Firebase Auth UID
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Study module sessions
export const studySessions = pgTable('study_sessions', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  subject: text('subject').notNull(),
  topic: text('topic').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  technique: text('technique').notNull(), // 'Pomodoro', 'Deep Work', 'Active Recall', 'Feynman Method'
  focusScore: integer('focus_score').notNull(), // 1-10
  energyScore: integer('energy_score').notNull(), // 1-10
  date: text('date').notNull(), // YYYY-MM-DD
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Finance module transactions
export const financeTransactions = pgTable('finance_transactions', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  type: text('type').notNull(), // 'income' | 'expense' | 'investment' | 'savings'
  category: text('category').notNull(), // 'Education', 'Housing', 'Food', 'Transport', 'Tech', 'Salary', 'Investment'
  amount: doublePrecision('amount').notNull(),
  paymentMethod: text('payment_method').notNull(), // 'Bank Transfer', 'Credit Card', 'Cash', 'Crypto'
  date: text('date').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Habits module definitions
export const habits = pgTable('habits', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  category: text('category').notNull(), // 'Productivity', 'Mindfulness', 'Fitness', 'Learning', 'Health'
  frequency: text('frequency').notNull(), // 'daily', 'weekdays', '3x_weekly'
  targetDaysPerWeek: integer('target_days_per_week').notNull().default(7),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  color: text('color').notNull().default('#3b82f6'),
  icon: text('icon').notNull().default('sparkles'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Habit check-in logs
export const habitLogs = pgTable('habit_logs', {
  id: serial('id').primaryKey(),
  habitId: integer('habit_id').notNull().references(() => habits.id),
  userId: text('user_id').notNull(),
  date: text('date').notNull(),
  completed: integer('completed').notNull().default(1),
  moodScore: integer('mood_score').notNull().default(5), // 1-5
  durationMinutes: integer('duration_minutes').notNull().default(15),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Goal setting module
export const goals = pgTable('goals', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  module: text('module').notNull(), // 'study', 'finance', 'habits', 'career'
  targetValue: doublePrecision('target_value').notNull(),
  currentValue: doublePrecision('current_value').notNull().default(0),
  unit: text('unit').notNull(), // 'Hours', '$', 'Days', 'Chapters'
  deadline: text('deadline').notNull(),
  milestones: text('milestones'), // JSON array of milestones: [{ id, text, done }]
  status: text('status').notNull().default('in_progress'), // 'in_progress' | 'achieved' | 'paused'
  createdAt: timestamp('created_at').defaultNow(),
});

// Simulation decision scenarios saved by user
export const simulationScenarios = pgTable('simulation_scenarios', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  category: text('category').notNull(), // 'study_career', 'wealth_accumulation', 'lifestyle_balance'
  parameters: text('parameters').notNull(), // JSON string of slider configurations
  projections: text('projections').notNull(), // JSON string of metrics output points
  riskScore: integer('risk_score').notNull(), // 0 - 100
  recommendations: text('recommendations').notNull(), // JSON string or text recommendations
  createdAt: timestamp('created_at').defaultNow(),
});

// Forecasting models meta and trained metrics
export const forecastModels = pgTable('forecast_models', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  datasetType: text('dataset_type').notNull(), // 'study', 'finance', 'habits'
  recordCount: integer('record_count').notNull().default(1200),
  features: text('features').notNull(), // JSON array of 6 feature names
  metrics: text('metrics').notNull(), // JSON: { r2, mae, mse, featureImportances, forecastHorizon }
  trainedAt: timestamp('trained_at').defaultNow(),
});

// Relations
export const habitsRelations = relations(habits, ({ many }) => ({
  logs: many(habitLogs),
}));

export const habitLogsRelations = relations(habitLogs, ({ one }) => ({
  habit: one(habits, {
    fields: [habitLogs.habitId],
    references: [habits.id],
  }),
}));
