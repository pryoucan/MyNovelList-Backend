import { Router } from "express";
import { registerUser, loginUser, forgotPassword, verifyOtp, resetPassword, logoutUser, getProfile, updateProfile } from "../controllers/user-auth.controller.js";
import { registerUserValidator, loginUserValidator } from "../validators/user.validator.js";
import { validate } from "../middlewares/validator.middleware.js";
import { userAuthentication } from "../middlewares/auth-user.middleware.js";


const authRouter = Router();

authRouter.post("/register", validate(registerUserValidator), registerUser);
authRouter.post("/login", validate(loginUserValidator), loginUser);
authRouter.post("/logout", logoutUser);
authRouter.get("/me", userAuthentication, getProfile);
authRouter.put("/profile", userAuthentication, updateProfile);

authRouter.post("/forgot-password", forgotPassword);
authRouter.post("/verify-otp", verifyOtp);
authRouter.post("/reset-password", userAuthentication , resetPassword);

export { authRouter };