import { Router } from 'express';
import { healthRouter } from '../modules/health/health.routes.ts';
import { userRouter } from '../modules/users/users.routes.ts';
import { studyRouter } from '../modules/study/study.routes.ts';
import { financeRouter } from '../modules/finance/finance.routes.ts';
import { habitsRouter } from '../modules/habits/habits.routes.ts';
import { goalsRouter } from '../modules/goals/goals.routes.ts';
import { mlRouter } from '../modules/forecasting/forecasting.routes.ts';
import { simulationRouter } from '../modules/simulation/simulation.routes.ts';
import { docsRouter } from '../modules/documents/documents.routes.ts';
import { dashboardRouter } from '../modules/dashboard/dashboard.routes.ts';
import { assistantRouter } from '../modules/assistant/assistant.routes.ts';

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
