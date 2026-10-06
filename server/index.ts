import { websocket } from "@hono/bun";
import { app } from "./app.ts";
import { startUdpCamera } from "./core/udp_camera.ts";
import { now } from "./core/util.ts";

const port = Number(process.env.PORT ?? 8080);
const udpPort = Number(process.env.UDP_PORT ?? 8080);

Bun.serve({ port, fetch: app.fetch, websocket });
startUdpCamera(udpPort);

console.log(`server   http://localhost:${port}`);
console.log(`device   ws://localhost:${port}/ws?device_id=esp-301`);
console.log(`ts       ${now()}`);
