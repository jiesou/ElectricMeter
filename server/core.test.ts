import { expect, test } from "bun:test";
import { rmSync } from "node:fs";

process.env.DB_PATH = "/tmp/agents/em-test.db";
for (const f of ["", "-wal", "-shm"]) rmSync(process.env.DB_PATH + f, { force: true });

const hub = await import("./core/hub.ts");
const stats = await import("./core/stats.ts");
const { historyOf, lastStateOf } = await import("./core/db.ts");
const { now } = await import("./core/util.ts");

const DEFS = [
  { key: "light", name: "照明", domain: "switch" as const, deviceClass: "outlet" as const },
  {
    key: "light_power",
    name: "照明功率",
    domain: "sensor" as const,
    deviceClass: "power" as const,
    unit: "W",
    stateClass: "measurement" as const,
  },
];

const t0 = 1_800_000_000; // 对齐到 60 秒整

/** 假下位机：收下所有下行消息，怎么回由测试决定 */
function fakeDevice(id: string, defs = DEFS) {
  const inbox: Record<string, never>[] = [];
  const ws = { send: (raw: string) => inbox.push(JSON.parse(raw)) } as never;
  hub.connect(id, ws);
  const hello = (entities = defs) =>
    hub.onMessage(id, ws, JSON.stringify({ type: "hello", deviceId: id, name: id, entities }));
  hello();

  return {
    ws,
    hello,
    /** 设备回报一轮状态。obey=false 模拟接触器粘连：令下得去，继电器不动 */
    report(states: { key: string; state: number | boolean }[], ts = now(), obey = true) {
      for (const m of inbox.splice(0)) {
        if (m.type !== "action") continue;
        if (obey) states = states.map((s) => (s.key === m.key ? { ...s, state: m.action !== "turn_off" } : s));
        hub.onMessage(id, ws, JSON.stringify({ type: "ack", ts, callId: m.callId, ok: true }));
      }
      hub.onMessage(id, ws, JSON.stringify({ type: "state", ts, states }));
    },
  };
}

test("hello 登记实体，设备自己声明它有什么", () => {
  fakeDevice("esp-101");
  const e = hub.getEntity("esp-101:light")!;
  expect(e.name).toBe("照明");
  expect(e.domain).toBe("switch");
  expect(e.deviceId).toBe("esp-101");
  expect(hub.isOnline("esp-101")).toBe(true);
});

test("设备不再上报的实体会被摘掉", () => {
  const d = fakeDevice("esp-102", [
    ...DEFS,
    { key: "ac", name: "空调", domain: "switch" as const, deviceClass: "outlet" as const },
  ]);
  expect(hub.getEntity("esp-102:ac")).toBeDefined();
  d.hello(DEFS);
  expect(hub.getEntity("esp-102:ac")).toBeUndefined();
  expect(hub.getEntity("esp-102:light")).toBeDefined();
});

test("开关只在状态真变了的时候落 states 表", () => {
  const d = fakeDevice("esp-103");
  d.report([{ key: "light", state: true }], t0);
  d.report([{ key: "light", state: true }], t0 + 1); // 没变，不该再记
  d.report([{ key: "light", state: false }], t0 + 2);
  expect(historyOf("esp-103", "light", 0, t0 + 10).map((r) => r.state)).toEqual(["true", "false"]);
});

test("均值按时间加权，不是按样本数取平均", () => {
  // 一个 5 秒桶里：1600W 烧 4 秒，然后 0。
  // 按样本平均会得出 800W，按时间加权是 1280W——电水壶这种占空比负载两者差很多
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

test("下发动作：设备收到、回执、状态跟着变", async () => {
  const d = fakeDevice("esp-105");
  d.report([{ key: "light", state: true }], t0);
  const pending = hub.act(hub.getEntity("esp-105:light")!, "turn_off");
  d.report([{ key: "light", state: true }], t0 + 5); // 设备听令，回报「断」
  expect((await pending).ok).toBe(true);
  expect(hub.getEntity("esp-105:light")!.state).toBe(false);
  expect(historyOf("esp-105", "light", 0, t0 + 10).map((r) => r.state)).toEqual(["true", "false"]);
});

test("令下得去但继电器不动：requested 与 state 分道扬镳，就是粘连", async () => {
  const d = fakeDevice("esp-106");
  d.report([{ key: "light", state: true }], t0);
  const pending = hub.act(hub.getEntity("esp-106:light")!, "turn_off");
  d.report([{ key: "light", state: true }], t0 + 5, false);
  expect((await pending).ok).toBe(true); // 回执是有的：令确实下到了
  const e = hub.getEntity("esp-106:light")!;
  expect(e.requested).toBe(false);
  expect(e.state).toBe(true); // 但实际没断
});

test("整房断电：按 device 展开到这台设备的所有开关，传感器不参与", () => {
  fakeDevice("esp-107");
  expect(hub.resolve({ device: "esp-107" }).map((e) => e.ref)).toEqual(["esp-107:light"]);
  expect(hub.resolve({ device: "esp-999" })).toEqual([]);
});

test("设备离线时下令直接失败，不等回执", async () => {
  const d = fakeDevice("esp-108");
  hub.disconnect("esp-108", d.ws);
  const r = await hub.act(hub.getEntity("esp-108:light")!, "turn_on");
  expect(r.ok).toBe(false);
  expect(r.error).toContain("离线");
});

test("设备重连：状态不丢，陈旧命令不残留", async () => {
  const d = fakeDevice("esp-109");
  d.report([{ key: "light", state: true }], t0);
  const pending = hub.act(hub.getEntity("esp-109:light")!, "turn_off");
  d.report([{ key: "light", state: true }], t0 + 5);
  await pending;
  expect(hub.getEntity("esp-109:light")!.requested).toBe(false);

  d.hello(); // 设备重连
  const e = hub.getEntity("esp-109:light")!;
  expect(e.state).toBe(false); // 状态没丢
  expect(e.requested).toBeUndefined(); // 但没有命令在飞了，不该继续报「令未生效」
});

test("服务器重启后靠 states 表把开关初值捡回来，不伪造跳变", () => {
  fakeDevice("esp-111");
  expect(lastStateOf("esp-111", "light") ?? undefined).toBeUndefined();
  hub.onMessage(
    "esp-111",
    { send: () => {} } as never,
    JSON.stringify({
      type: "state",
      ts: t0,
      states: [{ key: "light", state: true }],
    }),
  );
  expect(lastStateOf("esp-111", "light")!.state).toBe("true");
});

test("令未生效只在命令未落地的窗口内出现", async () => {
  const d = fakeDevice("esp-110");
  d.report([{ key: "light", state: true }], t0);
  const e = hub.getEntity("esp-110:light")!;
  expect(e.requested).toBeUndefined(); // 重连后没有命令在飞
  const pending = hub.act(e, "turn_off");
  d.report([{ key: "light", state: true }], t0 + 5);
  await pending;
  expect(hub.getEntity("esp-110:light")!.requested).toBe(false); // 命令落地，不再报故障
  expect(hub.getEntity("esp-110:light")!.state).toBe(false);
});
