import 'dotenv/config';
import { db, pool } from '../src/db/index.ts';
import {
  users,
  studySessions,
  financeTransactions,
  habits,
  habitLogs,
  goals,
} from '../src/db/schema.ts';
import { eq } from 'drizzle-orm';

/**
 * Format a Date object to YYYY-MM-DD
 */
function toDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get YYYY-MM-DD string for N days ago
 */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateStr(d);
}

/**
 * Get timestamp for N days ago at a specific hour
 */
function timestampDaysAgo(n: number, hour = 12): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
  return d;
}

/**
 * Seed full 30-day historical data for a specific user UID
 */
async function seedUserData(targetUid: string, targetEmail: string, displayName: string) {
  console.log(`----------------------------------------------------`);
  console.log(`Seeding User: ${targetEmail} (UID: ${targetUid})`);
  console.log(`----------------------------------------------------`);

  // 1. Find or create user in PostgreSQL
  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.uid, targetUid));

  let userRecord;
  if (existingUsers.length > 0) {
    const updated = await db
      .update(users)
      .set({
        email: targetEmail,
        displayName,
      })
      .where(eq(users.uid, targetUid))
      .returning();
    userRecord = updated[0];
  } else {
    const inserted = await db
      .insert(users)
      .values({
        uid: targetUid,
        email: targetEmail,
        displayName,
      })
      .returning();
    userRecord = inserted[0];
  }
  console.log(`  [Users] Profile synchronized (id=${userRecord.id}, uid=${userRecord.uid})`);

  // 2. Clean previous records for idempotency
  await db.delete(habitLogs).where(eq(habitLogs.userId, targetUid));
  await db.delete(studySessions).where(eq(studySessions.userId, targetUid));
  await db.delete(financeTransactions).where(eq(financeTransactions.userId, targetUid));

  // 3. Generate Finance Transactions (at least 20-25 distinct expense days + 1-2 income transactions)
  const financeRows: Array<{
    userId: string;
    title: string;
    type: string;
    category: string;
    amount: number;
    paymentMethod: string;
    date: string;
    notes: string;
    createdAt: Date;
  }> = [];

  // 2 Income transactions dated 15-30 days ago
  financeRows.push({
    userId: targetUid,
    title: 'Monthly Salary (Software Engineering)',
    type: 'income',
    category: 'Salary',
    amount: 90000,
    paymentMethod: 'Bank Transfer',
    date: daysAgo(28),
    notes: 'Direct deposit monthly corporate compensation',
    createdAt: timestampDaysAgo(28, 9),
  });

  financeRows.push({
    userId: targetUid,
    title: 'Freelance AI Consulting Retainer',
    type: 'income',
    category: 'Salary',
    amount: 35000,
    paymentMethod: 'Bank Transfer',
    date: daysAgo(15),
    notes: 'Quarterly ML architecture retainer',
    createdAt: timestampDaysAgo(15, 14),
  });

  // Expense catalog templates with realistic amounts
  const expenseCatalog = [
    { title: 'Fresh Produce & Groceries', category: 'Food', amount: 650, method: 'UPI', notes: 'Weekly vegetables, fruits & dairy' },
    { title: 'Supermarket Restock & Pantry', category: 'Food', amount: 1420, method: 'Credit Card', notes: 'Dry pantry items & grains' },
    { title: 'Café Espresso & Working Lunch', category: 'Food', amount: 480, method: 'UPI', notes: 'Coffee meeting' },
    { title: 'Healthy Dinner & Protein Greens', category: 'Food', amount: 550, method: 'UPI', notes: 'Organic dinner' },
    { title: 'Metro Transit Smart Card Recharge', category: 'Transport', amount: 400, method: 'UPI', notes: 'Monthly metro pass' },
    { title: 'Uber Commute to Workspace', category: 'Transport', amount: 320, method: 'UPI', notes: 'Direct morning cab ride' },
    { title: 'High-Speed Fiber Internet Bill', category: 'Utilities', amount: 1199, method: 'Credit Card', notes: '300 Mbps fiber line' },
    { title: 'Electricity & Power Board Bill', category: 'Utilities', amount: 1850, method: 'Bank Transfer', notes: 'Monthly utility bill' },
    { title: 'Mobile 5G Postpaid Plan', category: 'Utilities', amount: 699, method: 'UPI', notes: 'Monthly plan' },
    { title: 'Cloud Infrastructure & API Credits', category: 'Tech', amount: 2450, method: 'Credit Card', notes: 'Gemini API tokens & compute' },
    { title: 'Books & ML Research Paper Prints', category: 'Education', amount: 750, method: 'UPI', notes: 'Textbooks & journals' },
    { title: 'Gym & Fitness Center Membership', category: 'Health', amount: 2000, method: 'Bank Transfer', notes: 'Monthly strength training pass' },
    { title: 'Apartment Maintenance & Water', category: 'Housing', amount: 2500, method: 'Bank Transfer', notes: 'Society maintenance fee' },
    { title: 'Nifty 50 Index Mutual Fund SIP', category: 'Investment', amount: 7500, method: 'Bank Transfer', notes: 'Monthly index wealth SIP' },
  ];

  // Distribute expenses across 26 distinct days within past 30 days
  const expenseDays = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    11, 12, 13, 14, 16, 17, 18, 19, 20,
    21, 22, 23, 24, 25, 26, 27, 29
  ];

  let catIdx = 0;
  for (const day of expenseDays) {
    const item1 = expenseCatalog[catIdx % expenseCatalog.length];
    catIdx++;
    financeRows.push({
      userId: targetUid,
      title: item1.title,
      type: item1.category === 'Investment' ? 'investment' : 'expense',
      category: item1.category,
      amount: item1.amount,
      paymentMethod: item1.method,
      date: daysAgo(day),
      notes: item1.notes,
      createdAt: timestampDaysAgo(day, 11),
    });

    // Add a second transaction on even days
    if (day % 2 === 0) {
      const item2 = expenseCatalog[catIdx % expenseCatalog.length];
      catIdx++;
      financeRows.push({
        userId: targetUid,
        title: item2.title,
        type: item2.category === 'Investment' ? 'investment' : 'expense',
        category: item2.category,
        amount: item2.amount,
        paymentMethod: item2.method,
        date: daysAgo(day),
        notes: item2.notes,
        createdAt: timestampDaysAgo(day, 16),
      });
    }
  }

  await db.insert(financeTransactions).values(financeRows);
  const distinctDays = new Set(financeRows.filter(r => r.type === 'expense').map(r => r.date)).size;
  console.log(`  [Finance] Inserted ${financeRows.length} transactions across ${distinctDays} distinct expense days + 2 income.`);

  // 4. Generate Study Sessions (15-20 sessions, durations 30-120 min, focus 6-10)
  const studyTopics = [
    { subject: 'Machine Learning', topic: 'Backpropagation & Loss Optimization', technique: 'Deep Work' },
    { subject: 'Machine Learning', topic: 'Attention Mechanisms & Transformers', technique: 'Deep Work' },
    { subject: 'Machine Learning', topic: 'Time Series Forecasting & ARIMA Models', technique: 'Active Recall' },
    { subject: 'PostgreSQL Architecture', topic: 'B-Tree Index Scans vs Bitmap Heap Scans', technique: 'Pomodoro' },
    { subject: 'PostgreSQL Architecture', topic: 'VACUUM, MVCC & Transaction Isolation', technique: 'Feynman Method' },
    { subject: 'PostgreSQL Architecture', topic: 'Connection Pooling & Query Plan Caching', technique: 'Deep Work' },
    { subject: 'Algorithms & DS', topic: 'Graph Theory: Dijkstra & Bellman-Ford', technique: 'Active Recall' },
    { subject: 'Algorithms & DS', topic: 'Dynamic Programming: 2D Grid DP', technique: 'Pomodoro' },
    { subject: 'Algorithms & DS', topic: 'Interval Scheduling & Greedy Approaches', technique: 'Pomodoro' },
    { subject: 'Distributed Systems', topic: 'Raft Consensus Protocol & Log Replication', technique: 'Deep Work' },
    { subject: 'Distributed Systems', topic: 'CAP Theorem & Eventual Consistency', technique: 'Feynman Method' },
    { subject: 'TypeScript Internals', topic: 'Conditional Types & Infer Keyword', technique: 'Active Recall' },
    { subject: 'TypeScript Internals', topic: 'Template Literal Types & Type Guards', technique: 'Pomodoro' },
    { subject: 'System Design', topic: 'Scalable Sharding & Write Replication', technique: 'Deep Work' },
    { subject: 'System Design', topic: 'Rate Limiting Algorithms: Token Bucket', technique: 'Active Recall' },
    { subject: 'Applied Mathematics', topic: 'Linear Algebra: Eigenvalues & PCA', technique: 'Deep Work' },
    { subject: 'Applied Mathematics', topic: 'Multivariable Calculus: Hessian Matrices', technique: 'Pomodoro' },
    { subject: 'Applied Statistics', topic: 'Bayesian Inference & Markov Chains', technique: 'Deep Work' },
  ];

  const studyDays = [1, 2, 4, 5, 7, 9, 11, 12, 14, 16, 18, 19, 21, 23, 25, 26, 28, 29];
  const studyRows = studyTopics.map((st, idx) => {
    const day = studyDays[idx];
    const duration = [45, 60, 75, 90, 105, 120][idx % 6];
    const focusScore = 7 + (idx % 4);
    const energyScore = 6 + (idx % 5);

    return {
      userId: targetUid,
      subject: st.subject,
      topic: st.topic,
      durationMinutes: duration,
      technique: st.technique,
      focusScore,
      energyScore,
      date: daysAgo(day),
      notes: `Session notes on ${st.topic}. Solved practice problems and flashcard reviews.`,
      createdAt: timestampDaysAgo(day, 10),
    };
  });

  await db.insert(studySessions).values(studyRows);
  console.log(`  [Study] Inserted ${studyRows.length} study sessions (duration 45-120m, focus 7-10).`);

  // 5. Habits & 14-day completion logs
  const targetHabits = [
    {
      name: 'Daily Expense Audit',
      category: 'Learning',
      frequency: 'daily',
      targetDaysPerWeek: 7,
      currentStreak: 14,
      longestStreak: 30,
      color: '#f59e0b',
      icon: 'wallet',
    },
    {
      name: 'Strength Training or 5K Run',
      category: 'Fitness',
      frequency: 'daily',
      targetDaysPerWeek: 7,
      currentStreak: 14,
      longestStreak: 21,
      color: '#10b981',
      icon: 'flame',
    },
    {
      name: '60-Minute Deep Work Block',
      category: 'Productivity',
      frequency: 'daily',
      targetDaysPerWeek: 7,
      currentStreak: 14,
      longestStreak: 28,
      color: '#8b5cf6',
      icon: 'brain',
    },
    {
      name: 'Morning Cold Shower & Hydration',
      category: 'Health',
      frequency: 'daily',
      targetDaysPerWeek: 7,
      currentStreak: 14,
      longestStreak: 35,
      color: '#06b6d4',
      icon: 'droplets',
    },
  ];

  const existingHabits = await db
    .select()
    .from(habits)
    .where(eq(habits.userId, targetUid));

  const habitMap = new Map<string, number>();

  for (const th of targetHabits) {
    const existing = existingHabits.find(h => h.name === th.name);
    if (existing) {
      await db
        .update(habits)
        .set({
          currentStreak: th.currentStreak,
          longestStreak: th.longestStreak,
          targetDaysPerWeek: th.targetDaysPerWeek,
          color: th.color,
          icon: th.icon,
        })
        .where(eq(habits.id, existing.id));
      habitMap.set(th.name, existing.id);
    } else {
      const created = await db
        .insert(habits)
        .values({
          userId: targetUid,
          ...th,
        })
        .returning();
      habitMap.set(th.name, created[0].id);
    }
  }

  const logRows: Array<{
    habitId: number;
    userId: string;
    date: string;
    completed: number;
    moodScore: number;
    durationMinutes: number;
    notes: string;
    createdAt: Date;
  }> = [];

  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const dateStr = daysAgo(dayOffset);

    for (const th of targetHabits) {
      const habitId = habitMap.get(th.name)!;
      let duration = 15;
      let notes = 'Daily routine completed.';

      if (th.name === '60-Minute Deep Work Block') duration = 60;
      else if (th.name === 'Strength Training or 5K Run') duration = 45;
      else if (th.name === 'Daily Expense Audit') duration = 10;
      else if (th.name === 'Morning Cold Shower & Hydration') duration = 15;

      logRows.push({
        habitId,
        userId: targetUid,
        date: dateStr,
        completed: 1,
        moodScore: 5,
        durationMinutes: duration,
        notes,
        createdAt: timestampDaysAgo(dayOffset, 8),
      });
    }
  }

  await db.insert(habitLogs).values(logRows);
  console.log(`  [Habits] 4 habits synced with 14-day streak + ${logRows.length} logs inserted.`);

  // 6. Goals
  const existingGoals = await db.select().from(goals).where(eq(goals.userId, targetUid));
  if (existingGoals.length === 0) {
    await db.insert(goals).values([
      {
        userId: targetUid,
        title: 'Master ML Foundations & Neural Nets',
        module: 'study',
        targetValue: 60,
        currentValue: 38,
        unit: 'Hours',
        deadline: '2026-11-30',
        milestones: JSON.stringify([
          { id: 1, text: 'Complete gradient descent derivations', done: true },
          { id: 2, text: 'Implement Multi-Layer Perceptron from scratch', done: true },
          { id: 3, text: 'Fine-tune transformer model on custom dataset', done: false },
        ]),
        status: 'in_progress',
      },
      {
        userId: targetUid,
        title: 'Build ₹3,00,000 Liquid Emergency Reserve',
        module: 'finance',
        targetValue: 300000,
        currentValue: 185000,
        unit: 'Money',
        deadline: '2026-12-31',
        milestones: JSON.stringify([
          { id: 1, text: 'Reach ₹1,00,000 threshold', done: true },
          { id: 2, text: 'Reach ₹2,00,000 threshold', done: false },
        ]),
        status: 'in_progress',
      },
      {
        userId: targetUid,
        title: 'Achieve 30-Day Unbroken Habit Consistency',
        module: 'habits',
        targetValue: 30,
        currentValue: 14,
        unit: 'Days',
        deadline: '2026-10-31',
        milestones: JSON.stringify([
          { id: 1, text: 'Reach 7-day milestone', done: true },
          { id: 2, text: 'Reach 14-day milestone', done: true },
          { id: 3, text: 'Reach 30-day milestone', done: false },
        ]),
        status: 'in_progress',
      },
    ]);
    console.log(`  [Goals] 3 strategic goals established.`);
  }

  console.log(`  -> Completed seeding for ${targetEmail}!\n`);
}

