import type { Entity, WSMessage } from "@em/shared";
import { ALIVE } from "@em/shared";

/**
 * 大屏模拟器：一台「大屏设备」替几间房报人数，形态跟 esp32.ts 一致（出站连接 + 心跳 + 断线重连）。
 * 报的实体带 device_id 指向要报的那间房，所以那些房必须先有表箱连过 —— 服务器不认这台大屏是什么。
 */

const DEVICE_ID = process.env.DEVICE_ID ?? "bigscreen";
const HOST = process.env.WS ?? "ws://localhost:8080/ws";
const INTERVAL = Number(process.env.INTERVAL ?? 2000);
// 替哪几间房报：逗号分隔。默认挑几间常见的演示房号
const ROOMS = (process.env.ROOMS ?? "esp-301,esp-302,esp-303")
  .split(",")
  .map((r) => r.trim())
  .filter(Boolean);

/** 每间房一份计数，模拟判定线跨线的进出 */
const counts = new Map(ROOMS.map((room) => [room, { inCount: 0, outCount: 0 }]));

let ws: WebSocket | null = null;
let reportTimer: ReturnType<typeof setInterval> | null = null;
let aliveTimer: ReturnType<typeof setInterval> | null = null;
let backoff = 1000;

const now = () => Math.floor(Date.now() / 1000);

const send = (m: WSMessage) =>
  ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m));

function entities(): Entity[] {
  return ROOMS.map((room) => {
    const c = counts.get(room)!;
    return {
      id: "people",
      name: "人数",
      type: "people-counter",
      inCount: c.inCount,
      outCount: c.outCount,
      // 净数由大屏自己说了算，服务器不拿 inCount - outCount 去算
      netCount: c.inCount - c.outCount,
      device_id: room,
    };
  });
}

/** 随机有人进出：进比出多一点，净数慢慢涨，演示时看得见变化 */
function walk() {
  for (const room of ROOMS) {
    const c = counts.get(room)!;
    if (Math.random() < 0.35) c.inCount++;
    if (Math.random() < 0.2 && c.outCount < c.inCount) c.outCount++;
  }
}

function tick() {
  walk();
  const ts = now();
  send({ type: "pub_entities", ts, entities: entities().map((e) => ({ ...e, ts })) });
}

function stopTimers() {
  if (reportTimer) clearInterval(reportTimer);
  if (aliveTimer) clearInterval(aliveTimer);
  reportTimer = null;
  aliveTimer = null;
}

function connect() {
  ws = new WebSocket(`${HOST}?device_id=${encodeURIComponent(DEVICE_ID)}`);
  ws.onopen = () => {
    backoff = 1000;
    const ts = now();
    send({ type: "pub_entities", ts, entities: entities().map((e) => ({ ...e, ts })) });
    reportTimer = setInterval(tick, INTERVAL);
    aliveTimer = setInterval(
      () => send({ type: "pub_alive", ts: now() }),
      ALIVE * 1000,
    );
    console.log(`${DEVICE_ID} 已接入 ${HOST}，替 ${ROOMS.join(" / ")} 报人数`);
  };
  ws.onclose = () => {
    stopTimers();
    console.log(`${DEVICE_ID} 已断开，${backoff / 1000}s 后重连`);
    setTimeout(connect, backoff);
    backoff = Math.min(backoff * 2, 30_000);
  };
}

connect();
