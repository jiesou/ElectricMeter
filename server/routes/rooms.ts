import { Hono } from "hono";
import * as hub from "../core/hub.ts";
import { streamSnapshot } from "../core/sse.ts";

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
