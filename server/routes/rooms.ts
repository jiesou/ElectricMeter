import { Hono } from "hono";
import { db } from "../core/db.ts";
import * as hub from "../core/hub.ts";
import { streamSnapshot } from "../core/sse.ts";
import * as stays from "../core/stays.ts";
import { now, byId, isRoom } from "../core/util.ts";

export const rooms = new Hono();

/** 客房快照：大屏不算房，别的设备有几个算几个 */
const snapshot = () =>
  [...hub.devices.values()]
    .filter((device) => isRoom(device.id))
    .sort(byId)
    .map((device) => {
      const entities = [...device.entities.values()].sort(byId);
      const meters = entities.filter((entity) => entity.type === "meter");
      return {
        id: device.id,
        name: device.name,
        online: device.online,
        occupied: stays.occupied(device.id),
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
  // 改完顺手告诉设备：它屏幕顶上显示的就是这个名
  hub.sendTo(device_id, { type: "pub_name", name: device.name });
  return c.json(snapshot().find((room) => room.id === device_id));
});

/** 办理入住：开一段入住区间。用了多少电不记在这儿，统计时回账本做差 */
rooms.post("/:device_id/checkin", async (c) => {
  const device_id = c.req.param("device_id");
  if (!hub.devices.has(device_id))
    return c.json({ error: `未知客房: ${device_id}` }, 404);

  return c.json({ start_ts: await stays.checkin(device_id) });
});

/** 办理退房：给这段入住填上结束时间 */
rooms.post("/:device_id/checkout", async (c) => {
  const device_id = c.req.param("device_id");
  if (!hub.devices.has(device_id))
    return c.json({ error: `未知客房: ${device_id}` }, 404);

  await stays.checkout(device_id);
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
