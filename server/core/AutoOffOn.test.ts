import { beforeEach, expect, test } from "bun:test";
import type { Entity } from "@em/shared";
import { check } from "./AutoOffOn.ts";
import * as hub from "./hub.ts";
import { now } from "./util.ts";

/** 一间房：三个回路 + 人数 */
const ROOM: Entity[] = [
  { id: "light", name: "灯", type: "switch", state: false },
  { id: "kettle", name: "热水壶", type: "switch", state: false },
  { id: "dryer", name: "吹风机", type: "switch", state: false },
  { id: "people", name: "人数", type: "people-counter", netCount: 0 },
];

/** 假板子：下行报文都留着，人数与回执照真实设备那样报上去 */
async function room(id: string) {
  const sent: any[] = [];
  const post = (m: object) => hub.handleMessage(id, JSON.stringify(m));
  await hub.connect(
    id,
    { send: (raw: string) => sent.push(JSON.parse(raw)), close: () => {} } as never,
    "10.0.0.1",
  );
  await post({ type: "pub_entities", ts: now(), entities: ROOM });

  const actions = () =>
    sent
      .filter((m) => m.type === "pub_action_switch")
      .map((m) => [m.id, m.state]);

  return {
    sent,
    actions,
    people: (netCount: number, ts = now()) =>
      post({
        type: "pub_entities",
        ts,
        entities: [{ id: "people", netCount }],
      }),
    /** 板子翻闸后的回执：服务器的 state 只认这一条 */
    ack: (state: boolean) =>
      Promise.all(
        ROOM.filter((e) => e.type === "switch").map((e) =>
          post({ type: "ack_action_switch", ts: now(), id: e.id, state }),
        ),
      ),
  };
}

beforeEach(() => hub.devices.clear());

test("人进：该房全部回路合闸", async () => {
  const r = await room("esp-951");
  check();
  await r.people(2);
  check();

  expect(r.actions()).toEqual([
    ["light", true],
    ["kettle", true],
    ["dryer", true],
  ]);
});

test("人在房内：不反复下发，手动关掉的也不被开回去", async () => {
  const r = await room("esp-952");
  await r.people(2);
  check();
  await r.ack(true);
  const before = r.actions().length;

  await r.people(1);
  check();
  await r.ack(false); // 房内手动关闸

  expect(r.actions().length).toBe(before);
});

test("人出：满 5s 才断，全部回路分闸", async () => {
  const r = await room("esp-953");
  const t = now();
  check(t - 1_000); // 先空房
  await r.people(2, t);
  check(t + 1_000);
  await r.ack(true);

  await r.people(0, t + 2_000);
  check(t + 2_000);
  check(t + 6_000); // 才过 4s
  expect(r.actions()).toEqual([
    ["light", true],
    ["kettle", true],
    ["dryer", true],
  ]);

  check(t + 7_000);
  expect(r.actions().slice(3)).toEqual([
    ["light", false],
    ["kettle", false],
    ["dryer", false],
  ]);
});

test("5s 内人又回来：撤销断电", async () => {
  const r = await room("esp-954");
  const t = now();
  check(t - 1_000);
  await r.people(2, t);
  check(t + 1_000);
  await r.ack(true);

  await r.people(0, t + 2_000);
  check(t + 2_000);
  await r.people(1, t + 4_000);
  check(t + 4_000);
  check(t + 30_000);

  expect(r.actions().filter(([, state]) => !state)).toEqual([]);
});

test("空房断过一次就不再干预，人再走一轮才重新计", async () => {
  const r = await room("esp-955");
  const t = now();
  check(t - 1_000);
  await r.people(2, t);
  check(t);
  await r.ack(true);
  await r.people(0, t + 1_000);
  check(t + 1_000);
  check(t + 6_000);
  await r.ack(false);

  await r.ack(true); // 空房里又有人手动合闸
  check(t + 20_000);
  expect(r.actions().filter(([, state]) => !state).length).toBe(3);

  await r.people(1, t + 21_000);
  check(t + 21_000);
  await r.people(0, t + 22_000);
  check(t + 22_000);
  check(t + 27_000);
  expect(r.actions().filter(([, state]) => !state).length).toBe(6);
});
