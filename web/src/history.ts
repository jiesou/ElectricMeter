import { reactive } from "vue";
import type { HistoryPoint, Point, Room } from "./api.ts";
import { fetchHistory } from "./api.ts";

/** 只留最近 10 分钟，跟服务端 history.ts 一致 */
const KEEP = 600_000;

export interface Series {
  id: string;
  name: string;
  points: { ts: number; powerW: number }[];
}

const store = reactive(new Map<string, Series[]>());

/** 曲线与接口同序：按 id 字母序，跟谁先被记上无关 */
export function series(device_id: string): Series[] {
  return [...(store.get(device_id) ?? [])].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
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

/** 攒进曲线：给一批读数就照它们的时刻插，没给就按这一帧的房间快照自己打点 */
export function record(rooms: Room[], points?: Point[]) {
  const now = Date.now();
  const rows =
    points ??
    rooms.flatMap((room) =>
      room.entities
        .filter((entity) => entity.type === "meter")
        .map((entity) => ({
          device_id: room.id,
          id: entity.id,
          ts: entity.ts ?? now,
          powerW: entity.powerW ?? 0,
        })),
    );
  const cutoff = now - KEEP;

  for (const row of rows) {
    const room = rooms.find((r) => r.id === row.device_id);
    const name = room?.entities.find((e) => e.id === row.id)?.name ?? row.id;
    const list = store.get(row.device_id) ?? [];
    upsert(list, row.id, name, row.ts, row.powerW);
    for (const s of list)
      while (s.points[0] && s.points[0].ts < cutoff) s.points.shift();
    store.set(row.device_id, list);
  }
}

/** 按 ts 升序插进去，同一毫秒只留一个点：回填的老点要插到前面，不能只往尾巴上追加 */
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
  const i = s.points.findIndex((p) => p.ts >= ts);
  if (i === -1) s.points.push({ ts, powerW });
  else if (s.points[i].ts === ts) s.points[i].powerW = powerW;
  else s.points.splice(i, 0, { ts, powerW });
}
