import pc from "picocolors";
import Table from "cli-table3";
import type { Device, Entity } from "@em/shared";
import type { Room } from "./types.ts";
import { clock, kwh, stamp, watt } from "./format.ts";

const table = (head: string[], rows: string[][]) => {
  const t = new Table({ head, style: { head: ["bold"] } });
  t.push(...rows);
  return t.toString();
};

/** 开关看 state，电表看 powerW——实体是哪种，看它有什么字段 */
const stateText = (e: Entity) => {
  if (e.type === "switch") return e.state ? pc.green("通电") : pc.gray("断开");
  return e.powerW === undefined ? pc.gray("—") : watt(e.powerW);
};

const typeText = (e: Entity) => (e.type === "switch" ? "开关" : e.type === "meter" ? "电表" : pc.gray("—"));

export const online = (ok: boolean) => (ok ? pc.green("在线") : pc.red("离线"));

/** 客房总览：合计功率只算在线房，电量全部计入（只增不减，与 web 端口径一致） */
export function rooms(list: Room[]): string {
  if (!list.length) return "暂无客房，等待设备接入";
  const power = list.reduce((a, r) => a + (r.online ? r.power : 0), 0);
  const energy = list.reduce((a, r) => a + r.energy, 0);
  return table(
    ["客房", "ID", "在线", "当前功率", "累计电量"],
    [
      ...list.map((r) => [r.name || r.id, r.id, online(r.online), r.online ? watt(r.power) : pc.gray("—"), kwh(r.energy)]),
      [pc.dim("合计"), "", "", pc.dim(watt(power)), pc.dim(kwh(energy))],
    ],
  );
}

export function devices(list: Device[]): string {
  if (!list.length) return "还没有设备接入";
  return table(
    ["ID", "名称", "IP", "在线", "最后上线"],
    list.map((d) => [d.id, d.name, d.ip, online(d.online), stamp(d.lastSeen)]),
  );
}

export function entities(list: Entity[]): string {
  if (!list.length) return "暂无实体";
  return table(
    ["实体", "名称", "类型", "状态", "累计电量"],
    list.map((e) => [
      `${e.device_id}/${e.id}`,
      e.name ?? "—",
      typeText(e),
      stateText(e),
      e.energyKwh === undefined ? pc.gray("—") : kwh(e.energyKwh),
    ]),
  );
}

export function show(e: Entity): string {
  const lines = [`${pc.bold(e.name ?? e.id)}  ${pc.dim(`${e.device_id}/${e.id}`)}`];
  lines.push(`  类型      ${typeText(e)}`);
  if (e.type === "switch") lines.push(`  状态      ${stateText(e)}`);
  if (e.type === "meter") {
    lines.push(`  当前功率  ${e.powerW === undefined ? pc.gray("—") : watt(e.powerW)}`);
    lines.push(`  累计电量  ${e.energyKwh === undefined ? pc.gray("—") : kwh(e.energyKwh)}`);
  }
  if (e.lastUpdate !== undefined) lines.push(`  最后上报  ${stamp(e.lastUpdate)}`);
  return lines.join("\n");
}

/** watch 的每秒一帧：本机时钟 + 房间表 */
export function watchTick(list: Room[]): string {
  return `${pc.dim(clock(Date.now() / 1000))}\n${rooms(list)}`;
}
