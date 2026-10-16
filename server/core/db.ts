import { isAbsolute, join } from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../generated/prisma/client.ts";

// Prisma 7 运行期不带 Rust 引擎，SQLite 走 libsql 适配器（better-sqlite3 在 Bun 下跑不了）。
// 相对路径基于 server/ 解析，从哪儿启动都指向同一份库
const url = (process.env.DATABASE_URL ?? "file:./data/electric.db").replace(/^file:/, "");

export const db = new PrismaClient({
  adapter: new PrismaLibSql({ url: `file:${isAbsolute(url) ? url : join(import.meta.dirname, "..", url)}` }),
});

// 读数每秒落一次盘，走 WAL 且不 fsync：进程崩溃不丢，断电最多回滚最后一笔
await db.$executeRawUnsafe("PRAGMA journal_mode = WAL");
await db.$executeRawUnsafe("PRAGMA synchronous = NORMAL");
