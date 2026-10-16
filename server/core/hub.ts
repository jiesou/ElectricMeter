import type { WSContext } from "hono/ws";
import type {
  AckActionSwitchMessage,
  Device,
  EntitiesMessage,
  Entity,
  WSMessage,
  WSMessageHandler,
} from "@em/shared";
import { db } from "./db.ts";
import { now } from "./util.ts";

/** 所有设备：库是底账，这里是运行期那份（连接 + 读数 + 最后说话时间） */
export const devices = new Map<
  string,
  Device & { ws?: WSContext; entities: Map<string, Entity> }
>();

/** 有读数进来就喊一声：SSE 这类只读的推流端各自挂上来 */
export const onUpdate: (() => void)[] = [];

/** 给某台设备发一条报文。它不在线就丢掉，连上时会把当前的数补给它 */
export function sendTo(device_id: string, m: WSMessage) {
  devices.get(device_id)?.ws?.send(JSON.stringify(m));
}

// 服务器启动：库里的设备与实体全读进来，之后只有连接和读数在变
for (const d of await db.device.findMany({
  orderBy: { id: "asc" },
  include: { entities: { orderBy: { id: "asc" } } },
})) {
  const entities = d.entities.map(
    (e) =>
      [
        e.id,
        // 库里的 null 换成 undefined：读不到的字段就是没有，别输出一串 null
        {
          ...e,
          type: e.type as Entity["type"],
          state: e.state ?? undefined,
          powerW: e.powerW ?? undefined,
          energyKwh: e.energyKwh ?? undefined,
          inCount: e.inCount ?? undefined,
          outCount: e.outCount ?? undefined,
          netCount: e.netCount ?? undefined,
          ts: e.ts ?? undefined,
        },
      ] as const,
  );
  devices.set(d.id, {
    ...d,
    ip: d.ip ?? "",
    online: false,
    lastSeen: 0,
    entities: new Map(entities),
  });
}

const handlers: WSMessageHandler[] = []; // 谁关心谁注册：每个处理器自己认报文类型

handlers.push((_device, reply, m) => {
  if (m.type === "pub_alive") reply({ type: "ack_alive", ts: now() });
});

/**
 * 板子自己有什么。连上把每个实体的 name/type 报一遍，之后按字段部分更新，没提到的字段保持原样。
 * 报来的都写回库，所以内存这张表始终就是库那张表。
 * 每条实体算哪台设备由报文里的 device_id 说了算，没带就用这条连接的身份 —— 大屏就是这样替各台设备报数的。
 */
handlers.push(async (device, _reply, m) => {
  if (m.type !== "pub_entities") return;
  for (const e of (m as EntitiesMessage).entities) {
    // 实体自己指了设备就听它的，没指就报在这条连接的设备名下
    const device_id = e.device_id ?? device.id;
    const target = devices.get(device_id);
    if (!target) throw new Error(`实体 ${e.id} 报了不存在的设备: ${device_id}`);
    const old = target.entities.get(e.id);
    const type = e.type ?? old?.type;
    if (!type) continue; // 没申报过身份，这条读数丢掉
    const row = {
      device_id,
      id: e.id,
      name: e.name ?? old?.name ?? e.id,
      type,
      state: e.state ?? old?.state,
      powerW: e.powerW ?? old?.powerW,
      energyKwh: e.energyKwh ?? old?.energyKwh,
      inCount: e.inCount ?? old?.inCount,
      outCount: e.outCount ?? old?.outCount,
      netCount: e.netCount ?? old?.netCount,
      ts: e.ts ?? old?.ts,
    };
    target.entities.set(e.id, row);
    // 人数是替房间报的：那间房自己的设备要能看到自己的数
    if (row.type === "people-counter" && device_id !== device.id)
      sendTo(device_id, { type: "pub_entities", ts: now(), entities: [row] });
    await db.entity.upsert({
      where: { device_id_id: { device_id, id: e.id } },
      create: row,
      update: {
        name: row.name,
        type: row.type,
        state: row.state,
        powerW: row.powerW,
        energyKwh: row.energyKwh,
        inCount: row.inCount,
        outCount: row.outCount,
        netCount: row.netCount,
        ts: row.ts,
      },
    });
  }
  for (const notify of onUpdate) notify();
});

/** 设备干完活回执：回执里的 state 就是实体现在的状态，写回内存与库，顺手推给网页 */
handlers.push(async (device, _reply, m) => {
  if (m.type !== "ack_action_switch") return;
  const { id, state } = m as AckActionSwitchMessage;
  const row = devices.get(device.id)?.entities.get(id);
  if (row?.type !== "switch") return;
  row.state = state;
  row.ts = m.ts ?? now();
  await db.entity.update({
    where: { device_id_id: { device_id: device.id, id } },
    data: { state, ts: row.ts },
  });
  for (const notify of onUpdate) notify();
});

export async function connect(device_id: string, ws: WSContext, ip = "") {
  // 先登记连接再写库：板子的第一条消息可能比这次写库更早到
  let device = devices.get(device_id);
  if (device) {
    device.ip = ip;
    device.online = true;
    device.ws = ws;
    device.lastSeen = now();
  } else {
    // 设备名由服务端分配，新设备先拿 id 顶
    device = {
      id: device_id,
      name: device_id,
      ip,
      online: true,
      lastSeen: now(),
      ws,
      entities: new Map(),
    };
    devices.set(device_id, device);
  }
  await db.device.upsert({
    where: { id: device_id },
    create: { id: device_id, name: device_id, ip },
    update: { ip },
  });

  // 刚连上先把当前的人数补给它，不然要等下一个人跨线才有数
  const people = [...device.entities.values()].filter(
    (e) => e.type === "people-counter",
  );
  if (people.length)
    sendTo(device_id, { type: "pub_entities", ts: now(), entities: people });
  for (const notify of onUpdate) notify();
}

export function disconnect(device_id: string) {
  const device = devices.get(device_id);
  if (!device) return;
  device.online = false;
  device.ws = undefined;
  for (const notify of onUpdate) notify();
}

export async function handleMessage(device_id: string, raw: string) {
  const device = devices.get(device_id);
  if (!device) return; // 连接已经不在了，这条丢掉
  device.lastSeen = now();
  const m = JSON.parse(raw) as WSMessage;
  for (const handle of handlers)
    await handle(device, (r) => device.ws?.send(JSON.stringify(r)), m);
}

const HEARTBEAT_TIMEOUT = 10; // 心跳超时（秒）：板子 3s 一拍，10s 没动静就当它失联
const HEARTBEAT_CHECK_INTERVAL = 2000; // 心跳检查间隔（毫秒）

/** 断电断网时 TCP 不会断，光等 onClose 是等不到的，得自己看表 */
export function checkOffline() {
  for (const [id, d] of devices) {
    if (!d.ws || now() - d.lastSeen <= HEARTBEAT_TIMEOUT) continue;
    console.log(`设备 ${id} 失联 ${now() - d.lastSeen}s，断开`);
    try {
      d.ws.close(4000, "heartbeat timeout");
    } catch {
      // 关不掉就算了，下面照样标离线
    }
    disconnect(id);
  }
}

export function startHeartbeat() {
  setInterval(checkOffline, HEARTBEAT_CHECK_INTERVAL);
}
