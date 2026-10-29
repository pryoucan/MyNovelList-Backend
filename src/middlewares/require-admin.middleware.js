import { prisma } from "../config/db.config.js";

// Runs after userAuthentication. The role is read from the database on every
// request (not trusted from the token), so demoting an admin takes effect at once.
const requireAdmin = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user?.id }, select: { role: true } });
    if (user?.role !== "ADMIN") {
      return res.status(403).json({ message: "Admins only" });
    }
    next();
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export { requireAdmin };
