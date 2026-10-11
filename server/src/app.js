import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { loadEnvironment } from './config/environment.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { Startup } from './models/Startup.js';
import { User } from './models/User.js';
import { Watchlist } from './models/Watchlist.js';
import { ConnectionRequest } from './models/ConnectionRequest.js';
import { Notification } from './models/Notification.js';
import { StartupEvent } from './models/StartupEvent.js';
import { Report } from './models/Report.js';
import { UploadAsset } from './models/UploadAsset.js';
import { createAuthRouter } from './routes/authRoutes.js';
import { createPlatformRouter } from './routes/platformRoutes.js';
import { createStartupRouter } from './routes/startupRoutes.js';
import { createAnalyticsRouter } from './routes/analyticsRoutes.js';
import { createAdminRouter } from './routes/adminRoutes.js';
import { createProfileRouter } from './routes/profileRoutes.js';
import { createUploadRouter } from './routes/uploadRoutes.js';
import { createS3Storage } from './storage/s3Storage.js';

const config = loadEnvironment();

export function createApp({ startupModel = Startup, userModel = User, watchlistModel = Watchlist, connectionRequestModel = ConnectionRequest, notificationModel = Notification, startupEventModel = StartupEvent, reportModel = Report, assetModel = UploadAsset, uploadStorage = createS3Storage(config.storage), jwtSecret = config.jwtSecret } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin.split(',').map((origin) => origin.trim()), credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/startups', createStartupRouter({ StartupModel: startupModel, StartupEventModel: startupEventModel, UserModel: userModel, jwtSecret }));
  app.use('/api/auth', createAuthRouter({ userModel, startupModel, jwtSecret, production: config.nodeEnv === 'production' }));
  app.use('/api/profiles', createProfileRouter({ UserModel: userModel, StartupModel: startupModel, jwtSecret }));
  app.use('/api/uploads', createUploadRouter({ UserModel: userModel, StartupModel: startupModel, AssetModel: assetModel, storage: uploadStorage, jwtSecret }));
  app.use('/api', createPlatformRouter({ StartupModel: startupModel, UserModel: userModel, WatchlistModel: watchlistModel, ConnectionRequestModel: connectionRequestModel, NotificationModel: notificationModel, ReportModel: reportModel, jwtSecret }));
  app.use('/api/analytics', createAnalyticsRouter({ StartupModel: startupModel, StartupEventModel: startupEventModel, ConnectionRequestModel: connectionRequestModel, UserModel: userModel, jwtSecret }));
  app.use('/api/admin', createAdminRouter({ StartupModel: startupModel, ReportModel: reportModel, UserModel: userModel, ConnectionRequestModel: connectionRequestModel, jwtSecret }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export const app = createApp();
