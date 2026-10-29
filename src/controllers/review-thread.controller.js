import { prisma } from "../config/db.config.js";
import { isUuid } from "../utils/serializers.js";
import { replySelect, presentReply } from "../utils/review-presenters.js";

const validRoute = (req, hasReply = false) =>
  isUuid(req.params.id) && isUuid(req.params.reviewId) && (!hasReply || isUuid(req.params.replyId));

const replyBody = (value) =>
  typeof value === "string" && value.trim().length >= 1 && value.trim().length <= 2000
    ? value.trim()
    : null;

const findReview = (req) => prisma.novelReview.findFirst({
  where: { id: req.params.reviewId, novelId: req.params.id },
  select: { id: true },
});

const findReply = (req) => prisma.reviewReply.findFirst({
  where: { id: req.params.replyId, reviewId: req.params.reviewId, review: { novelId: req.params.id } },
  select: { id: true, deletedAt: true },
});

export const createReviewReply = async (req, res) => {
  if (!validRoute(req)) return res.status(404).json({ message: "Review not found" });
  const body = replyBody(req.body?.body);
  const parentId = req.body?.parentId ?? null;
  if (!body || (parentId !== null && !isUuid(parentId))) return res.status(400).json({ message: "Reply must be 1–2000 characters with a valid parent" });
  try {
    if (!await findReview(req)) return res.status(404).json({ message: "Review not found" });
    if (parentId) {
      const parent = await prisma.reviewReply.findFirst({
        where: { id: parentId, reviewId: req.params.reviewId }, select: { id: true },
      });
      if (!parent) return res.status(404).json({ message: "Parent reply not found" });
    }
    const reply = await prisma.reviewReply.create({
      data: { body, parentId, reviewId: req.params.reviewId, userId: req.user.id },
      select: replySelect(req.user.id),
    });
    return res.status(201).json({ reply: presentReply(reply) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const editReviewReply = async (req, res) => {
  if (!validRoute(req, true)) return res.status(404).json({ message: "Reply not found" });
  const body = replyBody(req.body?.body);
  if (!body) return res.status(400).json({ message: "Reply must be 1–2000 characters" });
  try {
    const updated = await prisma.reviewReply.updateMany({
      where: { id: req.params.replyId, reviewId: req.params.reviewId, review: { novelId: req.params.id }, userId: req.user.id, deletedAt: null },
      data: { body, editedAt: new Date() },
    });
    if (!updated.count) return res.status(404).json({ message: "Reply not found" });
    const reply = await prisma.reviewReply.findUnique({ where: { id: req.params.replyId }, select: replySelect(req.user.id) });
    return res.json({ reply: presentReply(reply) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const deleteReviewReply = async (req, res) => {
  if (!validRoute(req, true)) return res.status(404).json({ message: "Reply not found" });
  try {
    const deleted = await prisma.reviewReply.updateMany({
      where: { id: req.params.replyId, reviewId: req.params.reviewId, review: { novelId: req.params.id }, userId: req.user.id, deletedAt: null },
      data: { body: null, deletedAt: new Date() },
    });
    if (!deleted.count) return res.status(404).json({ message: "Reply not found" });
    const reply = await prisma.reviewReply.findUnique({ where: { id: req.params.replyId }, select: replySelect(req.user.id) });
    return res.json({ reply: presentReply(reply) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

const setLike = async (req, res, kind, liked) => {
  if (!validRoute(req, kind === "reply")) return res.status(404).json({ message: "Item not found" });
  try {
    const target = kind === "reply" ? await findReply(req) : await findReview(req);
    if (!target || target.deletedAt) return res.status(404).json({ message: "Item not found" });
    const model = kind === "reply" ? prisma.reviewReplyLike : prisma.reviewLike;
    const field = kind === "reply" ? "replyId" : "reviewId";
    const targetId = kind === "reply" ? req.params.replyId : req.params.reviewId;
    if (liked) {
      const unique = kind === "reply" ? "userId_replyId" : "userId_reviewId";
      await model.upsert({
        where: { [unique]: { userId: req.user.id, [field]: targetId } },
        update: {},
        create: { userId: req.user.id, [field]: targetId },
      });
    } else {
      await model.deleteMany({ where: { userId: req.user.id, [field]: targetId } });
    }
    const likesCount = await model.count({ where: { [field]: targetId } });
    return res.json({ likesCount, likedByMe: liked });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const likeReview = (req, res) => setLike(req, res, "review", true);
export const unlikeReview = (req, res) => setLike(req, res, "review", false);
export const likeReply = (req, res) => setLike(req, res, "reply", true);
export const unlikeReply = (req, res) => setLike(req, res, "reply", false);
