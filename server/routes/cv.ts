import { Hono } from "hono";
import { getLatestFrame } from "../core/udp_camera.ts";

export const cv = new Hono();

/**
 * 单帧 JPEG：网页拿到一帧再要下一帧。MJPEG 那种长连接在手机 Safari 上会排队，
 * 网络一慢就攒出几秒延迟且追不回来；这样最多只落后一帧。
 * X-Seq 让网页判断这帧是不是新的，没变就不用重画。
 */
cv.get("/frame", (c) => {
  const frame = getLatestFrame();
  if (!frame) return c.body(null, 204);

  return c.newResponse(frame.data, 200, {
    "Content-Type": "image/jpeg",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "X-Seq": String(frame.seq),
  });
});
