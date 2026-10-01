/**
 * 领域模型。
 *
 * 命名照抄 Home Assistant 的词汇（domain / device_class / state_class / action），
 * 但只保留本项目真用得上的部分。HA 那套 entity registry 的二十来个字段和四层 ID，
 * 是为「几千个实体、几百个集成」的平台设计的，搬过来就是过度工程。
 *
 * 身份只有一层：ref = `${deviceId}:${key}`。
 * deviceId 是一台 ESP32，key 是设备内的回路号，name 是显示名——随便改，服务器不较劲。
 */

/** 实体域。只有两种：一路可通断的回路，一只只读读数 */
export type Domain = "switch" | "sensor";

/** sensor 的语义分类，决定统计怎么算 */
export type StateClass = "measurement" | "total_increasing";

/** 语义 + 标准单位，名字和单位跟 HA 一致（W / kWh） */
export type DeviceClass = "outlet" | "power" | "energy";

/** 设备内实体的局部标识，如 light / socket / total */
export type Key = string;

/** 全局引用，如 esp-301:light */
export type Ref = string;

/** 动作。HA 现在叫 action，REST 端点仍叫 services */
export type Action = "turn_on" | "turn_off" | "toggle";

export interface Device {
  id: string;
  name: string;
  model?: string;
  fwVersion?: string;
  /** 秒级时间戳 */
  lastSeen: number;
  online: boolean;
}

/** 设备在 hello 里自报的实体清单 */
export interface EntityDef {
  key: Key;
  /** 显示名，随便改 */
  name: string;
  domain: Domain;
  deviceClass: DeviceClass;
  /** power=W，energy=kWh。设备上报，服务器只校验不加工 */
  unit?: string;
  stateClass?: StateClass;
}

/** 实体定义 + 当前状态，服务器内存里的形态 */
export interface Entity extends EntityDef {
  ref: Ref;
  deviceId: string;
  /** switch 是 boolean，sensor 是 number */
  state: number | boolean;
  /** 秒级时间戳 */
  ts: number;
  /** switch 专用：服务器下的令。与 state 不一致即为接触器粘连 */
  requested?: boolean;
}

/** 观察者（CLI watch / 前端）收到的事件。带 domain，观察者才知道怎么渲染 */
export type Event =
  | {
      type: "state";
      ts: number;
      ref: Ref;
      domain: Domain;
      name: string;
      state: number | boolean;
      unit?: string;
      requested?: boolean;
    }
  | { type: "device"; ts: number; deviceId: string; online: boolean }
  | {
      type: "action";
      ts: number;
      callId: number;
      ref: Ref;
      action: Action;
      ok: boolean;
      error?: string;
    }
  | { type: "alarm"; ts: number; ref: Ref; kind: string; message: string };

export interface StatPoint {
  /** 桶起始，秒级时间戳 */
  ts: number;
  /** 时间加权均值，不是 AVG()。占空比负载下两者能差 1.5 倍 */
  mean: number;
  min: number;
  max: number;
  /**
   * measurement：功率积分，单位瓦秒，÷3.6e6 得 kWh
   * total_increasing：桶末的累计读数，查询时做首尾差
   */
  sum: number;
}

export interface StatSeries {
  ref: Ref;
  /** 桶宽，秒 */
  bucket: number;
  from: number;
  to: number;
  points: StatPoint[];
}

/**
 * 一次 action 调用的目标，二选一。
 * device 是「整房断电」——对这台设备的所有开关一起下令。
 * 对应 HA 的 entity_id / device_id，但不沿用那套名字：
 * 我们的 ref 并不是 HA 的 entity_id，叫 entity_id 会误导。
 */
export interface Target {
  entity?: Ref;
  device?: string;
}
