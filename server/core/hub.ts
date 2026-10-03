import type { WSContext } from "hono/ws";
import type { Device, EntitiesMessage, Entity, WSMessage, WSMessageHandler } from "@em/shared";
import { db } from "./db.ts";
import { now } from "./util.ts";

/** 实体现在的读数，设备报什么就有什么 */
type Readings = { state?: boolean; powerW?: number; energyKwh?: number };

/** 在线设备：库里的身份 + 这条连接 + 它上面每个实体现在的读数 */
const devices = new Map<string, Device & { ws: WSContext; lastSeen: number; entities: Map<string, Readings> }>();

const handlers: WSMessageHandler[] = []; // 谁关心谁注册：每个处理器自己认报文类型

/** 库里的每一台设备都在列，在线与否看当前有没有连接 */
async function listDevices(): Promise<Device[]> {
  const rows = await db.device.findMany({ orderBy: { id: "asc" } });
  return rows.map((d) => ({
    ...d,
    ip: d.ip ?? "",
    online: devices.has(d.id),
    lastSeen: devices.get(d.id)?.lastSeen ?? 0,
  }));
}

/** 实体清单：身份从库里读，读数从在线设备那儿叠上去 */
export async function listEntities(device_id?: string): Promise<(Entity & Readings)[]> {
  const rows = await db.entity.findMany({
    where: device_id ? { device_id } : {},
    orderBy: [{ device_id: "asc" }, { id: "asc" }],
  });
  return rows.map((row) => ({
    ...row,
    type: row.type as Entity["type"],
    ...devices.get(row.device_id)?.entities.get(row.id),
  }));
}

export async function getEntity(device_id: string, id: string): Promise<(Entity & Readings) | undefined> {
  const row = await db.entity.findUnique({ where: { device_id_id: { device_id, id } } });
  if (!row) return;
  return { ...row, type: row.type as Entity["type"], ...devices.get(device_id)?.entities.get(id) };
}

/** 总览：在线状态 + 当前功率 + 电量 */
export async function deviceTotals() {
  const [rows, entities] = [await listDevices(), await listEntities()];
  return rows.map((d) => {
    const meters = entities.filter((e) => e.device_id === d.id && e.type === "meter");
    return {
      ...d,
      power: meters.reduce((s, e) => s + (e.powerW ?? 0), 0),
      energy: meters.reduce((s, e) => s + (e.energyKwh ?? 0), 0),
    };
  });
}

/**
 * 板子自己有什么。连上把每个实体的 name/type 报一遍，之后哪个实体变了就补一份，没提到的保持原样。
 * 身份落库、读数只在内存，所以掉线时实体照留、读数跟着连接走。
 */
handlers.push(async (device, _reply, m) => {
  if (m.type !== "pub_entities") return;
  const { entities } = m as EntitiesMessage;
  const online = devices.get(device.id);
  if (!online) return;
  for (const e of entities as (Entity & Readings)[]) {
    // 申报身份（带 type）时才写库，之后每秒的读数不碰数据库
    if (e.type !== undefined) {
      await db.entity.upsert({
        where: { device_id_id: { device_id: device.id, id: e.id } },
        create: { device_id: device.id, id: e.id, name: e.name ?? e.id, type: e.type },
        update: { name: e.name ?? e.id },
      });
    }
    const readings = online.entities.get(e.id) ?? {};
    online.entities.set(e.id, readings);
    if (e.state !== undefined) readings.state = e.state;
    if (e.powerW !== undefined) readings.powerW = e.powerW;
    if (e.energyKwh !== undefined) readings.energyKwh = e.energyKwh;
  }
});

export async function connect(device_id: string, ws: WSContext, ip = "") {
  // 先登记连接再写库：板子的第一条消息可能比这次写库更早到
  devices.set(device_id, {
    id: device_id,
    name: device_id,
    ip,
    online: true,
    lastSeen: now(),
    ws,
    entities: new Map(),
  });
  // 设备名由服务端分配，新设备先拿 id 顶
  await db.device.upsert({
    where: { id: device_id },
    create: { id: device_id, name: device_id, ip },
    update: { ip },
  });
}

export function disconnect(device_id: string) {
  devices.delete(device_id);
}

export async function handleMessage(device_id: string, raw: string) {
  const online = devices.get(device_id);
  if (!online) return; // 连接已经不在了，这条丢掉
  online.lastSeen = now();
  const m = JSON.parse(raw) as WSMessage;
  for (const handle of handlers) await handle(online, (r) => online.ws.send(JSON.stringify(r)), m);
}

/** 服务器重启：内存里的一切清空，库不动。重启后还在的，才是真落了库 */
export function restart() {
  devices.clear();
}
