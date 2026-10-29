import { Router } from "express";
import { viewNovel, getNovelById, getNovelByName, getNovelStats, getNovelStatsById } from "../controllers/global-novel.controller.js";
import { listNovelReviews, createNovelReview, editNovelReview, deleteNovelReview } from "../controllers/novel-review.controller.js";
import { userAuthentication } from "../middlewares/auth-user.middleware.js";

const novelRouter = Router();

novelRouter.get("/", async (req, res) => {
    if(req.query.q) {
        return getNovelByName(req, res);
    }
    return viewNovel(req, res);
});

novelRouter.get("/stats", getNovelStats);
novelRouter.get("/:id/stats", getNovelStatsById);
novelRouter.get("/:id/reviews", listNovelReviews);
novelRouter.post("/:id/reviews", userAuthentication, createNovelReview);
novelRouter.patch("/:id/reviews/mine", userAuthentication, editNovelReview);
novelRouter.delete("/:id/reviews/mine", userAuthentication, deleteNovelReview);
novelRouter.get("/:id", getNovelById);

// Suggestions for novel details live in request.route.js and admin.route.js.

export { novelRouter };
