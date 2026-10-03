import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { Target } from "@em/shared";
import { db } from "../core/db.ts";
import { command, deviceTotals, getEntity, listEntities, resolve, waitAck, watch } from "../core/hub.ts";
import { series } from "../core/stats.ts";
import { now } from "../core/util.ts";

export const api = new Hono();

api.get("/health", (c) => c.json({ status: "ok", ts: now() }));

/** 总览：在线状态 + 当前功率 + 电量 */
api.get("/devices", (c) => c.json(deviceTotals()));

/** 不给 device 就是所有设备的实体 */
api.get("/entities", (c) => {
  const { device } = c.req.query();
  return c.json(device ? listEntities().filter((e) => e.device_id === device) : listEntities());
});

api.get("/entities/:device_id/:id", (c) => {
  const { device_id, id } = c.req.param();
  const e = getEntity(device_id, id);
  return e ? c.json(e) : c.json({ error: `未知实体: ${device_id}/${id}` }, 404);
});

api.get("/statistics/:device_id/:id", (c) => {
  const { device_id, id } = c.req.param();
  const to = Number(c.req.query("to") ?? now());
  const from = Number(c.req.query("from") ?? to - 86400);
  return c.json(series(device_id, id, from, to));
});

api.get("/history/:device_id/:id", (c) => {
  const { device_id, id } = c.req.param();
  const to = Number(c.req.query("to") ?? now());
  const from = Number(c.req.query("from") ?? to - 86400);
  return c.json({
    states: db
      .query<{ ts: number; state: string }, [string, string, number, number]>(
        "SELECT ts, state FROM state WHERE device_id = ? AND id = ? AND ts >= ? AND ts < ? ORDER BY ts",
      )
      .all(device_id, id, from, to),
  });
});

/** 通断：{ device_id, id, state }。只给 device_id 就是整房断电，不给 state 就是取反 */
api.post("/actions", async (c) => {
  const target = (await c.req.json().catch(() => ({}))) as Target;
  const targets = resolve(target);
  const ids = targets.filter((e) => command(e, target.state ?? !e.state)).map((e) => `${e.device_id}/${e.id}`);
  return c.json({ ts: now(), ids, sent: ids.length, acked: ids.length ? await waitAck() : 0 });
});

/** 观察者只读流，CLI watch 和将来的前端都走它 */
api.get("/events", (c) =>
  streamSSE(c, async (stream) => {
    const off = watch((e) => void stream.writeSSE({ event: e.type, data: JSON.stringify(e) }));
    stream.onAbort(off);
    while (true) await stream.sleep(60_000);
  }),
);
