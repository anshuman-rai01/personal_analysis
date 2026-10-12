import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { pool } from './db/index.ts';
import { validateDbEnv } from './db/envCheck.ts';
import { checkDatabase } from './db/health.ts';
import { apiRouter } from './routes/index.ts';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Mount all modular API routes under /api
app.use('/api', apiRouter);

// Setup Vite middleware for local development or static hosting in production
async function startServer() {
  // Validate database environment variables on startup
  const envProblems = validateDbEnv(process.env);
  if (envProblems.length > 0) {
    console.warn('\n⚠️  [Database Configuration Warnings]:');
    for (const problem of envProblems) {
      console.warn(`   - ${problem}`);
    }
    console.warn('');
  }

  // Non-mutating database startup verification
  try {
    const health = await checkDatabase(pool);
    if (health.status === 'ok') {
      console.log('✅ Database connected, schema OK');
    } else if (health.database.connected && health.database.missingTables.length > 0) {
      console.error(
        `❌ Database connected, but missing required tables: ${health.database.missingTables.join(', ')}`
      );
      console.error('👉 Run "npm run db:setup" to create missing tables.\n');
    } else {
      console.error(
        '❌ Failed to connect to database. Ensure PostgreSQL is running and check your .env credentials.'
      );
      console.error('👉 Run "npm run db:setup" to configure and verify your database.\n');
    }
  } catch (err: any) {
    console.error(`❌ Database startup check error: ${err.message || err}`);
    console.error('👉 Run "npm run db:setup" to set up your database.\n');
  }

  const isProd = process.env.NODE_ENV === 'production';
  const frontendDir = path.resolve(import.meta.dirname, '../../frontend');
  if (!isProd) {
    const vite = await createViteServer({
      root: frontendDir,
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(frontendDir, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OmniLife Studio full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
