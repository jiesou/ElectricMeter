import { websocket } from "@hono/bun";
import { app } from "./app.ts";
import { startHeartbeat } from "./core/hub.ts";
import { startUdpCamera } from "./core/udp_camera.ts";
import { now } from "./core/util.ts";
import { seedMissing } from "./simulator/stays.ts";

const port = Number(process.env.PORT ?? 8080);
const udpPort = Number(process.env.UDP_PORT ?? 8080);

Bun.serve({ port, fetch: app.fetch, websocket });
startUdpCamera(udpPort);
startHeartbeat();
setInterval(seedMissing, 5000); // 有房间接入就先看它要不要铺演示历史

console.log(`http     http://localhost:${port}`);
console.log(`device   ws://localhost:${port}/ws?device_id=esp-301`);
console.log(`udp      udp://localhost:${udpPort}`);
console.log(`ts       ${now()}`);
