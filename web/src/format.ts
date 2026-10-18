/** 功率：1000 W 以下整数瓦，1000 W 起进位到千瓦、一位小数 */
export function power(w?: number): string {
  if (w === undefined) return "—";
  return w < 1000 ? `${Math.round(w)} W` : `${(w / 1000).toFixed(1)} kW`;
}

/** 电量：固定两位小数 */
export function energy(kwh?: number): string {
  return kwh === undefined ? "—" : `${kwh.toFixed(2)} kWh`;
}

/** 日期：MM-DD（只在界面上出现，数据层一律毫秒时间戳） */
export function date(ts?: number): string {
  if (ts === undefined) return "—";
  const d = new Date(ts);
  return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, "0")}`;
}
