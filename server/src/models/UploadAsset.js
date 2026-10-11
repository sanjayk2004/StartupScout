import mongoose from 'mongoose';

export const uploadPurposes = ['profile-photo', 'startup-logo', 'startup-cover', 'product-gallery'];

const uploadAssetSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  startup: { type: mongoose.Schema.Types.ObjectId, ref: 'Startup', default: null, index: true },
  purpose: { type: String, required: true, enum: uploadPurposes },
  bucket: { type: String, required: true, maxlength: 255 },
  objectKey: { type: String, required: true, unique: true, maxlength: 1024 },
  url: { type: String, required: true, maxlength: 2048 },
  contentType: { type: String, required: true, enum: ['image/jpeg', 'image/png', 'image/webp'] },
  size: { type: Number, required: true, min: 1, max: 5 * 1024 * 1024 },
}, { timestamps: true, versionKey: false });

uploadAssetSchema.index({ owner: 1, createdAt: -1 });
uploadAssetSchema.index({ startup: 1, purpose: 1, createdAt: -1 });

export const UploadAsset = mongoose.models.UploadAsset || mongoose.model('UploadAsset', uploadAssetSchema);
