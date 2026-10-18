import {
  simulateReadableStream,
  type ChatTransport,
  type UIMessage,
  type UIMessageChunk,
} from "ai";

/** 演示模式：不联网，把一段写死的对话按流式吐出来，工具卡片也是假的 */
const answer = `当前 4 间客房全部离线：

| 房间 | 在线 | 有人 | 实时功率 | 本次入住累计 |
|---|---|---|---|---|
| 301真机 | ✗ | 否 | 0 W | 0 kWh |
| esp-48aff3 | ✗ | — | 0 W | 0 kWh |
| esp-905 | ✗ | — | — | — |
| bigscreen | ✗ | — | — | — |

说明：
- 301真机 是唯一装了完整设备的房间（吹风机、热水壶、灯 + 三路电表 + 人数计数）。
- esp-48aff3 只挂了热水壶一路，看着像重复注册的影子设备。
- esp-905 的 IP 还是 127.0.0.1，没配网。
- 所有设备 lastSeen 都是 0，说明服务端重启后没收到任何心跳 —— 先查下位机联网。`;

const piece = (text: string, size = 6) =>
  Array.from({ length: Math.ceil(text.length / size) }, (_, i) =>
    text.slice(i * size, i * size + size),
  );

const chunks: UIMessageChunk[] = [
  { type: "start" },
  { type: "start-step" },
  { type: "reasoning-start", id: "r1" },
  ...piece("先看设备在线情况，再回答。").map(
    (delta): UIMessageChunk => ({ type: "reasoning-delta", id: "r1", delta }),
  ),
  { type: "reasoning-end", id: "r1" },
  {
    type: "tool-input-available",
    toolCallId: "mock-1",
    toolName: "em",
    input: { args: ["rooms"] },
  },
  {
    type: "tool-output-available",
    toolCallId: "mock-1",
    output: JSON.stringify([
      { id: "48aff3", name: "301真机", online: false, occupied: false, power: 0, energy: 0 },
      { id: "esp-48aff3", name: "esp-48aff3", online: false, occupied: false, power: 0, energy: 0 },
      { id: "esp-905", name: "esp-905", online: false, occupied: false, power: 0, energy: 0 },
    ]),
  },
  { type: "text-start", id: "t1" },
  ...piece(answer).map(
    (delta): UIMessageChunk => ({ type: "text-delta", id: "t1", delta }),
  ),
  { type: "text-end", id: "t1" },
  { type: "finish-step" },
  { type: "finish" },
];

export const mockTransport: ChatTransport<UIMessage> = {
  async sendMessages() {
    return simulateReadableStream({
      chunks,
      initialDelayInMs: 400,
      chunkDelayInMs: 30,
    });
  },
  // 演示模式没有服务端，没有流可续
  async reconnectToStream() {
    return null;
  },
};
