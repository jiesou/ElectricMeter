/**
 * 全部类型，一个文件。东西就那么一些，不再拆 domain / protocol。
 *
 * 协议基座（用户已确认）：任何业务消息都从这四条展开，不要另立消息体系。
 */
export interface WSMessage {
  type: string;
  ts?: number; // 秒
  [key: string]: unknown;
}
/** 谁关心谁注册，不做按角色的 switch 分流 */
export type WSMessageHandler = (device: Device, send: (m: WSMessage) => void, m: WSMessage) => void;

/* XX PostMessage      客户机->服务器 post新数据 */
/* XX PostAckMessage   客户机<-服务器 回馈成功失败 */
/* XX GetMessage       客户机->服务器 get数据 */
/* XX GetAckMessage    客户机<-服务器 返回数据 */

// ===== 业务消息 =====

/** 连上后发一次：这块板子自己有什么 */
export interface PostEntitiesMessage extends WSMessage {
  type: "post_entities";
  name: string;
  model?: string;
  fwVersion?: string;
  entities: EntityDef[];
}

/** 采样上报，500ms 一条 */
export interface PostStateMessage extends WSMessage {
  type: "post_state";
  states: { key: string; state: number | boolean }[];
}

/** 服务器下通断令 */
export interface PostRelayMessage extends WSMessage {
  type: "post_relay";
  key: string;
  action: Action;
}

/** 回执，不做关联，哪条命令的就不管了 */
export interface PostAckMessage extends WSMessage {
  type: "post_ack";
  ok: boolean;
  error?: string;
}

/** 应用层心跳。WS 协议自带的 ping/pong 检测不到半开连接，所以留这个 */
export interface PingMessage extends WSMessage {
  type: "ping";
}

// ===== 领域 =====

export type Key = string;
export type Ref = string;
export type Action = "turn_on" | "turn_off" | "toggle";

/** relay = 一路可通断的回路；meter = 一只读数 */
export type Kind = "relay" | "meter";

export interface EntityDef {
  key: string;
  name: string;
  kind: Kind;
  /** W / kWh。W 的读数积分出来就是电量，kWh 的是累计读数 */
  unit?: string;
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
  /** unit=W：功率积分，瓦秒，÷3.6e6 得 kWh。unit=kWh：桶末累计读数，查询时做差 */
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
  | { type: "state"; ts: number; ref: Ref; kind: Kind; name: string; state: number | boolean; unit?: string }
  | { type: "device"; ts: number; deviceId: string; online: boolean };
