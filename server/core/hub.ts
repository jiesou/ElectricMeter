import type { WSContext } from "hono/ws";
import type { Device, EntitiesMessage, Entity, EntityUpdate, WSMessage, WSMessageHandler } from "@em/shared";
import { db } from "./db.ts";
import { now } from "./util.ts";

/** 实体现在的读数，设备报什么就有什么 */
type Readings = Pick<EntityUpdate, "state" | "powerW" | "energyKwh">;

/** 所有设备：库是底账，这里是运行期那份（连接 + 读数 + 最后说话时间） */
export const devices = new Map<
  string,
  Device & { ws?: WSContext; entities: Map<string, Entity & Readings> }
>();

// 服务器启动：库里的设备与实体全读进来，之后只有连接和读数在变
for (const d of await db.device.findMany({ orderBy: { id: "asc" }, include: { entities: { orderBy: { id: "asc" } } } })) {
  const entities = d.entities.map((e) => [
    e.id,
    // 库里的 null 换成 undefined：读不到的字段就是没有，别输出一串 null
    {
      ...e,
      type: e.type as Entity["type"],
      state: e.state ?? undefined,
      powerW: e.powerW ?? undefined,
      energyKwh: e.energyKwh ?? undefined,
      lastUpdate: e.lastUpdate ?? undefined,
    },
  ] as const);
  devices.set(d.id, { ...d, ip: d.ip ?? "", online: false, lastSeen: 0, entities: new Map(entities) });
}

const handlers: WSMessageHandler[] = []; // 谁关心谁注册：每个处理器自己认报文类型

handlers.push((_device, reply, m) => {
  if (m.type === "pub_alive") reply({ type: "ack_alive", ts: now() });
});

/**
 * 板子自己有什么。连上把每个实体的 name/type 报一遍，之后哪个实体变了就补一份，没提到的保持原样。
 * 报来的都写回库，所以内存这张表始终就是库那张表。
 */
handlers.push(async (device, _reply, m) => {
  if (m.type !== "pub_entities") return;
  const online = devices.get(device.id);
  if (!online) return;
  for (const e of (m as EntitiesMessage).entities) {
    const old = online.entities.get(e.id);
    if (!old && e.type === undefined) continue; // 没申报过身份，这条读数丢掉
    const row = {
      device_id: device.id,
      id: e.id,
      name: e.name ?? old?.name ?? e.id,
      type: e.type ?? old!.type,
      state: e.state ?? old?.state,
      powerW: e.powerW ?? old?.powerW,
      energyKwh: e.energyKwh ?? old?.energyKwh,
      lastUpdate: now(),
    };
    online.entities.set(e.id, row);
    await db.entity.upsert({
      where: { device_id_id: { device_id: device.id, id: e.id } },
      create: row,
      update: { name: row.name, type: row.type, state: row.state, powerW: row.powerW, energyKwh: row.energyKwh, lastUpdate: row.lastUpdate },
    });
  }
});

export async function connect(device_id: string, ws: WSContext, ip = "") {
  // 先登记连接再写库：板子的第一条消息可能比这次写库更早到
  const device = devices.get(device_id);
  if (device) {
    device.ip = ip;
    device.online = true;
    device.ws = ws;
    device.lastSeen = now();
  } else {
    // 设备名由服务端分配，新设备先拿 id 顶
    devices.set(device_id, {
      id: device_id,
      name: device_id,
      ip,
      online: true,
      lastSeen: now(),
      ws,
      entities: new Map(),
    });
  }
  await db.device.upsert({
    where: { id: device_id },
    create: { id: device_id, name: device_id, ip },
    update: { ip },
  });
}

export function disconnect(device_id: string) {
  const device = devices.get(device_id);
  if (!device) return;
  device.online = false;
  device.ws = undefined;
}

export async function handleMessage(device_id: string, raw: string) {
  const device = devices.get(device_id);
  if (!device) return; // 连接已经不在了，这条丢掉
  device.lastSeen = now();
  const m = JSON.parse(raw) as WSMessage;
  for (const handle of handlers) await handle(device, (r) => device.ws?.send(JSON.stringify(r)), m);
}
