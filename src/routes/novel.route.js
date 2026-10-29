import { Router } from "express";
import { viewNovel, getNovelById, getNovelByName, getNovelStats } from "../controllers/global-novel.controller.js";

const novelRouter = Router();

novelRouter.get("/", async (req, res) => {
    if(req.query.q) {
        return getNovelByName(req, res);
    }
    return viewNovel(req, res);
});

novelRouter.get("/stats", getNovelStats);
novelRouter.get("/:id", getNovelById);

// Suggesting and reviewing novels lives in request.route.js and admin.route.js.

export { novelRouter };
