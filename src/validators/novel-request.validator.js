import { z } from "zod";

// Allowed values, shared with the database CHECK constraints.
export const LANGUAGES = ["zh", "en"];
export const ORIGINAL_PUBLISHERS = ["Qidian", "Zongheng", "Jinjiang", "17K"];
export const ENGLISH_PUBLISHERS = ["Wuxiaworld", "Web Novel"];
export const PUBLICATION_STATUSES = ["Ongoing", "Completed", "Upcoming", "On Hiatus", "Cancelled"];

const MAX_YEAR = new Date().getFullYear() + 2;

const year = z.number().int().min(1990).max(MAX_YEAR);
const genres = z
  .array(z.string().trim().min(1).max(30))
  .min(1, "At least one genre is required")
  .max(12, "At most 12 genres");

const tags = z
  .array(z.string().trim().min(1).max(50))
  .max(100, "At most 100 tags");

// A base64 image data URL; size and type are checked again when decoded.
const cover = z.string().startsWith("data:image/", "Cover must be an image").max(3_000_000, "Cover is too large");

const publishers = z.object({
  original: z.enum(ORIGINAL_PUBLISHERS).nullable().optional(),
  english: z.enum(ENGLISH_PUBLISHERS).nullable().optional(),
});

const publication = z.object({
  status: z.enum(PUBLICATION_STATUSES),
  startYear: year.nullable().optional(),
  endYear: year.nullable().optional(),
});

const novelFields = {
  title: z.string().trim().min(1, "Title is required").max(200),
  originalTitle: z.string().trim().max(200).nullable().optional(),
  author: z.string().trim().min(1, "Author is required").max(120),
  originalLanguage: z.enum(LANGUAGES),
  isFullyTranslated: z.boolean().optional(),
  publishers: publishers.optional(),
  publication,
  chapterCount: z.number().int().min(0).max(100_000).nullable().optional(),
  synopsis: z.string().trim().max(5000).nullable().optional(),
  genres,
  tags: tags.optional(),
};

// Rules that involve more than one field; applied to new novels and to the
// merged result of an edit (see checkNovelRules).
export const checkNovelRules = (n) => {
  if (n.startYear != null && n.endYear != null && n.endYear < n.startYear) {
    return "End year can't be before the start year";
  }
  if (n.publicationStatus === "Completed" && (n.chapterCount == null || n.endYear == null)) {
    return "A finished novel needs a chapter count and an end year";
  }
  return null;
};

// `replace` (admins only): overwrite the existing novel with the same title/author.
export const newNovelRequestValidator = z.object({ ...novelFields, cover: cover.optional(), replace: z.boolean().optional() });

// Edits: any subset of the fields; the controller drops ones that don't change.
export const editNovelRequestValidator = z
  .object({
    changes: z
      .object({
        ...novelFields,
        publishers: publishers.partial().optional(),
        publication: publication.partial().optional(),
      })
      .partial()
      .default({}),
    cover: cover.optional(),
  })
  .refine((body) => Object.keys(body.changes).length > 0 || body.cover, {
    message: "Change at least one detail or the cover",
  });

export const rejectRequestValidator = z.object({
  reason: z.string().trim().max(500).optional(),
});
