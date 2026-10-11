const sortableFields = new Set(['name', 'fundingGoal', 'foundedYear', 'createdAt']);

export function buildStartupQuery(query) {
  const filter = { moderationStatus: 'approved' };
  const search = typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '';
  if (search) filter.$text = { $search: search };
  if (typeof query.industry === 'string' && query.industry.trim()) filter.industry = query.industry.trim();
  const stage = query.fundingStage || query.stage;
  if (typeof stage === 'string' && stage.trim()) filter.fundingStage = stage.trim();
  if (typeof query.location === 'string' && query.location.trim()) filter.location = query.location.trim();
  const requestedSort = sortableFields.has(query.sort) ? query.sort : 'createdAt';
  const direction = query.order === 'asc' ? 1 : -1;
  return { filter, sort: { [requestedSort]: direction, _id: 1 } };
}

export function parsePagination(query) {
  const page = Math.max(1, Math.trunc(Number(query.page) || 1));
  const limit = Math.min(100, Math.max(1, Math.trunc(Number(query.limit) || 24)));
  return { page, limit, skip: (page - 1) * limit };
}

export function createStartupService(StartupModel) {
  return {
    async list(query) {
      const { filter, sort } = buildStartupQuery(query);
      const { page, limit, skip } = parsePagination(query);
      const [items, total] = await Promise.all([
        StartupModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
        StartupModel.countDocuments(filter),
      ]);
      return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
    },
    async get(id) {
      const item = await StartupModel.findById(id).lean();
      if (!item || item.moderationStatus !== 'approved') throw Object.assign(new Error('Startup not found.'), { statusCode: 404 });
      return item;
    },
    async listOwned(owner) {
      return StartupModel.find({ owner }).sort({ createdAt: -1 }).limit(100).lean();
    },
    create(value) { return StartupModel.create(value); },
    async update(id, value, user) {
      const filter = user.role === 'admin' ? { _id: id } : { _id: id, owner: user.id };
      const item = await StartupModel.findOneAndUpdate(filter, value, { new: true, runValidators: true });
      if (!item) throw Object.assign(new Error('Startup not found.'), { statusCode: 404 });
      return item;
    },
    async remove(id, user) {
      const filter = user.role === 'admin' ? { _id: id } : { _id: id, owner: user.id };
      const item = await StartupModel.findOneAndDelete(filter);
      if (!item) throw Object.assign(new Error('Startup not found.'), { statusCode: 404 });
    },
  };
}
