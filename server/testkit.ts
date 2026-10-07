import { websocket } from "@hono/bun";
import { app } from "./app.ts";

/** 真 server 起随机端口，cli 的 e2e 验收用 */
export const serveApp = () => Bun.serve({ port: 0, fetch: app.fetch, websocket });
