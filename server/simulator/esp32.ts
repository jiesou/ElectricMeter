import type { Entity, WSMessage } from "@em/shared";
import { ALIVE } from "@em/shared";

const DEVICE_ID = process.env.DEVICE_ID ?? "esp-301";
const HOST = process.env.WS ?? "ws://localhost:8080/ws";
const INTERVAL = Number(process.env.INTERVAL ?? 1000);

type Circuit = "light" | "kettle" | "ac";
const CIRCUITS: { id: Circuit; name: string }[] = [
  { id: "light", name: "照明" },
  { id: "kettle", name: "热水壶" },
  { id: "ac", name: "空调" },
];
const id = (c: Circuit, suffix: string) => (suffix ? `${c}-${suffix}` : c);

const relay = { light: false, kettle: true, ac: true };
const energy = { light: 2.1, kettle: 18.4, ac: 46.2 };
const power = { light: 0, kettle: 0, ac: 0 };
let lastTick = 0;
let ws: WebSocket | null = null;
let reportTimer: ReturnType<typeof setInterval> | null = null;
let aliveTimer: ReturnType<typeof setInterval> | null = null;
let backoff = 1000;
const snap = new Map<string, Entity>();

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
  if (Math.random() < 0.01) relay.light = !relay.light;
  if (Math.random() < 0.0075) relay.kettle = !relay.kettle;
  power.light = relay.light ? 55 : 0;
  power.kettle = relay.kettle ? 12 + kettle() : 0;
  power.ac = relay.ac ? 900 : 0;
}

const send = (m: WSMessage) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m));
const now = () => Math.floor(Date.now() / 1000);

function entities(): Entity[] {
  return CIRCUITS.flatMap((c) => [
    { id: c.id, name: c.name, type: "switch", state: relay[c.id] },
    { id: id(c.id, "meter"), name: `${c.name}功率`, type: "meter", powerW: power[c.id], energyKwh: Number(energy[c.id].toFixed(2)) },
  ]);
}

function tick() {
  const ts = now();
  sample();
  const dt = lastTick ? ts - lastTick : 0;
  lastTick = ts;
  for (const c of CIRCUITS) energy[c.id] += (power[c.id] * dt) / 3.6e6;

  const fresh = entities();
  const changed: Entity[] = [];
  for (const e of fresh) {
    const old = snap.get(e.id);
    const diff: Record<string, unknown> = { id: e.id };
    for (const [key, value] of Object.entries(e)) {
      if (key !== "id" && old?.[key as keyof Entity] !== value) diff[key] = value;
    }
    if (Object.keys(diff).length > 1) changed.push(diff as unknown as Entity);
    snap.set(e.id, e);
  }
  if (changed.length) send({ type: "pub_entities", ts, entities: changed });
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
    lastTick = 0;
    sample();
    const declared = entities();
    snap.clear();
    for (const e of declared) snap.set(e.id, e);
    send({ type: "pub_entities", ts: now(), entities: declared });
    reportTimer = setInterval(tick, INTERVAL);
    aliveTimer = setInterval(() => send({ type: "pub_alive", ts: now() }), ALIVE * 1000);
    console.log(`${DEVICE_ID} 已接入 ${HOST}`);
  };
  ws.onclose = () => {
    stopTimers();
    console.log(`${DEVICE_ID} 已断开，${backoff / 1000}s 后重连`);
    setTimeout(connect, backoff);
    backoff = Math.min(backoff * 2, 30_000);
  };
}

connect();
