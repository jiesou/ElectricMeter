import { beforeEach, expect, test } from "bun:test";
import type { Meter, Switch } from "@em/shared";
import { app } from "../app.ts";
import * as hub from "../core/hub.ts";
import { now } from "../core/util.ts";

const json = async (res: Response) => (await res.json()) as any;

/** 假下位机：连上声明自己有什么 */
async function device(id: string, entities: Partial<Switch | Meter>[]) {
  await hub.connect(id, { send: () => {}, close: () => {} } as never, "10.0.0.9");
  await hub.handleMessage(id, JSON.stringify({ type: "pub_entities", ts: now(), entities }));
}

/** 总览里的那一台设备 */
const rowOf = async (id: string) => (await json(await app.request("/api/devices"))).find((d: any) => d.id === id);

beforeEach(() => hub.devices.clear());

test("总览：在线状态、ip、最后说话时间、当前功率、电量", async () => {
  await device("esp-201", [
    { id: "light", name: "照明", type: "switch", state: true },
    { id: "light-meter", name: "照明功率", type: "meter", powerW: 55, energyKwh: 2.5 },
  ]);
  expect(await rowOf("esp-201")).toMatchObject({ online: true, ip: "10.0.0.9", power: 55, energy: 2.5 });
  expect((await rowOf("esp-201")).lastSeen).toBeGreaterThan(0);
});

test("掉线：设备还在列，读数留着最后的值", async () => {
  await device("esp-204", [{ id: "light-meter", name: "照明功率", type: "meter", powerW: 55, energyKwh: 2.5 }]);
  hub.disconnect("esp-204");
  expect(await rowOf("esp-204")).toMatchObject({ online: false, power: 55, energy: 2.5 });
});
