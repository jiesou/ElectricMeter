/**
 * ESP32 下位机模拟器：RS485 电能表 + 直流断路器。
 * 只出站——连上先 pub_entities 声明自己有什么，之后哪个实体变了就补一份，
 * 收 pub_switch 动继电器，回 ack_switch。
 *
 *   bun run sim
 *   DEVICE_ID=esp-302 NAME="302 电表箱" INTERVAL=2 bun run sim
 *
 * 采样 1000ms 一次，服务器收到就推给观察者，原始样本不落盘只进时间桶。
 */
import type { Entity, SwitchMessage, WSMessage } from "@em/shared";
import { ALIVE } from "@em/shared";

const DEVICE_ID = process.env.DEVICE_ID ?? "esp-301";
const NAME = process.env.NAME ?? `${DEVICE_ID.replace(/^esp-/, "")} 电表箱`;
const HOST = process.env.WS ?? "ws://localhost:8080/ws";
const INTERVAL = Number(process.env.INTERVAL ?? 1000);

/** 一个回路两个实体：开关 + 功率表，id 就是它们的名字，没有第二套命名 */
type Circuit = "light" | "socket" | "ac";
const CIRCUITS: { id: Circuit; name: string }[] = [
  { id: "light", name: "照明" },
  { id: "socket", name: "插座" },
  { id: "ac", name: "空调" },
];
const id = (c: Circuit, suffix: string) => (suffix ? `${c}-${suffix}` : c);

const relay = { light: false, socket: true, ac: true };
const energy = { light: 2.1, socket: 18.4, ac: 46.2 };
const power = { light: 0, socket: 0, ac: 0 };
let lastTick = 0;

/** 电水壶：烧一阵歇一阵。占空比负载正是时间加权均值的用武之地——按样本取 AVG() 会算错 */
let kettleLeft = 0;
let kettleOn = false;
function kettle() {
  if (kettleLeft <= 0) {
    kettleOn = !kettleOn;
    kettleLeft = kettleOn ? 80 + Math.random() * 40 : 240 + Math.random() * 300;
  }
  kettleLeft--;
  return kettleOn ? 1600 : 0;
}

/** 1000ms 采一次。id 就是实体的名字，没有第二套命名 */
function sample() {
  // 房客随手开关
  if (Math.random() < 0.01) relay.light = !relay.light;
  if (Math.random() < 0.0075) relay.socket = !relay.socket;
  power.light = relay.light ? 55 : 0;
  power.socket = relay.socket ? 12 + kettle() : 0;
  power.ac = relay.ac ? 900 : 0;
}

let ws: WebSocket | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let backoff = 1000;
/** 上次报出去的实体快照，没变的字段就不重复发 */
const snap = new Map<string, Entity>();

const send = (m: WSMessage) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m));
const now = () => Math.floor(Date.now() / 1000);

function tick() {
  const ts = now();
  sample();
  // 电量在板子上就累加好了，服务器只管存。重启不归零
  const dt = lastTick ? ts - lastTick : 0;
  lastTick = ts;
  for (const c of CIRCUITS) energy[c.id] += (power[c.id] * dt) / 3.6e6;

  // 秒级时间戳只有 1 秒分辨率，取到小数点后两位够表示功率的瓦级变化了
  const fresh: Entity[] = CIRCUITS.flatMap<Entity>((c) => [
    { id: c.id, state: relay[c.id] },
    { id: id(c.id, "meter"), power_w: power[c.id], energy_kwh: Number(energy[c.id].toFixed(2)) },
  ]);
  const changed: Entity[] = [];
  for (const e of fresh) {
    const old = snap.get(e.id);
    const diff: Record<string, unknown> = { id: e.id };
    for (const [k, v] of Object.entries(e)) if (k !== "id" && old?.[k as keyof Entity] !== v) diff[k] = v;
    if (Object.keys(diff).length > 1) {
      changed.push(diff as unknown as Entity); // 只带变了的字段，id 必在
      snap.set(e.id, e);
    }
  }
  if (changed.length) send({ type: "pub_entities", ts, entities: changed });
}

function onDown(m: WSMessage) {
  if (m.type === "pub_switch") {
    const { id: target, state } = m as SwitchMessage;
    relay[target as Circuit] = state;
    send({ type: "ack_switch", ts: now() });
  }
}

function connect() {
  ws = new WebSocket(`${HOST}?device_id=${encodeURIComponent(DEVICE_ID)}`);
  ws.onopen = () => {
    backoff = 1000;
    lastTick = 0;
    sample();
    // 连上先声明自己有什么：name 只在这里给，往后只报变了的读数
    send({
      type: "pub_entities",
      ts: now(),
      name: NAME,
      model: "esp32-relay-3",
      fwVersion: "1.0.0",
      entities: CIRCUITS.flatMap<Entity>((c) => [
        { id: c.id, name: c.name, state: relay[c.id] },
        { id: id(c.id, "meter"), name: `${c.name}功率`, power_w: power[c.id], energy_kwh: energy[c.id] },
      ]),
    });
    if (!timer) timer = setInterval(tick, INTERVAL);
    setInterval(() => send({ type: "pub_alive", ts: now() }), ALIVE * 1000);
    console.log(`✅ ${DEVICE_ID} 已接入 ${HOST}`);
  };
  ws.onmessage = (e) => onDown(JSON.parse(String(e.data)) as WSMessage);
  ws.onclose = () => {
    if (timer) clearInterval(timer);
    timer = null;
    console.log(`🔌 ${DEVICE_ID} 断开，${backoff / 1000}s 后重连`);
    setTimeout(connect, backoff);
    backoff = Math.min(backoff * 2, 30_000);
  };
}

connect();
