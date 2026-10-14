import * as dotenv from 'dotenv';
import path from 'path';
import readline from 'readline';
import { clearUserData } from '../src/db/clearUserData.ts';
import { maskConnectionInfo } from '../src/db/health.ts';

dotenv.config();
dotenv.config({ path: path.resolve(import.meta.dirname, '../../../.env') });

function parseArgs(): {
  email?: string;
  uid?: string;
  execute: boolean;
  yes: boolean;
  deleteUser: boolean;
} {
  const args = process.argv.slice(2);
  let email: string | undefined;
  let uid: string | undefined;
  let execute = false;
  let yes = false;
  let deleteUser = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--email' && args[i + 1]) {
      email = args[++i];
    } else if (arg.startsWith('--email=')) {
      email = arg.slice(8);
    } else if (arg === '--uid' && args[i + 1]) {
      uid = args[++i];
    } else if (arg.startsWith('--uid=')) {
      uid = arg.slice(6);
    } else if (arg === '--execute') {
      execute = true;
    } else if (arg === '--yes') {
      yes = true;
    } else if (arg === '--delete-user') {
      deleteUser = true;
    } else if (!email && !uid && arg.includes('@') && !arg.startsWith('-')) {
      email = arg;
    }
  }

  return { email, uid, execute, yes, deleteUser };
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
  console.log('==================================================');
  console.log('OmniLife Studio: Clear User Data Tool');
  console.log('==================================================');

  // Refuse to run in production
  if (process.env.NODE_ENV === 'production') {
    console.error('\n[ABORT] Refusing to run db:clear-user in production environment.');
    process.exit(1);
  }

  const { email, uid, execute, yes, deleteUser } = parseArgs();

  if (!email && !uid) {
    console.error('\nUsage: npm run db:clear-user -- (--email <email> | --uid <uid>) [--execute] [--yes] [--delete-user]');
    console.error('\nExamples:');
    console.error('  npm run db:clear-user -- --email user@example.com           (Dry run)');
    console.error('  npm run db:clear-user -- --email user@example.com --execute (Prompts for confirmation)');
    console.error('  npm run db:clear-user -- --email user@example.com --execute --yes\n');
    process.exit(1);
  }

  const host = process.env.SQL_HOST || 'localhost';
  const port = process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 5432;
  const user = process.env.SQL_USER || 'postgres';
  const dbName = process.env.SQL_DB_NAME || 'omnilife';

  console.log(`Database:   ${maskConnectionInfo({ host, port, user })} / ${dbName}`);
  console.log(`Mode:       ${execute ? 'EXECUTE (DESTRUCTIVE)' : 'DRY RUN'}`);
  console.log(`Delete User:${deleteUser ? ' YES (removes users row too)' : ' NO (clears data only)'}\n`);

  // 1. Dry run count inspection
  let preview;
  try {
    preview = await clearUserData({ email, uid, execute: false, deleteUser });
  } catch (err: any) {
    console.error(`\n[ERROR] ${err.message}\n`);
    process.exit(1);
  }

  const target = preview.targetUser;
  console.log(`Target User: ${target.email} (UID: ${target.uid}, DisplayName: ${target.displayName || 'None'})`);
  console.log('--------------------------------------------------');
  console.log('Table Name                Rows Found');
  console.log('--------------------------------------------------');
  console.log(`habit_logs                ${preview.counts.habitLogs}`);
  console.log(`habits                    ${preview.counts.habits}`);
  console.log(`study_sessions            ${preview.counts.studySessions}`);
  console.log(`finance_transactions      ${preview.counts.financeTransactions}`);
  console.log(`goals                     ${preview.counts.goals}`);
  console.log(`simulation_scenarios      ${preview.counts.simulationScenarios}`);
  console.log(`forecast_models           ${preview.counts.forecastModels}`);
  if (deleteUser) {
    console.log(`users                     1 (will be deleted)`);
  } else {
    console.log(`users                     1 (preserved)`);
  }
  console.log('--------------------------------------------------');

  const totalDataRows =
    preview.counts.habitLogs +
    preview.counts.habits +
    preview.counts.studySessions +
    preview.counts.financeTransactions +
    preview.counts.goals +
    preview.counts.simulationScenarios +
    preview.counts.forecastModels;

  console.log(`Total Data Rows:          ${totalDataRows}`);
  console.log('==================================================');

  if (!execute) {
    console.log('\n[DRY RUN COMPLETE] Zero database changes were made.');
    console.log('Pass "--execute" to delete these records.');
    process.exit(0);
  }

  // 2. Interactive confirmation if not --yes
  if (!yes) {
    console.log(`\nCAUTION: You are about to permanently delete ${totalDataRows} records for user: ${target.email}`);
    const confirmation = await promptConfirm(`Type "${target.email}" to confirm deletion: `);
    if (confirmation.toLowerCase() !== target.email.toLowerCase()) {
      console.log('\nConfirmation text did not match. Aborting without changes.\n');
      process.exit(0);
    }
  }

  // 3. Execute deletion
  console.log('\nDeleting records in FK-safe transaction...');
  try {
    const executedResult = await clearUserData({ email, uid, execute: true, deleteUser });
    console.log('\n==================================================');
    console.log('SUCCESS: User Data Cleared Successfully! 🎉');
    console.log('==================================================');
    console.log(`Target:      ${executedResult.targetUser.email} (${executedResult.targetUser.uid})`);
    console.log(`Rows Purged: ${totalDataRows} data rows`);
    if (deleteUser) {
      console.log('User Account: Deleted from users table.');
    } else {
      console.log('User Account: Kept in users table with 0 data records.');
    }
    console.log('==================================================\n');
  } catch (err: any) {
    console.error(`\n[FATAL ERROR] Deletion failed and was rolled back: ${err.message}\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
