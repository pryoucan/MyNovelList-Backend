import { Router } from "express";
import { viewNovel, getNovelById, getNovelByName } from "../controllers/global-novel.controller.js";
import { userAuthentication } from "../middlewares/auth-user.middleware.js";
import { validate } from "../middlewares/validator.middleware.js";
import { novelAddRequestValidator } from "../validators/novel-add-request.validator.js";
import { novelAddRequest } from "../controllers/novel-add-request.controller.js";
import { approveRequest, rejectRequest, viewRequest } from "../controllers/admin-novel.controller.js";


const novelRouter = Router();

novelRouter.get("/", async (req, res) => {
    if(req.query.q) {
        return getNovelByName(req, res);
    }
    return viewNovel(req, res);
});

novelRouter.get("/view-request", userAuthentication, viewRequest);
novelRouter.post("/add",
    userAuthentication,
    validate(novelAddRequestValidator),
    novelAddRequest
);
novelRouter.delete("/approve-request/:novelId", userAuthentication, approveRequest);
novelRouter.delete("/reject-request/:novelId", userAuthentication, rejectRequest);

novelRouter.get("/:id", getNovelById);


export { novelRouter };