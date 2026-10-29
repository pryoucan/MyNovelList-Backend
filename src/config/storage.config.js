import { Files } from "files-sdk";
import { neon } from "files-sdk/neon";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Neon Object Storage bucket declared in neon.ts. Endpoint, region, and
// credentials come from the AWS_* variables `neon deploy` / `neon env pull` write.
export const files = new Files({ adapter: neon({ bucket: "assets" }) });

const AVATAR_TYPES = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

// Parses a "data:image/...;base64,..." string. Returns null if it isn't a supported image.
export const parseImageDataUrl = (dataUrl) => {
  if (typeof dataUrl !== "string") return null;
  const match = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match || !AVATAR_TYPES[match[1]]) return null;

  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null;

  return { contentType: match[1], ext: AVATAR_TYPES[match[1]], bytes };
};

// Each upload gets a fresh key so cached URLs never serve a stale image.
export const uploadAvatar = async (userId, image) => {
  const key = `avatars/${userId}/${crypto.randomUUID()}.${image.ext}`;
  await files.upload(key, image.bytes, { contentType: image.contentType });
  return key;
};

// Covers, like avatars, get a fresh key per upload so cached URLs never go stale.
export const uploadCover = async (image) => {
  const key = `covers/${crypto.randomUUID()}.${image.ext}`;
  await files.upload(key, image.bytes, { contentType: image.contentType });
  return key;
};

export const deleteObject = async (key) => {
  if (!key) return;
  try {
    await files.delete(key);
  } catch (error) {
    console.log(`Failed to delete object ${key}:`, error);
  }
};

// Credentials, endpoint and region come from the AWS_* env vars; Neon needs path-style URLs.
const s3 = new S3Client({ forcePathStyle: true });

const HOUR_MS = 60 * 60 * 1000;
const BROWSER_CACHE_SECONDS = 3600;

// Private bucket, so the browser gets a presigned URL. Signing with the time
// rounded down to the hour keeps the URL identical for that hour, so the
// browser can cache the image instead of re-downloading it on every page.
// Valid for 2h from the hour mark, so a URL is always good for at least 1h.
export const signedUrl = (key) => {
  if (!key) return null;
  const signingDate = new Date(Math.floor(Date.now() / HOUR_MS) * HOUR_MS);
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: "assets",
      Key: key,
      // Avatar keys are never overwritten (each upload gets a new key), so caching is safe.
      ResponseCacheControl: `private, max-age=${BROWSER_CACHE_SECONDS}, immutable`,
    }),
    { expiresIn: 2 * 3600, signingDate }
  );
};

export const avatarUrl = signedUrl;
export const coverUrl = signedUrl;
