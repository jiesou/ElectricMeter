import type { WSContext } from "hono/ws";
import type { Action, Device, Entity, Event, Ref, Target, UpMsg } from "@em/shared";
import { refOf } from "@em/shared";
import { appendState, device as deviceTable, lastStateOf } from "./db.ts";
import { energyOf, record } from "./stats.ts";
import { now } from "./util.ts";

type Conn = { deviceId: string; ws: WSContext };
export type Reply = { callId: number; ok: boolean; error?: string };

const conns = new Map<string, Conn>();
const registry = new Map<string, Device>();
const entities = new Map<Ref, Entity>();
const observers = new Set<(e: Event) => void>();
const pending = new Map<number, (r: Reply) => void>();
let seq = 0;

export const listDevices = () => [...registry.values()];
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

const send = (deviceId: string, msg: unknown) => conns.get(deviceId)?.ws.send(JSON.stringify(msg));

const stateEvent = (ts: number, e: Entity): Event => ({
  type: "state",
  ts,
  ref: e.ref,
  domain: e.domain,
  name: e.name,
  state: e.state,
  unit: e.unit,
  requested: e.requested,
});

function hello(m: Extract<UpMsg, { type: "hello" }>) {
  const ts = now();
  const dev: Device = { id: m.deviceId, name: m.name, model: m.model, fwVersion: m.fwVersion, lastSeen: ts, online: true };
  registry.set(dev.id, dev);
  deviceTable.put(dev);

  // 设备是它有什么的权威来源：不再上报的实体直接摘掉
  const live = new Set(m.entities.map((e) => e.key));
  for (const [ref, e] of entities) if (e.deviceId === dev.id && !live.has(e.key)) entities.delete(ref);

  for (const def of m.entities) {
    const ref = refOf(dev.id, def.key);
    const old = entities.get(ref);
    // 开关的初值从历史里恢复：服务器重启后内存是空的，
    // 若一律从 false 起步，设备第一次回报就会伪造出一段假跳变。
    // requested 则清空：重连时没有命令在飞，陈旧命令不该继续显示成「令未生效」。
    const last = def.domain === "switch" ? lastStateOf(dev.id, def.key) : undefined;
    entities.set(ref, {
      ...def,
      ref,
      deviceId: dev.id,
      state: old?.state ?? (last ? last.state === "true" : def.domain === "switch" ? false : 0),
      ts: old?.ts ?? ts,
      requested: undefined, // 重连即视为没有命令在飞
    });
  }
  send(dev.id, { type: "welcome", ts });
  emit({ type: "device", ts, deviceId: dev.id, online: true });
}

function ingest(deviceId: string, m: Extract<UpMsg, { type: "state" }>) {
  const ts = m.ts || now();
  for (const u of m.states) {
    const ref = refOf(deviceId, u.key);
    const e = entities.get(ref);
    if (!e) continue;
    if (e.domain === "switch") {
      if (e.state === u.state) continue; // 开关是事件，没变就不动
      e.state = u.state;
      e.ts = ts;
      // requested 是服务器的命令值，设备回报不覆盖它。
      // 两者对不上就是「令未生效」——要么接触器粘住了，要么有人在本地动了开关，都值得示警。
      appendState(deviceId, e.key, ts, u.state, e.requested);
      emit(stateEvent(ts, e));
    } else {
      // 读数每个采样都要记：时间积分靠「上一段持续了多久」推进，
      // 数值不变就跳过的话，常负载永远落不下桶
      const v = Number(u.state);
      record(ref, v, ts, e.stateClass === "total_increasing");
      const changed = e.state !== v;
      e.state = v;
      e.ts = ts;
      if (changed) emit(stateEvent(ts, e));
    }
  }
  const dev = registry.get(deviceId);
  if (dev) {
    dev.lastSeen = ts;
    deviceTable.touch(deviceId, ts);
  }
}

export function connect(deviceId: string, ws: WSContext) {
  conns.set(deviceId, { deviceId, ws });
}

export function disconnect(deviceId: string, ws: WSContext) {
  if (conns.get(deviceId)?.ws !== ws) return;
  conns.delete(deviceId);
  const dev = registry.get(deviceId);
  if (dev) {
    dev.online = false;
    dev.lastSeen = now();
    deviceTable.put(dev);
  }
  emit({ type: "device", ts: now(), deviceId, online: false });
}

export function onMessage(deviceId: string, ws: WSContext, raw: string) {
  const m = JSON.parse(raw) as UpMsg;
  if (m.type === "hello") hello(m);
  else if (m.type === "state") ingest(deviceId, m);
  else if (m.type === "ack") pending.get(m.callId)?.({ callId: m.callId, ok: m.ok, error: m.error });
  else if (m.type === "ping") ws.send(JSON.stringify({ type: "ping", ts: now() }));
}

/**
 * 下发一个动作并等回执。服务器先乐观地把 requested 记成目标值，
 * 设备随后回报的 state 若与之不同，就是接触器粘连。
 */
export function act(e: Entity, action: Action, timeout = 5000): Promise<Reply> {
  const conn = conns.get(e.deviceId);
  if (!conn) return Promise.resolve({ callId: 0, ok: false, error: `设备离线: ${e.deviceId}` });
  e.requested = action === "turn_on" ? true : action === "turn_off" ? false : !e.requested;
  const callId = ++seq;
  return new Promise<Reply>((resolve) => {
    const done = (r: Reply) => {
      if (!pending.delete(callId)) return;
      clearTimeout(timer);
      emit({ type: "action", ts: now(), ref: e.ref, ...r, action });
      resolve(r);
    };
    const timer = setTimeout(() => done({ callId, ok: false, error: "设备无回执" }), timeout);
    pending.set(callId, done);
    conn.ws.send(JSON.stringify({ type: "action", ts: now(), callId, key: e.key, action }));
  });
}

/** action 的目标：单个实体，或整台设备（整房断电）。只有 switch 能当目标 */
export function resolve(target: Target): Entity[] {
  const isSwitch = (e: Entity) => e.domain === "switch";
  if (target.entity) {
    const e = getEntity(target.entity);
    return e && isSwitch(e) ? [e] : [];
  }
  return target.device ? listEntities().filter((e) => isSwitch(e) && e.deviceId === target.device) : [];
}
