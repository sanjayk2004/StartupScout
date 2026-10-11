import { Router } from 'express';
import { createAdminController } from '../controllers/adminController.js';
import { createAuthenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

export function createAdminRouter({ StartupModel, ReportModel, UserModel, ConnectionRequestModel, jwtSecret }) {
  const router = Router();
  const controller = createAdminController({ StartupModel, ReportModel, UserModel, ConnectionRequestModel });
  const authenticate = createAuthenticate({ userModel: UserModel, jwtSecret });
  router.use(authenticate, authorize('admin'));
  router.get('/overview', controller.overview);
  router.get('/users', controller.listAccounts);
  router.patch('/users/:id/status', controller.setAccountStatus);
  router.get('/startups/pending', controller.listStartups);
  router.patch('/startups/:id/moderation', controller.moderateStartup);
  router.get('/startups/verification', controller.listVerificationRequests);
  router.patch('/startups/:id/verification', controller.reviewVerification);
  router.get('/reports', controller.listReports);
  router.patch('/reports/:id', controller.resolveReport);
  return router;
}
