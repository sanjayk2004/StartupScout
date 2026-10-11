import mongoose from 'mongoose';

const connectionRequestSchema = new mongoose.Schema({
  startup: { type: mongoose.Schema.Types.ObjectId, ref: 'Startup', required: true, index: true },
  investor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  founder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  message: { type: String, trim: true, maxlength: 1000, default: '' },
  status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending', index: true },
  resolvedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

connectionRequestSchema.index({ investor: 1, startup: 1 }, { unique: true });
connectionRequestSchema.index({ founder: 1, status: 1, createdAt: -1 });

export const ConnectionRequest = mongoose.models.ConnectionRequest || mongoose.model('ConnectionRequest', connectionRequestSchema);
