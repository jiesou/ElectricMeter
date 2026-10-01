/**
 * ESP32 下位机模拟器：RS485 电能表 + 直流断路器。
 * 按协议只出站——连上 → hello → 每 INTERVAL 秒上报 → 收 action 改继电器 → 回 ack。
 *
 *   bun run sim
 *   DEVICE_ID=esp-302 NAME="302 电表箱" INTERVAL=2 FAULT=1 bun run sim
 *
 * 采样 500ms 一次：实时曲线要顺滑，而原始样本服务器不落盘，只进时间桶。
 * FAULT=1 注入接触器粘连：通断令下得去，继电器实际不动作，
 * 服务器会发现 requested ≠ state——这就是真实故障的形状。
 */
import type { DownMsg, EntityDef, Key, UpMsg } from "@em/shared";

const DEVICE_ID = process.env.DEVICE_ID ?? "esp-301";
const NAME = process.env.NAME ?? `${DEVICE_ID.replace(/^esp-/, "")} 电表箱`;
const HOST = process.env.WS ?? "ws://localhost:8080/ws";
const INTERVAL = Number(process.env.INTERVAL ?? 0.5);
const FAULT = process.env.FAULT === "1";

const CIRCUITS: { key: Key; name: string }[] = [
  { key: "light", name: "照明" },
  { key: "socket", name: "插座" },
  { key: "ac", name: "空调" },
];

const ENTITIES: EntityDef[] = [
  ...CIRCUITS.flatMap<EntityDef>((c) => [
    { key: c.key, name: c.name, domain: "switch", deviceClass: "outlet" },
    {
      key: `${c.key}_power`,
      name: `${c.name}功率`,
      domain: "sensor",
      deviceClass: "power",
      unit: "W",
      stateClass: "measurement",
    },
  ]),
  {
    key: "meter",
    name: "电能表",
    domain: "sensor",
    deviceClass: "energy",
    unit: "kWh",
    stateClass: "total_increasing",
  },
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
  if (Math.random() < 0.02) relay.light = !relay.light;
  if (Math.random() < 0.015) relay.socket = !relay.socket;

  const on = (k: Key) => (relay[k] ? 1 : 0);
  const power = {
    light: on("light") * 55,
    socket: on("socket") * (12 + kettle()),
    ac: on("ac") * 900,
  };
  return power;
}

let ws: WebSocket | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let backoff = 1000;

const send = (m: UpMsg) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m));

function tick() {
  const ts = Math.floor(Date.now() / 1000);
  const power = sample();
  // 电能表按功率积分累计，重启不归零
  meter += (lastTick ? ((power.light + power.socket + power.ac) * (ts - lastTick)) / 3.6e6 : 0);
  lastTick = ts;

  send({
    type: "state",
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

function onDown(m: DownMsg) {
  if (m.type !== "action") return;
  if (!FAULT) {
    relay[m.key] = m.action === "turn_on" ? true : m.action === "turn_off" ? false : !relay[m.key];
  }
  send({ type: "ack", ts: Math.floor(Date.now() / 1000), callId: m.callId, ok: true });
}

function connect() {
  ws = new WebSocket(`${HOST}?deviceId=${encodeURIComponent(DEVICE_ID)}`);
  ws.onopen = () => {
    backoff = 1000;
    lastTick = 0;
    send({
      type: "hello",
      deviceId: DEVICE_ID,
      name: NAME,
      model: "esp32-relay-3",
      fwVersion: "1.0.0",
      entities: ENTITIES,
    });
    if (!timer) timer = setInterval(tick, INTERVAL * 1000);
    console.log(`✅ ${DEVICE_ID} 已接入 ${HOST}`);
  };
  ws.onmessage = (e) => onDown(JSON.parse(String(e.data)) as DownMsg);
  ws.onclose = () => {
    if (timer) clearInterval(timer);
    timer = null;
    console.log(`🔌 ${DEVICE_ID} 断开，${backoff / 1000}s 后重连`);
    setTimeout(connect, backoff);
    backoff = Math.min(backoff * 2, 30_000);
  };
}

connect();
