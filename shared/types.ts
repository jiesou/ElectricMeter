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

/** 连上后发一次：这块板子自己有什么 */
export interface EntitiesMessage extends WSMessage {
  type: "pub_entities";
  name: string;
  model?: string;
  fwVersion?: string;
  entities: EntityDef[];
}

/** 采样上报，1s 一条 */
export interface StateMessage extends WSMessage {
  type: "pub_state";
  states: { key: string; state: number | boolean }[];
}

/** 服务器下通断令 */
export interface SwitchMessage extends WSMessage {
  type: "pub_switch";
  key: string;
  action: Action;
}

/** 设备确认执行完成 */
export interface SwitchAckMessage extends WSMessage {
  type: "ack_switch";
}

// ===== 领域 =====

export type Key = string;
export type Ref = string;
export type Action = "turn_on" | "turn_off" | "toggle";

/** relay = 一路可通断的回路；meter = 一只读数 */
export type Kind = "relay" | "meter";

/**
 * 没有 unit 字段。瞬时功率和累计电量天生就是两个量，设备各发各的：
 *   xxx_power  实时瓦数      xxx_energy 自上电以来的千瓦时数
 * 少一个字符串，下位机的内存和 JSON 拼接都省一份。
 */
export interface EntityDef {
  key: string;
  name: string;
  kind: Kind;
}

export interface Entity extends EntityDef {
  ref: Ref; // deviceId:key
  deviceId: string;
  /** relay 是 boolean，meter 是 number */
  state: number | boolean;
  ts: number;
}

export interface Device {
  id: string;
  name: string;
  model?: string;
  fwVersion?: string;
  lastSeen: number;
  online: boolean;
}

export interface StatPoint {
  ts: number; // 桶起始
  mean: number; // 时间加权均值，不是 AVG()
  min: number;
  max: number;
  /** 功率读数：积分出的瓦秒，÷3.6e6 得 kWh。累计电量读数：桶末读数，查询时做首尾差 */
  sum: number;
}

export interface StatSeries {
  ref: Ref;
  bucket: number;
  from: number;
  to: number;
  points: StatPoint[];
}

/** 动作目标，二选一。device 就是整房断电 */
export interface Target {
  entity?: Ref;
  device?: string;
}

/** 观察者（SSE）收到的事件 */
export type Event =
  | { type: "state"; ts: number; ref: Ref; kind: Kind; name: string; state: number | boolean }
  | { type: "device"; ts: number; deviceId: string; online: boolean };
