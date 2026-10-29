import { prisma } from "../config/db.config.js";
import { avatarUrl } from "../config/storage.config.js";
import { presentPublicUser } from "../utils/public-profile.js";

const STATUSES = ["Reading", "Completed", "On Hold", "Plan To Read", "Dropped"];
const USERNAME = /^[A-Za-z0-9_]{3,20}$/;

const summarizeReading = (entries) => {
  const year = new Date().getFullYear();
  const stats = {
    total: entries.length,
    byStatus: Object.fromEntries(STATUSES.map((status) => [status, 0])),
    chapters: 0,
    average: null,
    rated: 0,
    finishedThisYear: 0,
    year,
  };
  let ratingSum = 0;
  for (const entry of entries) {
    stats.byStatus[entry.status] = (stats.byStatus[entry.status] ?? 0) + 1;
    stats.chapters += entry.progress ?? 0;
    if (entry.rating != null) {
      ratingSum += entry.rating;
      stats.rated += 1;
    }
    if (entry.status === "Completed" && entry.completedAt?.getFullYear() === year) {
      stats.finishedThisYear += 1;
    }
  }
  if (stats.rated) stats.average = Math.round((ratingSum / stats.rated) * 10) / 10;
  return stats;
};

export const getPublicProfile = async (req, res) => {
  const { username } = req.params;
  if (!USERNAME.test(username)) return res.status(404).json({ message: "Profile not found" });

  try {
    // Public allowlist: never load email, phone number, password, or verification state.
    const user = await prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: { id: true, username: true, role: true, avatarKey: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ message: "Profile not found" });

    const entries = await prisma.userNovel.findMany({
      where: { userId: user.id },
      select: { status: true, progress: true, rating: true, completedAt: true },
    });
    return res.json({
      user: presentPublicUser(user, await avatarUrl(user.avatarKey)),
      stats: summarizeReading(entries),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
