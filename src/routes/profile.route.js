import { Router } from "express";
import { getPublicProfile } from "../controllers/public-profile.controller.js";

const profileRouter = Router();

profileRouter.get("/:username", getPublicProfile);

export { profileRouter };
