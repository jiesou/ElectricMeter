export interface WSMessage {
  type: string;
  ts?: number; // 秒
  [key: string]: unknown;
}
export type WSMessageHandler = (device: Device, send: (m: WSMessage) => void, m: WSMessage) => void;

// ===== 线上消息 =====

/** 心跳，30s 一次 */
export interface AliveMessage extends WSMessage {
  type: "pub_alive" | "ack_alive";
}

/**
 * 心跳节奏和失联判定，双方得一致，所以放在协议里。
 * TCP 断开能感知到拔网线，但设备死机时连接可能还半开着，只有「心跳 + 超时」能发现。
 */
export const ALIVE = 30;
export const TIMEOUT = Number(process.env.EM_TIMEOUT ?? ALIVE * 2.5);

/**
 * 板子自己有什么、现在是什么样。连上发一份，之后哪个实体变了就补一份，没提到的保持原样。
 * 实体的设备侧标识就是 id，没有第二个名字，也没有"类型"字段——
 * 有 state 就能通断，有 power_w 就是功率读数，有 energy_kwh 就是累计电量。
 */
export interface EntitiesMessage extends WSMessage {
  type: "pub_entities";
  name?: string;
  model?: string;
  fwVersion?: string;
  entities: EntityDef[];
}

/** 服务器下通断令：说清要哪个实体到什么状态，action 由服务器自己算 */
export interface SwitchMessage extends WSMessage {
  type: "pub_switch";
  id: string;
  state: boolean;
}

/** 设备确认执行完成 */
export interface SwitchAckMessage extends WSMessage {
  type: "ack_switch";
}

// ===== 领域 =====

/**
 * state = 开关通断；power_w = 瞬时瓦数；energy_kwh = 自上电以来的千瓦时数。
 * 除了 id 都可以不发：第一次出现时给 name，之后只报变了的读数。
 */
export interface EntityDef {
  id: string;
  name?: string;
  state?: number | boolean;
  power_w?: number;
  energy_kwh?: number;
}

export interface Entity extends EntityDef {
  name: string;
  deviceId: string;
  /** 开关的通断状态；功率表没有这个字段，它的读数在 power_w */
  state?: number | boolean;
  ts: number;
}

export interface Device {
  id: string;
  name: string;
  model?: string;
  fwVersion?: string;
  online: boolean;
}

export interface StatPoint {
  ts: number; // 桶起始
  mean: number; // 时间加权均值，不是 AVG()
  min: number;
  max: number;
  /** 功率积分出的瓦秒，÷3.6e6 得 kWh */
  sum: number;
}

export interface StatSeries {
  id: string;
  bucket: number;
  from: number;
  to: number;
  points: StatPoint[];
}

/** 动作目标：一个实体，或一整台设备（整房断电）。不给 state 就是取反 */
export interface Target {
  deviceId?: string;
  id?: string;
  state?: boolean;
}

/** 观察者（SSE）收到的事件 */
export type Event =
  | { type: "state"; ts: number; deviceId: string; id: string; name: string; state: number | boolean }
  | { type: "device"; ts: number; deviceId: string; online: boolean };
