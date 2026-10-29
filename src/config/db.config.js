import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });

const dbConnectivity = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("Database connection success");
  } catch (error) {
    console.log(`Database connection is failed: ${error}`);
    throw error;
  }
};

export default dbConnectivity;
