import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { db } from '../db/index.ts';
import { forecastModels } from '../db/schema.ts';
import { eq, desc } from 'drizzle-orm';

const execFileAsync = promisify(execFile);
const PYTHON_CMD = process.env.PYTHON_CMD || (process.platform === 'win32' ? 'python' : 'python3');

export const mlRouter = Router();

mlRouter.post('/ml/train', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const { datasetType, customCsvContent } = req.body; // 'study' | 'finance' | 'habits'
    const type = datasetType || 'study';

    let csvTempPath = '';
    if (customCsvContent && typeof customCsvContent === 'string' && customCsvContent.length > 50) {
      csvTempPath = path.resolve(`temp_${Date.now()}_${type}.csv`);
      fs.writeFileSync(csvTempPath, customCsvContent, 'utf-8');
    }

    const scriptPath = path.resolve('python_service/ml_engine.py');
    const args = [scriptPath, 'train', type];
    if (csvTempPath) args.push(csvTempPath);

    const { stdout, stderr } = await execFileAsync(PYTHON_CMD, args);
    if (csvTempPath && fs.existsSync(csvTempPath)) {
      fs.unlinkSync(csvTempPath);
    }

    if (stderr && !stdout) {
      console.error('Python ML training error:', stderr);
      return res.status(500).json({ error: 'Python ML training failed: ' + stderr });
    }

    const result = JSON.parse(stdout);

    // Save model record to PostgreSQL
    await db.insert(forecastModels).values({
      userId: uid,
      datasetType: type,
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
