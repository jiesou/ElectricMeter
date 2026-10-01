import type { Ref, StatSeries } from "@em/shared";
import { db, powerSumOf, statsOf } from "./db.ts";
import { now } from "./util.ts";

/**
 * 时间桶聚合。原始样本一律不落盘——每 500ms 一行，一个月就是几千万行；
 * 只留 5 秒一个桶，落盘节奏 5 秒一次，30 天约 1 GB，这个体积我们换得起。
 *
 * 收到采样只改内存里未闭合的桶，桶跨过整 5 秒才写一次库。
 * 保留策略就一条 DELETE，没有 purge 任务、没有 rollup 任务。
 */
const BUCKET = 5;
const KEEP = 30 * 86400;

type Acc = {
  ref: Ref;
  deviceId: string;
  key: string;
  start: number;
  wsum: number; // Σ 值×秒
  wsec: number; // 权重秒数
  min: number;
  max: number;
  sum: number; // measurement=功率积分瓦秒；total_increasing=桶末读数
  last: number;
  n: number;
};

const open = new Map<string, Acc>();
/** 上一次采样，用来把 [上次, 本次] 这段时间按上次的值计权 */
const prev = new Map<string, { v: number; ts: number }>();

function accOf(ref: Ref, ts: number): Acc {
  const start = Math.floor(ts / BUCKET) * BUCKET;
  const k = `${ref}@${start}`;
  let a = open.get(k);
  if (!a) {
    const [deviceId, key] = ref.split(":");
    open.set(
      k,
      (a = { ref, deviceId, key, start, wsum: 0, wsec: 0, min: Infinity, max: -Infinity, sum: 0, last: 0, n: 0 }),
    );
  }
  return a;
}

/**
 * @param total true = 累计读数（电表），mean 无意义，sum 存桶末读数供查询时做首尾差
 */
export function record(ref: Ref, v: number, ts: number, total = false) {
  const last = prev.get(ref);
  prev.set(ref, { v, ts });
  const a = accOf(ref, ts);
  a.min = Math.min(a.min, v);
  a.max = Math.max(a.max, v);
  a.last = v;
  a.n++;
  if (total) {
    a.sum = v;
    return;
  }
  // 上一段 [last.ts, ts) 持续了 last.v 这个值，跨桶就分段摊进各自的时间加权
  if (!last || ts <= last.ts) return;
  for (let t = last.ts; t < ts; ) {
    const end = Math.min(Math.floor(t / BUCKET) * BUCKET + BUCKET, ts);
    const seg = accOf(ref, t);
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
      `INSERT OR REPLACE INTO statistics (device_id, key, bucket_start, mean, min, max, sum)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [a.deviceId, a.key, a.start, a.wsum / a.wsec, a.min, a.max, a.sum],
    );
  }
}

export const purge = (at = now()) => db.run("DELETE FROM statistics WHERE bucket_start < ?", [at - KEEP]).changes;

export function series(ref: Ref, from: number, to: number): StatSeries {
  return {
    ref,
    bucket: BUCKET,
    from,
    to,
    points: statsOf(ref, from, to).map((r) => ({
      ts: r.bucket_start,
      mean: r.mean,
      min: r.min,
      max: r.max,
      sum: r.sum,
    })),
  };
}

/** 一组实体在时段内的用电量，kWh */
export const energyOf = (refs: Ref[], from: number, to: number) => powerSumOf(refs, from, to) / 3.6e6;

export const midnight = (at = now()) => {
  const d = new Date(at * 1000);
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
};
