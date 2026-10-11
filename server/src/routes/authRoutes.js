import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createAuthController } from '../controllers/authController.js';
import { createAuthenticate } from '../middleware/authenticate.js';

export function createAuthRouter({ userModel, startupModel, jwtSecret, production = false }) {
  const router = Router();
  const controller = createAuthController({ userModel, startupModel, jwtSecret, production });
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const authenticate = createAuthenticate({ userModel, jwtSecret });

  router.post('/register/investor', authLimiter, controller.registerInvestor);
  router.post('/register/founder', authLimiter, controller.registerFounder);
  router.post('/login', authLimiter, controller.login);
  router.post('/logout', controller.logout);
  router.get('/me', authenticate, controller.me);
  return router;
}
