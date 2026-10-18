import { Hono } from "hono";
import { report } from "../core/stats.ts";

export const stats = new Hono();

/** 统计页要的全在这儿：在住客房、本次入住明细、客户用电情况记录表 */
stats.get("/", async (c) => c.json(await report()));
