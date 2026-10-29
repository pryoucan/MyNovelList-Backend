import { Router } from "express";
import { userAuthentication } from "../middlewares/auth-user.middleware.js";
import { requireAdmin } from "../middlewares/require-admin.middleware.js";
import { validate } from "../middlewares/validator.middleware.js";
import { rejectRequestValidator } from "../validators/novel-request.validator.js";
import { listRequests, approveRequest, rejectRequest } from "../controllers/admin-request.controller.js";
import { getSubmitterProfile } from "../controllers/admin-user.controller.js";

const adminRouter = Router();

adminRouter.use(userAuthentication, requireAdmin);
adminRouter.get("/requests", listRequests);
adminRouter.post("/requests/:type/:id/approve", approveRequest);
adminRouter.post("/requests/:type/:id/reject", validate(rejectRequestValidator), rejectRequest);
adminRouter.get("/users/:id", getSubmitterProfile);

export { adminRouter };
