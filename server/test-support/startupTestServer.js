import { createApp } from '../src/app.js';
import jwt from 'jsonwebtoken';

const testSecret = 'test-secret-only-never-used-outside-tests-123456';

export const validStartup = {
  name: 'Northstar Health',
  industry: 'Health',
  description: 'A care coordination platform for underserved communities.',
  location: 'Pune, India',
  fundingStage: 'Seed',
  fundingGoal: 1_200_000,
  foundedYear: 2022,
  website: 'northstar.example',
};

function matches(startup, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$text') return `${startup.name} ${startup.industry} ${startup.location} ${startup.description}`.toLowerCase().includes(value.$search.toLowerCase());
    return startup[key] === value;
  });
}

export function makeStartupModel() {
  const records = [];
  return {
    records,
    find(filter) {
      let sortSpec = {};
      let skipCount = 0;
      let limitCount = records.length;
      const query = {
        sort(value) { sortSpec = value; return query; },
        skip(value) { skipCount = value; return query; },
        limit(value) { limitCount = value; return query; },
        async lean() {
          const matched = records.filter((item) => matches(item, filter));
          const [[field, direction]] = Object.entries(sortSpec);
          matched.sort((a, b) => (a[field] > b[field] ? direction : a[field] < b[field] ? -direction : 0));
          return matched.slice(skipCount, skipCount + limitCount).map((item) => ({ ...item }));
        },
      };
      return query;
    },
    async countDocuments(filter) { return records.filter((item) => matches(item, filter)).length; },
    findById(id) { return { lean: async () => records.find((item) => item._id === id) || null }; },
    findOne(filter) { return { lean: async () => records.find((item) => matchesFields(item, filter)) || null }; },
    async create(value) {
      const item = { moderationStatus: 'approved', ...value, _id: `${records.length + 1}`.padStart(24, '0') };
      records.push(item);
      return { ...item };
    },
    async findByIdAndUpdate(id, value) {
      const index = records.findIndex((item) => item._id === id);
      if (index < 0) return null;
      records[index] = { ...records[index], ...(value.$set || value) };
      return { ...records[index] };
    },
    async findByIdAndDelete(id) {
      const index = records.findIndex((item) => item._id === id);
      return index < 0 ? null : records.splice(index, 1)[0];
    },
    async deleteOne(filter) {
      const index = records.findIndex((item) => matchesFields(item, filter));
      if (index < 0) return { deletedCount: 0 };
      records.splice(index, 1);
      return { deletedCount: 1 };
    },
    async findOneAndUpdate(filter, value) {
      const index = records.findIndex((item) => matchesFields(item, filter));
      if (index < 0) return null;
      records[index] = { ...records[index], ...(value.$set || value) };
      for (const [field, item] of Object.entries(value.$addToSet || {})) {
        const items = records[index][field] || [];
        records[index][field] = items.includes(item) ? items : [...items, item];
      }
      return { ...records[index] };
    },
    async findOneAndDelete(filter) {
      const index = records.findIndex((item) => matchesFields(item, filter));
      return index < 0 ? null : records.splice(index, 1)[0];
    },
  };
}

export function makeUserModel() {
  const records = [];
  return {
    records,
    async create(value) {
      const user = { accountStatus: 'active', ...value, _id: `${records.length + 1}`.padStart(24, '0') };
      records.push(user);
      return { ...user };
    },
    async findById(id) { return records.find((user) => user._id === id) || null; },
    find(filter) { return findQuery(records, filter); },
    async countDocuments(filter = {}) { return records.filter((record) => matchesFields(record, filter)).length; },
    async findByIdAndUpdate(id, update) {
      const user = records.find((record) => record._id === id);
      if (!user) return null;
      for (const [path, value] of Object.entries(update.$set || update)) {
        const [parent, child] = path.split('.');
        if (child) user[parent] = { ...(user[parent] || {}), [child]: value };
        else user[parent] = value;
      }
      return { ...user };
    },
    async findOneAndUpdate(filter, update) {
      const user = records.find((record) => matchesFields(record, filter));
      if (!user) return null;
      for (const [path, value] of Object.entries(update.$set || update)) {
        const [parent, child] = path.split('.');
        if (child) user[parent] = { ...(user[parent] || {}), [child]: value };
        else user[parent] = value;
      }
      return { ...user };
    },
  };
}

export function makeSessionCookie(user) {
  const token = jwt.sign({ role: user.role }, testSecret, { subject: String(user._id), issuer: 'startupconnect', expiresIn: '1h' });
  return `startupconnect_session=${token}`;
}

function matchesFields(record, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (value && typeof value === 'object' && '$ne' in value) return String(record[key]) !== String(value.$ne);
    if (value && typeof value === 'object' && '$in' in value) return value.$in.some((item) => String(record[key]) === String(item));
    return String(record[key]) === String(value);
  });
}

