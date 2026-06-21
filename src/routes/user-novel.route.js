import { Router } from "express";
import
{
    addUserNovel, deleteUserNovel,
    editUserNovel,
    getUserNovelByGId,
    getUserNovelById,
    getUserNovelByName,
    viewUserNovel,
}

from "../controllers/user-novel.controller.js";
import { userAuthentication } from "../middlewares/auth-user.middleware.js";
import { validate } from "../middlewares/validator.middleware.js";
import { userNovelAddValidator, userNovelEditValidator } from "../validators/user-novel.validator.js";

const userNovelRouter = Router();

userNovelRouter.get("/", userAuthentication, async (req, res) => {
    if(req.query.n) {
        return getUserNovelByName(req, res);
    }
    return viewUserNovel(req, res);
});

userNovelRouter.get("/by-global/:novelId", userAuthentication, getUserNovelByGId);
userNovelRouter.get("/:novelId", userAuthentication, getUserNovelById)
userNovelRouter.post("/:novelId", userAuthentication, validate(userNovelAddValidator), addUserNovel);
userNovelRouter.patch("/:novelId", userAuthentication, validate(userNovelEditValidator), editUserNovel);
userNovelRouter.delete("/:novelId", userAuthentication, deleteUserNovel);

export { userNovelRouter };