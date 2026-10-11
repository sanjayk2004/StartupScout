import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startup: { type: mongoose.Schema.Types.ObjectId, ref: 'Startup', required: true },
  connectionRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'ConnectionRequest', required: true },
  type: { type: String, enum: ['connection_requested', 'connection_accepted', 'connection_declined'], required: true },
  readAt: { type: Date, default: null, index: true },
}, { timestamps: true, versionKey: false });

notificationSchema.index({ recipient: 1, createdAt: -1 });

export const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
