import { reactive } from "vue";
import type { HistoryPoint, Room } from "./api.ts";
import { fetchHistory } from "./api.ts";

/** 只留最近 10 分钟，跟服务端 history.ts 一致 */
const KEEP = 600;

export interface Series {
  id: string;
  name: string;
  points: { ts: number; powerW: number }[];
}

const store = reactive(new Map<string, Series[]>());

export function series(device_id: string): Series[] {
  return store.get(device_id) ?? [];
}

export function clearHistory() {
  store.clear();
}

/** 打开页面时查一次库回填窗口内的点，接口失败就静默不画 */
export async function loadHistory(room: Room) {
  const rows = await fetchHistory(room.id).catch(() => [] as HistoryPoint[]);
  if (!rows.length) return;

  const list = store.get(room.id) ?? [];
  for (const row of rows) {
    const name = room.entities.find((e) => e.id === row.id)?.name ?? row.id;
    upsert(list, row.id, name, row.ts, row.powerW ?? 0);
  }
  store.set(room.id, list);
}

/** 每来一帧快照，给每个电表往右补一个点 */
export function record(rooms: Room[]) {
  const ts = Math.floor(Date.now() / 1000);
  const cutoff = ts - KEEP;

  for (const room of rooms) {
    const list = store.get(room.id) ?? [];
    for (const entity of room.entities) {
      if (entity.type === "meter")
        upsert(
          list,
          entity.id,
          entity.name ?? entity.id,
          ts,
          entity.powerW ?? 0,
        );
    }
    for (const s of list)
      while (s.points[0] && s.points[0].ts < cutoff) s.points.shift();
    if (list.length) store.set(room.id, list);
  }
}

/** 按 ts 升序插入，同一秒只留一个点 */
function upsert(
  list: Series[],
  id: string,
  name: string,
  ts: number,
  powerW: number,
) {
  let s = list.find((x) => x.id === id);
  if (!s) {
    s = { id, name, points: [] };
    list.push(s);
  }
  const last = s.points[s.points.length - 1];
  if (!last || last.ts < ts) s.points.push({ ts, powerW });
  else if (last.ts === ts) last.powerW = powerW;
}
