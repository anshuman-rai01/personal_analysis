import { Router } from 'express';
import { pool } from '../db/index.ts';
import { getCachedHealth } from '../db/health.ts';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  try {
    const health = await getCachedHealth(pool);
    res.json(health);
  } catch (_err) {
    res.json({
      status: 'degraded',
      database: {
        connected: false,
        schema: 'unknown',
        missingTables: [],
      },
    });
  }
});
