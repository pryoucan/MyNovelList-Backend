import { prisma } from "../config/db.config.js";
import { isUuid, isUniqueViolation } from "../utils/serializers.js";

const reviewSelect = {
  id: true,
  userId: true,
  novelId: true,
  body: true,
  isSpoiler: true,
  createdAt: true,
  editedAt: true,
  user: { select: { username: true } },
};

const present = ({ user, ...review }) => ({ ...review, username: user.username });

const readInput = (body) => {
  if (typeof body?.body !== "string" || !body.body.trim() || body.body.trim().length > 5000 || typeof body.isSpoiler !== "boolean") {
    return null;
  }
  return { body: body.body.trim(), isSpoiler: body.isSpoiler };
};

export const listNovelReviews = async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ message: "Novel not found" });
  try {
    const novel = await prisma.globalNovel.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!novel) return res.status(404).json({ message: "Novel not found" });
    const reviews = await prisma.novelReview.findMany({
      where: { novelId: req.params.id },
      select: reviewSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return res.json({ reviews: reviews.map(present) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const createNovelReview = async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ message: "Novel not found" });
  const input = readInput(req.body);
  if (!input) return res.status(400).json({ message: "Review must be 1–5000 characters and include a spoiler choice" });
  try {
    const novel = await prisma.globalNovel.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!novel) return res.status(404).json({ message: "Novel not found" });
    const review = await prisma.novelReview.create({
      data: { ...input, userId: req.user.id, novelId: req.params.id },
      select: reviewSelect,
    });
    return res.status(201).json({ review: present(review) });
  } catch (error) {
    if (isUniqueViolation(error)) return res.status(409).json({ message: "You already reviewed this novel" });
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const editNovelReview = async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ message: "Novel not found" });
  const input = readInput(req.body);
  if (!input) return res.status(400).json({ message: "Review must be 1–5000 characters and include a spoiler choice" });
  try {
    const existing = await prisma.novelReview.findUnique({
      where: { userId_novelId: { userId: req.user.id, novelId: req.params.id } },
    });
    if (!existing) return res.status(404).json({ message: "Review not found" });
    // Saving an unchanged review should not mark it edited.
    if (existing.body === input.body && existing.isSpoiler === input.isSpoiler) {
      const review = await prisma.novelReview.findUnique({ where: { id: existing.id }, select: reviewSelect });
      return res.json({ review: present(review) });
    }
    const review = await prisma.novelReview.update({
      where: { id: existing.id },
      data: { ...input, editedAt: new Date() },
      select: reviewSelect,
    });
    return res.json({ review: present(review) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
