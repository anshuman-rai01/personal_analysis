import { Router } from 'express';
import { healthRouter } from './health.ts';
import { userRouter } from './user.ts';
import { studyRouter } from './study.ts';
import { financeRouter } from './finance.ts';
import { habitsRouter } from './habits.ts';
import { goalsRouter } from './goals.ts';
import { mlRouter } from './ml.ts';
import { simulationRouter } from './simulation.ts';
import { docsRouter } from './docs.ts';
import { dashboardRouter } from './dashboard.ts';
import { assistantRouter } from './assistant.ts';

export const apiRouter = Router();

// Mount modular sub-routers
apiRouter.use(healthRouter);
apiRouter.use(userRouter);
apiRouter.use(studyRouter);
apiRouter.use(financeRouter);
apiRouter.use(habitsRouter);
apiRouter.use(goalsRouter);
apiRouter.use(mlRouter);
apiRouter.use(simulationRouter);
apiRouter.use(docsRouter);
apiRouter.use(dashboardRouter);
apiRouter.use('/assistant', assistantRouter);
apiRouter.use('/chat', assistantRouter);
