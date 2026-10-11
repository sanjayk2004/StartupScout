import { randomUUID } from 'node:crypto';
import { uploadPurposes } from '../models/UploadAsset.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function hasImageSignature(buffer, contentType) {
  if (contentType === 'image/png') {
    if (buffer.length < 24 || !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || buffer.toString('ascii', 12, 16) !== 'IHDR') return false;
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return width > 0 && height > 0 && width <= 8000 && height <= 8000 && width * height <= 40_000_000;
  }
  if (contentType === 'image/jpeg') return buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff && buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9;
  if (contentType === 'image/webp') return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.readUInt32LE(4) + 8 <= buffer.length && buffer.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

function responseAsset(asset, url, purpose) {
  return {
    id: String(asset.id || asset._id),
    url,
    purpose,
    contentType: asset.contentType,
    size: asset.size,
    createdAt: asset.createdAt || null,
  };
}

export function createUploadController({ UserModel, StartupModel, AssetModel, storage }) {
  return {
    upload: asyncRoute(async (req, res) => {
      if (!storage?.configured) return res.status(503).json({ error: { message: 'Image storage is not configured.' } });
      const purpose = req.params.purpose;
      if (!uploadPurposes.includes(purpose)) return res.status(400).json({ error: { message: 'Choose a supported image purpose.' } });
      const user = await UserModel.findById(req.user.id);
      if (!user || !['investor', 'founder'].includes(user.role)) return res.status(404).json({ error: { message: 'Account not found.' } });
      if (user.role === 'investor' && purpose !== 'profile-photo') return res.status(403).json({ error: { message: 'This image purpose is not available to investors.' } });

      const contentType = String(req.get('content-type') || '').split(';')[0].trim().toLowerCase();
      const body = req.body;
      if (!extensions[contentType] || !Buffer.isBuffer(body) || body.length < 1 || body.length > MAX_IMAGE_BYTES || !hasImageSignature(body, contentType)) {
        return res.status(400).json({ error: { message: 'Upload a valid PNG, JPEG, or WebP image no larger than 5 MB.' } });
      }

      const isStartupAsset = purpose !== 'profile-photo';
      let startup = null;
      if (isStartupAsset) {
        if (user.role !== 'founder' || !user.primaryStartup) return res.status(403).json({ error: { message: 'A founder-owned primary startup is required.' } });
        startup = await StartupModel.findOne({ _id: user.primaryStartup, owner: req.user.id }).lean();
        if (!startup) return res.status(404).json({ error: { message: 'Primary startup not found.' } });
        if (purpose === 'product-gallery' && (startup.productImageUrls || []).length >= 12) {
          return res.status(400).json({ error: { message: 'A startup may have at most 12 product images.' } });
        }
      }

      const ownerId = String(user.id || user._id);
      const startupId = startup ? String(startup._id || startup.id) : null;
      const key = `users/${ownerId}/${purpose}/${randomUUID()}.${extensions[contentType]}`;
      let stored = false;
      let asset;
      try {
        const result = await storage.upload({ key, body, contentType });
        stored = true;
        const url = result?.url || storage.publicUrl(key);
        if (typeof url !== 'string' || !url) throw new Error('Image storage did not return a public URL.');
        asset = await AssetModel.create({
          owner: ownerId,
          startup: startupId,
          purpose,
          bucket: storage.bucket,
          objectKey: key,
          url,
          contentType,
          size: body.length,
        });

        let updated;
        if (purpose === 'profile-photo') {
          const profileKey = user.role === 'investor' ? 'investorProfile' : 'founderProfile';
          updated = await UserModel.findByIdAndUpdate(ownerId, {
            $set: {
              [`${profileKey}.profilePhotoUrl`]: url,
              [`${profileKey}.profilePhotoAsset`]: asset._id || asset.id,
            },
          }, { new: true, runValidators: true });
        } else if (purpose === 'startup-logo') {
          updated = await StartupModel.findOneAndUpdate(
            { _id: startupId, owner: ownerId },
            { $set: { logoUrl: url, logoAsset: asset._id || asset.id } },
            { new: true, runValidators: true },
          );
        } else if (purpose === 'startup-cover') {
          updated = await StartupModel.findOneAndUpdate(
            { _id: startupId, owner: ownerId },
            { $set: { coverImageUrl: url, coverImageAsset: asset._id || asset.id } },
            { new: true, runValidators: true },
          );
        } else {
          updated = await StartupModel.findOneAndUpdate(
            { _id: startupId, owner: ownerId },
            { $addToSet: { productImageUrls: url } },
            { new: true, runValidators: true },
          );
        }
        if (!updated) throw Object.assign(new Error('The image owner could not be updated.'), { statusCode: 404 });
        return res.status(201).json({ data: responseAsset(asset, url, purpose) });
      } catch (error) {
        if (asset) await AssetModel.deleteOne({ _id: asset._id || asset.id });
        if (stored) await storage.remove({ key });
        throw error;
      }
    }),
  };
}
