import "dotenv/config";
import { defineConfig } from "prisma/config";

// The CLI (migrate, studio) needs a direct/session connection, not the
// transaction pooler, so it uses DATABASE_URL_UNPOOLED. The app itself uses DATABASE_URL.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED,
  },
});
