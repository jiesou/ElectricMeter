import { expect, test } from "bun:test";
import type { Entity, WSMessage } from "@em/shared";
import { TIMEOUT } from "@em/shared";
process.env.DB_PATH = ":memory:";

const hub = await import("./core/hub.ts");
const stats = await import("./core/stats.ts");
const { db } = await import("./core/db.ts");

/** 连上时板子声明自己有什么：一个回路两个实体，开关 + 功率表 */
const FULL: Entity[] = [
  { id: "light", name: "照明", state: false },
  { id: "light-meter", name: "照明功率", power_w: 0, energy_kwh: 2.1 },
];

/** 板子上的秒级时钟。用真时间，因为算电量要看「过了多久」 */
const sec = () => Math.floor(Date.now() / 1000);

/** 假下位机：收下所有下行消息，怎么回由测试决定 */
function fakeDevice(id: string, full = FULL) {
  const inbox: WSMessage[] = [];
  const ws = { send: (raw: string) => inbox.push(JSON.parse(raw)), close: () => {} };
  const post = (type: string, m: object) => hub.handleMessage(id, JSON.stringify({ type, ...m }));
  hub.connect(id, ws as never);

  return {
    ws,
    post,
    stop: () => hub.disconnect(id),
    /** 断线后重连：板子会重新声明一遍自己有什么 */
    reconnect: () => hub.connect(id, ws as never),
    /** 收到的下行消息 */
    received: () => inbox.splice(0),
    /** 连上先声明有什么 */
    setup(name = id, ts = sec()) {
      post("pub_entities", { ts, name, entities: full });
    },
    /** 之后哪个实体变了就补一份。obey=false 模拟令下得去但继电器不动作 */
    report(entities: Entity[], ts = sec(), obey = true) {
      for (const m of this.received()) {
        if (m.type !== "pub_switch") continue;
        if (obey) {
          const at = entities.findIndex((e) => e.id === m.id);
          if (at >= 0) entities = entities.with(at, { id: m.id as string, state: m.state as boolean });
        }
        post("ack_switch", { ts });
      }
      post("pub_entities", { ts, entities });
    },
    /** 一个回路两个实体都报一遍：开关 + 功率表 */
    meter(power_w: number, ts = sec(), energy_kwh?: number) {
      post("pub_entities", {
        ts,
        entities: [
          { id: "light", state: true },
          { id: "light-meter", power_w, ...(energy_kwh === undefined ? {} : { energy_kwh }) },
        ],
      });
    },
  };
}

test("连上声明实体：有 name 有初值", () => {
  const d = fakeDevice("esp-101");
  d.setup("301 电表箱");
  expect(hub.getEntity("esp-101", "light")!.name).toBe("照明");
  expect(hub.getEntity("esp-101", "light-meter")!.power_w).toBe(0);
  expect(hub.listDevices().find((d) => d.id === "esp-101")!.name).toBe("301 电表箱");
});

test("增量上报：没提到的字段保持上次的值", () => {
  const d = fakeDevice("esp-102");
  d.setup();
  d.post("pub_entities", { ts: sec(), entities: [{ id: "light", state: true }] }); // 只说开关
  const e = hub.getEntity("esp-102", "light")!;
  expect(e.state).toBe(true);
  expect(e.name).toBe("照明"); // name 没重发，但还在
  expect(hub.getEntity("esp-102", "light-meter")!.power_w).toBe(0); // 别的实体没被碰
});

test("上报里出现新 id 就登记，name 缺省时先用 id 顶", () => {
  const d = fakeDevice("esp-103");
  d.setup();
  d.post("pub_entities", { ts: sec(), entities: [{ id: "kettle", power_w: 1600, energy_kwh: 0 }] });
  expect(hub.getEntity("esp-103", "kettle")!.name).toBe("kettle");
});

