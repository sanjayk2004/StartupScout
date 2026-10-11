import mongoose from 'mongoose';

export const userRoles = ['investor', 'founder', 'admin'];

const investmentRangeSchema = new mongoose.Schema({
  min: { type: Number, min: 0, max: 1_000_000_000_000, required: true },
  max: { type: Number, min: 0, max: 1_000_000_000_000, required: true },
  currency: { type: String, required: true, enum: ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'SGD'] },
}, { _id: false });

const investorProfileSchema = new mongoose.Schema({
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  city: { type: String, trim: true, maxlength: 100, default: '' },
  country: { type: String, trim: true, maxlength: 100, default: '' },
  profilePhotoUrl: { type: String, trim: true, maxlength: 500, default: '' },
  profilePhotoAsset: { type: mongoose.Schema.Types.ObjectId, ref: 'UploadAsset', default: null },
  biography: { type: String, trim: true, maxlength: 2000, default: '' },
  investmentThesis: { type: String, trim: true, minlength: 20, maxlength: 2000, required: true },
  investorType: { type: String, required: true, enum: ['angel', 'individual', 'venture-capital'] },
  organizationName: { type: String, trim: true, maxlength: 160, default: '' },
  industriesOfInterest: { type: [String], required: true },
  preferredFundingStages: { type: [String], required: true, enum: ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Growth'] },
  investmentRange: { type: investmentRangeSchema, required: true },
  preferredStartupLocations: { type: [String], required: true },
  website: { type: String, trim: true, maxlength: 253, default: '' },
  linkedInUrl: { type: String, trim: true, maxlength: 253, default: '' },
}, { _id: false });

const founderProfileSchema = new mongoose.Schema({
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  city: { type: String, trim: true, maxlength: 100, default: '' },
  country: { type: String, trim: true, maxlength: 100, default: '' },
  profilePhotoUrl: { type: String, trim: true, maxlength: 500, default: '' },
  profilePhotoAsset: { type: mongoose.Schema.Types.ObjectId, ref: 'UploadAsset', default: null },
  founderDesignation: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  annualTurnover: { type: Number, min: 0, max: 1_000_000_000_000, default: null },
  turnoverCurrency: { type: String, enum: ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'SGD', ''], default: '' },
  financialYear: { type: String, trim: true, maxlength: 20, default: '' },
  fundingRaised: { type: Number, min: 0, max: 1_000_000_000_000, default: null },
}, { _id: false });

const userSchema = new mongoose.Schema({
  displayName: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, required: true, enum: userRoles, default: 'investor', index: true },
  investorProfile: { type: investorProfileSchema, default: undefined },
  founderProfile: { type: founderProfileSchema, default: undefined },
  primaryStartup: { type: mongoose.Schema.Types.ObjectId, ref: 'Startup', default: null },
  accountStatus: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
}, { timestamps: true, versionKey: false });

userSchema.set('toJSON', {
  transform: (_document, record) => {
    delete record.passwordHash;
    return record;
  },
});

export const User = mongoose.models.User || mongoose.model('User', userSchema);
