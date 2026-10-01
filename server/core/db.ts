import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import type { Device, Ref } from "@em/shared";

mkdirSync("data", { recursive: true });
export const db = new Database(process.env.DB_PATH ?? "data/electric.db", { create: true });
db.run("PRAGMA journal_mode = WAL");

// 实体注册表不在这里：设备连上时在内存重建，落库是浪费。
// states 只记开关的变化，高频读数全进 statistics——这是「不落原始样本」的关键。
db.exec(`
CREATE TABLE IF NOT EXISTS device (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  model      TEXT,
  fw_version TEXT,
  last_seen  INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS state (
  device_id TEXT NOT NULL,
  key       TEXT NOT NULL,
  ts        INTEGER NOT NULL,
  state     TEXT    NOT NULL,
  PRIMARY KEY (device_id, key, ts)
);
CREATE INDEX IF NOT EXISTS state_ts ON state (ts);
CREATE TABLE IF NOT EXISTS statistics (
  device_id    TEXT    NOT NULL,
  key          TEXT    NOT NULL,
  bucket_start INTEGER NOT NULL,
  mean         REAL    NOT NULL,
  min          REAL    NOT NULL,
  max          REAL    NOT NULL,
  sum          REAL    NOT NULL,
  PRIMARY KEY (device_id, key, bucket_start)
);
CREATE INDEX IF NOT EXISTS statistics_ts ON statistics (bucket_start);
`);

type DeviceRow = {
  id: string;
  name: string;
  model: string | null;
  fw_version: string | null;
  last_seen: number;
};

const toDevice = (r: DeviceRow): Device => ({
  id: r.id,
  name: r.name,
  model: r.model ?? undefined,
  fwVersion: r.fw_version ?? undefined,
  lastSeen: r.last_seen,
  online: false,
});

export const device = {
  all: () =>
    db
      .query<
        DeviceRow,
        []
      >("SELECT * FROM device ORDER BY id")
      .all()
      .map(toDevice),
  get: (id: string) => {
    const r = db.query<DeviceRow, [string]>("SELECT * FROM device WHERE id = ?").get(id);
    return r ? toDevice(r) : undefined;
  },
  put: (d: Device) =>
    db.run(
      `INSERT INTO device (id, name, model, fw_version, last_seen) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, model = excluded.model,
         fw_version = excluded.fw_version, last_seen = excluded.last_seen`,
      [d.id, d.name, d.model ?? null, d.fwVersion ?? null, d.lastSeen],
    ),
  touch: (id: string, ts: number) => db.run("UPDATE device SET last_seen = ? WHERE id = ?", [ts, id]),
};

export function appendState(deviceId: string, key: string, ts: number, state: number | boolean) {
  db.run("INSERT OR REPLACE INTO state (device_id, key, ts, state) VALUES (?, ?, ?, ?)", [
    deviceId,
    key,
    ts,
    String(state),
  ]);
}

export function historyOf(deviceId: string, key: string, from: number, to: number) {
  return db
    .query<{ ts: number; state: string }, [string, string, number, number]>(
      "SELECT ts, state FROM state WHERE device_id = ? AND key = ? AND ts >= ? AND ts < ? ORDER BY ts",
    )
    .all(deviceId, key, from, to);
}

export function lastStateOf(deviceId: string, key: string) {
  return db
    .query<{ state: string }, [string, string]>(
      "SELECT state FROM state WHERE device_id = ? AND key = ? ORDER BY ts DESC LIMIT 1",
    )
    .get(deviceId, key);
}

type StatRow = { bucket_start: number; mean: number; min: number; max: number; sum: number };

export function statsOf(ref: Ref, from: number, to: number) {
  const [deviceId, key] = ref.split(":");
  return db
    .query<StatRow, [string, string, number, number]>(
      `SELECT bucket_start, mean, min, max, sum FROM statistics
       WHERE device_id = ? AND key = ? AND bucket_start >= ? AND bucket_start < ?
       ORDER BY bucket_start`,
    )
    .all(deviceId, key, from, to);
}

/** 若干实体在时段内的功率积分之和，单位瓦秒。瓦秒 ÷ 3.6e6 = kWh */
export function powerSumOf(refs: Ref[], from: number, to: number) {
  if (!refs.length) return 0;
  const marks = refs.map(() => "(?, ?)").join(",");
  const row = db
    .query(
      `SELECT SUM(sum) AS v FROM statistics
       WHERE (device_id, key) IN (VALUES ${marks}) AND bucket_start >= ? AND bucket_start < ?`,
    )
    .get(...refs.flatMap((r) => r.split(":")), from, to) as { v: number | null } | null;
  return row?.v ?? 0;
}

// 首次启动先把两块板子登记上，板子还没到也能先看见
if (!device.all().length) {
  device.put({ id: "esp-301", name: "301 电表箱", lastSeen: 0, online: false });
  device.put({ id: "esp-302", name: "302 电表箱", lastSeen: 0, online: false });
}
