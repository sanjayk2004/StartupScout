import mongoose from 'mongoose';

export async function connectDatabase(uri) {
  if (!uri) throw new Error('MONGODB_URI must be configured before connecting to MongoDB.');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  return mongoose.connection;
}
