import type { WSContext } from "hono/ws";
import type {
  Device,
  EntitiesMessage,
  Entity,
  Event,
  Target,
  WSMessage,
  WSMessageHandler,
} from "@em/shared";
import { TIMEOUT } from "@em/shared";
import { db } from "./db.ts";
import { record } from "./stats.ts";
import { now } from "./util.ts";

type DeviceRow = { id: string; name: string; model: string | null; fw_version: string | null };
/** lastSeen 只服务失联判定，不落库也不对外暴露 */
type Conn = { device: Device; ws: WSContext; lastSeen: number };

const conns = new Map<string, Conn>(); // deviceId → 连接，一个连接一个身份
const entities = new Map<string, Map<string, Entity>>(); // deviceId → id → 实体，只在内存
/** 板子报来的电量读数；实时电量＝这个读数＋它之后这段时间的功率积分 */
const energyBase = new Map<string, { kwh: number; ts: number }>();
const observers = new Set<(e: Event) => void>();
const handlers: Record<string, WSMessageHandler> = {}; // 谁关心谁注册
const ackWaiters = new Set<() => void>();
let inflight = 0;

/** 库里的每一台设备都在列，在线与否看当前有没有连接 */
export const listDevices = () =>
  db
    .query<DeviceRow, []>("SELECT id, name, model, fw_version FROM device ORDER BY id")
    .all()
    .map((d) => ({
      id: d.id,
      name: d.name,
      model: d.model ?? undefined,
      fwVersion: d.fw_version ?? undefined,
      online: conns.has(d.id),
    }));
export const listEntities = () => [...entities.values()].flatMap((m) => [...m.values()]);
export const getEntity = (deviceId: string, id: string) => entities.get(deviceId)?.get(id);
export const isOnline = (deviceId: string) => conns.has(deviceId);

/** 累计电量：板子最近一次报的读数 + 它之后这段的功率积分。同一时刻的量不会算两遍 */
export function energyKwh(e: Entity, at: number): number {
  const base = energyBase.get(`${e.deviceId}/${e.id}`);
  const wsec = base ? Math.max(0, (e.power_w ?? 0) * (at - base.ts)) : 0;
  return (e.energy_kwh ?? 0) + wsec / 3.6e6;
}

export function watch(fn: (e: Event) => void) {
  observers.add(fn);
  return () => void observers.delete(fn);
}

const emit = (e: Event) => {
  for (const fn of observers) fn(e);
};
const send = (deviceId: string, m: WSMessage) => conns.get(deviceId)?.ws.send(JSON.stringify(m));

/**
 * 板子自己有什么。连上发一份（带 name），之后哪个实体变了就补一份，没提到的保持原样。
 * 所以实体表跟着设备走，不跟着连接走：掉线时实体照留，重连后接着更新。
 */
handlers.pub_entities = (device, _reply, m) => {
  const { name, model, fwVersion, entities: defs } = m as EntitiesMessage;
  const ts = m.ts || now();
  // 自我介绍只在连上时发一遍，之后是增量报文，没带的字段不能当成空的
  if (name) device.name = name;
  if (model) device.model = model;
  if (fwVersion) device.fwVersion = fwVersion;
  db.run(
    "UPDATE device SET name = ?, model = COALESCE(?, model), fw_version = COALESCE(?, fw_version) WHERE id = ?",
    [device.name, model ?? null, fwVersion ?? null, device.id],
  );
  const table = entities.get(device.id) ?? new Map<string, Entity>();

  for (const def of defs) {
    const { id, name: entityName, ...values } = def;
    // 新实体：服务器重启就靠 states 表把开关初值捡回来，免得伪造一段假跳变
    const last = db
      .query<{ state: string }, [string, string]>(
        "SELECT state FROM state WHERE device_id = ? AND id = ? ORDER BY ts DESC LIMIT 1",
      )
      .get(device.id, id);
    const e = table.get(id) ?? {
      id,
      name: entityName ?? id,
      deviceId: device.id,
      state: values.power_w === undefined ? (last ? last.state === "true" : false) : undefined,
      ts,
    };
    if (entityName) e.name = entityName;
    // 值只是「现在是多少」；电量另说，见 energyKwh
    if (values.state !== undefined && e.state !== values.state) {
      e.state = values.state;
      e.ts = ts;
      db.run("INSERT OR REPLACE INTO state (device_id, id, ts, state) VALUES (?, ?, ?, ?)", [
        device.id,
        id,
        ts,
        String(values.state),
      ]);
      emit({ type: "state", ts, deviceId: device.id, id, name: e.name, state: values.state });
    }
    if (values.energy_kwh !== undefined) {
      e.energy_kwh = values.energy_kwh;
      energyBase.set(`${device.id}/${id}`, { kwh: values.energy_kwh, ts });
    }
    if (values.power_w !== undefined) {
      const changed = e.power_w !== values.power_w;
      e.power_w = values.power_w;
      e.ts = ts;
      record(device.id, id, values.power_w, ts); // 读数每个采样都记：时间积分靠「上一段持续了多久」推进
      // 但只有变了才对外发事件，否则观察者每秒被刷一遍
      if (changed) emit({ type: "state", ts, deviceId: device.id, id, name: e.name, state: values.power_w });
    }
    table.set(id, e);
  }
  entities.set(device.id, table);
};

