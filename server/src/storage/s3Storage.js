import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export function createS3Storage(config = {}) {
  const hasStaticCredentials = Boolean(config.accessKeyId && config.secretAccessKey);
  const configured = Boolean(config.bucket && config.region && config.publicBaseUrl && (!config.endpoint || hasStaticCredentials));
  let client;

  function getClient() {
    if (!configured) throw Object.assign(new Error('Image storage is not configured.'), { statusCode: 503 });
    if (!client) {
      client = new S3Client({
        region: config.region,
        ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: config.forcePathStyle } : {}),
        ...(hasStaticCredentials ? { credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } } : {}),
      });
    }
    return client;
  }

  function publicUrl(key) {
    const base = config.publicBaseUrl.replace(/\/+$/, '');
    const encodedKey = key.split('/').map((segment) => encodeURIComponent(segment)).join('/');
    return `${base}/${encodedKey}`;
  }

  return {
    configured,
    bucket: config.bucket,
    publicUrl,
    async upload({ key, body, contentType }) {
      await getClient().send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }));
      return { url: publicUrl(key) };
    },
    async remove({ key }) {
      await getClient().send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
  };
}
