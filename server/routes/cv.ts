import { Hono } from "hono";
import { getLatestFrame } from "../core/udp_camera.ts";

export const cv = new Hono();

/** MJPEG 流：浏览器 <img src="/api/cv/stream"> 就能看大屏推上来的画面 */
cv.get("/stream", (c) => {
  let timer: ReturnType<typeof setInterval> | null = null;

  const body = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      timer = setInterval(() => {
        const frame = getLatestFrame();
        if (!frame) return;
        try {
          controller.enqueue(encoder.encode(
            `--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`,
          ));
          controller.enqueue(frame);
          controller.enqueue(encoder.encode("\r\n"));
        } catch {
          if (timer) clearInterval(timer);
        }
      }, 100); // 10fps
    },
    cancel() {
      if (timer) clearInterval(timer);
    },
  });

  return c.newResponse(body, {
    headers: {
      "Content-Type": "multipart/x-mixed-replace; boundary=frame",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
});
