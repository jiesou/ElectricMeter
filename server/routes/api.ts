import { Hono } from "hono";
import { now } from "../core/util.ts";
import { clock } from "./clock.ts";
import { cv } from "./cv.ts";
import { devices } from "./devices.ts";
import { entities } from "./entities.ts";
import { rooms } from "./rooms.ts";
import { stats } from "./stats.ts";

export const api = new Hono();

/** chat.ts 现场重写，随时可能不在：加载不了就退化成 503，别拖垮整个后端 */
const chat = await import("./chat.ts")
  .then((m) => m.chat)
  .catch(() => {
    const down = new Hono();
    down.all("/", (c) => c.text("DeepSeek 服务端连接失败", 503));
    return down;
  });

api.get("/health", (c) => c.json({ status: "ok", ts: now() }));

api.route("/chat", chat);
api.route("/clock", clock);
api.route("/cv", cv);
api.route("/devices", devices);
api.route("/entities", entities);
api.route("/rooms", rooms);
api.route("/stats", stats);
