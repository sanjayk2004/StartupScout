export function createAnalyticsService({ StartupModel, StartupEventModel, ConnectionRequestModel }) {
  return {
    recordProfileView(startupId) {
      return StartupEventModel.create({ startup: startupId, type: 'profile_view' });
    },
    async getFounderAnalytics(founderId) {
      const owned = await StartupModel.find({ owner: founderId }).sort({ createdAt: -1 }).limit(100).lean();
      const startups = await Promise.all(owned.map(async (startup) => {
        const startupId = startup._id || startup.id;
        const [profileViews, investorActivity] = await Promise.all([
          StartupEventModel.countDocuments({ startup: startupId, type: 'profile_view' }),
          ConnectionRequestModel.countDocuments({ startup: startupId }),
        ]);
        return { startupId: String(startupId), name: startup.name, profileViews, investorActivity };
      }));
      return {
        totals: startups.reduce((total, startup) => ({
          profileViews: total.profileViews + startup.profileViews,
          investorActivity: total.investorActivity + startup.investorActivity,
        }), { profileViews: 0, investorActivity: 0 }),
        startups,
      };
    },
  };
}
