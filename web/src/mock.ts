import type { Entity } from "@em/shared";
import { AssistantChatTransport } from "@assistant-ui/ai-sdk";
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import type { Ref } from "vue";
import type { Bill, Room, Stats } from "./api.ts";
import { energy, power } from "./format.ts";

/** 演示时 1 秒当 40 秒，两位小数下累计电量每秒都在涨 */
const DEMO_SPEED = 40;
/** 功率围绕基准值浮动 ±40W，各实体相位不同 */
const SWING = 40;

/** 每间房三个用电器，实体 id 跟下位机报的一模一样：一块表配一个闸 */
const APPLIANCES = [
  { id: "light", name: "灯", powerW: 55, energyKwh: 3.42 },
  { id: "kettle", name: "热水壶", powerW: 1600, energyKwh: 18.4 },
  { id: "dryer", name: "吹风机", powerW: 900, energyKwh: 46.2 },
];

/** 表 id 是「light-meter」，它那个闸就叫「light」 */
const switchOf = (meterId: string) => meterId.replace(/-meter$/, "");

/** 只做演示的两间房：301 住着人、开着灯和水壶，302 是空房、闸全关 */
const TEMPLATE = [
  { id: "esp-301", name: "301 电表箱", online: true, occupied: true, on: ["light", "kettle"] },
  { id: "esp-302", name: "302 电表箱", online: true, occupied: false, on: [] },
] as const;

const entitiesOf = (on: readonly string[]): Entity[] =>
  APPLIANCES.flatMap((a) => [
    {
      id: `${a.id}-meter`,
      name: `${a.name}功率`,
      type: "meter" as const,
      powerW: on.includes(a.id) ? a.powerW : 0,
      energyKwh: a.energyKwh,
    },
    {
      id: a.id,
      name: a.name,
      type: "switch" as const,
      state: on.includes(a.id),
    },
  ]);

const totals = (entities: Entity[]) => {
  const meters = entities.filter((e) => e.type === "meter");
  return {
    power: meters.reduce((sum, e) => sum + (e.powerW ?? 0), 0),
    energy: meters.reduce((sum, e) => sum + (e.energyKwh ?? 0), 0),
  };
};

let tick = 0;

/** 两间房的初值，每次给一份可改的副本 */
export function mockRooms(): Room[] {
  tick = 0;
  return TEMPLATE.map((r) => {
    const entities = entitiesOf(r.on);
    return {
      id: r.id,
      name: r.name,
      online: r.online,
      occupied: r.occupied,
      ...totals(entities),
      entities,
    };
  });
}

/** 上一帧推进一秒：闸开着的表功率正弦浮动、电量按功率累积，关着的表归零不动 */
export function mockTick(prev: Room[]): Room[] {
  tick += 1;
  return prev.map((r) => {
    if (!r.online) return r;
    const entities = r.entities.map((entity, i) => {
      if (entity.type !== "meter") return entity;
      const base = APPLIANCES.find((a) => `${a.id}-meter` === entity.id)?.powerW ?? 0;
      const on = r.entities.find((e) => e.id === switchOf(entity.id))?.state;
      const powerW = on
        ? Math.max(0, Math.round(base + SWING * Math.sin((tick + i * 7) / 9)))
        : 0;
      return {
        ...entity,
        powerW,
        energyKwh: Number(
          ((entity.energyKwh ?? 0) + (powerW * DEMO_SPEED) / 3600000).toFixed(2),
        ),
      };
    });
    return { ...r, entities, ...totals(entities) };
  });
}

/* === 统计页那份 mock：形状与 /api/stats 一致，动作只动内存 === */

const day = 86_400_000;

/** 24 小时的作息权重：晚上多、凌晨少 */
const WEIGHT = [
  0.3, 0.2, 0.2, 0.2, 0.2, 0.3, 0.6, 1.2, 1.0, 0.6, 0.5, 0.5, 0.6, 0.5, 0.5,
  0.6, 0.9, 1.4, 1.8, 1.6, 1.4, 1.2, 0.9, 0.5,
];

const dayStart = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** 把一段用电摊到 24 个小时上 */
const spread = (kwh: number) => {
  const sum = WEIGHT.reduce((a, b) => a + b, 0);
  return WEIGHT.map((w, hour) => ({ hour, kwh: (kwh * w) / sum }));
};

/** 三块表各吃多少：灯 < 水壶 < 吹风机 */
const devicesOf = (kwh: number) =>
  APPLIANCES.map((a, i) => ({
    id: `${a.id}-meter`,
    name: `${a.name}功率`,
    kwh: kwh * [0.15, 0.28, 0.57][i]!,
  }));

/** 在住房这几天的日用电 */
const DAYS = [1.8, 2.6, 3];

let offset = 0; // mock 自己的拨天偏移

