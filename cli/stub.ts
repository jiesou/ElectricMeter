import type { Device, Entity } from "@em/shared";
import type { Room } from "./types.ts";

export const rooms: Room[] = [
  { id: "esp-301", name: "301 房", online: true, power: 955, energy: 66.7, entities: [] },
  { id: "esp-302", name: "", online: false, power: 0, energy: 12.34, entities: [] },
];

export const devices: Device[] = [
  { id: "esp-301", name: "301 房", ip: "192.168.1.31", online: true, lastSeen: 1759291200 },
];

export const entities: Entity[] = [
  { id: "light", device_id: "esp-301", name: "照明", type: "switch", state: true },
  { id: "meter", device_id: "esp-301", name: "插座", type: "meter", powerW: 123.4, energyKwh: 12.5 },
];

/** 进程内 stub server，复刻 /api 的 REST 与 SSE 形态，给 api / CLI 测试用 */
export const startStub = () =>
  Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/api/rooms") return Response.json(rooms);
      if (url.pathname === "/api/devices") return Response.json(devices);
      if (url.pathname === "/api/entities") return Response.json(entities);
      if (url.pathname === "/api/entities/esp-301/light") return Response.json(entities[0]);
      if (url.pathname === "/api/entities/esp-301/nope")
        return Response.json({ error: "未知实体: esp-301/nope" }, { status: 404 });
      if (url.pathname === "/api/rooms/stream") {
        const enc = new TextEncoder();
        const body = new ReadableStream({
          start(c) {
            c.enqueue(enc.encode(`data: ${JSON.stringify(rooms)}\n\n`));
            c.enqueue(enc.encode(`data: ${JSON.stringify(rooms)}\n\n`));
            c.close();
          },
        });
        return new Response(body, { headers: { "content-type": "text/event-stream" } });
      }
      return Response.json({ error: "not found" }, { status: 404 });
    },
  });
