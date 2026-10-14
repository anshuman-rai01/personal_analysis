import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { simulationScenarios } from '../../db/schema.ts';
import { eq, desc, and } from 'drizzle-orm';
import {
  FORECAST_MIN_ACTIVE_DAYS,
  scenarioToModule,
  buildInsufficientBody,
} from '../forecasting/thresholds.ts';
import { getForecastReadiness } from '../forecasting/readiness.ts';

const execFileAsync = promisify(execFile);
const PYTHON_CMD = process.env.PYTHON_CMD || (process.platform === 'win32' ? 'python' : 'python3');

export type SimulationRunner = (args: string[]) => Promise<{ stdout: string; stderr: string }>;
let customSimulationRunner: SimulationRunner | null = null;

export function setSimulationRunner(runner: SimulationRunner | null) {
  customSimulationRunner = runner;
}

export function resetSimulationRunner() {
  customSimulationRunner = null;
}

export const simulationRouter = Router();

/**
 * POST /api/simulation/run
 * Server-gated what-if scenario simulation.
 * Rejects with 400 for unknown scenario, 422 INSUFFICIENT_DATA if threshold not met.
 */
simulationRouter.post('/simulation/run', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const { scenarioType, params } = req.body;

    const targetModule = scenarioToModule(scenarioType);
    if (!targetModule) {
      return res.status(400).json({
        error:
          'Unknown scenarioType: must be one of study_career, wealth_accumulation, lifestyle_habits',
      });
    }

    // Check minimum threshold
    const readiness = await getForecastReadiness(uid, db);
    const modReadiness = readiness.modules[targetModule];
    if (!modReadiness.allowed) {
      return res
        .status(422)
        .json(
          buildInsufficientBody(
            targetModule,
            'tracked',
            modReadiness.distinctDays,
            FORECAST_MIN_ACTIVE_DAYS
          )
        );
    }

    const scriptCandidate = path.resolve(import.meta.dirname, '../../python_service/ml_engine.py');
    const scriptPath = fs.existsSync(scriptCandidate) ? scriptCandidate : path.resolve('backend/python_service/ml_engine.py');
    const args = [
      scriptPath,
      'simulate',
      scenarioType,
      JSON.stringify(params || {}),
    ];

    let stdout = '';
    let stderr = '';

    if (customSimulationRunner) {
      const out = await customSimulationRunner(args);
      stdout = out.stdout;
      stderr = out.stderr;
    } else {
      const out = await execFileAsync(PYTHON_CMD, args);
      stdout = out.stdout;
      stderr = out.stderr;
    }

    if (stderr && !stdout) {
      return res.status(500).json({ error: 'Simulation engine error: ' + stderr });
    }

    const result = JSON.parse(stdout);
    res.json(result);
  } catch (error: any) {
    console.error('Simulation error:', error);
    res.status(500).json({ error: error.message || 'Failed to run simulation' });
  }
});

simulationRouter.post('/simulation/save', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const { name, category, parameters, projections, riskScore, recommendations } = req.body;

    const inserted = await db
      .insert(simulationScenarios)
      .values({
        userId: uid,
        name: name || 'Custom Scenario',
        category: category || 'study_career',
        parameters: typeof parameters === 'string' ? parameters : JSON.stringify(parameters),
        projections: typeof projections === 'string' ? projections : JSON.stringify(projections),
        riskScore: parseInt(riskScore || '25', 10),
        recommendations: Array.isArray(recommendations) ? recommendations.join('; ') : (recommendations || ''),
      })
      .returning();

    res.json(inserted[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to save simulation scenario' });
  }
});

simulationRouter.get('/simulation/saved', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const scenarios = await db
      .select()
      .from(simulationScenarios)
      .where(eq(simulationScenarios.userId, uid))
      .orderBy(desc(simulationScenarios.createdAt));
    res.json(scenarios);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch saved scenarios' });
  }
});

simulationRouter.delete('/simulation/saved/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const id = parseInt(req.params.id, 10);
    await db
      .delete(simulationScenarios)
      .where(and(eq(simulationScenarios.id, id), eq(simulationScenarios.userId, uid)));
    res.json({ success: true, id });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete scenario' });
  }
});
