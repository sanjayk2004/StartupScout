const requiredInProduction = ['MONGODB_URI', 'JWT_SECRET'];

export function loadEnvironment(env = process.env) {
  const port = Number(env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  if (env.NODE_ENV === 'production') {
    const missing = requiredInProduction.filter((name) => !env[name]);
    if (missing.length) throw new Error(`Missing required environment variable: ${missing.join(', ')}.`);
    if (Buffer.byteLength(env.JWT_SECRET, 'utf8') < 32) throw new Error('JWT_SECRET must contain at least 32 bytes in production.');
  }
  return {
    port,
    nodeEnv: env.NODE_ENV || 'development',
    mongoUri: env.MONGODB_URI || '',
    jwtSecret: env.JWT_SECRET || '',
    clientOrigin: env.CLIENT_ORIGIN || 'http://localhost:5173',
    storage: {
      endpoint: env.S3_ENDPOINT || '',
      region: env.S3_REGION || '',
      bucket: env.S3_BUCKET || '',
      accessKeyId: env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: env.S3_SECRET_ACCESS_KEY || '',
      publicBaseUrl: env.S3_PUBLIC_BASE_URL || '',
      forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
    },
  };
}
