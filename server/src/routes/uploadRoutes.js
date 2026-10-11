import express, { Router } from 'express';
import { createUploadController } from '../controllers/uploadController.js';
import { createAuthenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

export function createUploadRouter({ UserModel, StartupModel, AssetModel, storage, jwtSecret }) {
  const router = Router();
  const controller = createUploadController({ UserModel, StartupModel, AssetModel, storage });
  const authenticate = createAuthenticate({ userModel: UserModel, jwtSecret });
  const parseImageBody = express.raw({ type: '*/*', limit: '5mb' });

  router.post('/:purpose', authenticate, authorize('investor', 'founder'), (req, res, next) => {
    parseImageBody(req, res, (error) => {
      if (error?.type === 'entity.too.large') return res.status(413).json({ error: { message: 'Image must be no larger than 5 MB.' } });
      if (error) return res.status(400).json({ error: { message: 'Image upload could not be read.' } });
      return next();
    });
  }, controller.upload);

  return router;
}
