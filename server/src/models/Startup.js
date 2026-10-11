import mongoose from 'mongoose';

export const fundingStages = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Growth'];

const startupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  industry: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  description: { type: String, required: true, trim: true, minlength: 20, maxlength: 2000 },
  location: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  fundingStage: { type: String, required: true, enum: fundingStages },
  fundingGoal: { type: Number, required: true, min: 1, max: 1_000_000_000_000 },
  foundedYear: { type: Number, required: true, min: 1900, max: new Date().getFullYear() },
  website: { type: String, trim: true, maxlength: 253, default: '' },
  teamSize: { type: Number, min: 1, max: 1_000_000, default: null },
  businessModel: { type: String, trim: true, maxlength: 300, default: '' },
  targetMarket: { type: String, trim: true, maxlength: 500, default: '' },
  productName: { type: String, trim: true, maxlength: 120, default: '' },
  productDescription: { type: String, trim: true, maxlength: 1500, default: '' },
  logoUrl: { type: String, trim: true, maxlength: 2048, default: '' },
  logoAsset: { type: mongoose.Schema.Types.ObjectId, ref: 'UploadAsset', default: null },
  coverImageUrl: { type: String, trim: true, maxlength: 2048, default: '' },
  coverImageAsset: { type: mongoose.Schema.Types.ObjectId, ref: 'UploadAsset', default: null },
  productImageUrls: { type: [String], default: [], validate: { validator: (images) => images.length <= 12, message: 'A startup may have at most 12 product images.' } },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  moderationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved', index: true },
  moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  moderatedAt: { type: Date, default: null },
  verificationStatus: { type: String, enum: ['unverified', 'pending', 'verified', 'rejected'], default: 'unverified', index: true },
  verificationRequestedAt: { type: Date, default: null },
  verificationReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  verificationReviewedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

startupSchema.index({ name: 'text', industry: 'text', location: 'text', description: 'text' });
startupSchema.index({ industry: 1, fundingStage: 1, location: 1 });
startupSchema.index({ fundingStage: 1, fundingGoal: -1 });
startupSchema.index({ verificationStatus: 1, createdAt: 1 });

export const Startup = mongoose.models.Startup || mongoose.model('Startup', startupSchema);
