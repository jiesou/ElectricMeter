import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { Action, Target } from "@em/shared";
import { historyOf } from "../core/db.ts";
import { command, deviceTotals, getEntity, listEntities, resolve, waitAck, watch } from "../core/hub.ts";
import { midnight, series } from "../core/stats.ts";
import { now } from "../core/util.ts";

export const api = new Hono();

const ACTIONS: Action[] = ["turn_on", "turn_off", "toggle"];

api.get("/health", (c) => c.json({ status: "ok", ts: now() }));

/** 总览：在线状态 + 当前功率 + 今日用电 */
api.get("/devices", (c) => c.json(deviceTotals(midnight())));

api.get("/entities", (c) => {
  const q = c.req.query();
  return c.json(listEntities().filter((e) => (!q.kind || e.kind === q.kind) && (!q.device || e.deviceId === q.device)));
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

/** 动作入口：POST /api/actions/turn_off { "device": "esp-301" } 就是整房断电 */
api.post("/actions/:action", async (c) => {
  const action = c.req.param("action") as Action;
  if (!ACTIONS.includes(action)) return c.json({ error: `未知动作: ${action}` }, 404);
  const targets = resolve((await c.req.json()) as Target);
  const refs = targets.map((e) => e.ref);
  const sent = targets.filter((e) => command(e, action)).length;
  if (!sent) return c.json({ ts: now(), refs, sent, acked: 0 });
  return c.json({ ts: now(), refs, sent, acked: await waitAck() });
});

/** 观察者只读流，CLI watch 和将来的前端都走它 */
api.get("/events", (c) =>
  streamSSE(c, async (stream) => {
    const off = watch((e) => void stream.writeSSE({ event: e.type, data: JSON.stringify(e) }));
    stream.onAbort(off);
    while (true) await stream.sleep(60_000);
  }),
);
