import jwt from "jsonwebtoken";

const userAuthentication = async (req, res, next) => {
  let token = null;

  // 1. Try to read token from cookies
  if (req.headers.cookie) {
    token = req.headers.cookie
      .split("; ")
      .find((row) => row.startsWith("token="))
      ?.split("=")[1];
  }

  // 2. Fallback to Authorization header
  if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Token not found" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRETKEY);
    if(!decoded.purpose || decoded.purpose !== "reset_password") {
      req.user = { id: decoded.id, role: decoded.role, username: decoded.username };
    }
    else {
      req.user = { id: decoded.id, purpose: decoded.purpose };
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export { userAuthentication };