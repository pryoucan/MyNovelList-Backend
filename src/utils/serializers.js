import { avatarUrl, coverUrl } from "../config/storage.config.js";

// Converts flat Postgres rows into the API shape (nested publishers/publication)
// and back again for writes.

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value) => typeof value === "string" && UUID_REGEX.test(value);

export const normalizeEmail = (email) => email.trim().toLowerCase();

// "slice of life" / "SLICE OF LIFE" -> "Slice Of Life"; duplicates removed.
export const normalizeGenres = (genres) => {
  const seen = new Set();
  const result = [];
  for (const raw of genres) {
    const genre = raw
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
    if (genre && !seen.has(genre)) {
      seen.add(genre);
      result.push(genre);
    }
  }
  return result;
};

// Tags keep their casing ("Weak to Strong"); whitespace is collapsed and
// case-insensitive duplicates removed.
export const normalizeTags = (tags) => {
  const seen = new Set();
  const result = [];
  for (const raw of tags) {
    const tag = raw.trim().replace(/\s+/g, " ");
    if (tag && !seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      result.push(tag);
    }
  }
  return result;
};

// Async because the avatar is returned as a presigned URL.
export const serializeUser = async (user) => {
  if (!user) return user;
  const { password, avatarKey, ...rest } = user;
  return { ...rest, avatar: await avatarUrl(avatarKey) };
};

// Async because an uploaded cover is returned as a signed URL.
export const serializeNovel = async (novel) => {
  if (!novel) return novel;
  const {
    publisherOriginal,
    publisherEnglish,
    publicationStatus,
    startYear,
    endYear,
    coverKey,
    coverImage,
    ...rest
  } = novel;

  return {
    ...rest,
    coverImage: coverKey ? await coverUrl(coverKey) : coverImage ?? null,
    publishers: {
      original: publisherOriginal,
      english: publisherEnglish,
    },
    publication: {
      status: publicationStatus,
      startYear,
      endYear,
    },
  };
};

// Prisma error code for a unique-constraint violation.
export const isUniqueViolation = (error) => error?.code === "P2002";
