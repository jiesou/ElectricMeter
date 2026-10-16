/* === 数据模型 === */

export interface Entity {
  id: string;
  device_id?: string;
  name?: string;
  type?: "switch" | "meter";
  state?: boolean;
  powerW?: number;
  energyKwh?: number;
  ts?: number; // 实例存在的时间点，可以用来提供最后一次上报的时间（秒级时间戳）
}

export interface Switch extends Entity {
  type: "switch";
  state: boolean;
}

export interface Meter extends Entity {
  type: "meter";
  powerW: number;
  energyKwh: number;
}

export interface Device {
  id: string;
  name: string;
  ip: string;
  online: boolean;
  lastSeen: number; // 秒级时间戳
}

/* === WebSocket 通信协议 === */
export interface WSMessage {
  type: string;
  ts?: number; // 全局统一 UTC 秒级时间戳
  [key: string]: unknown;
}
export type WSMessageHandler = (
  device: Device,
  send: (m: WSMessage) => void,
  m: WSMessage,
) => void;

/* 必要应用层心跳 */
export const ALIVE = 30;

export interface PubAliveMessage extends WSMessage {
  type: "pub_alive";
}

export interface AckAliveMessage extends WSMessage {
  type: "ack_alive";
}

/* 下位机按字段部分更新：只带 id 和本次要更新的字段，其余字段缺席即不改 */
export interface EntitiesMessage extends WSMessage {
  type: "pub_entities";
  entities: Entity[];
}