function findQuery(records, filter) {
  let limit = records.length;
  const query = {
    sort() { return query; },
    select() { return query; },
    limit(value) { limit = value; return query; },
    async lean() { return records.filter((record) => matchesFields(record, filter)).slice(0, limit).map((record) => ({ ...record })); },
  };
  return query;
}

export function makeWatchlistModel() {
  const records = [];
  return {
    records,
    find(filter) { return findQuery(records, filter); },
    async findOne(filter) { return records.find((record) => matchesFields(record, filter)) || null; },
    async findOneAndUpdate(filter, update) {
      let record = records.find((entry) => matchesFields(entry, filter));
      if (!record) { record = { ...update.$setOnInsert, _id: `${records.length + 1}`.padStart(24, '0') }; records.push(record); }
      return { ...record };
    },
    async findOneAndDelete(filter) {
      const index = records.findIndex((record) => matchesFields(record, filter));
      return index < 0 ? null : records.splice(index, 1)[0];
    },
  };
}

export function makeConnectionRequestModel() {
  const records = [];
  return {
    records,
    find(filter) { return findQuery(records, filter); },
    async countDocuments(filter) { return records.filter((record) => matchesFields(record, filter)).length; },
    async create(value) {
      if (records.some((record) => record.investor === value.investor && record.startup === value.startup)) throw Object.assign(new Error('Duplicate connection.'), { code: 11000 });
      const record = { ...value, _id: `${records.length + 1}`.padStart(24, '0'), status: value.status || 'pending' };
      records.push(record);
      return { ...record };
    },
    async findOneAndUpdate(filter, update) {
      const record = records.find((entry) => matchesFields(entry, filter));
      if (!record) return null;
      Object.assign(record, update.$set);
      return { ...record };
    },
  };
}

export function makeNotificationModel() {
  const records = [];
  return {
    records,
    find(filter) { return findQuery(records, filter); },
    async create(value) {
      const record = { ...value, _id: `${records.length + 1}`.padStart(24, '0'), readAt: null };
      records.push(record);
      return { ...record };
    },
    async findOneAndUpdate(filter, update) {
      const record = records.find((entry) => matchesFields(entry, filter));
      if (!record) return null;
      Object.assign(record, update.$set);
      return { ...record };
    },
  };
}

export function makeStartupEventModel() {
  const records = [];
  return {
    records,
    async create(value) {
      const record = { ...value, _id: `${records.length + 1}`.padStart(24, '0'), createdAt: new Date() };
      records.push(record);
      return { ...record };
    },
    async countDocuments(filter) { return records.filter((record) => matchesFields(record, filter)).length; },
  };
}

export function makeReportModel() {
  const records = [];
  return {
    records,
    find(filter) { return findQuery(records, filter); },
    async countDocuments(filter) { return records.filter((record) => matchesFields(record, filter)).length; },
    async create(value) {
      const record = { ...value, status: 'pending', _id: `${records.length + 1}`.padStart(24, '0'), createdAt: new Date() };
      records.push(record);
      return { ...record };
    },
    async findOneAndUpdate(filter, update) {
      const record = records.find((entry) => matchesFields(entry, filter));
      if (!record) return null;
      Object.assign(record, update.$set);
      return { ...record };
    },
  };
}

export function makeUploadAssetModel() {
  const records = [];
  return {
    records,
    async create(value) {
      const asset = { ...value, _id: `${records.length + 1}`.padStart(24, '0'), createdAt: new Date() };
      records.push(asset);
      return { ...asset };
    },
    async deleteOne(filter) {
      const index = records.findIndex((record) => record._id === filter._id);
      if (index < 0) return { deletedCount: 0 };
      records.splice(index, 1);
      return { deletedCount: 1 };
    },
  };
}

export async function startStartupTestServer(model = makeStartupModel(), userModel = makeUserModel(), platformModels = {}) {
  const models = {
    watchlistModel: platformModels.watchlistModel || makeWatchlistModel(),
    connectionRequestModel: platformModels.connectionRequestModel || makeConnectionRequestModel(),
    notificationModel: platformModels.notificationModel || makeNotificationModel(),
    startupEventModel: platformModels.startupEventModel || makeStartupEventModel(),
    reportModel: platformModels.reportModel || makeReportModel(),
    assetModel: platformModels.assetModel || makeUploadAssetModel(),
    uploadStorage: platformModels.uploadStorage || null,
  };
  const server = createApp({ startupModel: model, userModel, jwtSecret: testSecret, ...models }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  return {
    model,
    userModel,
    ...models,
    assetModel: models.assetModel,
    uploadStorage: models.uploadStorage,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}
