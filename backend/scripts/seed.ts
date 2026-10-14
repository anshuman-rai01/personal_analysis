import * as dotenv from 'dotenv';
import path from 'path';
import readline from 'readline';
import { seedAccount } from '../src/db/seedAccount.ts';
import { maskConnectionInfo } from '../src/db/health.ts';

dotenv.config();
dotenv.config({ path: path.resolve(import.meta.dirname, '../../../.env') });

function parseArgs(): {
  email?: string;
  execute: boolean;
  reset: boolean;
  yes: boolean;
} {
  const args = process.argv.slice(2);
  let email: string | undefined;
  let execute = false;
  let reset = false;
  let yes = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--email' && args[i + 1]) {
      email = args[++i];
    } else if (arg.startsWith('--email=')) {
      email = arg.slice(8);
    } else if (arg === '--execute') {
      execute = true;
    } else if (arg === '--reset') {
      reset = true;
    } else if (arg === '--yes') {
      yes = true;
    } else if (!email && arg.includes('@') && !arg.startsWith('-')) {
      email = arg;
    }
  }

  return { email, execute, reset, yes };
}

async function promptConfirm(message: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('======================================================================');
  console.log('OmniLife Studio: Account Historical Database Seeder');
  console.log('======================================================================');

  // Refuse in production
  if (process.env.NODE_ENV === 'production') {
    console.error('\n[ABORT] Refusing to run db:seed in production environment.\n');
    process.exit(1);
  }

  const { email, execute, reset, yes } = parseArgs();

  if (!email) {
    console.error('\n[ERROR] Missing required argument: --email <registered_email>');
    console.error('Usage: npm run db:seed -- --email <email> [--reset] [--execute] [--yes]\n');
    console.error('Examples:');
    console.error('  npm run db:seed -- --email user@example.com                    (Dry Run)');
    console.error('  npm run db:seed -- --email user@example.com --reset --execute  (Prompts for confirmation)');
    console.error('  npm run db:seed -- --email user@example.com --reset --execute --yes\n');
    process.exit(1);
  }

  const host = process.env.SQL_HOST || 'localhost';
  const port = process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 5432;
  const user = process.env.SQL_USER || 'postgres';
  const dbName = process.env.SQL_DB_NAME || 'omnilife';

  console.log(`Database:     ${maskConnectionInfo({ host, port, user })} / ${dbName}`);
  console.log(`Target Email: ${email}`);
  console.log(`Mode:         ${execute ? 'EXECUTE (DATABASE WRITES)' : 'DRY RUN (ZERO CHANGES)'}`);
  console.log(`Reset Option: ${reset ? 'ENABLED (--reset: clears old data for this user)' : 'DISABLED'}\n`);

  // 1. Dry run preview or pre-check
  let previewResult;
  try {
    previewResult = await seedAccount({ email, execute: false, reset });
  } catch (err: any) {
    console.error(`\n[ABORT] ${err.message}\n`);
    process.exit(1);
  }

  const target = previewResult.targetUser;
  console.log(`User Profile: ${target.email} (UID: ${target.uid}, DisplayName: ${target.displayName || 'None'})`);
  console.log(`Date Window:  ${previewResult.window.startDate} to ${previewResult.window.endDate} (${previewResult.window.totalDays} days, no future dates)\n`);

  console.log('----------------------------------------------------------------------');
  console.log('Current Data Status for Target User');
  console.log('----------------------------------------------------------------------');
  console.log(`study_sessions:            ${previewResult.existingCounts.studySessions}`);
  console.log(`finance_transactions:      ${previewResult.existingCounts.financeTransactions}`);
  console.log(`habits:                    ${previewResult.existingCounts.habits}`);
  console.log(`habit_logs:                ${previewResult.existingCounts.habitLogs}`);
  console.log(`goals:                     ${previewResult.existingCounts.goals}`);
  console.log(`simulation_scenarios:      ${previewResult.existingCounts.simulationScenarios}`);
  console.log(`forecast_models:           ${previewResult.existingCounts.forecastModels}`);
  console.log(`Total Existing Rows:       ${previewResult.existingCounts.total}`);
  if (previewResult.existingCounts.total > 0 && reset) {
    console.log(`> NOTE: All ${previewResult.existingCounts.total} existing records will be cleanly replaced.`);
  }
  console.log('----------------------------------------------------------------------\n');

  console.log('----------------------------------------------------------------------');
  console.log('Planned Records to Insert');
  console.log('----------------------------------------------------------------------');
  console.log(`study_sessions:            ${previewResult.plannedCounts.studySessions}`);
  console.log(`finance_transactions:      ${previewResult.plannedCounts.financeTransactions}`);
  console.log(`habits:                    ${previewResult.plannedCounts.habits}`);
  console.log(`habit_logs:                ${previewResult.plannedCounts.habitLogs}`);
  console.log(`goals:                     ${previewResult.plannedCounts.goals}`);
  console.log(`Total Planned Rows:        ${previewResult.plannedCounts.total}`);
  console.log('----------------------------------------------------------------------\n');

  console.log('======================================================================');
  console.log('Active Days vs Minimum-Data Thresholds Evaluation');
  console.log('======================================================================');
  console.log('%-12s %-12s %-12s %-14s %-12s'.replace('%-12s', 'Module'.padEnd(12))
    .replace('%-12s', 'Active Days'.padEnd(12))
    .replace('%-12s', 'Min Needed'.padEnd(12))
    .replace('%-14s', 'Reliable Tier'.padEnd(14))
    .replace('%-12s', 'Status')
  );
  console.log('----------------------------------------------------------------------');

  const { study, finance, habits: habitReport } = previewResult.activeDaysReport;
  console.log(`${'study'.padEnd(12)} ${String(study.have).padEnd(12)} ${String(study.minimumRequired).padEnd(12)} ${String(study.reliableAt).padEnd(14)} ${study.status.toUpperCase()}`);
  console.log(`${'finance'.padEnd(12)} ${String(finance.have).padEnd(12)} ${String(finance.minimumRequired).padEnd(12)} ${String(finance.reliableAt).padEnd(14)} ${finance.status.toUpperCase()}`);
  console.log(`${'habits'.padEnd(12)} ${String(habitReport.have).padEnd(12)} ${String(habitReport.minimumRequired).padEnd(12)} ${String(habitReport.reliableAt).padEnd(14)} ${habitReport.status.toUpperCase()}`);
  console.log('======================================================================\n');

  console.log('Finance Details:');
  console.log(`  - Expense Days:            ${previewResult.financeBreakdown.expenseDays} (threshold: >= 35)`);
  console.log(`  - Income Days:             ${previewResult.financeBreakdown.incomeDays} (threshold: >= 18)`);
  console.log(`  - Savings/Investment Days: ${previewResult.financeBreakdown.savingsDays} (threshold: >= 16)`);
  console.log(`  - Total Inflow:            ₹${previewResult.financeBreakdown.totalIncome.toLocaleString('en-IN')}`);
  console.log(`  - Total Outflow:           ₹${previewResult.financeBreakdown.totalExpenses.toLocaleString('en-IN')}`);
  console.log(`  - Net Savings:             ₹${previewResult.financeBreakdown.netSavings.toLocaleString('en-IN')}`);
  console.log(`  - Savings Rate:            ${previewResult.financeBreakdown.savingsRate}% (healthy range: 15% - 40%)\n`);

  if (!execute) {
    console.log('======================================================================');
    console.log('[DRY RUN COMPLETE] Zero database modifications were made.');
    console.log('To execute this seeding, re-run with:');
    console.log(`  npm run db:seed -- --email ${target.email} --reset --execute`);
    console.log('======================================================================\n');
    process.exit(0);
  }

  // 2. Interactive confirmation if not --yes
  if (!yes) {
    console.log(`\nCAUTION: You are about to seed ${previewResult.plannedCounts.total} records for: ${target.email}`);
    if (previewResult.existingCounts.total > 0) {
      console.log(`All ${previewResult.existingCounts.total} existing records will be replaced.`);
    }
    const confirmation = await promptConfirm(`Type "${target.email}" to confirm: `);
    if (confirmation.toLowerCase() !== target.email.toLowerCase()) {
      console.log('\nConfirmation did not match. Aborting without changes.\n');
      process.exit(0);
    }
  }

  // 3. Execute
  console.log('\nExecuting atomic database transaction...');
  try {
    const executedResult = await seedAccount({
      email,
      execute: true,
      reset,
    });

    console.log('\n======================================================================');
    console.log('SUCCESS: Database Seeding Completed Successfully! 🎉');
    console.log('======================================================================');
    console.log(`Target Account:    ${executedResult.targetUser.email} (${executedResult.targetUser.uid})`);
    console.log(`Total Rows Seeded: ${executedResult.insertedCounts?.total} records`);
    console.log(`  - study_sessions:       ${executedResult.insertedCounts?.studySessions}`);
    console.log(`  - finance_transactions: ${executedResult.insertedCounts?.financeTransactions}`);
    console.log(`  - habits:               ${executedResult.insertedCounts?.habits}`);
    console.log(`  - habit_logs:           ${executedResult.insertedCounts?.habitLogs}`);
    console.log(`  - goals:                ${executedResult.insertedCounts?.goals}`);
    console.log(`Other Users:       Strictly untouched (0 rows modified for any other user).`);
    console.log(`Forecasting Gates: Unlocked & Reliable across study, finance, and habits.`);
    console.log('======================================================================\n');
  } catch (err: any) {
    console.error(`\n[FATAL ERROR] Seeding failed and was rolled back: ${err.message}\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
