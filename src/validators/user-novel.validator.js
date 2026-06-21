import { z } from "zod";

const statusEnum = z.enum(["Reading", "Completed", "On Hold", "Plan To Read", "Dropped"]);

// Used for POST (adding a novel). Status defaults to "Reading" and the
// Completed/Reading date refinements apply to the full submitted state.
export const userNovelAddValidator = z.object({
    progress: z.number().min(0).optional(),
    rating: z.number().min(1).max(10).multipleOf(0.5).nullable().optional(),
    status: statusEnum.default("Reading"),
    startedAt: z.coerce.date().nullable().optional(),
    completedAt: z.coerce.date().nullable().optional(),
}).refine(
    (data) => {
        if (data.status === "Completed") {
            return data.completedAt != null;
        }
        return true;
    },
    { message: "completedAt is required when status is Completed", path: ["completedAt"] }
).refine(
    (data) => {
        if (data.status === "Reading") {
            return !data.completedAt;
        }
        return true;
    },
    { message: "Cannot set completedAt while status is Reading", path: ["completedAt"] }
);

// Used for PATCH (editing an entry). Status is fully optional — omitting it
// means "keep the existing status". Refinements only apply when the field is
// explicitly present in the request body to avoid poisoning partial updates.
export const userNovelEditValidator = z.object({
    progress: z.number().min(0).optional(),
    rating: z.number().min(1).max(10).multipleOf(0.5).nullable().optional(),
    status: statusEnum.optional(),
    startedAt: z.coerce.date().nullable().optional(),
    completedAt: z.coerce.date().nullable().optional(),
}).refine(
    (data) => {
        if (data.status === "Reading" && data.completedAt != null) {
            return false;
        }
        return true;
    },
    { message: "Cannot set completedAt while status is Reading", path: ["completedAt"] }
);
