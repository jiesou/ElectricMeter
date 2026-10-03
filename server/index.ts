import { websocket } from "@hono/bun";
import { app } from "./app.ts";
import { checkTimeout } from "./core/hub.ts";
import { flush, purge } from "./core/stats.ts";
import { now } from "./core/util.ts";

const port = Number(process.env.PORT ?? 8080);

Bun.serve({ port, fetch: app.fetch, websocket });

// 桶闭合了就落库，保留期到了就删
setInterval(() => flush(), 10_000);
setInterval(() => purge(), 3_600_000);
// 板子心跳 30s 一次，过了 TIMEOUT 还没动静就当它掉线
setInterval(() => checkTimeout(), 5_000);
purge();

console.log(`server   http://localhost:${port}`);
console.log(`device   ws://localhost:${port}/ws?device_id=esp-301`);
console.log(`ts       ${now()}`);
