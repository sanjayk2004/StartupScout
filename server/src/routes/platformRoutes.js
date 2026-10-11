import { Router } from 'express';
import { createPlatformController } from '../controllers/platformController.js';
import { createAuthenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { createAdminController } from '../controllers/adminController.js';

export function createPlatformRouter({ StartupModel, UserModel, WatchlistModel, ConnectionRequestModel, NotificationModel, ReportModel, jwtSecret }) {
  const router = Router();
  const controller = createPlatformController({ StartupModel, WatchlistModel, ConnectionRequestModel, NotificationModel });
  const authenticate = createAuthenticate({ userModel: UserModel, jwtSecret });
  const reportController = createAdminController({ StartupModel, ReportModel });

  router.get('/watchlist', authenticate, authorize('investor'), controller.listWatchlist);
  router.put('/watchlist/:startupId', authenticate, authorize('investor'), controller.addWatchlist);
  router.delete('/watchlist/:startupId', authenticate, authorize('investor'), controller.removeWatchlist);
  router.get('/connections', authenticate, authorize('investor', 'founder'), controller.listConnections);
  router.post('/connections', authenticate, authorize('investor'), controller.createConnection);
  router.patch('/connections/:id', authenticate, authorize('founder'), controller.resolveConnection);
  router.get('/notifications', authenticate, controller.listNotifications);
  router.patch('/notifications/:id/read', authenticate, controller.readNotification);
  router.post('/reports', authenticate, authorize('investor', 'founder'), reportController.createReport);
  return router;
}
