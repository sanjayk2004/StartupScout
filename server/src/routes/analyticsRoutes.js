import { Router } from 'express';
import { createAnalyticsController } from '../controllers/analyticsController.js';
import { createAuthenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

export function createAnalyticsRouter({ StartupModel, StartupEventModel, ConnectionRequestModel, UserModel, jwtSecret }) {
  const router = Router();
  const controller = createAnalyticsController({ StartupModel, StartupEventModel, ConnectionRequestModel });
  router.get('/founder', createAuthenticate({ userModel: UserModel, jwtSecret }), authorize('founder'), controller.founder);
  return router;
}
