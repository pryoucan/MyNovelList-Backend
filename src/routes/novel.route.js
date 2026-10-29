import { Router } from "express";
import { viewNovel, getNovelById, getNovelByName, getNovelStats, getNovelStatsById } from "../controllers/global-novel.controller.js";
import { listNovelReviews, createNovelReview, editNovelReview, deleteNovelReview } from "../controllers/novel-review.controller.js";
import { userAuthentication } from "../middlewares/auth-user.middleware.js";
import { optionalAuthentication } from "../middlewares/optional-auth.middleware.js";
import { createReviewReply, editReviewReply, deleteReviewReply, likeReview, unlikeReview, likeReply, unlikeReply } from "../controllers/review-thread.controller.js";

const novelRouter = Router();
const normalUser = (req, res, next) => req.user?.purpose
    ? res.status(403).json({ message: "Sign in to interact with reviews" })
    : next();

novelRouter.get("/", async (req, res) => {
    if(req.query.q) {
        return getNovelByName(req, res);
    }
    return viewNovel(req, res);
});

novelRouter.get("/stats", getNovelStats);
novelRouter.get("/:id/stats", getNovelStatsById);
novelRouter.get("/:id/reviews", optionalAuthentication, listNovelReviews);
novelRouter.post("/:id/reviews", userAuthentication, normalUser, createNovelReview);
novelRouter.patch("/:id/reviews/mine", userAuthentication, normalUser, editNovelReview);
novelRouter.delete("/:id/reviews/mine", userAuthentication, normalUser, deleteNovelReview);
novelRouter.put("/:id/reviews/:reviewId/like", userAuthentication, normalUser, likeReview);
novelRouter.delete("/:id/reviews/:reviewId/like", userAuthentication, normalUser, unlikeReview);
novelRouter.post("/:id/reviews/:reviewId/replies", userAuthentication, normalUser, createReviewReply);
novelRouter.patch("/:id/reviews/:reviewId/replies/:replyId", userAuthentication, normalUser, editReviewReply);
novelRouter.delete("/:id/reviews/:reviewId/replies/:replyId", userAuthentication, normalUser, deleteReviewReply);
novelRouter.put("/:id/reviews/:reviewId/replies/:replyId/like", userAuthentication, normalUser, likeReply);
novelRouter.delete("/:id/reviews/:reviewId/replies/:replyId/like", userAuthentication, normalUser, unlikeReply);
novelRouter.get("/:id", getNovelById);

// Suggestions for novel details live in request.route.js and admin.route.js.

export { novelRouter };
