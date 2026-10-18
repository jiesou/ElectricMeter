/** 演示快进用的偏移：点一次「进入下一天」加一天 */
let offset = 0;

export const now = () => Date.now() + offset;

export const DAY = 86_400_000;
export const HOUR = 3_600_000;

/** 把服务器这台表往前拨一天：所有按时间算的东西跟着前进 */
export const nextDay = () => (offset += DAY);

/** 当地 0 点 */
export const dayStart = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** 当地整点 */
export const hourStart = (ts: number) => {
  const d = new Date(ts);
  d.setMinutes(0, 0, 0);
  return d.getTime();
};

/** 展示顺序：设备与实体一律按 id 字母序，跟谁先连上、谁先申报无关 */
export const byId = (a: { id: string }, b: { id: string }) =>
  a.id.localeCompare(b.id);