test("开关只在状态真变了的时候落 states 表", () => {
  const d = fakeDevice("esp-104");
  const t0 = sec();
  d.setup("esp-104", t0);
  d.report([{ id: "light", state: true }], t0);
  d.report([{ id: "light", state: true }], t0 + 1); // 没变，不该再记
  d.report([{ id: "light", state: false }], t0 + 2);
  expect(
    db
      .query<{ ts: number; state: string }, [string, string, number, number]>(
        "SELECT ts, state FROM state WHERE device_id = ? AND id = ? AND ts >= ? AND ts < ? ORDER BY ts",
      )
      .all("esp-104", "light", 0, t0 + 10)
      .map((r) => r.state),
  ).toEqual(["true", "false"]);
});

test("没变化的实体不上报，也就不产生事件", () => {
  const d = fakeDevice("esp-105");
  d.setup();
  const seen: string[] = [];
  const off = hub.watch((e) => seen.push(`${e.type}:${"id" in e ? e.id : e.device_id}`));
  d.report([{ id: "light", state: true }, { id: "light-meter", power_w: 55, energy_kwh: 2.1 }]);
  d.report([{ id: "light-meter", power_w: 55, energy_kwh: 2.1 }]); // 一模一样，什么都不该发
  off();
  expect(seen).toEqual(["state:light", "state:light-meter"]);
});

test("掉线不清实体，重连接着更新就行", () => {
  const d = fakeDevice("esp-106");
  d.setup();
  const before = hub.getEntity("esp-106", "light")!;
  before.state = true;
  d.stop(); // 板子掉线，实体照留
  expect(hub.getEntity("esp-106", "light")!.state).toBe(true);
  expect(hub.isOnline("esp-106")).toBe(false);
  d.reconnect();
  d.report([{ id: "light", state: false }], sec() + 1);
  expect(hub.getEntity("esp-106", "light")!.state).toBe(false);
});

test("均值按时间加权，不是按样本数取平均", () => {
  // 一个 5 秒桶里：1600W 烧 4 秒，第 4 秒起归零。
  // 按样本平均是 800W，按时间加权是 1280W——电水壶这种占空比负载两者差很多
  const t0 = 1_800_000_000;
  stats.record("calc", "kettle", 1600, t0);
  stats.record("calc", "kettle", 1600, t0 + 2);
  stats.record("calc", "kettle", 0, t0 + 4);
  stats.record("calc", "kettle", 0, t0 + 5); // 封口：这一段到此为止
  stats.flush(t0 + 60);
  const [p] = stats.series("calc", "kettle", t0, t0 + 60).points;
  expect(p.mean).toBeCloseTo(1280, 6);
  expect(p.max).toBe(1600);
});

test("板子只报电量：服务器记基准，不加戏", () => {
  const d = fakeDevice("esp-107");
  const t0 = 1_800_000_000;
  d.setup("esp-107", t0);
  d.report([{ id: "light-meter", power_w: 0, energy_kwh: 10 }], t0);
  expect(hub.energyKwh(hub.getEntity("esp-107", "light-meter")!, t0 + 3600)).toBeCloseTo(10, 6);
});

test("板子给了电量，还继续报功率：增量从最后一次电量读数往后算", () => {
  const d = fakeDevice("esp-108");
  const t0 = 1_800_000_000;
  d.setup("esp-108", t0);
  d.meter(1000, t0, 10);
  expect(hub.energyKwh(hub.getEntity("esp-108", "light-meter")!, t0 + 3600)).toBeCloseTo(10 + 1000 / 1000, 6);
});

test("板上电量在累加，服务器只在两次读数之间做积分，不重复计算", () => {
  const d = fakeDevice("esp-109");
  const t0 = 1_800_000_000;
  d.setup("esp-109", t0);
  d.meter(1000, t0, 10);
  d.meter(1000, t0 + 3600, 10.5); // 板子说这小时用了 0.5 kWh
  const e = hub.getEntity("esp-109", "light-meter")!;
  expect(hub.energyKwh(e, t0 + 3600)).toBeCloseTo(10.5, 6); // 不额外加积分
  expect(hub.energyKwh(e, t0 + 7200)).toBeCloseTo(10.5 + 1, 6); // 之后靠积分补
});

