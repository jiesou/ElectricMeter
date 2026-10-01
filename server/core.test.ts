import { expect, test } from "bun:test";
import type { WSMessage } from "@em/shared";
import { rmSync } from "node:fs";

process.env.DB_PATH = "/tmp/agents/em-test.db";
for (const f of ["", "-wal", "-shm"]) rmSync(process.env.DB_PATH + f, { force: true });

const hub = await import("./core/hub.ts");
const stats = await import("./core/stats.ts");
const { historyOf, lastStateOf } = await import("./core/db.ts");

const DEFS = [
  { key: "light", name: "照明", kind: "relay" as const },
  { key: "light_power", name: "照明功率", kind: "meter" as const },
  { key: "light_energy", name: "照明电量", kind: "meter" as const },
];

const t0 = 1_800_000_000;

/** 假下位机：收下所有下行消息，怎么回由测试决定 */
function fakeDevice(id: string, defs = DEFS) {
  const inbox: WSMessage[] = [];
  const ws = { send: (raw: string) => inbox.push(JSON.parse(raw)) } as never;
  hub.connect(id, ws as never);
  const post = (type: string, m: object) => hub.handleMessage(id, JSON.stringify({ type, ...m }));

  return {
    ws,
    post,
    /** 收到的下行消息 */
    received: () => inbox.splice(0),
    /** 设备回报一轮状态。obey=false 模拟令下得去但继电器不动作 */
    report(states: { key: string; state: number | boolean }[], ts = t0, obey = true) {
      for (const m of this.received()) {
        if (m.type !== "post_relay") continue;
        if (obey)
          states = states.map((s) =>
            s.key === m.key ? { ...s, state: m.action !== "turn_off" } : s,
          );
        post("post_ack", { ts, ok: true });
      }
      post("post_state", { ts, states });
    },
  };
}

test("post_entities 登记实体", () => {
  const d = fakeDevice("esp-101");
  d.post("post_entities", { ts: t0, name: "301 电表箱", model: "esp32-relay-3", entities: DEFS });
  expect(hub.getEntity("esp-101:light")!.name).toBe("照明");
  expect(hub.getEntity("esp-101:light_power")!.kind).toBe("meter");
  expect(hub.isOnline("esp-101")).toBe(true);
});

test("设备不再上报的实体会被摘掉", () => {
  const d = fakeDevice("esp-102", [...DEFS, { key: "ac", name: "空调", kind: "relay" as const }]);
  d.post("post_entities", { ts: t0, name: "esp-102", entities: [...DEFS, { key: "ac", name: "空调", kind: "relay" }] });
  expect(hub.getEntity("esp-102:ac")).toBeDefined();
  d.post("post_entities", { ts: t0, name: "esp-102", entities: DEFS });
  expect(hub.getEntity("esp-102:ac")).toBeUndefined();
  expect(hub.getEntity("esp-102:light")).toBeDefined();
});

test("开关只在状态真变了的时候落 states 表", () => {
  const d = fakeDevice("esp-103");
  d.post("post_entities", { ts: t0, name: "esp-103", entities: DEFS });
  d.report([{ key: "light", state: true }], t0);
  d.report([{ key: "light", state: true }], t0 + 1); // 没变，不该再记
  d.report([{ key: "light", state: false }], t0 + 2);
  expect(historyOf("esp-103", "light", 0, t0 + 10).map((r) => r.state)).toEqual(["true", "false"]);
});

test("均值按时间加权，不是按样本数取平均", () => {
  // 一个 5 秒桶里：1600W 烧 4 秒，然后 0。
  // 按样本平均是 800W，按时间加权是 1280W——电水壶这种占空比负载两者差很多
  const ref = "calc:power";
  stats.record(ref, 1600, t0);
  stats.record(ref, 1600, t0 + 2);
  stats.record(ref, 0, t0 + 4);
  stats.record(ref, 0, t0 + 5);
  stats.flush(t0 + 60);
  const [p] = stats.series(ref, t0, t0 + 60).points;
  expect(p.mean).toBeCloseTo(1280, 6);
  expect(p.max).toBe(1600);
});

test("功率积分就是电量：瓦秒 ÷ 3.6e6 = kWh", () => {
  const ref = "calc:power2";
  for (let s = 0; s <= 5; s += 1) stats.record(ref, 1000, t0 + s);
  stats.flush(t0 + 60);
  expect(stats.energyOf([ref], t0, t0 + 60)).toBeCloseTo((1_000 * 5) / 3.6e6, 6);
});

test("下动作 → 设备回执 → 状态跟着变", async () => {
  const d = fakeDevice("esp-105");
  d.post("post_entities", { ts: t0, name: "esp-105", entities: DEFS });
  d.report([{ key: "light", state: true }], t0);
  expect(hub.command(hub.getEntity("esp-105:light")!, "turn_off")).toBe(true);
  d.report([{ key: "light", state: true }], t0 + 5);
  await hub.waitAck(100);
  expect(hub.getEntity("esp-105:light")!.state).toBe(false);
});

test("令下得去但继电器不动：板子只管回报实际状态", async () => {
  const d = fakeDevice("esp-106");
  d.post("post_entities", { ts: t0, name: "esp-106", entities: DEFS });
  d.report([{ key: "light", state: true }], t0);
  hub.command(hub.getEntity("esp-106:light")!, "turn_off");
  d.report([{ key: "light", state: true }], t0 + 5, false);
  await hub.waitAck(100);
  expect(hub.getEntity("esp-106:light")!.state).toBe(true);
});

test("整房断电：按 device 展开到所有开关，读数不参与", () => {
  const d = fakeDevice("esp-107");
  d.post("post_entities", { ts: t0, name: "esp-107", entities: DEFS });
  expect(hub.resolve({ device: "esp-107" }).map((e) => e.ref)).toEqual(["esp-107:light"]);
  expect(hub.resolve({ device: "esp-999" })).toEqual([]);
});

test("设备离线时不下令", () => {
  const d = fakeDevice("esp-108");
  d.post("post_entities", { ts: t0, name: "esp-108", entities: DEFS });
  const e = hub.getEntity("esp-108:light")!;
  hub.disconnect("esp-108", d.ws);
  expect(hub.command(e, "turn_on")).toBe(false);
});

test("服务器重启后靠 states 表把开关初值捡回来", () => {
  const d = fakeDevice("esp-111");
  d.post("post_entities", { ts: t0, name: "esp-111", entities: DEFS });
  expect(lastStateOf("esp-111", "light") ?? undefined).toBeUndefined();
  d.report([{ key: "light", state: true }], t0);
  expect(lastStateOf("esp-111", "light")!.state).toBe("true");
});

test("ping 有来有回", () => {
  const d = fakeDevice("esp-112");
  d.post("post_entities", { ts: t0, name: "esp-112", entities: DEFS });
  d.received();
  d.post("ping", { ts: t0 });
  expect(d.received()).toEqual([{ type: "ping", ts: expect.any(Number) }]);
});
