import { Hono } from "hono";
import { db } from "../core/db.ts";
import * as hub from "../core/hub.ts";
import { streamSnapshot } from "../core/sse.ts";
import { now, byId } from "../core/util.ts";

export const rooms = new Hono();

const snapshot = () =>
  [...hub.devices.values()].sort(byId).map((device) => {
    const entities = [...device.entities.values()].sort(byId);
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
rooms.get("/stream", (c) => streamSnapshot(c, snapshot, () => hub.recent));

/** 该房所有实体窗口内的历史读数，默认最近 10 分钟 */
rooms.get("/:device_id/history", async (c) =>
  c.json(
    await db.entityHistory.findMany({
      where: {
        device_id: c.req.param("device_id"),
        ts: { gte: Number(c.req.query("since") ?? now() - 600_000) },
      },
      orderBy: { ts: "asc" },
    }),
  ),
);

/** 改房名：内存和库都要写，只写一边就会一边新一边旧 */
rooms.patch("/:device_id", async (c) => {
  const device_id = c.req.param("device_id");
  const device = hub.devices.get(device_id);
  if (!device) return c.json({ error: `未知客房: ${device_id}` }, 404);

  const { name } = await c.req.json<{ name?: unknown }>();
  if (typeof name !== "string" || !name.trim())
    return c.json({ error: "房名不能为空" }, 400);

  device.name = name.trim();
  await db.device.update({
    where: { id: device_id },
    data: { name: device.name },
  });
  return c.json(snapshot().find((room) => room.id === device_id));
});

/** 删房：实体与历史读数靠外键级联一起清掉。设备还连着的话，下一帧会被它自己重新建回来 */
rooms.delete("/:device_id", async (c) => {
  const device_id = c.req.param("device_id");
  if (!hub.devices.has(device_id))
    return c.json({ error: `未知客房: ${device_id}` }, 404);

  hub.devices.delete(device_id);
  await db.device.delete({ where: { id: device_id } });
  return c.body(null, 204);
});
