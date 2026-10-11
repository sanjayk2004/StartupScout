import { Router } from 'express';
import { createStartupController } from '../controllers/startupController.js';
import { createAuthenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

export function createStartupRouter({ StartupModel, StartupEventModel, UserModel, jwtSecret }) {
  const router = Router();
  const controller = createStartupController(StartupModel, StartupEventModel);
  const authenticate = createAuthenticate({ userModel: UserModel, jwtSecret });
  const authenticateOptional = createAuthenticate({ userModel: UserModel, jwtSecret, optional: true });
  router.get('/', controller.list);
  router.get('/mine', authenticate, authorize('founder'), controller.mine);
  router.get('/:id', authenticateOptional, controller.get);
  router.post('/', authenticate, authorize('founder'), controller.create);
  router.patch('/:id', authenticate, authorize('founder', 'admin'), controller.update);
  router.delete('/:id', authenticate, authorize('founder', 'admin'), controller.remove);
  return router;
}
