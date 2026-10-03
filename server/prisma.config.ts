import { defineConfig } from "prisma/config";

// Prisma 7 把连接串从 schema 挪到了这里
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: process.env.DATABASE_URL ?? "file:./data/electric.db" },
});
