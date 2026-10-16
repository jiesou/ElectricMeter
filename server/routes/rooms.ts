import { Hono } from "hono";
import { db } from "../core/db.ts";
import * as hub from "../core/hub.ts";
import { streamSnapshot } from "../core/sse.ts";
import { now } from "../core/util.ts";

export const rooms = new Hono();

const snapshot = () =>
  [...hub.devices.values()].map((device) => {
    const entities = [...device.entities.values()];
    const meters = entities.filter((entity) => entity.type === "meter");
    return {
      id: device.id,
      name: device.name,
      online: device.online,
      power: meters.reduce((sum, entity) => sum + (entity.powerW ?? 0), 0),
      energy: meters.reduce((sum, entity) => sum + (entity.energyKwh ?? 0), 0),
      entities,
    };
  });

rooms.get("/", (c) => c.json(snapshot()));
rooms.get("/stream", (c) => streamSnapshot(c, snapshot));

/** 该房所有实体窗口内的历史读数，默认最近 10 分钟 */
rooms.get("/:device_id/history", async (c) =>
  c.json(
    await db.entityHistory.findMany({
      where: { device_id: c.req.param("device_id"), ts: { gte: Number(c.req.query("since") ?? now() - 600) } },
      orderBy: { ts: "asc" },
    }),
  ),
);
