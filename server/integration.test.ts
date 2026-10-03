import { expect, test } from "bun:test";
import { websocket } from "@hono/bun";
import { app } from "./app.ts";
import { db } from "./core/db.ts";
import { now } from "./core/util.ts";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("端到端：真下位机连上来 → REST 看得见 → 读数落库，重启读得回来", async () => {
  const server = Bun.serve({ port: 0, fetch: app.fetch, websocket });
  const api = (path: string) => fetch(`http://127.0.0.1:${server.port}/api${path}`);
  const json = async (res: Response) => (await res.json()) as any;

  expect((await json(await api("/health"))).status).toBe("ok");

  const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws?device_id=esp-901`);
  await new Promise((r) => (ws.onopen = r));
  await delay(50);

  ws.send(
    JSON.stringify({
      type: "pub_entities",
      ts: now(),
      entities: [
        { id: "light", name: "照明", type: "switch", state: false },
        { id: "light-meter", name: "照明功率", type: "meter", powerW: 55, energyKwh: 2.1 },
      ],
    }),
  );
  await delay(200);

  expect((await json(await api("/devices"))).find((d: any) => d.id === "esp-901")).toMatchObject({
    name: "esp-901", // 设备名由服务端分配
    online: true,
    power: 55,
    energy: 2.1,
  });
  const entities = await json(await api("/entities?device=esp-901"));
  expect(entities.map((e: any) => e.id)).toEqual(["light", "light-meter"]);
  expect(entities[0].state).toBe(false);

  // 库是底账：读数也写进去了，服务器重启后启动那段 load 读得回来
  expect(await db.entity.findUnique({ where: { device_id_id: { device_id: "esp-901", id: "light-meter" } } }))
    .toMatchObject({ name: "照明功率", type: "meter", powerW: 55, energyKwh: 2.1 });

  ws.close();
  server.stop(true);
});
