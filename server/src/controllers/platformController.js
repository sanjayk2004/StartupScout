import mongoose from 'mongoose';
import { createStartupService } from '../services/startupService.js';

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const objectIdIsValid = (id) => mongoose.isValidObjectId(id);

export function createPlatformController({ StartupModel, WatchlistModel, ConnectionRequestModel, NotificationModel }) {
  const startups = createStartupService(StartupModel);

  const getApprovedStartup = async (id) => {
    if (!objectIdIsValid(id)) return null;
    const startup = await startups.get(id).catch((error) => error.statusCode === 404 ? null : Promise.reject(error));
    return startup?.moderationStatus === 'approved' ? startup : null;
  };

  return {
    listWatchlist: asyncRoute(async (req, res) => {
      const items = await WatchlistModel.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(100).lean();
      return res.json({ data: items });
    }),
    addWatchlist: asyncRoute(async (req, res) => {
      const startup = await getApprovedStartup(req.params.startupId);
      if (!startup) return res.status(404).json({ error: { message: 'Startup not found.' } });
      try {
        const item = await WatchlistModel.findOneAndUpdate(
          { user: req.user.id, startup: startup._id || startup.id },
          { $setOnInsert: { user: req.user.id, startup: startup._id || startup.id } },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
        return res.status(200).json({ data: item });
      } catch (error) {
        if (error.code !== 11000) throw error;
        const item = await WatchlistModel.findOne({ user: req.user.id, startup: startup._id || startup.id });
        return res.status(200).json({ data: item });
      }
    }),
    removeWatchlist: asyncRoute(async (req, res) => {
      if (!objectIdIsValid(req.params.startupId)) return res.status(404).json({ error: { message: 'Startup not found.' } });
      await WatchlistModel.findOneAndDelete({ user: req.user.id, startup: req.params.startupId });
      return res.status(204).end();
    }),
    listConnections: asyncRoute(async (req, res) => {
      const filter = req.user.role === 'founder' ? { founder: req.user.id } : { investor: req.user.id };
      const items = await ConnectionRequestModel.find(filter).sort({ createdAt: -1 }).limit(100).lean();
      return res.json({ data: items });
    }),
    createConnection: asyncRoute(async (req, res) => {
      const startup = await getApprovedStartup(req.body?.startupId);
      if (!startup || !startup.owner) return res.status(404).json({ error: { message: 'Startup is unavailable for connection requests.' } });
      if (String(startup.owner) === String(req.user.id)) return res.status(400).json({ error: { message: 'You cannot request a connection with your own startup.' } });
      const message = req.body?.message === undefined ? '' : req.body.message;
      if (typeof message !== 'string' || message.trim().length > 1000) {
        return res.status(400).json({ error: { message: 'Message must be 1000 characters or fewer.' } });
      }
      let connection;
      try {
        connection = await ConnectionRequestModel.create({
          startup: startup._id || startup.id,
          investor: req.user.id,
          founder: String(startup.owner),
          message: message.trim(),
          status: 'pending',
        });
      } catch (error) {
        if (error.code === 11000) return res.status(409).json({ error: { message: 'A connection request for this startup already exists.' } });
        throw error;
      }
      await NotificationModel.create({
        recipient: String(startup.owner), actor: req.user.id, startup: startup._id || startup.id,
        connectionRequest: connection._id || connection.id, type: 'connection_requested',
      });
      return res.status(201).json({ data: connection });
    }),
    resolveConnection: asyncRoute(async (req, res) => {
      if (!objectIdIsValid(req.params.id)) return res.status(404).json({ error: { message: 'Connection request not found.' } });
      const status = req.body?.status;
      if (!['accepted', 'declined'].includes(status)) return res.status(400).json({ error: { message: 'Choose accepted or declined.' } });
      const connection = await ConnectionRequestModel.findOneAndUpdate(
        { _id: req.params.id, founder: req.user.id, status: 'pending' },
        { $set: { status, resolvedAt: new Date() } },
        { new: true, runValidators: true },
      );
      if (!connection) return res.status(404).json({ error: { message: 'Pending connection request not found.' } });
      await NotificationModel.create({
        recipient: String(connection.investor), actor: req.user.id, startup: connection.startup,
        connectionRequest: connection._id || connection.id, type: `connection_${status}`,
      });
      return res.json({ data: connection });
    }),
    listNotifications: asyncRoute(async (req, res) => {
      const items = await NotificationModel.find({ recipient: req.user.id }).sort({ createdAt: -1 }).limit(100).lean();
      return res.json({ data: items });
    }),
    readNotification: asyncRoute(async (req, res) => {
      if (!objectIdIsValid(req.params.id)) return res.status(404).json({ error: { message: 'Notification not found.' } });
      const notification = await NotificationModel.findOneAndUpdate(
        { _id: req.params.id, recipient: req.user.id },
        { $set: { readAt: new Date() } },
        { new: true },
      );
      if (!notification) return res.status(404).json({ error: { message: 'Notification not found.' } });
      return res.json({ data: notification });
    }),
  };
}
