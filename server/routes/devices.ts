import { Hono } from "hono";
import * as hub from "../core/hub.ts";

export const devices = new Hono();

/** 总览：一台设备一行。库是底账，启动时全读进内存了，这里只读内存那张表 */
devices.get("/", (c) =>
  c.json(
    [...hub.devices.values()].map((d) => {
      const meters = [...d.entities.values()].filter((e) => e.type === "meter");
      return {
        id: d.id,
        name: d.name,
        ip: d.ip,
        online: d.online,
        lastSeen: d.lastSeen,
        power: meters.reduce((sum, e) => sum + (e.powerW ?? 0), 0),
        energy: meters.reduce((sum, e) => sum + (e.energyKwh ?? 0), 0),
      };
    }),
  ),
);