export function mockStats(): Stats {
  const now = Date.now() + offset;
  const rooms = TEMPLATE.map((r) => {
    const kwh = r.occupied ? 7.4 : 0;
    return {
      id: r.id,
      name: r.name,
      occupied: r.occupied,
      start_ts: r.occupied ? now - 2 * day : undefined,
      kwh,
      days: r.occupied
        ? DAYS.map((k, i) => ({ day: dayStart(now) - (2 - i) * day, kwh: k }))
        : [],
      hours: spread(kwh),
      devices: devicesOf(kwh),
    };
  });
  return { now, rooms, stays: mockBills(now), avg_hours: spread(3.2) };
}

/** 历史入住记录：两间房都有账单，形状与真实账单一样 */
function mockBills(now: number): Bill[] {
  return [
    { id: "esp-301", start: 5, end: 4, kwh: 9.6, top: "吹风机功率", percent: 78 },
    { id: "esp-302", start: 12, end: 10, kwh: 5.2, top: "热水壶功率", percent: 42 },
    { id: "esp-301", start: 20, end: 19, kwh: 3.1, top: "灯功率", percent: 12 },
  ].map((b) => {
    const room = TEMPLATE.find((r) => r.id === b.id)!;
    return {
      device_id: b.id,
      room: room.name,
      start_ts: now - b.start * day,
      end_ts: now - b.end * day,
      days: b.start - b.end + 1,
      kwh: b.kwh,
      top: b.top,
      percent: b.percent,
    };
  });
}

const find = (s: Stats, device_id: string) =>
  s.rooms.find((r) => r.id === device_id);

/** 在住房的用电每秒涨一点，肉眼看得见 */
export function mockStatsTick(s: Stats) {
  s.now = Date.now() + offset;
  for (const room of s.rooms) {
    if (!room.occupied) continue;
    const add = 0.0006;
    room.kwh += add;
    const last = room.days[room.days.length - 1];
    if (last) last.kwh += add;
    const hour = room.hours[new Date(s.now).getHours()];
    if (hour) hour.kwh += add;
    const device = room.devices[0];
    if (device) device.kwh += add;
  }
}

export function mockNextDay(s: Stats) {
  offset += day;
  s.now = Date.now() + offset;
  for (const room of s.rooms) {
    if (!room.occupied) continue;
    room.days.push({ day: dayStart(s.now), kwh: 0 });
    room.hours = spread(0);
  }
}

export function mockCheckin(s: Stats, device_id: string) {
  const room = find(s, device_id);
  if (!room) return;
  room.occupied = true;
  room.start_ts = s.now;
  room.kwh = 0;
  room.days = [{ day: dayStart(s.now), kwh: 0 }];
  room.hours = spread(0);
  for (const d of room.devices) d.kwh = 0;
}

export function mockCheckout(s: Stats, device_id: string) {
  const room = find(s, device_id);
  if (!room?.start_ts) return;
  const top = [...room.devices].sort((a, b) => b.kwh - a.kwh)[0];
  s.stays.unshift({
    device_id,
    room: room.name,
    start_ts: room.start_ts,
    end_ts: s.now,
    days: room.days.length,
    kwh: room.kwh,
    top: top && top.kwh > 0 ? top.name : "—",
    percent: 50,
  });
  room.occupied = false;
}

/* === 智能体那份 mock：不连模型，拿上面这份假数据拼回答 === */

const stateOf = (room: Room) =>
  room.entities
    .filter((e) => e.type === "switch")
    .map((e) => `${e.name}${e.state ? "开着" : "关着"}`)
    .join("、");

const onlineReply = (rooms: Room[]) =>
  [
    `现在在线的客房有 ${rooms.filter((r) => r.online).length} 间：`,
    "",
    ...rooms.map(
      (r) =>
        `- **${r.name}**：${r.online ? "在线" : "离线"}，${r.occupied ? "住着人" : "空房"}，${stateOf(r)}，合计 ${power(r.power)}`,
    ),
  ].join("\n");

const usageReply = (stats: Stats | null) => {
  const ranked = [...(stats?.rooms ?? [])].sort((a, b) => b.kwh - a.kwh);
  const room = ranked.find((r) => r.kwh > 0);
  if (!stats || !room) return "现在还没有入住的用电记录。";

  const bills = stats.stays.filter((b) => b.kwh > 0);
  const avg = bills.reduce((sum, b) => sum + b.kwh, 0) / (bills.length || 1);
  const top = [...room.devices].sort((a, b) => b.kwh - a.kwh)[0];
  return [
    `最费电的是 **${room.name}**，这趟入住已经用了 ${energy(room.kwh)}。`,
    "",
    ...(top
      ? [`- 大头是 ${top.name}：${energy(top.kwh)}（占 ${Math.round((top.kwh / room.kwh) * 100)}%）`]
      : []),
    `- 跟店里其他入住比：${bills.length} 次历史入住平均 ${energy(avg)}，这次${room.kwh > avg ? "高出" : "低了"} ${energy(Math.abs(room.kwh - avg))}`,
  ].join("\n");
};

