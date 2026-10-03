/* === 数据模型 === */

export interface Entity {
  id: string;
  device_id: string;
  name: string;
  type: 'switch' | 'meter';
  lastUpdate?: number; // 这个读数最后一次上报的时间（秒级时间戳），还没报过就没有
}

export interface Switch extends Entity {
  type: 'switch';
  state: boolean;
}

export interface Meter extends Entity {
  type: 'meter';
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
export type WSMessageHandler = (device: Device, send: (m: WSMessage) => void, m: WSMessage) => void;

/* 必要应用层心跳 */
export interface PubAliveMessage extends WSMessage {
  type: "pub_alive";
}

export interface AckAliveMessage extends WSMessage {
  type: "ack_alive";
}

/* 下位机只报增量：除了 id 都可以不发，第一次出现时可以给 name，之后根据需要只报变了的读数。*/
export interface EntitiesMessage extends WSMessage {
  type: "pub_entities";
  entities: Entity[];
}
