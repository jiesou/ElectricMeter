/**
 * ESP32 下位机模拟器：RS485 电能表 + 直流断路器。
 * 只出站——连上 → pub_entities → 每 INTERVAL 毫秒 pub_state → 收 pub_switch 动继电器 → 回 ack_switch。
 *
 *   bun run sim
 *   DEVICE_ID=esp-302 NAME="302 电表箱" INTERVAL=2 bun run sim
 *
 * 采样 1000ms 一次，服务器收到就推给观察者，原始样本不落盘只进时间桶。
 */
import type { EntityDef, Key, SwitchMessage, WSMessage } from "@em/shared";

const DEVICE_ID = process.env.DEVICE_ID ?? "esp-301";
const NAME = process.env.NAME ?? `${DEVICE_ID.replace(/^esp-/, "")} 电表箱`;
const HOST = process.env.WS ?? "ws://localhost:8080/ws";
const INTERVAL = Number(process.env.INTERVAL ?? 1000);

type Circuit = "light" | "socket" | "ac";
const CIRCUITS: { key: Circuit; name: string }[] = [
  { key: "light", name: "照明" },
  { key: "socket", name: "插座" },
  { key: "ac", name: "空调" },
];

// 每路回路三个实体：开关、实时瓦数、自上电以来的千瓦时数
const ENTITIES: EntityDef[] = [
  ...CIRCUITS.flatMap<EntityDef>((c) => [
    { key: c.key, name: c.name, kind: "relay" },
    { key: `${c.key}_power`, name: `${c.name}功率`, kind: "meter" },
    { key: `${c.key}_energy`, name: `${c.name}电量`, kind: "meter" },
  ]),
  { key: "total_energy", name: "总电量", kind: "meter" },
];

const relay: Record<Key, boolean> = { light: false, socket: true, ac: true };
const energy: Record<Key, number> = { light: 2.1, socket: 18.4, ac: 46.2, total_energy: 66.7 };
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

function sample(): Record<Circuit, number> {
  // 房客随手开关
  if (Math.random() < 0.01) relay.light = !relay.light;
  if (Math.random() < 0.0075) relay.socket = !relay.socket;
  const on = (k: Key) => (relay[k] ? 1 : 0);
  return {
    light: on("light") * 55,
    socket: on("socket") * (12 + kettle()),
    ac: on("ac") * 900,
  };
}

let ws: WebSocket | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let backoff = 1000;

const send = (m: WSMessage) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m));
const now = () => Math.floor(Date.now() / 1000);

function tick() {
  const ts = now();
  const p = sample();
  // 电量在板子上就累加好了，服务器只管存。重启不归零
  if (lastTick) {
    const dt = ts - lastTick;
    for (const c of CIRCUITS) energy[c.key] += (p[c.key] * dt) / 3.6e6;
    energy.total_energy += ((p.light + p.socket + p.ac) * dt) / 3.6e6;
  }
  lastTick = ts;
  send({
    type: "pub_state",
    ts,
    states: [
      ...CIRCUITS.map((c) => ({ key: c.key, state: relay[c.key] })),
      ...CIRCUITS.map((c) => ({ key: `${c.key}_power`, state: p[c.key] })),
      ...CIRCUITS.map((c) => ({ key: `${c.key}_energy`, state: Number(energy[c.key].toFixed(4)) })),
      { key: "total_energy", state: Number(energy.total_energy.toFixed(4)) },
    ],
  });
}

function onDown(m: WSMessage) {
  if (m.type === "pub_switch") {
    const { key, action } = m as SwitchMessage;
    relay[key] = action === "turn_on" ? true : action === "turn_off" ? false : !relay[key];
    send({ type: "ack_switch", ts: now() });
  }
}

function connect() {
  ws = new WebSocket(`${HOST}?deviceId=${encodeURIComponent(DEVICE_ID)}`);
  ws.onopen = () => {
    backoff = 1000;
    lastTick = 0;
    send({ type: "pub_entities", ts: now(), name: NAME, model: "esp32-relay-3", fwVersion: "1.0.0", entities: ENTITIES });
    if (!timer) timer = setInterval(tick, INTERVAL);
    setInterval(() => send({ type: "pub_alive", ts: now() }), 30_000);
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
