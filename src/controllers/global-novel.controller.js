import { prisma } from "../config/db.config.js";
import { isUuid, serializeNovel } from "../utils/serializers.js";

// Case-insensitive partial match on title, original title, or author.
export const novelSearchFilter = (q) => ({
    OR: [
        { title: { contains: q, mode: "insensitive" } },
        { originalTitle: { contains: q, mode: "insensitive" } },
        { author: { contains: q, mode: "insensitive" } }
    ]
});

const viewNovel = async (req, res) => {
    try {
        const novels = await prisma.globalNovel.findMany({ orderBy: { title: "asc" } });
        if(!novels.length) {
            return res.status(404).json({
                message: "Novel not found"
            });
        }

        return res.status(200).json({
            message: "Novel fetched successfully",
            novels: await Promise.all(novels.map(serializeNovel))
        });
    }
    catch(error) {
        console.log(error);
        return res.status(500).json({ message: "Something went wrong" });
    }
}


const getNovelById = async (req, res) => {
    const { id } = req.params;
    if(!isUuid(id)) {
        return res.status(404).json({ message: "No novels found" });
    }

    try {
        const novel = await prisma.globalNovel.findUnique({ where: { id } });
        if(!novel) {
            return res.status(404).json({
                message: "No novels found"
            });
        }
        return res.status(200).json({
            message: "Novel found",
            novel: await serializeNovel(novel)
        });
    }
    catch(error) {
        console.log(error);
        return res.status(500).json({
            message: "Something went wrong"
        });
    }
}


const getNovelByName = async (req, res) => {
    const q = req.query.q?.trim();
    if(!q) {
        return res.status(400).json({ message: "Novel name required" });
    }

    try {
        const novels = await prisma.globalNovel.findMany({
            where: novelSearchFilter(q),
            orderBy: { title: "asc" }
        });
        if(!novels.length) {
            return res.status(404).json({ message: "Novel not found"});
        }

        return res.status(200).json({
            message: "Novel found",
            novels: await Promise.all(novels.map(serializeNovel))
        });
    }
    catch(error) {
        console.log(error)
        return res.status(500).json({ message: "Something went wrong" });
    }
}

// Bayesian average: each novel's mean is pulled toward the site-wide mean
// until it has enough ratings, so one 10/10 can't top the chart.
//   score = (PRIOR_WEIGHT * siteMean + sumOfRatings) / (PRIOR_WEIGHT + ratingCount)
const PRIOR_WEIGHT = 2;
// Below this many ratings the score is reported as null ("New").
const MIN_RATINGS_FOR_SCORE = 2;

const roundTo = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;

// The detail page only needs one novel's score and rating count.
const getNovelStatsById = async (req, res) => {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(404).json({ message: "Novel not found" });

    try {
        const [ratings, site] = await Promise.all([
            prisma.userNovel.aggregate({
                where: { novelId: id, rating: { not: null } },
                _count: { rating: true },
                _sum: { rating: true },
            }),
            prisma.userNovel.aggregate({
                where: { rating: { not: null } },
                _avg: { rating: true },
            }),
        ]);
        const ratingCount = ratings._count.rating;
        const siteMean = site._avg.rating;
        const score = ratingCount >= MIN_RATINGS_FOR_SCORE && siteMean != null
            ? roundTo((PRIOR_WEIGHT * siteMean + ratings._sum.rating) / (PRIOR_WEIGHT + ratingCount), 1)
            : null;
        return res.json({ stats: { novelId: id, ratingCount, score } });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Something went wrong" });
    }
};

// Public, aggregated across all readers: reader counts and community scores.
const getNovelStats = async (req, res) => {
    try {
        const [readers, ratings, site] = await Promise.all([
            prisma.userNovel.groupBy({ by: ["novelId"], _count: { _all: true } }),
            prisma.userNovel.groupBy({
                by: ["novelId"],
                where: { rating: { not: null } },
                _count: { rating: true },
                _sum: { rating: true },
            }),
            prisma.userNovel.aggregate({ where: { rating: { not: null } }, _avg: { rating: true } }),
        ]);

        const siteMean = site._avg.rating;
        const ratingsByNovel = new Map(ratings.map((r) => [r.novelId, r]));

        const stats = readers.map(({ novelId, _count }) => {
            const r = ratingsByNovel.get(novelId);
            const ratingCount = r?._count.rating ?? 0;
            const score =
                ratingCount >= MIN_RATINGS_FOR_SCORE && siteMean != null
                    ? roundTo((PRIOR_WEIGHT * siteMean + r._sum.rating) / (PRIOR_WEIGHT + ratingCount), 1)
                    : null;
            return { novelId, readers: _count._all, ratingCount, score };
        });

        return res.status(200).json({
            message: "Novel stats fetched successfully",
            siteMean: siteMean != null ? roundTo(siteMean, 2) : null,
            stats,
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Something went wrong" });
    }
}

export { viewNovel, getNovelById, getNovelByName, getNovelStats, getNovelStatsById };
