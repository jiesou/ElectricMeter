import { Hono } from "hono";
import * as hub from "../core/hub.ts";

export const entities = new Hono();

/** 实体清单：身份和读数都在内存那张表里。不给 device 就是所有设备的实体 */
entities.get("/", (c) => {
  const device_id = c.req.query("device");
  return c.json(
    [...hub.devices.values()]
      .filter((d) => !device_id || d.id === device_id)
      .flatMap((d) => [...d.entities.values()]),
  );
});

/** 单个实体：esp-301/light 就是 /api/entities/esp-301/light */
entities.get("/:device_id/:id", (c) => {
  const { device_id, id } = c.req.param();
  const e = hub.devices.get(device_id)?.entities.get(id);
  return e ? c.json(e) : c.json({ error: `未知实体: ${device_id}/${id}` }, 404);
});
