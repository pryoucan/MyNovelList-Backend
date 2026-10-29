import jwt from "jsonwebtoken";
import { isUuid } from "../utils/serializers.js";

// Public review lists also include whether the current reader liked each item.
export const optionalAuthentication = (req, _res, next) => {
  const cookieToken = req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith("token="))?.slice(6);
  const token = cookieToken || (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null);
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRETKEY);
      if (isUuid(decoded.id) && decoded.purpose !== "reset_password") req.viewerId = decoded.id;
    } catch {
      // An expired session may still read public reviews.
    }
  }
  next();
};
