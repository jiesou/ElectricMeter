/** 数值与时间的显示格式（协议层是 number 秒级时间戳，只在渲染层转可读） */

/** 功率：最多一位小数，如 955 W / 955.5 W */
export function watt(w: number): string {
  const v = Math.round(w * 10) / 10;
  return `${v} W`;
}

/** 电量：两位小数，如 66.70 kWh */
export function kwh(e: number): string {
  return `${e.toFixed(2)} kWh`;
}

/** 秒级时间戳 → HH:MM:SS */
export function clock(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString("sv-SE");
}

/** 秒级时间戳 → MM-DD HH:MM:SS，看历史时刻用 */
export function stamp(ts: number): string {
  const d = new Date(ts * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${d.toLocaleTimeString("sv-SE")}`;
}
