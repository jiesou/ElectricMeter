import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";

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
  fw_version TEXT
);
CREATE TABLE IF NOT EXISTS state (
  device_id TEXT NOT NULL,
  id        TEXT NOT NULL,
  ts        INTEGER NOT NULL,
  state     TEXT    NOT NULL,
  PRIMARY KEY (device_id, id, ts)
);
CREATE INDEX IF NOT EXISTS state_ts ON state (ts);
CREATE TABLE IF NOT EXISTS statistics (
  device_id    TEXT    NOT NULL,
  id           TEXT    NOT NULL,
  bucket_start INTEGER NOT NULL,
  mean         REAL    NOT NULL,
  min          REAL    NOT NULL,
  max          REAL    NOT NULL,
  sum          REAL    NOT NULL,
  PRIMARY KEY (device_id, id, bucket_start)
);
CREATE INDEX IF NOT EXISTS statistics_ts ON statistics (bucket_start);
`);

if (!db.query("SELECT id FROM device LIMIT 1").get()) {
  db.run("INSERT INTO device (id, name) VALUES (?, ?), (?, ?)", [
    "esp-301",
    "301 电表箱",
    "esp-302",
    "302 电表箱",
  ]);
}
