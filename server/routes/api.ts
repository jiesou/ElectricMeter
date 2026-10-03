import { Hono } from "hono";
import { deviceTotals, getEntity, listEntities } from "../core/hub.ts";
import { now } from "../core/util.ts";

export const api = new Hono();

api.get("/health", (c) => c.json({ status: "ok", ts: now() }));

/** 总览：在线状态 + 当前功率 + 电量 */
api.get("/devices", async (c) => c.json(await deviceTotals()));

/** 不给 device 就是所有设备的实体 */
api.get("/entities", async (c) => c.json(await listEntities(c.req.query("device"))));

api.get("/entities/:device_id/:id", async (c) => {
  const { device_id, id } = c.req.param();
  const e = await getEntity(device_id, id);
  return e ? c.json(e) : c.json({ error: `未知实体: ${device_id}/${id}` }, 404);
});
