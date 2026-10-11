import { validateProfileUpdate } from '../validators/profile.js';
import { validateStartup } from '../validators/startup.js';

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function plain(value) {
  if (!value) return value;
  return typeof value.toObject === 'function' ? value.toObject() : value;
}

function serializeSelf(user) {
  const id = String(user.id || user._id);
  return {
    id,
    displayName: user.displayName,
    email: user.email,
    role: user.role,
    accountStatus: user.accountStatus || 'active',
    profile: plain(user[user.role === 'investor' ? 'investorProfile' : 'founderProfile']) || {},
  };
}

function publicInvestor(user) {
  const profile = plain(user.investorProfile) || {};
  return {
    id: String(user.id || user._id),
    displayName: user.displayName,
    profile: {
      profilePhotoUrl: profile.profilePhotoUrl || '',
      biography: profile.biography || '',
      investmentThesis: profile.investmentThesis || '',
      investorType: profile.investorType,
      organizationName: profile.organizationName || '',
      industriesOfInterest: profile.industriesOfInterest || [],
      preferredFundingStages: profile.preferredFundingStages || [],
      preferredStartupLocations: profile.preferredStartupLocations || [],
      website: profile.website || '',
      linkedInUrl: profile.linkedInUrl || '',
    },
  };
}

function normalized(value) {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase() : '';
}

export function createProfileController({ UserModel, StartupModel }) {
  return {
    getMine: asyncRoute(async (req, res) => {
      const user = await UserModel.findById(req.user.id);
      if (!user || !['investor', 'founder'].includes(user.role)) return res.status(404).json({ error: { message: 'Profile not found.' } });
      let startup = null;
      if (user.role === 'founder' && user.primaryStartup) {
        startup = await StartupModel.findOne({ _id: user.primaryStartup, owner: req.user.id }).lean();
      }
      return res.json({ data: { user: serializeSelf(user), startup } });
    }),
    updateMine: asyncRoute(async (req, res) => {
      const user = await UserModel.findById(req.user.id);
      if (!user || !['investor', 'founder'].includes(user.role)) return res.status(404).json({ error: { message: 'Profile not found.' } });
      const profileKey = user.role === 'investor' ? 'investorProfile' : 'founderProfile';
      if (!user[profileKey]) return res.status(404).json({ error: { message: 'Profile not found.' } });
      const { value, errors } = validateProfileUpdate(user.role, req.body || {});
      if (Object.keys(errors).length) return res.status(400).json({ error: { message: 'Profile details are invalid.', fields: errors } });
      const changes = {};
      if (value.displayName !== undefined) changes.displayName = value.displayName;
      for (const [key, field] of Object.entries(value.profile)) changes[`${profileKey}.${key}`] = field;
      const updated = await UserModel.findByIdAndUpdate(req.user.id, { $set: changes }, { new: true, runValidators: true });
      if (!updated) return res.status(404).json({ error: { message: 'Profile not found.' } });
      return res.json({ data: { user: serializeSelf(updated) } });
    }),
    updateStartup: asyncRoute(async (req, res) => {
      const user = await UserModel.findById(req.user.id);
      if (!user?.primaryStartup) return res.status(404).json({ error: { message: 'Primary startup not found.' } });
      const { value, errors } = validateStartup(req.body || {}, { partial: true });
      if (Object.keys(errors).length) return res.status(400).json({ error: { message: 'Startup details are invalid.', fields: errors } });
      if (!Object.keys(value).length) return res.status(400).json({ error: { message: 'Provide at least one startup field to update.' } });
      const startup = await StartupModel.findOneAndUpdate(
        { _id: user.primaryStartup, owner: req.user.id },
        { $set: value },
        { new: true, runValidators: true },
      );
      if (!startup) return res.status(404).json({ error: { message: 'Primary startup not found.' } });
      return res.json({ data: startup });
    }),
    requestVerification: asyncRoute(async (req, res) => {
      const user = await UserModel.findById(req.user.id);
      if (!user?.primaryStartup) return res.status(404).json({ error: { message: 'Primary startup not found.' } });
      const current = await StartupModel.findOne({ _id: user.primaryStartup, owner: req.user.id }).lean();
      if (!current || current.moderationStatus !== 'approved' || !['unverified', 'rejected'].includes(current.verificationStatus || 'unverified')) {
        return res.status(409).json({ error: { message: 'This startup cannot request verification in its current state.' } });
      }
      const startup = await StartupModel.findOneAndUpdate(
        { _id: user.primaryStartup, owner: req.user.id, moderationStatus: 'approved', verificationStatus: current.verificationStatus || 'unverified' },
        { $set: { verificationStatus: 'pending', verificationRequestedAt: new Date(), verificationReviewedBy: null, verificationReviewedAt: null } },
        { new: true, runValidators: true },
      );
      if (!startup) return res.status(409).json({ error: { message: 'This startup verification request has already changed.' } });
      return res.status(202).json({ data: startup });
    }),
    discoverInvestors: asyncRoute(async (req, res) => {
      const page = Math.max(1, Math.trunc(Number(req.query.page) || 1));
      const limit = Math.min(50, Math.max(1, Math.trunc(Number(req.query.limit) || 20)));
      const search = normalized(req.query.q).slice(0, 100);
      const industry = normalized(req.query.industry);
      const stage = normalized(req.query.fundingStage || req.query.stage);
      const location = normalized(req.query.location);
      const type = normalized(req.query.investorType);
      let query = UserModel.find({ role: 'investor', accountStatus: { $ne: 'suspended' } });
      if (typeof query.select === 'function') query = query.select('displayName role accountStatus investorProfile');
      if (typeof query.limit === 'function') query = query.limit(500);
      const candidates = await (typeof query.lean === 'function' ? query.lean() : query);
      const filtered = candidates.filter((user) => {
        if (!user.investorProfile) return false;
        const profile = plain(user.investorProfile);
        const searchable = [user.displayName, profile.organizationName, profile.biography, profile.investmentThesis, ...(profile.industriesOfInterest || [])].map(normalized).join(' ');
        if (search && !searchable.includes(search)) return false;
        if (industry && !(profile.industriesOfInterest || []).some((item) => normalized(item) === industry)) return false;
        if (stage && !(profile.preferredFundingStages || []).some((item) => normalized(item) === stage)) return false;
        if (location && !(profile.preferredStartupLocations || []).some((item) => normalized(item).includes(location))) return false;
        if (type && normalized(profile.investorType) !== type) return false;
        return true;
      }).sort((left, right) => left.displayName.localeCompare(right.displayName));
      const data = filtered.slice((page - 1) * limit, page * limit).map(publicInvestor);
      return res.json({ data, pagination: { page, limit, total: filtered.length, pages: Math.ceil(filtered.length / limit) } });
    }),
  };
}
