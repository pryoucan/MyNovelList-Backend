import { prisma } from "../config/db.config.js";
import { avatarUrl } from "../config/storage.config.js";
import { isUuid } from "../utils/serializers.js";

// Below this many reviewed requests an approval rate isn't meaningful.
const MIN_REVIEWED_FOR_RATE = 3;
const RECENT_LIMIT = 10;

const countByStatus = (rows) =>
  Object.fromEntries(rows.map((r) => [r.status, r._count._all]));

// GET /api/admin/users/:id — a submitter's contribution profile for reviewers.
// Deliberately excludes email and phone: reviewers don't need them.
const getSubmitterProfile = async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return res.status(404).json({ message: "User not found" });

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, role: true, avatarKey: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    const [addCounts, editCounts, adds, edits, reading] = await Promise.all([
      prisma.novelAddRequest.groupBy({ by: ["status"], where: { createdById: id }, _count: { _all: true } }),
      prisma.novelEditRequest.groupBy({ by: ["status"], where: { editedById: id }, _count: { _all: true } }),
      prisma.novelAddRequest.findMany({
        where: { createdById: id },
        orderBy: { createdAt: "desc" },
        take: RECENT_LIMIT,
        select: { id: true, title: true, status: true, createdAt: true, reviewedAt: true, createdNovelId: true },
      }),
      prisma.novelEditRequest.findMany({
        where: { editedById: id },
        orderBy: { createdAt: "desc" },
        take: RECENT_LIMIT,
        select: { id: true, status: true, createdAt: true, reviewedAt: true, novel: { select: { id: true, title: true } } },
      }),
      prisma.userNovel.aggregate({ where: { userId: id }, _count: { _all: true }, _sum: { progress: true } }),
    ]);

    const a = countByStatus(addCounts);
    const e = countByStatus(editCounts);
    const approved = (a.APPROVED ?? 0) + (e.APPROVED ?? 0);
    const rejected = (a.REJECTED ?? 0) + (e.REJECTED ?? 0);
    const pending = (a.PENDING ?? 0) + (e.PENDING ?? 0);
    const reviewed = approved + rejected;

    const recent = [
      ...adds.map((r) => ({ type: "new", id: r.id, status: r.status, createdAt: r.createdAt, reviewedAt: r.reviewedAt, title: r.title, novelId: r.createdNovelId })),
      ...edits.map((r) => ({ type: "edit", id: r.id, status: r.status, createdAt: r.createdAt, reviewedAt: r.reviewedAt, title: r.novel?.title ?? "Deleted novel", novelId: r.novel?.id ?? null })),
    ]
      .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt))
      .slice(0, RECENT_LIMIT);

    return res.status(200).json({
      message: "Submitter profile fetched",
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        avatar: await avatarUrl(user.avatarKey),
        createdAt: user.createdAt,
      },
      submissions: {
        total: reviewed + pending,
        approved,
        rejected,
        pending,
        newNovels: Object.values(a).reduce((s, n) => s + n, 0),
        edits: Object.values(e).reduce((s, n) => s + n, 0),
        // approved ÷ (approved + rejected); null until enough have been reviewed
        approvalRate: reviewed >= MIN_REVIEWED_FOR_RATE ? Math.round((approved / reviewed) * 100) : null,
      },
      reading: {
        novels: reading._count._all,
        chapters: reading._sum.progress ?? 0,
      },
      recent,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export { getSubmitterProfile };
