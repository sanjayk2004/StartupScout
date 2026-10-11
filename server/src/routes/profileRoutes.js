import { Router } from 'express';
import { createProfileController } from '../controllers/profileController.js';
import { createAuthenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

export function createProfileRouter({ UserModel, StartupModel, jwtSecret }) {
  const router = Router();
  const controller = createProfileController({ UserModel, StartupModel });
  const authenticate = createAuthenticate({ userModel: UserModel, jwtSecret });
  router.use(authenticate);
  router.get('/me', authorize('investor', 'founder'), controller.getMine);
  router.patch('/me', authorize('investor', 'founder'), controller.updateMine);
  router.patch('/me/startup', authorize('founder'), controller.updateStartup);
  router.post('/me/startup/verification', authorize('founder'), controller.requestVerification);
  router.get('/investors', authorize('founder'), controller.discoverInvestors);
  return router;
}
