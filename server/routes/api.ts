import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { Action, Target } from "@em/shared";
import { historyOf } from "../core/db.ts";
import { act, getEntity, listDevices, listEntities, resolve, watch } from "../core/hub.ts";
import { energyOf, midnight, series } from "../core/stats.ts";
import { now } from "../core/util.ts";

export const api = new Hono();

const ACTIONS: Action[] = ["turn_on", "turn_off", "toggle"];

api.get("/health", (c) => c.json({ status: "ok", ts: now() }));

/** 设备总览：在线状态 + 当前功率 + 今日用电。功率实时取内存，用电量从统计表算 */
api.get("/devices", (c) => {
  const from = midnight();
  return c.json(
    listDevices().map((d) => {
      const meters = listEntities().filter((e) => e.deviceId === d.id && e.deviceClass === "power");
      return {
        ...d,
        power: meters.reduce((s, e) => s + Number(e.state), 0),
        energy: energyOf(
          meters.map((e) => e.ref),
          from,
          now(),
        ),
      };
    }),
  );
});

api.get("/entities", (c) => {
  const q = c.req.query();
  return c.json(listEntities().filter((e) => (!q.domain || e.domain === q.domain) && (!q.device || e.deviceId === q.device)));
});

api.get("/entities/:ref", (c) => {
  const e = getEntity(c.req.param("ref"));
  return e ? c.json(e) : c.json({ error: "未知实体" }, 404);
});

api.get("/history/:ref", (c) => {
  const ref = c.req.param("ref");
  const to = Number(c.req.query("to") ?? now());
  const from = Number(c.req.query("from") ?? to - 86400);
  const [deviceId, key] = ref.split(":");
  return c.json({ ref, from, to, states: historyOf(deviceId, key, from, to) });
});

api.get("/statistics/:ref", (c) => {
  const ref = c.req.param("ref");
  if (!getEntity(ref)) return c.json({ error: `未知实体: ${ref}` }, 404);
  const to = Number(c.req.query("to") ?? now());
  const from = Number(c.req.query("from") ?? to - 86400);
  return c.json(series(ref, from, to));
});

/** 统一动作入口：POST /api/services/switch/turn_off { "device": "esp-301" } 就是整房断电 */
api.post("/services/:domain/:service", async (c) => {
  const domain = c.req.param("domain");
  const service = c.req.param("service") as Action;
  if (domain !== "switch") return c.json({ error: `本版本只提供 switch 域` }, 400);
  if (!ACTIONS.includes(service)) return c.json({ error: `未知动作: ${service}` }, 404);
  const targets = resolve((await c.req.json()) as Target);
  if (!targets.length) return c.json({ error: "目标为空，或目标里没有可开关的实体" }, 400);
  const results = await Promise.all(
    targets.map(async (e) => ({ ref: e.ref, ...(await act(e, service)) })),
  );
  return c.json({ ts: now(), results });
});

/** 观察者只读流，CLI watch 和将来的前端都走它 */
api.get("/events", (c) =>
  streamSSE(c, async (stream) => {
    const off = watch((e) => void stream.writeSSE({ event: e.type, data: JSON.stringify(e) }));
    stream.onAbort(off);
    while (true) await stream.sleep(60_000);
  }),
);
