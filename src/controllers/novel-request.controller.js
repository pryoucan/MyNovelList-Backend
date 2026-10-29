import { prisma } from "../config/db.config.js";
import { parseImageDataUrl, uploadCover, deleteObject } from "../config/storage.config.js";
import { isUuid, isUniqueViolation } from "../utils/serializers.js";
import { checkNovelRules } from "../validators/novel-request.validator.js";
import {
  toNovelFields,
  diffAgainst,
  countPending,
  MAX_PENDING_PER_USER,
  approveAddRequest,
  approveEditRequest,
  serializeAddRequest,
  serializeEditRequest,
  ADD_INCLUDE,
  EDIT_INCLUDE,
} from "../utils/novel-requests.js";

const isAdmin = async (userId) =>
  (await prisma.user.findUnique({ where: { id: userId }, select: { role: true } }))?.role === "ADMIN";

const COVER_ERROR = "Cover must be a PNG, JPEG, or WebP image under 2MB";

// POST /api/requests/novels — suggest a new novel. Admins' suggestions are
// applied immediately (and recorded as approved, so history stays complete).
const submitNovel = async (req, res) => {
  const userId = req.user.id;
  let coverKey = null;
  try {
    const fields = toNovelFields(req.body);
    const ruleError = checkNovelRules(fields);
    if (ruleError) return res.status(400).json({ message: ruleError });

    const admin = await isAdmin(userId);
    if (!admin && (await countPending(userId)) >= MAX_PENDING_PER_USER) {
      return res.status(429).json({
        message: `You have ${MAX_PENDING_PER_USER} requests waiting for review. Try again once some are reviewed.`,
      });
    }

    const exists = await prisma.globalNovel.findFirst({
      where: {
        title: { equals: fields.title, mode: "insensitive" },
        author: { equals: fields.author, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (exists) {
      return res.status(409).json({ message: "This novel is already on MyNovelList", novelId: exists.id });
    }

    if (req.body.cover) {
      const image = parseImageDataUrl(req.body.cover);
      if (!image) return res.status(400).json({ message: COVER_ERROR });
      coverKey = await uploadCover(image);
    }

    const request = await prisma.novelAddRequest.create({
      data: { ...fields, coverKey, createdById: userId },
    });

    if (admin) {
      const novel = await approveAddRequest(request, userId);
      return res.status(201).json({ message: "Novel added", applied: true, novelId: novel.id });
    }

    const full = await prisma.novelAddRequest.findUnique({ where: { id: request.id }, include: ADD_INCLUDE });
    return res.status(201).json({
      message: "Thanks! Your suggestion was sent for review.",
      applied: false,
      request: await serializeAddRequest(full),
    });
  } catch (error) {
    await deleteObject(coverKey);
    if (isUniqueViolation(error)) {
      return res.status(409).json({ message: "Someone already suggested this novel — it's waiting for review" });
    }
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// POST /api/requests/novels/:novelId/edits — suggest changes to a novel.
const submitEdit = async (req, res) => {
  const userId = req.user.id;
  const { novelId } = req.params;
  if (!isUuid(novelId)) return res.status(404).json({ message: "Novel not found" });

  let coverKey = null;
  try {
    const novel = await prisma.globalNovel.findUnique({ where: { id: novelId } });
    if (!novel) return res.status(404).json({ message: "Novel not found" });

    const { updatedFields, originalValues } = diffAgainst(novel, toNovelFields(req.body.changes));
    if (Object.keys(updatedFields).length === 0 && !req.body.cover) {
      return res.status(400).json({ message: "Nothing changed — edit at least one detail or the cover" });
    }

    const ruleError = checkNovelRules({ ...novel, ...updatedFields });
    if (ruleError) return res.status(400).json({ message: ruleError });

    const admin = await isAdmin(userId);
    if (!admin && (await countPending(userId)) >= MAX_PENDING_PER_USER) {
      return res.status(429).json({
        message: `You have ${MAX_PENDING_PER_USER} requests waiting for review. Try again once some are reviewed.`,
      });
    }

    if (req.body.cover) {
      const image = parseImageDataUrl(req.body.cover);
      if (!image) return res.status(400).json({ message: COVER_ERROR });
      coverKey = await uploadCover(image);
    }

    const request = await prisma.novelEditRequest.create({
      data: { novelId, editedById: userId, updatedFields, originalValues, coverKey },
    });

    if (admin) {
      await approveEditRequest(request, userId);
      return res.status(201).json({ message: "Novel updated", applied: true, novelId });
    }

    const full = await prisma.novelEditRequest.findUnique({ where: { id: request.id }, include: EDIT_INCLUDE });
    return res.status(201).json({
      message: "Thanks! Your edit was sent for review.",
      applied: false,
      request: await serializeEditRequest(full),
    });
  } catch (error) {
    await deleteObject(coverKey);
    if (isUniqueViolation(error)) {
      return res.status(409).json({
        message: "You already have an edit waiting for review on this novel. Withdraw it first to send a new one.",
      });
    }
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// GET /api/requests/mine — everything the user has submitted, newest first.
const mySubmissions = async (req, res) => {
  try {
    const [adds, edits] = await Promise.all([
      prisma.novelAddRequest.findMany({ where: { createdById: req.user.id }, include: ADD_INCLUDE }),
      prisma.novelEditRequest.findMany({ where: { editedById: req.user.id }, include: EDIT_INCLUDE }),
    ]);
    const requests = [
      ...(await Promise.all(adds.map(serializeAddRequest))),
      ...(await Promise.all(edits.map(serializeEditRequest))),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.status(200).json({ message: "Submissions fetched", requests });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// DELETE /api/requests/:type/:id — withdraw your own pending request.
const withdrawRequest = async (req, res) => {
  const { type, id } = req.params;
  if (!isUuid(id) || !["new", "edit"].includes(type)) return res.status(404).json({ message: "Request not found" });

  try {
    const model = type === "new" ? prisma.novelAddRequest : prisma.novelEditRequest;
    const owner = type === "new" ? "createdById" : "editedById";
    const request = await model.findFirst({ where: { id, [owner]: req.user.id } });
    if (!request) return res.status(404).json({ message: "Request not found" });
    if (request.status !== "PENDING") {
      return res.status(409).json({ message: "This request was already reviewed" });
    }
    await model.delete({ where: { id } });
    await deleteObject(request.coverKey);
    return res.status(200).json({ message: "Request withdrawn" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export { submitNovel, submitEdit, mySubmissions, withdrawRequest };
