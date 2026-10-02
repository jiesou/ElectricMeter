import type { StatSeries } from "@em/shared";
import { db } from "./db.ts";
import { now } from "./util.ts";

/**
 * 时间桶聚合。原始样本一律不落盘——每 500ms 一行，一个月就是几千万行；
 * 只留 5 秒一个桶，落盘节奏 5 秒一次，30 天约 1 GB，这个体积我们换得起。
 *
 * 只做功率：电量不是测出来的，是功率积分出来的，所以这里没有第二种读数。
 *
 * 收到采样只改内存里未闭合的桶，桶跨过整 5 秒才写一次库。
 * 保留策略就一条 DELETE，没有 purge 任务、没有 rollup 任务。
 */
const BUCKET = 5;
const KEEP = 30 * 86400;

type Acc = {
  deviceId: string;
  id: string;
  start: number;
  wsum: number; // Σ 值×秒
  wsec: number; // 权重秒数
  min: number;
  max: number;
  sum: number; // 瓦秒
  n: number;
};

type StatRow = { bucket_start: number; mean: number; min: number; max: number; sum: number };

const open = new Map<string, Acc>();
/** 上一次采样，用来把 [上次, 本次] 这段时间按上次的值计权 */
const prev = new Map<string, { v: number; ts: number }>();

function accOf(deviceId: string, id: string, ts: number): Acc {
  const start = Math.floor(ts / BUCKET) * BUCKET;
  const k = `${deviceId}/${id}@${start}`;
  let a = open.get(k);
  if (!a) {
    open.set(
      k,
      (a = { deviceId, id, start, wsum: 0, wsec: 0, min: Infinity, max: -Infinity, sum: 0, n: 0 }),
    );
  }
  return a;
}

export function record(deviceId: string, id: string, v: number, ts: number) {
  const k = `${deviceId}/${id}`;
  const last = prev.get(k);
  prev.set(k, { v, ts });
  const a = accOf(deviceId, id, ts);
  a.min = Math.min(a.min, v);
  a.max = Math.max(a.max, v);
  a.n++;
  // 上一段 [last.ts, ts) 持续了 last.v 这个值，跨桶就分段摊进各自的时间加权
  if (!last || ts <= last.ts) return;
  for (let t = last.ts; t < ts; ) {
    const end = Math.min(Math.floor(t / BUCKET) * BUCKET + BUCKET, ts);
    const seg = accOf(deviceId, id, t);
    seg.wsum += last.v * (end - t);
    seg.wsec += end - t;
    seg.sum += last.v * (end - t);
    t = end;
  }
}

/** 把已经跨过整 5 秒的桶落库。定时调，进程退出前再调一次 */
export function flush(at = now()) {
  for (const [k, a] of open) {
    if (a.start + BUCKET > at) continue;
    open.delete(k);
    if (!a.n || !a.wsec) continue;
    db.run(
      `INSERT OR REPLACE INTO statistics (device_id, id, bucket_start, mean, min, max, sum)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [a.deviceId, a.id, a.start, a.wsum / a.wsec, a.min, a.max, a.sum],
    );
  }
}

export const purge = (at = now()) => db.run("DELETE FROM statistics WHERE bucket_start < ?", [at - KEEP]).changes;

export function series(deviceId: string, id: string, from: number, to: number): StatSeries {
  return {
    id,
    bucket: BUCKET,
    from,
    to,
    points: db
      .query<StatRow, [string, string, number, number]>(
        `SELECT bucket_start, mean, min, max, sum FROM statistics
         WHERE device_id = ? AND id = ? AND bucket_start >= ? AND bucket_start < ?
         ORDER BY bucket_start`,
      )
      .all(deviceId, id, from, to)
      .map((r) => ({
        ts: r.bucket_start,
        mean: r.mean,
        min: r.min,
        max: r.max,
        sum: r.sum,
      })),
  };
}

export const midnight = (at = now()) => {
  const d = new Date(at * 1000);
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
};
