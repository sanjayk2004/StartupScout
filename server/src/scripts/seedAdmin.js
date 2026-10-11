import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDatabase } from '../config/database.js';
import { User } from '../models/User.js';

const { MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;

if (!MONGODB_URI || !ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_NAME) {
  throw new Error('Set MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_NAME to seed an administrator.');
}
if (!/^\S+@\S+\.\S+$/.test(ADMIN_EMAIL) || ADMIN_EMAIL.length > 254) throw new Error('ADMIN_EMAIL must be a valid email address.');
if (ADMIN_NAME.trim().length < 2 || ADMIN_NAME.length > 80) throw new Error('ADMIN_NAME must be between 2 and 80 characters.');
const passwordBytes = Buffer.byteLength(ADMIN_PASSWORD, 'utf8');
if (passwordBytes < 12 || passwordBytes > 72) throw new Error('ADMIN_PASSWORD must be between 12 and 72 bytes.');

try {
  await connectDatabase(MONGODB_URI);
  const email = ADMIN_EMAIL.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await User.findOneAndUpdate(
    { email },
    { $set: { displayName: ADMIN_NAME.trim(), email, passwordHash, role: 'admin' } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
  console.log('Administrator account seeded.');
} finally {
  const mongoose = await import('mongoose');
  await mongoose.default.disconnect();
}
