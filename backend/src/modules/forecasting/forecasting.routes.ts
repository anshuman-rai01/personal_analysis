import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { forecastModels } from '../../db/schema.ts';
import { eq, desc } from 'drizzle-orm';
import {
  FORECAST_MIN_ACTIVE_DAYS,
  FORECAST_MIN_CSV_ROWS,
  countCsvDataRows,
  buildInsufficientBody,
  ForecastModuleType,
} from './thresholds.ts';
import { getForecastReadiness } from './readiness.ts';

const execFileAsync = promisify(execFile);
const PYTHON_CMD = process.env.PYTHON_CMD || (process.platform === 'win32' ? 'python' : 'python3');

export type PythonRunner = (args: string[]) => Promise<{ stdout: string; stderr: string }>;
let customPythonRunner: PythonRunner | null = null;

export function setPythonRunner(runner: PythonRunner | null) {
  customPythonRunner = runner;
}

export function resetPythonRunner() {
  customPythonRunner = null;
}

export const mlRouter = Router();

/**
 * GET /api/forecasting/readiness
 * Returns user readiness progress across study, finance, and habits.
 */
mlRouter.get('/forecasting/readiness', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const readiness = await getForecastReadiness(uid, db);
    res.json(readiness);
  } catch (error: any) {
    console.error('Forecast readiness error:', error);
    res.status(500).json({ error: 'Failed to evaluate forecasting readiness' });
  }
});

/**
 * POST /api/ml/train
 * Server-gated ML model training. Rejects with 422 INSUFFICIENT_DATA before starting Python.
 */
mlRouter.post('/ml/train', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const { datasetType, customCsvContent } = req.body;

    const validModules: ForecastModuleType[] = ['study', 'finance', 'habits'];
    if (!datasetType || !validModules.includes(datasetType)) {
      return res.status(400).json({
        error: `datasetType must be one of: ${validModules.join(', ')}`,
      });
    }

    const modType = datasetType as ForecastModuleType;

    // Check thresholds: custom CSV vs tracked user history
    if (customCsvContent && typeof customCsvContent === 'string' && customCsvContent.trim().length > 0) {
      const csvRows = countCsvDataRows(customCsvContent);
      if (csvRows < FORECAST_MIN_CSV_ROWS) {
        return res
          .status(422)
          .json(buildInsufficientBody(modType, 'csv', csvRows, FORECAST_MIN_CSV_ROWS));
      }
    } else {
      const readiness = await getForecastReadiness(uid, db);
      const modReadiness = readiness.modules[modType];
      if (!modReadiness.allowed) {
        return res
          .status(422)
          .json(
            buildInsufficientBody(
              modType,
              'tracked',
              modReadiness.distinctDays,
              FORECAST_MIN_ACTIVE_DAYS
            )
          );
      }
    }

    let csvTempPath = '';
    if (customCsvContent && typeof customCsvContent === 'string' && customCsvContent.trim().length > 0) {
      csvTempPath = path.resolve(`temp_${Date.now()}_${modType}.csv`);
      fs.writeFileSync(csvTempPath, customCsvContent, 'utf-8');
    }

    const scriptCandidate = path.resolve(import.meta.dirname, '../../python_service/ml_engine.py');
    const scriptPath = fs.existsSync(scriptCandidate) ? scriptCandidate : path.resolve('backend/python_service/ml_engine.py');
    const args = [scriptPath, 'train', modType];
    if (csvTempPath) args.push(csvTempPath);

    let stdout = '';
    let stderr = '';

    try {
      if (customPythonRunner) {
        const out = await customPythonRunner(args);
        stdout = out.stdout;
        stderr = out.stderr;
      } else {
        const out = await execFileAsync(PYTHON_CMD, args);
        stdout = out.stdout;
        stderr = out.stderr;
      }
    } finally {
      if (csvTempPath && fs.existsSync(csvTempPath)) {
        try {
          fs.unlinkSync(csvTempPath);
        } catch (_e) {
          // Ignore temp cleanup errors
        }
      }
    }

    if (stderr && !stdout) {
      console.error('Python ML training error:', stderr);
      return res.status(500).json({ error: 'Python ML training failed: ' + stderr });
    }

    const result = JSON.parse(stdout);

    // Save model record to PostgreSQL
    await db.insert(forecastModels).values({
      userId: uid,
      datasetType: modType,
      recordCount: result.record_count || 1200,
      features: JSON.stringify(result.features),
      metrics: JSON.stringify({
        r2: result.r2_score,
        mae: result.mae,
        mse: result.mse,
        featureImportances: result.feature_importances,
        forecastSeries: result.forecast_series,
      }),
    });

    res.json(result);
  } catch (error: any) {
    console.error('Train ML endpoint error:', error);
    res.status(500).json({ error: error.message || 'Failed to train forecasting model' });
  }
});

mlRouter.get('/ml/models', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const models = await db
      .select()
      .from(forecastModels)
      .where(eq(forecastModels.userId, uid))
      .orderBy(desc(forecastModels.trainedAt));
    res.json(models);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch trained models' });
  }
});