const roomReply = (room: Room, stats: Stats | null) => {
  const detail = stats?.rooms.find((r) => r.id === room.id);
  return [
    `**${room.name}** ${room.online ? "在线" : "离线"}，${room.occupied ? "住着人" : "空房"}。`,
    "",
    ...room.entities
      .filter((e) => e.type === "meter")
      .map(
        (e) =>
          `- ${e.name?.replace("功率", "") ?? e.id}：${power(e.powerW)}，累计 ${energy(e.energyKwh)}`,
      ),
    "",
    ...(detail && detail.kwh > 0
      ? [`这趟入住已经用了 ${energy(detail.kwh)}，今天 ${energy(detail.days.at(-1)?.kwh ?? 0)}。`]
      : ["这间房还没有入住用电记录。"]),
  ].join("\n");
};

/** mock 模式下智能体的一次回答：调工具的参数、工具吐的 JSON、最后说的话 */
function mockCall(prompt: string, rooms: Room[], stats: Stats | null) {
  const asRooms = (reply: string) => ({
    args: ["rooms"],
    output: JSON.stringify(rooms, null, 2),
    reply,
  });

  const room = rooms.find((r) => prompt.includes(r.id.replace("esp-", "")));
  if (room)
    return {
      args: ["entities", "-d", room.id],
      output: JSON.stringify(room.entities, null, 2),
      reply: roomReply(room, stats),
    };
  if (/在线|状态|客房/.test(prompt)) return asRooms(onlineReply(rooms));
  if (/费电|电量|用电/.test(prompt) || !rooms.length)
    return asRooms(usageReply(stats));
  return asRooms(`${onlineReply(rooms)}\n\n${usageReply(stats)}`);
}

const TOOL = "electricmeter";
const wait = (min: number, max: number) => min + Math.random() * (max - min);
const pieces = (text: string) => text.match(/[\s\S]{1,3}/g) ?? [];

/** 一块流数据加它前面该等多久，让工具调用和打字都看起来像真的 */
type Step = [number, UIMessageChunk];

function toolSteps(args: string[], output: string): Step[] {
  const toolCallId = crypto.randomUUID();
  const input = { args };
  const steps: Step[] = [
    [wait(600, 1200), { type: "start-step" }],
    [0, { type: "tool-input-start", toolCallId, toolName: TOOL }],
  ];
  for (const delta of pieces(JSON.stringify(input)))
    steps.push([
      wait(12, 28),
      { type: "tool-input-delta", toolCallId, inputTextDelta: delta },
    ]);
  steps.push([
    0,
    { type: "tool-input-available", toolCallId, toolName: TOOL, input },
  ]);
  steps.push([
    wait(800, 1500),
    { type: "tool-output-available", toolCallId, output },
  ]);
  steps.push([0, { type: "finish-step" }]);
  return steps;
}

function textSteps(text: string): Step[] {
  const id = crypto.randomUUID();
  const steps: Step[] = [
    [wait(200, 500), { type: "start-step" }],
    [0, { type: "text-start", id }],
  ];
  for (const delta of pieces(text))
    steps.push([wait(25, 45), { type: "text-delta", id, delta }]);
  steps.push(
    [0, { type: "text-end", id }],
    [0, { type: "finish-step" }],
    [0, { type: "finish", finishReason: "stop" }],
  );
  return steps;
}

function stream(steps: Step[]): ReadableStream<UIMessageChunk> {
  let i = 0;
  return new ReadableStream({
    async pull(c) {
      const step = steps[i++];
      if (!step) return c.close();
      await new Promise((done) => setTimeout(done, step[0]));
      c.enqueue(step[1]);
    },
  });
}

const askOf = (messages: UIMessage[]) =>
  messages
    .filter((m) => m.role === "user")
    .at(-1)
    ?.parts.map((p) => (p.type === "text" ? p.text : ""))
    .join("") ?? "";

/** mock 模式下前端自己出回答、不发请求；其它情况照旧发给 /api/chat */
export class MockChatTransport extends AssistantChatTransport<UIMessage> {
  constructor(
    private mock: Ref<boolean>,
    private rooms: Ref<Room[]>,
    private stats: Ref<Stats | null>,
  ) {
    super();
  }

  async sendMessages(
    options: Parameters<ChatTransport<UIMessage>["sendMessages"]>[0],
  ) {
    if (!this.mock.value) return super.sendMessages(options);
    const { args, output, reply } = mockCall(
      askOf(options.messages),
      this.rooms.value,
      this.stats.value,
    );
    return stream([
      [0, { type: "start" }],
      ...toolSteps(args, output),
      ...textSteps(reply),
    ]);
  }
}
