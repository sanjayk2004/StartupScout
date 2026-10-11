import mongoose from 'mongoose';

export const reportReasons = ['misleading', 'duplicate', 'inappropriate', 'other'];
export const reportStatuses = ['pending', 'resolved', 'dismissed'];

const reportSchema = new mongoose.Schema({
  startup: { type: mongoose.Schema.Types.ObjectId, ref: 'Startup', required: true },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, enum: reportReasons, required: true },
  details: { type: String, trim: true, maxlength: 1000, default: '' },
  status: { type: String, enum: reportStatuses, default: 'pending', index: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ startup: 1, reporter: 1, createdAt: -1 });

export const Report = mongoose.models.Report || mongoose.model('Report', reportSchema);