/** 设备确认动完了。回执不做关联，收到几个算几个 */
handlers.ack_switch = () => {
  inflight = Math.max(0, inflight - 1);
  for (const w of ackWaiters) w();
};

handlers.pub_alive = (_device, reply) => reply({ type: "ack_alive", ts: now() });

export function connect(deviceId: string, ws: WSContext) {
  db.run("INSERT OR IGNORE INTO device (id, name) VALUES (?, ?)", [deviceId, deviceId]);
  const saved = db
    .query<DeviceRow, [string]>("SELECT id, name, model, fw_version FROM device WHERE id = ?")
    .get(deviceId)!;
  const device: Device = {
    id: saved.id,
    name: saved.name,
    model: saved.model ?? undefined,
    fwVersion: saved.fw_version ?? undefined,
    online: true,
  };
  conns.set(deviceId, { device, ws, lastSeen: now() });
  emit({ type: "device", ts: now(), deviceId, online: true });
}

export function disconnect(deviceId: string) {
  if (!conns.delete(deviceId)) return;
  emit({ type: "device", ts: now(), deviceId, online: false });
}

/**
 * 失联判定：太久没收到任何消息就当成掉线。设备死机、网线松了，TCP 可能一直半开着，
 * 只有这里能发现。断连后板子会重连，重连时重新声明自己有什么。
 */
export function checkTimeout(at = now()) {
  for (const [deviceId, c] of conns) {
    if (at - c.lastSeen <= TIMEOUT) continue;
    conns.delete(deviceId);
    emit({ type: "device", ts: at, deviceId, online: false });
    c.ws.close();
  }
}

export function handleMessage(deviceId: string, raw: string) {
  const c = conns.get(deviceId)!;
  c.lastSeen = now(); // 收到任何一条都算还活着，板子心跳 30s 一次保底
  const m = JSON.parse(raw) as WSMessage;
  handlers[m.type]?.(c.device, (r) => send(deviceId, r), m);
}

/** 下一个动作：说清要到什么状态，取反在这里算完。设备离线、或者不是可开关的实体，就返回 false */
export function command(e: Entity, state: boolean): boolean {
  if (!conns.has(e.deviceId) || e.state === undefined) return false;
  inflight++;
  send(e.deviceId, { type: "pub_switch", ts: now(), id: e.id, state });
  return true;
}

/** 等回执。不做关联，收齐了或者超时就返回收到的条数 */
export function waitAck(timeout = 5000): Promise<number> {
  const start = inflight;
  return new Promise((resolve) => {
    const done = () => {
      if (inflight > 0) return; // 还没收齐
      clearTimeout(timer);
      ackWaiters.delete(done);
      resolve(start);
    };
    const timer = setTimeout(() => {
      ackWaiters.delete(done);
      resolve(start - inflight);
    }, timeout);
    ackWaiters.add(done);
    if (inflight === 0) done();
  });
}

/** 可通断的实体：一个 id 就是一个，或者整台设备（整房断电） */
export function resolve(target: Target): Entity[] {
  if (target.id) {
    const e = getEntity(target.deviceId ?? "", target.id);
    return e && e.state !== undefined ? [e] : [];
  }
  if (!target.deviceId) return [];
  return [...(entities.get(target.deviceId)?.values() ?? [])].filter((e) => e.state !== undefined);
}

/** 总览：在线状态 + 当前功率 + 电量 */
export function deviceTotals() {
  const at = now();
  return listDevices().map((d) => {
    const meters = [...(entities.get(d.id)?.values() ?? [])].filter((e) => e.power_w !== undefined);
    return {
      ...d,
      power: meters.reduce((s, e) => s + (e.power_w ?? 0), 0),
      energy: meters.reduce((s, e) => s + energyKwh(e, at), 0),
    };
  });
}
