import mongoose from 'mongoose';

const startupEventSchema = new mongoose.Schema({
  startup: { type: mongoose.Schema.Types.ObjectId, ref: 'Startup', required: true },
  type: { type: String, enum: ['profile_view'], required: true },
}, { timestamps: true, versionKey: false });

startupEventSchema.index({ startup: 1, type: 1, createdAt: -1 });
startupEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31_536_000 });

export const StartupEvent = mongoose.models.StartupEvent || mongoose.model('StartupEvent', startupEventSchema);
