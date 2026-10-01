/**
 * ESP32 下位机模拟器：RS485 电能表 + 直流断路器。
 * 只出站——连上 → post_entities → 每 INTERVAL 毫秒 post_state → 收 post_relay 动继电器 → 回 post_ack。
 *
 *   bun run sim
 *   DEVICE_ID=esp-302 NAME="302 电表箱" INTERVAL=2 bun run sim
 *
 * 采样 500ms 一次，服务器收到就推给观察者，原始样本不落盘只进时间桶。
 */
import type { EntityDef, Key, PostRelayMessage, WSMessage } from "@em/shared";

const DEVICE_ID = process.env.DEVICE_ID ?? "esp-301";
const NAME = process.env.NAME ?? `${DEVICE_ID.replace(/^esp-/, "")} 电表箱`;
const HOST = process.env.WS ?? "ws://localhost:8080/ws";
const INTERVAL = Number(process.env.INTERVAL ?? 500);

const CIRCUITS: { key: Key; name: string }[] = [
  { key: "light", name: "照明" },
  { key: "socket", name: "插座" },
  { key: "ac", name: "空调" },
];

const ENTITIES: EntityDef[] = [
  ...CIRCUITS.flatMap<EntityDef>((c) => [
    { key: c.key, name: c.name, kind: "relay" },
    { key: `${c.key}_power`, name: `${c.name}功率`, kind: "meter", unit: "W" },
  ]),
  { key: "meter", name: "电能表", kind: "meter", unit: "kWh" },
];

const relay: Record<Key, boolean> = { light: false, socket: true, ac: true };
let meter = 128.4; // 电能表累计读数
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

function sample() {
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
  const power = sample();
  // 电能表按功率积分累计，重启不归零
  if (lastTick) meter += ((power.light + power.socket + power.ac) * (ts - lastTick)) / 3.6e6;
  lastTick = ts;
  send({
    type: "post_state",
    ts,
    states: [
      ...CIRCUITS.map((c) => ({ key: c.key, state: relay[c.key] })),
      { key: "light_power", state: power.light },
      { key: "socket_power", state: power.socket },
      { key: "ac_power", state: power.ac },
      { key: "meter", state: Number(meter.toFixed(3)) },
    ],
  });
}

function onDown(m: WSMessage) {
  if (m.type === "post_relay") {
    const { key, action } = m as PostRelayMessage;
    relay[key] = action === "turn_on" ? true : action === "turn_off" ? false : !relay[key];
    send({ type: "post_ack", ts: now(), ok: true });
  } else if (m.type === "ping") {
    send({ type: "ping", ts: now() });
  }
}

function connect() {
  ws = new WebSocket(`${HOST}?deviceId=${encodeURIComponent(DEVICE_ID)}`);
  ws.onopen = () => {
    backoff = 1000;
    lastTick = 0;
    send({ type: "post_entities", ts: now(), name: NAME, model: "esp32-relay-3", fwVersion: "1.0.0", entities: ENTITIES });
    if (!timer) timer = setInterval(tick, INTERVAL);
    setInterval(() => send({ type: "ping", ts: now() }), 30_000);
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
