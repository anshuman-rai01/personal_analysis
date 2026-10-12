import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { db } from '../../db/index.ts';
import { simulationScenarios } from '../../db/schema.ts';
import { eq, desc, and } from 'drizzle-orm';

const execFileAsync = promisify(execFile);
const PYTHON_CMD = process.env.PYTHON_CMD || (process.platform === 'win32' ? 'python' : 'python3');

export const simulationRouter = Router();

simulationRouter.post('/simulation/run', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { scenarioType, params } = req.body;
    const scriptCandidate = path.resolve(import.meta.dirname, '../../python_service/ml_engine.py');
    const scriptPath = fs.existsSync(scriptCandidate) ? scriptCandidate : path.resolve('backend/python_service/ml_engine.py');
    const { stdout, stderr } = await execFileAsync(PYTHON_CMD, [
      scriptPath,
      'simulate',
      scenarioType || 'study_career',
      JSON.stringify(params || {}),
    ]);

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

simulationRouter.delete('/simulation/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.uid;
    const id = parseInt(req.params.id, 10);
    await db.delete(simulationScenarios).where(and(eq(simulationScenarios.id, id), eq(simulationScenarios.userId, uid)));
    res.json({ success: true, id });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete scenario' });
  }
});
