import * as dotenv from 'dotenv';
import path from 'path';
import readline from 'readline';
import { purgeLegacyData } from '../src/db/purgeLegacy.ts';
import { maskConnectionInfo } from '../src/db/health.ts';

dotenv.config();
dotenv.config({ path: path.resolve(import.meta.dirname, '../../../.env') });

function parseArgs(): { execute: boolean; yes: boolean } {
  const args = process.argv.slice(2);
  let execute = false;
  let yes = false;

  for (const arg of args) {
    if (arg === '--execute') {
      execute = true;
    } else if (arg === '--yes') {
      yes = true;
    }
  }

  return { execute, yes };
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
  console.log('OmniLife Studio: Purge Legacy Accounts & Data Tool');
  console.log('==================================================');

  // Refuse in production
  if (process.env.NODE_ENV === 'production') {
    console.error('\n[ABORT] Refusing to run db:purge-legacy in production environment.');
    process.exit(1);
  }

  const { execute, yes } = parseArgs();

  const host = process.env.SQL_HOST || 'localhost';
  const port = process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 5432;
  const user = process.env.SQL_USER || 'postgres';
  const dbName = process.env.SQL_DB_NAME || 'omnilife';

  console.log(`Database:   ${maskConnectionInfo({ host, port, user })} / ${dbName}`);
  console.log(`Mode:       ${execute ? 'EXECUTE (DESTRUCTIVE)' : 'DRY RUN'}\n`);

  // 1. Dry run preview
  let preview;
  try {
    preview = await purgeLegacyData({ execute: false });
  } catch (err: any) {
    console.error(`\n[ERROR] Failed to scan legacy data: ${err.message}\n`);
    process.exit(1);
  }

  console.log(`Identified Legacy User Accounts (${preview.legacyUsers.length}):`);
  console.log('--------------------------------------------------');
  if (preview.legacyUsers.length === 0) {
    console.log('No legacy user accounts found in "users" table.');
  } else {
    for (const u of preview.legacyUsers) {
      console.log(`  [${u.identityClass.padEnd(8)}] ${u.email.padEnd(30)} UID: ${u.uid}`);
    }
  }
  console.log('--------------------------------------------------');

  const hasUsrAccounts = preview.legacyUsers.some((u) => u.identityClass === 'usr_');
  if (hasUsrAccounts) {
    console.warn('\n> [WARNING] "usr_" accounts were created by the legacy local-account fallback');
    console.warn('> and may have belonged to a real user who signed in while Firebase was unavailable.');
    console.warn('> Please carefully review the emails above before purging.\n');
  }

  console.log('Legacy Records Breakdown:');
  console.log('--------------------------------------------------');
  console.log(`users                     ${preview.counts.users}`);
  console.log(`habit_logs                ${preview.counts.habitLogs}`);
  console.log(`habits                    ${preview.counts.habits}`);
  console.log(`study_sessions            ${preview.counts.studySessions}`);
  console.log(`finance_transactions      ${preview.counts.financeTransactions}`);
  console.log(`goals                     ${preview.counts.goals}`);
  console.log(`simulation_scenarios      ${preview.counts.simulationScenarios}`);
  console.log(`forecast_models           ${preview.counts.forecastModels}`);
  console.log('--------------------------------------------------');

  const totalLegacyRecords =
    preview.counts.users +
    preview.counts.habitLogs +
    preview.counts.habits +
    preview.counts.studySessions +
    preview.counts.financeTransactions +
    preview.counts.goals +
    preview.counts.simulationScenarios +
    preview.counts.forecastModels;

  console.log(`Total Legacy Rows:        ${totalLegacyRecords}`);
  console.log('==================================================');

  if (totalLegacyRecords === 0) {
    console.log('\nDatabase is clean! No legacy records found.');
    process.exit(0);
  }

  if (!execute) {
    console.log('\n[DRY RUN COMPLETE] Zero database changes were made.');
    console.log('Pass "--execute" to permanently purge all legacy accounts and data.');
    process.exit(0);
  }

  // 2. Interactive confirmation if not --yes
  if (!yes) {
    console.log(`\nCAUTION: You are about to permanently purge ${totalLegacyRecords} legacy records and ${preview.legacyUsers.length} user accounts.`);
    const confirmation = await promptConfirm('Type "PURGE" to confirm deletion: ');
    if (confirmation !== 'PURGE') {
      console.log('\nConfirmation was not "PURGE". Aborting without changes.\n');
      process.exit(0);
    }
  }

  // 3. Execute purge
  console.log('\nPurging legacy records in FK-safe transaction...');
  try {
    await purgeLegacyData({ execute: true });
    console.log('\n==================================================');
    console.log('SUCCESS: All Legacy Accounts & Records Purged! 🎉');
    console.log('==================================================');
    console.log(`Users Purged:   ${preview.legacyUsers.length}`);
    console.log(`Records Purged: ${totalLegacyRecords} total rows`);
    console.log('==================================================\n');
  } catch (err: any) {
    console.error(`\n[FATAL ERROR] Purge failed and was rolled back: ${err.message}\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
