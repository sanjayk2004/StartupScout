import mongoose from 'mongoose';
import { reportReasons, reportStatuses } from '../models/Report.js';

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

export function createAdminController({ StartupModel, ReportModel, UserModel, ConnectionRequestModel }) {
  return {
    overview: asyncRoute(async (_req, res) => {
      const [investors, founders, startups, pendingStartups, pendingVerifications, pendingReports, connectionRequests] = await Promise.all([
        UserModel.countDocuments({ role: 'investor' }),
        UserModel.countDocuments({ role: 'founder' }),
        StartupModel.countDocuments({}),
        StartupModel.countDocuments({ moderationStatus: 'pending' }),
        StartupModel.countDocuments({ verificationStatus: 'pending' }),
        ReportModel.countDocuments({ status: 'pending' }),
        ConnectionRequestModel.countDocuments({}),
      ]);
      return res.json({ data: { investors, founders, startups, pendingStartups, pendingVerifications, pendingReports, connectionRequests } });
    }),
    listAccounts: asyncRoute(async (_req, res) => {
      const accounts = await UserModel.find({}).select('displayName role accountStatus createdAt').sort({ createdAt: -1 }).limit(200).lean();
      const data = accounts.map((user) => ({
        id: String(user._id || user.id),
        displayName: user.displayName,
        role: user.role,
        accountStatus: user.accountStatus || 'active',
        createdAt: user.createdAt || null,
      }));
      return res.json({ data });
    }),
    setAccountStatus: asyncRoute(async (req, res) => {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: { message: 'Account not found.' } });
      const { status } = req.body || {};
      if (!['active', 'suspended'].includes(status)) return res.status(400).json({ error: { message: 'Choose active or suspended.' } });
      if (String(req.params.id) === String(req.user.id)) return res.status(400).json({ error: { message: 'Administrators cannot change their own account status.' } });
      const target = await UserModel.findById(req.params.id);
      if (!target || target.role === 'admin') return res.status(404).json({ error: { message: 'Account not found.' } });
      const user = await UserModel.findByIdAndUpdate(req.params.id, { $set: { accountStatus: status } }, { new: true, runValidators: true });
      if (!user) return res.status(404).json({ error: { message: 'Account not found.' } });
      return res.json({ data: { id: String(user._id || user.id), role: user.role, accountStatus: user.accountStatus } });
    }),
    listStartups: asyncRoute(async (_req, res) => {
      const items = await StartupModel.find({ moderationStatus: 'pending' }).sort({ createdAt: 1 }).limit(100).lean();
      return res.json({ data: items });
    }),
    moderateStartup: asyncRoute(async (req, res) => {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: { message: 'Startup not found.' } });
      const { status } = req.body || {};
      if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: { message: 'Choose approved or rejected.' } });
      const startup = await StartupModel.findOneAndUpdate(
        { _id: req.params.id, moderationStatus: 'pending' },
        { $set: { moderationStatus: status, moderatedBy: req.user.id, moderatedAt: new Date() } },
        { new: true, runValidators: true },
      );
      if (!startup) return res.status(404).json({ error: { message: 'Pending startup not found.' } });
      return res.json({ data: startup });
    }),
    listVerificationRequests: asyncRoute(async (_req, res) => {
      const items = await StartupModel.find({ verificationStatus: 'pending' }).sort({ verificationRequestedAt: 1 }).limit(100).lean();
      return res.json({ data: items });
    }),
    reviewVerification: asyncRoute(async (req, res) => {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: { message: 'Startup not found.' } });
      const { status } = req.body || {};
      if (!['verified', 'rejected'].includes(status)) return res.status(400).json({ error: { message: 'Choose verified or rejected.' } });
      const startup = await StartupModel.findOneAndUpdate(
        { _id: req.params.id, verificationStatus: 'pending' },
        { $set: { verificationStatus: status, verificationReviewedBy: req.user.id, verificationReviewedAt: new Date() } },
        { new: true, runValidators: true },
      );
      if (!startup) return res.status(404).json({ error: { message: 'Pending verification request not found.' } });
      return res.json({ data: startup });
    }),
    createReport: asyncRoute(async (req, res) => {
      const { startupId, reason, details = '' } = req.body || {};
      if (!mongoose.isValidObjectId(startupId)) return res.status(400).json({ error: { message: 'A valid startup id is required.' } });
      if (!reportReasons.includes(reason)) return res.status(400).json({ error: { message: 'Choose a valid report reason.' } });
      if (typeof details !== 'string' || details.trim().length > 1000) return res.status(400).json({ error: { message: 'Report details must be 1000 characters or fewer.' } });
      const startup = await StartupModel.findById(startupId).lean();
      if (!startup || startup.moderationStatus !== 'approved') return res.status(404).json({ error: { message: 'Startup not found.' } });
      const report = await ReportModel.create({ startup: startupId, reporter: req.user.id, reason, details: details.trim() });
      return res.status(201).json({ data: report });
    }),
    listReports: asyncRoute(async (_req, res) => {
      const items = await ReportModel.find({ status: 'pending' }).sort({ createdAt: 1 }).limit(100).lean();
      const reports = await Promise.all(items.map(async (report) => {
        const startup = await StartupModel.findById(report.startup).lean();
        return { ...report, startupName: startup?.name || 'Startup profile unavailable' };
      }));
      return res.json({ data: reports });
    }),
    resolveReport: asyncRoute(async (req, res) => {
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: { message: 'Report not found.' } });
      const { status } = req.body || {};
      if (!reportStatuses.filter((value) => value !== 'pending').includes(status)) return res.status(400).json({ error: { message: 'Choose resolved or dismissed.' } });
      const report = await ReportModel.findOneAndUpdate(
        { _id: req.params.id, status: 'pending' },
        { $set: { status, reviewedBy: req.user.id, reviewedAt: new Date() } },
        { new: true, runValidators: true },
      );
      if (!report) return res.status(404).json({ error: { message: 'Pending report not found.' } });
      return res.json({ data: report });
    }),
  };
}