test("下动作 → 设备回执 → 状态跟着变", async () => {
  const d = fakeDevice("esp-110");
  const t0 = sec();
  d.setup("esp-110", t0);
  d.report([{ id: "light", state: true }], t0);
  expect(hub.command(hub.getEntity("esp-110", "light")!, false)).toBe(true);
  d.report([{ id: "light", state: true }], t0 + 5);
  await hub.waitAck(100);
  expect(hub.getEntity("esp-110", "light")!.state).toBe(false);
});

test("令下得去但继电器不动：板子只管回报实际状态", async () => {
  const d = fakeDevice("esp-111");
  const t0 = sec();
  d.setup("esp-111", t0);
  d.report([{ id: "light", state: true }], t0);
  hub.command(hub.getEntity("esp-111", "light")!, false);
  d.report([{ id: "light", state: true }], t0 + 5, false);
  await hub.waitAck(100);
  expect(hub.getEntity("esp-111", "light")!.state).toBe(true);
});

test("整房断电：按 device 展开到所有开关，功率表不参与", () => {
  const d = fakeDevice("esp-112");
  d.setup();
  expect(hub.resolve({ device_id: "esp-112" }).map((e) => e.id)).toEqual(["light"]);
  expect(hub.resolve({ device_id: "esp-999" })).toEqual([]);
});

test("设备离线时不下令", () => {
  const d = fakeDevice("esp-113");
  d.setup();
  const e = hub.getEntity("esp-113", "light")!;
  d.stop();
  expect(hub.isOnline("esp-113")).toBe(false);
  expect(hub.command(e, true)).toBe(false);
});

test("失联判定：太久没消息就当掉线，重连接着更新", () => {
  const d = fakeDevice("esp-116");
  const t0 = sec();
  d.setup("esp-116", t0);
  const connectedAt = sec(); // 连上时间就是 lastSeen 的起点

  hub.checkTimeout(connectedAt); // 刚连上，不该踢
  expect(hub.isOnline("esp-116")).toBe(true);

  hub.checkTimeout(connectedAt + TIMEOUT + 1); // 超时没动静 → 掉线，实体照留
  expect(hub.isOnline("esp-116")).toBe(false);
  expect(hub.getEntity("esp-116", "light")).toBeDefined();

  d.reconnect(); // 重连后又是活的
  expect(hub.isOnline("esp-116")).toBe(true);
});

test("来一条消息就把失联计时刷新", () => {
  const d = fakeDevice("esp-117");
  d.setup("esp-117", sec());
  const connectedAt = sec();

  d.post("pub_alive", { ts: connectedAt + TIMEOUT }); // 心跳把 lastSeen 顶到现在
  hub.checkTimeout(sec() + 1);
  expect(hub.isOnline("esp-117")).toBe(true);
});

test("服务器重启后靠 states 表把开关初值捡回来", () => {
  const d = fakeDevice("esp-114");
  const t0 = sec();
  d.setup("esp-114", t0);
  expect(
    db
      .query<{ state: string }, [string, string]>(
        "SELECT state FROM state WHERE device_id = ? AND id = ? ORDER BY ts DESC LIMIT 1",
      )
      .get("esp-114", "light") ?? undefined,
  ).toBeUndefined();
  d.report([{ id: "light", state: true }], t0);
  expect(
    db
      .query<{ state: string }, [string, string]>(
        "SELECT state FROM state WHERE device_id = ? AND id = ? ORDER BY ts DESC LIMIT 1",
      )
      .get("esp-114", "light")!.state,
  ).toBe("true");
});

test("心跳有来有回：pub_alive / ack_alive", () => {
  const d = fakeDevice("esp-115");
  d.setup();
  d.received();
  d.post("pub_alive", { ts: sec() });
  expect(d.received()).toEqual([{ type: "ack_alive", ts: expect.any(Number) }]);
});
