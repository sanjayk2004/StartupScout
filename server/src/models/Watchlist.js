import mongoose from 'mongoose';

const watchlistSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  startup: { type: mongoose.Schema.Types.ObjectId, ref: 'Startup', required: true, index: true },
}, { timestamps: true, versionKey: false });

watchlistSchema.index({ user: 1, startup: 1 }, { unique: true });

export const Watchlist = mongoose.models.Watchlist || mongoose.model('Watchlist', watchlistSchema);
