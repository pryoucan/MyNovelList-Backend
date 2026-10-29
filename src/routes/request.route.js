import { Router } from "express";
import { userAuthentication } from "../middlewares/auth-user.middleware.js";
import { validate } from "../middlewares/validator.middleware.js";
import { newNovelRequestValidator, editNovelRequestValidator } from "../validators/novel-request.validator.js";
import { submitNovel, submitEdit, mySubmissions, withdrawRequest } from "../controllers/novel-request.controller.js";

const requestRouter = Router();

requestRouter.use(userAuthentication);
requestRouter.get("/mine", mySubmissions);
requestRouter.post("/novels", validate(newNovelRequestValidator), submitNovel);
requestRouter.post("/novels/:novelId/edits", validate(editNovelRequestValidator), submitEdit);
requestRouter.delete("/:type/:id", withdrawRequest);

export { requestRouter };
