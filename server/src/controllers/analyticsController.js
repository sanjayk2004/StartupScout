import mongoose from 'mongoose';
import { createAnalyticsService } from '../services/analyticsService.js';

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

export function createAnalyticsController({ StartupModel, StartupEventModel, ConnectionRequestModel }) {
  const analytics = createAnalyticsService({ StartupModel, StartupEventModel, ConnectionRequestModel });
  return {
    founder: asyncRoute(async (req, res) => {
      if (!mongoose.isValidObjectId(req.user.id)) return res.status(400).json({ error: { message: 'Invalid account id.' } });
      return res.json({ data: await analytics.getFounderAnalytics(req.user.id) });
    }),
  };
}
