import { createSocket } from "node:dgram";

/**
 * UDP 图传接收：8 字节小端包头（frame_index u32 + chunk_index u16 + chunk_total u16）+ JPEG 分片。
 * 逐行照老项目 server/UdpCameraServer.ts 的逻辑，只是把「更新所有 cvClient」换成一份最新帧。
 */

let latestFrame: Uint8Array | null = null;
const frameBuffer = new Map<number, Map<number, Uint8Array>>();

export function getLatestFrame(): Uint8Array | null {
  return latestFrame;
}

export function startUdpCamera(port = 8080): void {
  const socket = createSocket("udp4");

  socket.on("error", (err) => console.error("[udp_camera] UDP socket 错误:", err));
  socket.on("message", (msg) => processPacket(msg));
  socket.on("listening", () => console.log(`udp      udp://localhost:${port}`));

  socket.bind(port);
}

function processPacket(data: Uint8Array): void {
  if (data.length < 8) return;

  const frameIndex = data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24);
  const chunkIndex = data[4] | (data[5] << 8);
  const chunkTotal = data[6] | (data[7] << 8);

  if (!frameBuffer.has(frameIndex)) frameBuffer.set(frameIndex, new Map());
  frameBuffer.get(frameIndex)!.set(chunkIndex, data.slice(8));

  cleanupBuffer();

  const chunks = frameBuffer.get(frameIndex)!;
  if (chunks.size !== chunkTotal) return;

  // 缺一片就丢整帧
  const ordered: Uint8Array[] = [];
  for (let i = 0; i < chunkTotal; i++) {
    const chunk = chunks.get(i);
    if (!chunk) {
      frameBuffer.delete(frameIndex);
      return;
    }
    ordered.push(chunk);
  }

  const total = ordered.reduce((sum, chunk) => sum + chunk.length, 0);
  const frame = new Uint8Array(total);
  let offset = 0;
  for (const chunk of ordered) {
    frame.set(chunk, offset);
    offset += chunk.length;
  }
  latestFrame = frame;

  frameBuffer.delete(frameIndex);
}

/** 只留最近 5 帧的缓存：没有超时、没有重传 */
function cleanupBuffer(): void {
  if (frameBuffer.size === 0) return;

  const newest = Math.max(...frameBuffer.keys());
  for (const frameIndex of frameBuffer.keys()) {
    if (newest - frameIndex > 5) frameBuffer.delete(frameIndex);
  }
}
