/* === 数据模型 === */

export interface Entity {
  id: string;
  // 这个实体算在哪台设备名下：报文的填了听报文的，没填就用这条连接的 device_id
  device_id?: string;
  name?: string;
  type?: "switch" | "meter" | "people-counter";
  state?: boolean; // switch：开关 on / off
  powerW?: number; // meter：电表瞬时功率
  energyKwh?: number; // meter：电表累计电量，类似 Home Assistant total_increasing
  inCount?: number; // people-counter：进
  outCount?: number; // people-counter：出
  netCount?: number; // people-counter：净，大屏说多少就是多少，服务器不拿 in-out 去算
  ts?: number; // 实例存在的时间点，可以用来提供最后一次上报的时间（毫秒级时间戳）
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

export interface PeopleCounter extends Entity {
  type: "people-counter";
  inCount: number;
  outCount: number;
  netCount: number;
}

export interface Device {
  id: string;
  name: string;
  ip: string;
  online: boolean;
  lastSeen: number; // 毫秒级时间戳
}

/* === WebSocket 通信协议 === */
export interface WSMessage {
  type: string;
  ts?: number; // 全局统一 UTC 毫秒级时间戳
  [key: string]: unknown;
}
export type WSMessageHandler = (
  device: Device,
  send: (m: WSMessage) => void,
  m: WSMessage,
) => void;

/* 必要应用层心跳 */
export const ALIVE = 3;

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

/* 服务器把房名推给设备：屏幕顶上显示的就是这个名，网页上改名也走这一条 */

export interface PubNameMessage extends WSMessage {
  type: "pub_name";
  name: string;
}

/* 服务器叫设备做事：下通断令，设备干完回执 */

export interface PubActionSwitchMessage extends WSMessage {
  type: "pub_action_switch";
  id: string;
  state: boolean;
}

export interface AckActionSwitchMessage extends WSMessage {
  type: "ack_action_switch";
  id: string;
  state: boolean;
}
