import mongoose from 'mongoose';
import { validateStartup } from '../validators/startup.js';
import { createStartupService } from '../services/startupService.js';

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

export function createStartupController(StartupModel, StartupEventModel) {
  const service = createStartupService(StartupModel);
  return {
    list: asyncRoute(async (req, res) => {
      const result = await service.list(req.query);
      return res.json({ data: result.items, pagination: result.pagination });
    }),
    mine: asyncRoute(async (req, res) => res.json({ data: await service.listOwned(req.user.id) })),
    get: asyncRoute(async (req, res) => {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: { message: 'Invalid startup id.' } });
      const startup = await service.get(req.params.id);
      const isOwner = req.user?.role === 'founder' && String(startup.owner) === req.user.id;
      if (!isOwner && req.user?.role !== 'admin') await StartupEventModel.create({ startup: startup._id || startup.id, type: 'profile_view' });
      return res.json({ data: startup });
    }),
    create: asyncRoute(async (req, res) => {
      const { value, errors } = validateStartup(req.body || {});
      if (Object.keys(errors).length) return res.status(400).json({ error: { message: 'Startup validation failed.', fields: errors } });
      const startup = await service.create({ ...value, owner: req.user.id, moderationStatus: 'pending' });
      return res.status(201).json({ data: startup });
    }),
    update: asyncRoute(async (req, res) => {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: { message: 'Invalid startup id.' } });
      const { value, errors } = validateStartup(req.body || {}, { partial: true });
      if (Object.keys(errors).length) return res.status(400).json({ error: { message: 'Startup validation failed.', fields: errors } });
      if (!Object.keys(value).length) return res.status(400).json({ error: { message: 'Provide at least one startup field to update.' } });
      return res.json({ data: await service.update(req.params.id, value, req.user) });
    }),
    remove: asyncRoute(async (req, res) => {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: { message: 'Invalid startup id.' } });
      await service.remove(req.params.id, req.user);
      return res.status(204).end();
    }),
  };
}
