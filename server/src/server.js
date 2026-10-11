import 'dotenv/config';
import { app } from './app.js';
import { connectDatabase } from './config/database.js';
import { loadEnvironment } from './config/environment.js';

const config = loadEnvironment();

try {
  if (!config.mongoUri) throw new Error('Set MONGODB_URI before starting the API server.');
  if (Buffer.byteLength(config.jwtSecret, 'utf8') < 32) throw new Error('Set JWT_SECRET to a random value of at least 32 bytes before starting the API server.');
  await connectDatabase(config.mongoUri);
  const server = app.listen(config.port, () => {
    console.log(`StartupConnect API listening on port ${config.port}.`);
  });

  const shutdown = (signal) => {
    server.close(async () => {
      const mongoose = await import('mongoose');
      await mongoose.default.disconnect();
      process.exit(signal === 'SIGINT' ? 130 : 0);
    });
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
} catch (error) {
  console.error(`StartupConnect API could not start: ${error.message}`);
  process.exitCode = 1;
}