async function main() {
  console.log('====================================================');
  console.log('OmniLife Studio: 30-Day Historical Database Seeder');
  console.log('====================================================\n');

  // Primary Requested User: anshumanr699@gmail.com
  const primaryEmail = 'anshumanr699@gmail.com';
  const encodedEmail = Buffer.from(primaryEmail.toLowerCase())
    .toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 16);
  const primaryUid = `usr_${encodedEmail}`; // usr_YW5zaHVtYW5yNjk5
  const demoAnshumanUid = 'demo_' + Buffer.from(primaryEmail).toString('base64').replace(/=/g, '').toLowerCase().slice(0, 16);

  await seedUserData(primaryUid, primaryEmail, 'Anshuman Rai');
  await seedUserData(demoAnshumanUid, primaryEmail, 'Anshuman Rai');

  // Also seed default demo user (Alex Sharma)
  const alexUid = 'demo_ywxlec5zagfybwfa';
  await seedUserData(alexUid, 'alex.sharma@omnilife.ai', 'Alex Sharma');

  console.log('====================================================');
  console.log('Database Seeding Finished Successfully! 🎉');
  console.log('====================================================');
  console.log('Target User Credentials:');
  console.log('  Email:    anshumanr699@gmail.com');
  console.log('  Password: Anshuman@123');
  console.log('  UIDs:     usr_YW5zaHVtYW5yNjk5 / demo_yw5zahvtyw5ynjk5');
  console.log('\nReady for ML Forecasting & AI Assistant analysis.');
  console.log('====================================================\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seeding encountered an error:', err);
    process.exit(1);
  });
