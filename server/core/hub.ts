import type { WSContext } from "hono/ws";
import type {
  Action,
  Device,
  Entity,
  Event,
  PostEntitiesMessage,
  PostStateMessage,
  Ref,
  Target,
  WSMessage,
  WSMessageHandler,
} from "@em/shared";
import { appendState, device as deviceTable, lastStateOf } from "./db.ts";
import { energyOf, record } from "./stats.ts";
import { now } from "./util.ts";

type Conn = { device: Device; ws: WSContext };

const conns = new Map<string, Conn>(); // deviceId → 连接，一个连接一个身份
const entities = new Map<Ref, Entity>(); // 实体注册表只在内存
const observers = new Set<(e: Event) => void>();
const handlers: Record<string, WSMessageHandler> = {}; // 谁关心谁注册
const ackWaiters = new Set<() => void>();
let inflight = 0;

export const listDevices = () => [...conns.values()].map((c) => c.device);
export const listEntities = () => [...entities.values()];
export const getEntity = (ref: Ref) => entities.get(ref);
export const isOnline = (deviceId: string) => conns.has(deviceId);

export function watch(fn: (e: Event) => void) {
  observers.add(fn);
  return () => void observers.delete(fn);
}

const emit = (e: Event) => {
  for (const fn of observers) fn(e);
};
const send = (deviceId: string, m: WSMessage) => conns.get(deviceId)?.ws.send(JSON.stringify(m));

/** kWh 是累计读数，它的时均没意义，sum 直接存桶末读数，查询时做首尾差 */
const isTotal = (unit?: string) => unit === "kWh";

/** 连上后发一次：这块板子自己有什么 */
handlers.post_entities = (device, _reply, m) => {
  const ts = now();
  const { name, model, fwVersion, entities: defs } = m as PostEntitiesMessage;
  Object.assign(device, { name, model, fwVersion, lastSeen: ts });
  deviceTable.put(device);

  // 设备是它有什么的权威来源：不再上报的实体直接摘掉
  const live = new Set(defs.map((e) => e.key));
  for (const [ref, e] of entities) if (e.deviceId === device.id && !live.has(e.key)) entities.delete(ref);

  for (const def of defs) {
    const ref = `${device.id}:${def.key}`;
    const old = entities.get(ref);
    // 开关的初值从历史里捡回来，服务器重启后不至于伪造一段假跳变
    const last = def.kind === "relay" ? lastStateOf(device.id, def.key) : undefined;
    entities.set(ref, {
      ...def,
      ref,
      deviceId: device.id,
      state: old?.state ?? (last ? last.state === "true" : def.kind === "relay" ? false : 0),
      ts: old?.ts ?? ts,
    });
  }
  emit({ type: "device", ts, deviceId: device.id, online: true });
};

/** 500ms 一条 */
handlers.post_state = (device, _reply, m) => {
  const ts = (m as PostStateMessage).ts || now();
  for (const u of m.states as PostStateMessage["states"]) {
    const ref = `${device.id}:${u.key}`;
    const e = entities.get(ref);
    if (!e) continue;
    if (e.kind === "relay") {
      if (e.state === u.state) continue; // 开关是事件，没变就不记
      e.state = u.state;
      e.ts = ts;
      appendState(device.id, e.key, ts, u.state);
      emit({ type: "state", ts, ref, kind: e.kind, name: e.name, state: u.state });
    } else {
      // 读数每个采样都要记：时间积分靠「上一段持续了多久」推进
      const v = Number(u.state);
      record(ref, v, ts, isTotal(e.unit));
      if (e.state !== v) {
        e.state = v;
        e.ts = ts;
        emit({ type: "state", ts, ref, kind: e.kind, name: e.name, state: v, unit: e.unit });
      }
    }
  }
  device.lastSeen = ts;
  deviceTable.touch(device.id, ts);
};

/** 板子上只管动自己的继电器，服务器不猜它执行了没有 */
handlers.post_relay = (_device, reply) => reply({ type: "post_ack", ts: now(), ok: true });

/** 回执不做关联，收到几个算几个 */
handlers.post_ack = () => {
  inflight = Math.max(0, inflight - 1);
  for (const w of ackWaiters) w();
};

handlers.ping = (_device, reply) => reply({ type: "ping", ts: now() });

export function connect(deviceId: string, ws: WSContext) {
  const device: Device = {
    ...(deviceTable.get(deviceId) ?? { id: deviceId, name: deviceId }),
    online: true,
    lastSeen: now(),
  };
  deviceTable.put(device);
  conns.set(deviceId, { device, ws });
}

export function disconnect(deviceId: string, ws: WSContext) {
  const c = conns.get(deviceId);
  if (!c || c.ws !== ws) return;
  conns.delete(deviceId);
  Object.assign(c.device, { online: false, lastSeen: now() });
  deviceTable.put(c.device);
  emit({ type: "device", ts: now(), deviceId, online: false });
}

export function handleMessage(deviceId: string, raw: string) {
  const c = conns.get(deviceId);
  const m = JSON.parse(raw) as WSMessage;
  handlers[m.type]?.(c!.device, (r) => send(deviceId, r), m);
}

/** 下一个动作。设备离线、或者不是可开关的实体，就返回 false */
export function command(e: Entity, action: Action): boolean {
  if (!conns.has(e.deviceId) || e.kind !== "relay") return false;
  inflight++;
  send(e.deviceId, { type: "post_relay", ts: now(), key: e.key, action });
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

/** 动作目标：单个实体，或整台设备（整房断电） */
export function resolve(target: Target): Entity[] {
  if (target.entity) {
    const e = getEntity(target.entity);
    return e?.kind === "relay" ? [e] : [];
  }
  return target.device ? listEntities().filter((e) => e.deviceId === target.device && e.kind === "relay") : [];
}

/** 总览：在线状态 + 当前功率 + 时段用电 */
export function deviceTotals(from: number) {
  return listDevices().map((d) => {
    const meters = listEntities().filter((e) => e.deviceId === d.id && e.unit === "W");
    return {
      ...d,
      power: meters.reduce((s, e) => s + Number(e.state), 0),
      energy: energyOf(
        meters.map((e) => e.ref),
        from,
        now(),
      ),
    };
  });
}
