// Shared logic for "suggest a novel" / "suggest an edit" requests: turning
// API input into GlobalNovel fields, diffing edits, approving and serializing.
import { prisma } from "../config/db.config.js";
import { coverUrl, deleteObject } from "../config/storage.config.js";
import { normalizeGenres, serializeNovel } from "./serializers.js";

// GlobalNovel fields a request may change, with labels for the reviewer.
export const EDITABLE_FIELDS = {
  title: "Title",
  originalTitle: "Original title",
  author: "Author",
  originalLanguage: "Language",
  isFullyTranslated: "Translation",
  publisherOriginal: "Original publisher",
  publisherEnglish: "English publisher",
  publicationStatus: "Publication status",
  startYear: "Start year",
  endYear: "End year",
  chapterCount: "Chapters",
  synopsis: "Synopsis",
  genres: "Genres",
};

export const MAX_PENDING_PER_USER = 5;

const blankToNull = (value) => (typeof value === "string" && value.trim() === "" ? null : value);

// Validated API shape (nested publishers/publication) → flat GlobalNovel
// fields. Only keys present in the input are returned, so it works for both
// full new novels and partial edits.
export const toNovelFields = (input) => {
  const out = {};
  const set = (key, value) => {
    if (value !== undefined) out[key] = blankToNull(value);
  };
  set("title", input.title?.trim());
  set("originalTitle", input.originalTitle?.trim?.() ?? input.originalTitle);
  set("author", input.author?.trim());
  set("originalLanguage", input.originalLanguage);
  set("isFullyTranslated", input.isFullyTranslated);
  set("publisherOriginal", input.publishers?.original);
  set("publisherEnglish", input.publishers?.english);
  set("publicationStatus", input.publication?.status);
  set("startYear", input.publication?.startYear);
  set("endYear", input.publication?.endYear);
  set("chapterCount", input.chapterCount);
  set("synopsis", input.synopsis?.trim?.() ?? input.synopsis);
  if (input.genres !== undefined) out.genres = normalizeGenres(input.genres);
  return out;
};

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// Keep only fields whose proposed value differs from the novel's current one.
export const diffAgainst = (novel, proposed) => {
  const updatedFields = {};
  const originalValues = {};
  for (const [key, value] of Object.entries(proposed)) {
    if (!(key in EDITABLE_FIELDS) || same(novel[key], value)) continue;
    updatedFields[key] = value;
    originalValues[key] = novel[key] ?? null;
  }
  return { updatedFields, originalValues };
};

export const countPending = async (userId) => {
  const [adds, edits] = await Promise.all([
    prisma.novelAddRequest.count({ where: { createdById: userId, status: "PENDING" } }),
    prisma.novelEditRequest.count({ where: { editedById: userId, status: "PENDING" } }),
  ]);
  return adds + edits;
};

// ---------------------------------------------------------------------------
// Review actions. Each runs in one transaction: the novel and the request
// change together or not at all.
// ---------------------------------------------------------------------------

const REQUEST_ONLY = ["id", "createdById", "status", "reviewedById", "reviewedAt", "reviewNote", "createdNovelId", "createdAt", "updatedAt"];

export const approveAddRequest = async (request, reviewerId) => {
  const novelData = Object.fromEntries(Object.entries(request).filter(([key]) => !REQUEST_ONLY.includes(key)));
  const [novel] = await prisma.$transaction(async (tx) => {
    const created = await tx.globalNovel.create({ data: novelData });
    await tx.novelAddRequest.update({
      where: { id: request.id },
      data: { status: "APPROVED", reviewedById: reviewerId, reviewedAt: new Date(), createdNovelId: created.id },
    });
    return [created];
  });
  return novel;
};

export const approveEditRequest = async (request, reviewerId) => {
  const previous = await prisma.globalNovel.findUnique({ where: { id: request.novelId } });
  const data = { ...request.updatedFields };
  if (request.coverKey) data.coverKey = request.coverKey;

  const novel = await prisma.$transaction(async (tx) => {
    const updated = await tx.globalNovel.update({ where: { id: request.novelId }, data });
    await tx.novelEditRequest.update({
      where: { id: request.id },
      data: { status: "APPROVED", reviewedById: reviewerId, reviewedAt: new Date() },
    });
    return updated;
  });

  // The replaced cover is no longer referenced.
  if (request.coverKey && previous?.coverKey && previous.coverKey !== request.coverKey) {
    await deleteObject(previous.coverKey);
  }
  return novel;
};

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

const person = (user) => (user ? { id: user.id, username: user.username } : null);

const reviewFields = (request) => ({
  id: request.id,
  status: request.status,
  createdAt: request.createdAt,
  reviewedAt: request.reviewedAt,
  reviewNote: request.reviewNote,
  reviewedBy: person(request.reviewedBy),
});

export const serializeAddRequest = async (request) => {
  const novel = Object.fromEntries(Object.entries(request).filter(([key]) => !REQUEST_ONLY.includes(key) && !["createdBy", "reviewedBy"].includes(key)));
  return {
    type: "new",
    ...reviewFields(request),
    submittedBy: person(request.createdBy),
    createdNovelId: request.createdNovelId,
    novel: await serializeNovel(novel),
  };
};

// `current` is the novel as it is now, so the reviewer can see when a field
// was changed by someone else after this request was made ("stale").
export const serializeEditRequest = async (request) => {
  const current = request.novel;
  const changes = Object.entries(request.updatedFields).map(([field, to]) => {
    const from = request.originalValues?.[field] ?? null;
    return {
      field,
      label: EDITABLE_FIELDS[field] ?? field,
      from,
      to,
      current: current ? current[field] ?? null : null,
      stale: request.status === "PENDING" && !!current && !same(current[field], from),
    };
  });

  return {
    type: "edit",
    ...reviewFields(request),
    submittedBy: person(request.editedBy),
    novel: current
      ? { id: current.id, title: current.title, author: current.author, coverImage: (await serializeNovel(current)).coverImage }
      : null,
    changes,
    cover: request.coverKey ? { to: await coverUrl(request.coverKey) } : null,
  };
};

export const ADD_INCLUDE = { createdBy: true, reviewedBy: true };
export const EDIT_INCLUDE = { editedBy: true, reviewedBy: true, novel: true };
