/**
 * OmniLife Studio: Seed Data Generator
 *
 * Deterministic, realistic seed data generator for personal analytics,
 * forecasting, and simulation engine unlock.
 * Pure module with zero side effects or database dependencies.
 */

import {
  FORECAST_MIN_ACTIVE_DAYS,
  FORECAST_RELIABLE_ACTIVE_DAYS,
} from '../modules/forecasting/thresholds.ts';

export interface SeedGeneratorOptions {
  uid: string;
  referenceDate?: Date;
  seed?: number;
}

export interface GeneratedStudySession {
  userId: string;
  subject: string;
  topic: string;
  durationMinutes: number;
  technique: 'Deep Work' | 'Pomodoro' | 'Active Recall' | 'Feynman Method';
  focusScore: number;
  energyScore: number;
  date: string;
  notes: string;
}

export interface GeneratedFinanceTransaction {
  userId: string;
  title: string;
  type: 'income' | 'expense' | 'investment' | 'savings';
  category: string;
  amount: number;
  paymentMethod: string;
  date: string;
  notes: string;
}

export interface GeneratedHabit {
  id?: number; // assigned in-memory for linking habitLogs
  userId: string;
  name: string;
  category: string;
  frequency: string;
  targetDaysPerWeek: number;
  currentStreak: number;
  longestStreak: number;
  color: string;
  icon: string;
}

export interface GeneratedHabitLog {
  habitIndex: number; // 0-based index to link with generatedHabits
  userId: string;
  date: string;
  completed: number;
  moodScore: number;
  durationMinutes: number;
  notes: string;
}

export interface GeneratedGoal {
  userId: string;
  title: string;
  module: 'study' | 'finance' | 'habits' | 'career';
  targetValue: number;
  currentValue: number;
  unit: string;
  deadline: string;
  milestones: string; // JSON string
  status: 'in_progress' | 'achieved' | 'paused';
}

export interface GeneratedSeedData {
  uid: string;
  windowDays: number;
  startDate: string;
  endDate: string;
  studySessions: GeneratedStudySession[];
  financeTransactions: GeneratedFinanceTransaction[];
  habits: GeneratedHabit[];
  habitLogs: GeneratedHabitLog[];
  goals: GeneratedGoal[];
  metrics: {
    studyDistinctDays: number;
    studySessionsCount: number;
    financeDistinctDays: number;
    financeTransactionsCount: number;
    financeExpenseDays: number;
    financeIncomeDays: number;
    financeSavingsDays: number;
    totalIncome: number;
    totalExpenses: number;
    totalSavingsAndInvestments: number;
    netSavings: number;
    savingsRate: number;
    habitsCount: number;
    habitLogsCount: number;
    habitCompletedDistinctDays: number;
    goalsCount: number;
  };
}

/**
 * Formats a Date object to YYYY-MM-DD using local calendar year, month, and day.
 * Avoids UTC shift bugs that occur with toISOString().
 */
export function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Creates a deterministic Mulberry32 pseudo-random number generator.
 */
