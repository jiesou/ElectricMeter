import type { Action, EntityDef, Key, Ref } from "./domain.ts";

/** 设备 → 服务器。设备只出站，连上即 ws://host/ws?deviceId=xxx */
export type UpMsg =
  | {
      type: "hello";
      deviceId: string;
      name: string;
      model?: string;
      fwVersion?: string;
      entities: EntityDef[];
    }
  | { type: "state"; ts: number; states: { key: Key; state: number | boolean }[] }
  | { type: "ack"; ts: number; callId: number; ok: boolean; error?: string }
  | { type: "ping"; ts: number };

/** 服务器 → 设备 */
export type DownMsg =
  | { type: "welcome"; ts: number }
  | { type: "action"; ts: number; callId: number; key: Key; action: Action }
  | { type: "ping"; ts: number };

export const refOf = (deviceId: string, key: Key): Ref => `${deviceId}:${key}`;