export function createRng(seed = 424242) {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Calculates current streak and longest streak from an array of completed dates (YYYY-MM-DD).
 */
export function computeStreaksFromDates(
  completedDates: string[],
  todayStr: string
): { currentStreak: number; longestStreak: number } {
  if (completedDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const uniqueSorted = Array.from(new Set(completedDates)).sort();
  if (uniqueSorted.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Calculate longest streak across all consecutive dates
  let longestStreak = 1;
  let currentRun = 1;

  for (let i = 1; i < uniqueSorted.length; i++) {
    const prev = new Date(`${uniqueSorted[i - 1]}T00:00:00`);
    const curr = new Date(`${uniqueSorted[i]}T00:00:00`);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      currentRun++;
      if (currentRun > longestStreak) {
        longestStreak = currentRun;
      }
    } else if (diffDays > 1) {
      currentRun = 1;
    }
  }

  // Calculate current streak ending today (or yesterday if today isn't logged yet)
  const dateSet = new Set(uniqueSorted);
  const today = new Date(`${todayStr}T00:00:00`);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatLocalDate(yesterday);

  let currentStreak = 0;
  let cursor = dateSet.has(todayStr) ? new Date(today) : (dateSet.has(yesterdayStr) ? new Date(yesterday) : null);

  if (cursor) {
    while (true) {
      const cursorStr = formatLocalDate(cursor);
      if (dateSet.has(cursorStr)) {
        currentStreak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
  }

  return { currentStreak, longestStreak: Math.max(longestStreak, currentStreak) };
}

/**
 * Generates realistic, internally consistent data for one account.
 */
export function generateSeedData(options: SeedGeneratorOptions): GeneratedSeedData {
  const { uid, referenceDate = new Date(), seed = 847291 } = options;
  const rng = createRng(seed);

  const randInt = (min: number, max: number): number => {
    return Math.floor(rng() * (max - min + 1)) + min;
  };

  const randFloat = (min: number, max: number, decimals = 2): number => {
    const val = rng() * (max - min) + min;
    const factor = Math.pow(10, decimals);
    return Math.round(val * factor) / factor;
  };

  const randPick = <T>(arr: T[]): T => {
    return arr[Math.floor(rng() * arr.length)];
  };

  // Derive target window: max(45, reliableActiveDays + 17) ending today (inclusive)
  const windowDays = Math.max(45, FORECAST_RELIABLE_ACTIVE_DAYS + 17); // 45 days
  const minActiveDaysTarget = FORECAST_RELIABLE_ACTIVE_DAYS + 10; // 38 days

  // Build calendar dates in chronological order from past to today
  // dayOffset 0 is today, dayOffset (windowDays - 1) is earliest day
  const dateStrings: string[] = [];
  for (let offset = windowDays - 1; offset >= 0; offset--) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - offset);
    dateStrings.push(formatLocalDate(d));
  }

  const todayStr = dateStrings[dateStrings.length - 1];
  const startDateStr = dateStrings[0];

  // ----------------------------------------------------
  // 1. Study Sessions
  // ----------------------------------------------------
  // Target: 50-75 sessions total, >= 38 distinct active days (>= 80% of window = 36).
  // Active on 40 of the 45 days (5 rest days).
  // Exam week between day index 28 and 34 (approx 10-16 days ago): heavier study.
  const studySubjects = [
    {
      subject: 'Machine Learning & AI',
      topics: [
        'Backpropagation & Loss Optimization',
        'Transformers & Self-Attention Mechanisms',
        'Time Series Forecasting & LSTM Networks',
        'Convolutional Networks & Computer Vision',
        'Reinforcement Learning: Q-Learning & Policy Gradients',
      ],
    },
    {
      subject: 'Distributed Systems',
      topics: [
        'Raft Consensus Protocol & Log Replication',
        'CAP Theorem & Eventual Consistency Models',
        'Distributed Cache Invalidation & Redis',
        'Kafka Partitioning & Message Guarantees',
        'Microservice Resiliency: Circuit Breakers & Retries',
      ],
    },
    {
      subject: 'Database Engineering',
      topics: [
        'PostgreSQL MVCC & WAL Architecture',
        'B-Tree vs Bitmap Index Scan Optimization',
        'Query Execution Plans & EXPLAIN ANALYZE',
        'Connection Pooling & Pgbouncer Tuning',
        'Horizontal Sharding & Read Replica Replication',
      ],
    },
    {
      subject: 'Algorithms & Data Structures',
      topics: [
        'Dynamic Programming on Trees & DAGs',
        'Graph Shortest Paths: Dijkstra & Bellman-Ford',
        'Segment Trees & Range Minimum Queries',
        'Trie Prefix Trees & Aho-Corasick Matching',
        'Disjoint Set Union & Kruskal Algorithm',
      ],
    },
    {
      subject: 'Computer Networks & OS',
      topics: [
        'TCP Congestion Control & 3-Way Handshake',
        'Linux Process Scheduling & Thread Context Switching',
        'Virtual Memory, Paging & TLB Optimization',
        'TLS 1.3 Handshake & Asymmetric Encryption',
        'Epoll Event Loops & Non-blocking I/O',
      ],
    },
  ];

  const allowedTechniques: Array<'Deep Work' | 'Pomodoro' | 'Active Recall' | 'Feynman Method'> = [
    'Deep Work',
    'Pomodoro',
    'Active Recall',
    'Feynman Method',
  ];

  const studyNotes = [
    'Completed practice problem set and validated edge cases.',
    'Reviewed architecture diagrams and wrote concise flashcards.',
    'Worked through textbook derivations step by step.',
    'Traced memory execution profile and documented bottlenecks.',
    'Summarized core mechanisms using the Feynman teaching method.',
    'Implemented clean working prototype and verified test suite.',
    'Focused deep work session without mobile notifications.',
    'Solved timed algorithmic challenge set with high accuracy.',
  ];

  // Pick 5 rest days out of 45 (leave 40 active days >= 38 threshold)
  // Rest days distributed on Sundays / lighter days
  const studyRestDayIndices = new Set<number>([4, 11, 18, 25, 39]); // exactly 5 rest days -> 40 active days

  const studySessions: GeneratedStudySession[] = [];

  for (let dayIdx = 0; dayIdx < windowDays; dayIdx++) {
    if (studyRestDayIndices.has(dayIdx)) {
      continue;
    }

    const date = dateStrings[dayIdx];
    const isExamWeek = dayIdx >= 28 && dayIdx <= 34; // 7 days of heavier study

    // On exam week or selected weekdays, schedule 2 sessions
    const hasDoubleSession = isExamWeek || (dayIdx % 3 === 0 && dayIdx < 42);
    const sessionCount = hasDoubleSession ? 2 : 1;

    // Upward trend factor: ~10% increase over the 45 days
    const trendFactor = 1.0 + (dayIdx / windowDays) * 0.12;

    for (let s = 0; s < sessionCount; s++) {
      const subjectObj = studySubjects[(dayIdx + s * 2) % studySubjects.length];
      const topic = subjectObj.topics[(dayIdx * 3 + s) % subjectObj.topics.length];
      const technique = allowedTechniques[(dayIdx + s) % allowedTechniques.length];

      // Base duration 45-120 min, exam week 90-150 min, adjusted by trend
      let durationMinutes: number;
      if (isExamWeek) {
        durationMinutes = Math.min(180, Math.max(60, Math.round((randInt(90, 150)) * trendFactor)));
      } else {
        durationMinutes = Math.min(180, Math.max(30, Math.round((randInt(40, 95)) * trendFactor)));
      }

      // Ensure duration is integer
      durationMinutes = Math.round(durationMinutes);

      // Focus and energy correlated with technique and duration
      // Long sessions (>100 min) lower focus slightly; Deep Work / Active Recall higher
      let baseFocus = randInt(7, 9);
      if (technique === 'Deep Work' || technique === 'Active Recall') {
        baseFocus = Math.min(10, baseFocus + 1);
      }
      if (durationMinutes > 110) {
        baseFocus = Math.max(5, baseFocus - 1);
      }
      const focusScore = Math.max(1, Math.min(10, baseFocus));

      let baseEnergy = randInt(6, 9);
      if (s === 1) {
        baseEnergy = Math.max(5, baseEnergy - 1); // afternoon session lower energy
      }
      const energyScore = Math.max(1, Math.min(10, baseEnergy));

      const notes = randInt(1, 10) <= 6 ? randPick(studyNotes) : '';

      studySessions.push({
        userId: uid,
        subject: subjectObj.subject,
        topic,
        durationMinutes,
        technique,
        focusScore,
        energyScore,
        date,
        notes,
      });
    }
  }

  // ----------------------------------------------------
  // 2. Finance Transactions
  // ----------------------------------------------------
  // Requirements:
  // - 150-200 transactions
  // - Allowed types: income, expense, investment, savings
  // - Allowed categories: Food, Housing, Education, Tech, Salary, Investment, Savings, Transport, Health, General
  // - Payment methods: Bank Transfer, Credit Card, Debit Card, Cash, Crypto
  // - Per-type coverage:
  //   - expenses on at least 35 distinct days
  //   - income on at least 18 distinct days
  //   - savings + investment on at least 16 distinct days
  // - Income: monthly stipend/retainer + frequent small items (tutoring, freelance, cashback)
  // - Expenses: daily food/transport, weekly shopping, monthly rent/subscriptions, festival spike
  // - No single category > 45% of expenses
  // - Monthly savings rate between 15% and 40% of income (never negative net)
  // - Positive amounts with 2 decimals

  const financeTransactions: GeneratedFinanceTransaction[] = [];

  // Income items catalog
  const smallIncomeCatalog = [
    { title: 'Peer Tutoring: Discrete Math & DSA', category: 'Salary', amountRange: [1200, 2200], method: 'Bank Transfer' },
    { title: 'Freelance Web API Endpoint Build', category: 'Salary', amountRange: [2200, 3600], method: 'Bank Transfer' },
    { title: 'Code Review & Bug Bounty Reward', category: 'Salary', amountRange: [1400, 2600], method: 'Bank Transfer' },
    { title: 'University Teaching Assistant Hours', category: 'Salary', amountRange: [1500, 2800], method: 'Bank Transfer' },
    { title: 'Credit Card Cashback Reward', category: 'General', amountRange: [250, 650], method: 'Credit Card' },
    { title: 'Textbook Resale & Notes Share', category: 'Education', amountRange: [500, 1100], method: 'Cash' },
    { title: 'Weekend Mentorship Honorarium', category: 'Salary', amountRange: [1800, 3200], method: 'Bank Transfer' },
  ];

  // Assign income across 20 distinct days (exceeds >= 18 threshold)
  // 2 monthly stipends on day indices 5 and 35
  const incomeDayIndices = [1, 3, 5, 7, 9, 12, 14, 17, 19, 22, 24, 27, 29, 32, 35, 37, 39, 41, 43, 44];

  for (let i = 0; i < incomeDayIndices.length; i++) {
    const dayIdx = incomeDayIndices[i];
    const date = dateStrings[dayIdx];

    if (dayIdx === 5 || dayIdx === 35) {
      // Monthly engineering stipend / scholarship
      financeTransactions.push({
        userId: uid,
        title: 'Monthly Engineering Research Fellowship',
        type: 'income',
        category: 'Salary',
        amount: 35000.0,
        paymentMethod: 'Bank Transfer',
        date,
        notes: 'Monthly academic research stipend direct deposit',
      });
    } else {
      const template = smallIncomeCatalog[i % smallIncomeCatalog.length];
      const amount = randFloat(template.amountRange[0], template.amountRange[1], 2);
      financeTransactions.push({
        userId: uid,
        title: template.title,
        type: 'income',
        category: template.category,
        amount,
        paymentMethod: template.method,
        date,
        notes: 'Earned income deposit',
      });
    }
  }

  // Savings & Investment items (at least 18 distinct days >= 16 threshold)
  const savingsDayIndices = [2, 4, 6, 8, 10, 13, 16, 18, 21, 23, 26, 28, 30, 33, 36, 38, 40, 42];
  const savingsCatalog = [
    { title: 'Nifty 50 Index Mutual Fund SIP', type: 'investment' as const, category: 'Investment', range: [1500, 2800], method: 'Bank Transfer' },
    { title: 'Tech Sector Focused Equity SIP', type: 'investment' as const, category: 'Investment', range: [1000, 2200], method: 'Bank Transfer' },
    { title: 'High-Yield Liquid Emergency Fund Deposit', type: 'savings' as const, category: 'Savings', range: [1200, 2500], method: 'Bank Transfer' },
    { title: 'Recurring Gold ETF Allocation', type: 'investment' as const, category: 'Investment', range: [800, 1600], method: 'Bank Transfer' },
    { title: 'Automated Round-Up Savings Deposit', type: 'savings' as const, category: 'Savings', range: [300, 750], method: 'Debit Card' },
  ];

  for (let i = 0; i < savingsDayIndices.length; i++) {
    const dayIdx = savingsDayIndices[i];
    const date = dateStrings[dayIdx];
    const template = savingsCatalog[i % savingsCatalog.length];
    const amount = randFloat(template.range[0], template.range[1], 2);

    financeTransactions.push({
      userId: uid,
      title: template.title,
      type: template.type,
      category: template.category,
      amount,
      paymentMethod: template.method,
      date,
      notes: `${template.category} systematic allocation`,
    });
  }

  // Expense items catalog
  const dailyFoodCatalog = [
    { title: 'Canteen Lunch & Cold Coffee', category: 'Food', range: [180, 360], method: 'Debit Card' },
    { title: 'Fresh Fruit & Morning Breakfast', category: 'Food', range: [140, 260], method: 'Cash' },
    { title: 'Hostel Mess Dinner Supplement', category: 'Food', range: [190, 380], method: 'Debit Card' },
    { title: 'Campus Café Espresso & Sandwich', category: 'Food', range: [220, 420], method: 'Credit Card' },
  ];

  const dailyTransportCatalog = [
    { title: 'Metro Transit Smart Card Recharge', category: 'Transport', range: [180, 380], method: 'Debit Card' },
    { title: 'Auto Rickshaw Shared Commute', category: 'Transport', range: [70, 160], method: 'Cash' },
    { title: 'Bicycle Campus Maintenance & Air', category: 'Transport', range: [60, 140], method: 'Cash' },
    { title: 'Late Evening Cab to Campus', category: 'Transport', range: [200, 380], method: 'Credit Card' },
  ];

  const snackCatalog = [
    { title: 'Afternoon Tea & Steamed Snacks', category: 'Food', range: [60, 150], method: 'Cash' },
    { title: 'Energy Bars & Roasted Almonds', category: 'Food', range: [120, 220], method: 'Debit Card' },
    { title: 'Campus Xerox & Lab Notes Printing', category: 'Education', range: [80, 210], method: 'Cash' },
    { title: 'Electrolyte Hydration Drink', category: 'Health', range: [50, 130], method: 'Debit Card' },
  ];

  const weeklyShoppingCatalog = [
    { title: 'Supermarket Grocery & Dairy Restock', category: 'Food', range: [950, 1850], method: 'Credit Card' },
    { title: 'Personal Care & Pharmacy Essentials', category: 'Health', range: [450, 950], method: 'Debit Card' },
    { title: 'Engineering Stationery & Technical Notebooks', category: 'Education', range: [350, 750], method: 'Cash' },
  ];

  // Distribute expenses across 42 distinct days (exceeds >= 35 threshold)
  const expenseDayIndices: number[] = [];
  for (let d = 0; d < windowDays; d++) {
    if (d !== 15 && d !== 31 && d !== 43) {
      expenseDayIndices.push(d); // 42 distinct days
    }
  }

  for (let idx = 0; idx < expenseDayIndices.length; idx++) {
    const dayIdx = expenseDayIndices[idx];
    const date = dateStrings[dayIdx];

    // 1. Food item (42 transactions)
    const foodItem = dailyFoodCatalog[(dayIdx + idx) % dailyFoodCatalog.length];
    financeTransactions.push({
      userId: uid,
      title: foodItem.title,
      type: 'expense',
      category: foodItem.category,
      amount: randFloat(foodItem.range[0], foodItem.range[1], 2),
      paymentMethod: foodItem.method,
      date,
      notes: 'Daily nutritional expense',
    });

    // 2. Transport item (42 transactions)
    const transItem = dailyTransportCatalog[(dayIdx * 2 + idx) % dailyTransportCatalog.length];
    financeTransactions.push({
      userId: uid,
      title: transItem.title,
      type: 'expense',
      category: transItem.category,
      amount: randFloat(transItem.range[0], transItem.range[1], 2),
      paymentMethod: transItem.method,
      date,
      notes: 'Transit & travel',
    });

    // 3. Snacks / minor items on ~35 days
    if (dayIdx % 5 !== 0) {
      const snack = snackCatalog[(dayIdx + idx) % snackCatalog.length];
      financeTransactions.push({
        userId: uid,
        title: snack.title,
        type: 'expense',
        category: snack.category,
        amount: randFloat(snack.range[0], snack.range[1], 2),
        paymentMethod: snack.method,
        date,
        notes: 'Campus daily essential',
      });
    }

    // 4. Weekly grocery/pharmacy on day % 3 === 0 (14 transactions)
    if (dayIdx % 3 === 0) {
      const shopItem = weeklyShoppingCatalog[(dayIdx / 3) % weeklyShoppingCatalog.length];
      financeTransactions.push({
        userId: uid,
        title: shopItem.title,
        type: 'expense',
        category: shopItem.category,
        amount: randFloat(shopItem.range[0], shopItem.range[1], 2),
        paymentMethod: shopItem.method,
        date,
        notes: 'Weekly pantry & supplies',
      });
    }

    // 5. Monthly rent & subscriptions
    if (dayIdx === 8 || dayIdx === 36) {
      financeTransactions.push({
        userId: uid,
        title: 'Student Flat Rent & Electricity Share',
        type: 'expense',
        category: 'Housing',
        amount: 11500.0,
        paymentMethod: 'Bank Transfer',
        date,
        notes: 'Monthly residential accommodation fee',
      });
    }

    if (dayIdx === 11 || dayIdx === 38) {
      financeTransactions.push({
        userId: uid,
        title: 'High-Speed Fiber Broadband Bill',
        type: 'expense',
        category: 'Tech',
        amount: 1199.0,
        paymentMethod: 'Credit Card',
        date,
        notes: '300 Mbps fiber line monthly bill',
      });
    }

    if (dayIdx === 14) {
      financeTransactions.push({
        userId: uid,
        title: 'Cloud Compute & AI Model Tokens',
        type: 'expense',
        category: 'Tech',
        amount: 1950.0,
        paymentMethod: 'Credit Card',
        date,
        notes: 'Developer cloud compute usage',
      });
    }

    // Realistic anomaly: Festival expense spike around day 20 ago (index 24)
    if (dayIdx === 24) {
      financeTransactions.push({
        userId: uid,
        title: 'Festival Sweets, Gifts & Family Celebration',
        type: 'expense',
        category: 'General',
        amount: 5500.0,
        paymentMethod: 'Credit Card',
        date,
        notes: 'Seasonal festive occasion celebration',
      });
    }
  }

  // Calculate finance totals and verify ratios
  const totalIncome = financeTransactions
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpenses = financeTransactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalSavingsAndInvestments = financeTransactions
    .filter((t) => t.type === 'investment' || t.type === 'savings')
    .reduce((acc, t) => acc + t.amount, 0);

  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

  // ----------------------------------------------------
  // 3. Habits and Habit Logs
  // ----------------------------------------------------
  // Requirements:
  // - 5-6 habits across the app's categories and frequencies
  // - targetDaysPerWeek sensible
  // - Believable completion pattern (higher on weekdays, gentle improvement)
  // - Completed log across at least 38 distinct days in the window
  // - Unique constraint on (habit, date)
  // - Derived fields (currentStreak, longestStreak) computed from logs

  const habitDefinitions = [
    {
      name: 'Deep Work Focus Block (60m)',
      category: 'Productivity',
      frequency: 'daily',
      targetDaysPerWeek: 7,
      color: '#8b5cf6',
      icon: 'brain',
      weekdayProb: 0.94,
      weekendProb: 0.82,
      duration: 60,
    },
    {
      name: 'Morning 5K Run & Mobility',
      category: 'Fitness',
      frequency: 'daily',
      targetDaysPerWeek: 7,
      color: '#10b981',
      icon: 'flame',
      weekdayProb: 0.88,
      weekendProb: 0.75,
      duration: 40,
    },
    {
      name: 'Mindful Meditation & Breathwork',
      category: 'Mindfulness',
      frequency: 'daily',
      targetDaysPerWeek: 7,
      color: '#06b6d4',
      icon: 'sparkles',
      weekdayProb: 0.9,
      weekendProb: 0.85,
      duration: 20,
    },
    {
      name: 'Technical Paper & Chapter Review',
      category: 'Learning',
      frequency: 'weekdays',
      targetDaysPerWeek: 5,
      color: '#f59e0b',
      icon: 'book-open',
      weekdayProb: 0.89,
      weekendProb: 0.55,
      duration: 45,
    },
    {
      name: 'Clean Nutrition & 3L Water Intake',
      category: 'Health',
      frequency: 'daily',
      targetDaysPerWeek: 7,
      color: '#3b82f6',
      icon: 'droplets',
      weekdayProb: 0.92,
      weekendProb: 0.88,
      duration: 15,
    },
    {
      name: 'Nightly Ledger & Expense Audit',
      category: 'Productivity',
      frequency: 'daily',
      targetDaysPerWeek: 7,
      color: '#ec4899',
      icon: 'wallet',
      weekdayProb: 0.91,
      weekendProb: 0.84,
      duration: 15,
    },
  ];

  const habitLogs: GeneratedHabitLog[] = [];
  const habitCompletedDateSets: Array<Set<string>> = habitDefinitions.map(() => new Set<string>());

  for (let dayIdx = 0; dayIdx < windowDays; dayIdx++) {
    const date = dateStrings[dayIdx];
    const dayDate = new Date(`${date}T00:00:00`);
    const dayOfWeek = dayDate.getDay(); // 0 is Sunday, 6 is Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Gradual improvement factor: completion increases slightly over the window
    const improvement = (dayIdx / windowDays) * 0.08;

    for (let hIdx = 0; hIdx < habitDefinitions.length; hIdx++) {
      const hDef = habitDefinitions[hIdx];
      const baseProb = isWeekend ? hDef.weekendProb : hDef.weekdayProb;
      const effectiveProb = Math.min(0.98, baseProb + improvement);

      const isCompleted = rng() < effectiveProb ? 1 : 0;
      const moodScore = isCompleted ? randInt(4, 5) : randInt(2, 3);
      const notes = isCompleted ? 'Routine check-in completed on schedule.' : 'Missed due to tight schedule.';

      habitLogs.push({
        habitIndex: hIdx,
        userId: uid,
        date,
        completed: isCompleted,
        moodScore,
        durationMinutes: hDef.duration,
        notes,
      });

      if (isCompleted === 1) {
        habitCompletedDateSets[hIdx].add(date);
      }
    }
  }

  // Compute streaks for each habit from its completed dates
  const habits: GeneratedHabit[] = habitDefinitions.map((hDef, idx) => {
    const completedDates = Array.from(habitCompletedDateSets[idx]);
    const { currentStreak, longestStreak } = computeStreaksFromDates(completedDates, todayStr);

    return {
      userId: uid,
      name: hDef.name,
      category: hDef.category,
      frequency: hDef.frequency,
      targetDaysPerWeek: hDef.targetDaysPerWeek,
      currentStreak,
      longestStreak,
      color: hDef.color,
      icon: hDef.icon,
    };
  });

  // ----------------------------------------------------
  // 4. Goals
  // ----------------------------------------------------
  // Requirements:
  // - 4-5 goals across the app's modules (study, finance, habits, career)
  // - realistic targetValue, unit, future deadlines
  // - currentValue equals what seeded data implies, <= targetValue
  // - valid milestones JSON
  // - mix of statuses (mostly in progress, at most one achieved)

  // 1) Study Goal: Total study hours completed in window
  const totalStudyMinutes = studySessions.reduce((acc, s) => acc + s.durationMinutes, 0);
  const totalStudyHoursSeeded = Math.round((totalStudyMinutes / 60) * 10) / 10;
  const studyTargetHours = 120.0;
  const studyCurrentHours = Math.min(studyTargetHours, totalStudyHoursSeeded);

  // 2) Finance Goal: Total savings & investments accumulated
  const financeTargetWealth = 60000.0;
  const financeCurrentWealth = Math.min(
    financeTargetWealth,
    Math.round(totalSavingsAndInvestments * 100) / 100
  );

  // 3) Habits Goal: Distinct completed habit days
  const allCompletedHabitDates = new Set<string>();
  habitLogs.forEach((l) => {
    if (l.completed === 1) allCompletedHabitDates.add(l.date);
  });
  const completedHabitDaysCount = allCompletedHabitDates.size;
  const habitsTargetDays = 35; // Achieved!
  const habitsCurrentDays = Math.min(habitsTargetDays, completedHabitDaysCount);

  // Deadlines in future: 30 to 90 days ahead
  const studyDeadline = new Date(referenceDate);
  studyDeadline.setDate(studyDeadline.getDate() + 60);

  const financeDeadline = new Date(referenceDate);
  financeDeadline.setDate(financeDeadline.getDate() + 90);

  const habitsDeadline = new Date(referenceDate);
  habitsDeadline.setDate(habitsDeadline.getDate() + 25);

  const careerDeadline = new Date(referenceDate);
  careerDeadline.setDate(careerDeadline.getDate() + 75);

  const goals: GeneratedGoal[] = [
    {
      userId: uid,
      title: 'Complete 120 Hours of Technical Mastery',
      module: 'study',
      targetValue: studyTargetHours,
      currentValue: studyCurrentHours,
      unit: 'Hours',
      deadline: formatLocalDate(studyDeadline),
      milestones: JSON.stringify([
        { id: 1, text: 'Master Core Algorithms & Data Structures', done: true },
        { id: 2, text: 'Deep Dive into Distributed Consensus & Storage', done: true },
        { id: 3, text: 'Train & Fine-Tune Deep Learning Models', done: false },
      ]),
      status: studyCurrentHours >= studyTargetHours ? 'achieved' : 'in_progress',
    },
    {
      userId: uid,
      title: 'Build ₹60,000 Liquid Wealth & Index Reserve',
      module: 'finance',
      targetValue: financeTargetWealth,
      currentValue: financeCurrentWealth,
      unit: 'Money',
      deadline: formatLocalDate(financeDeadline),
      milestones: JSON.stringify([
        { id: 1, text: 'Accumulate ₹20,000 baseline emergency cushion', done: true },
        { id: 2, text: 'Scale Index Fund allocation to ₹40,000', done: false },
        { id: 3, text: 'Reach ₹60,000 aggregate reserve milestone', done: false },
      ]),
      status: financeCurrentWealth >= financeTargetWealth ? 'achieved' : 'in_progress',
    },
    {
      userId: uid,
      title: 'Achieve 35 Days of Completed Daily Habits',
      module: 'habits',
      targetValue: habitsTargetDays,
      currentValue: habitsCurrentDays,
      unit: 'Days',
      deadline: formatLocalDate(habitsDeadline),
      milestones: JSON.stringify([
        { id: 1, text: 'First 7-day consistency badge', done: true },
        { id: 2, text: '21-day routine habit formation', done: true },
        { id: 3, text: '35-day streak habit mastery unlocked', done: true },
      ]),
      status: 'achieved', // At most one achieved
    },
    {
      userId: uid,
      title: 'Solve 60 System Design & LeetCode Hard Problems',
      module: 'career',
      targetValue: 60,
      currentValue: 38,
      unit: 'Problems',
      deadline: formatLocalDate(careerDeadline),
      milestones: JSON.stringify([
        { id: 1, text: 'Solve 20 Dynamic Programming challenges', done: true },
        { id: 2, text: 'Design 5 distributed system architectures', done: true },
        { id: 3, text: 'Complete 35 concurrency & graph problems', done: false },
      ]),
      status: 'in_progress',
    },
  ];

  // ----------------------------------------------------
  // Summary Metrics
  // ----------------------------------------------------
  const studyDistinctDays = new Set(studySessions.map((s) => s.date)).size;
  const financeDistinctDays = new Set(financeTransactions.map((t) => t.date)).size;
  const financeExpenseDays = new Set(
    financeTransactions.filter((t) => t.type === 'expense').map((t) => t.date)
  ).size;
  const financeIncomeDays = new Set(
    financeTransactions.filter((t) => t.type === 'income').map((t) => t.date)
  ).size;
  const financeSavingsDays = new Set(
    financeTransactions
      .filter((t) => t.type === 'investment' || t.type === 'savings')
      .map((t) => t.date)
  ).size;

  return {
    uid,
    windowDays,
    startDate: startDateStr,
    endDate: todayStr,
    studySessions,
    financeTransactions,
    habits,
    habitLogs,
    goals,
    metrics: {
      studyDistinctDays,
      studySessionsCount: studySessions.length,
      financeDistinctDays,
      financeTransactionsCount: financeTransactions.length,
      financeExpenseDays,
      financeIncomeDays,
      financeSavingsDays,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      totalSavingsAndInvestments: Math.round(totalSavingsAndInvestments * 100) / 100,
      netSavings: Math.round(netSavings * 100) / 100,
      savingsRate,
      habitsCount: habits.length,
      habitLogsCount: habitLogs.length,
      habitCompletedDistinctDays: completedHabitDaysCount,
      goalsCount: goals.length,
    },
  };
}
