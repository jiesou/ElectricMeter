import type { Context } from "hono";

export function streamSnapshot(c: Context, getSnapshot: () => unknown) {
  let timer: ReturnType<typeof setInterval> | undefined;
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      const send = () => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(getSnapshot())}\n\n`));
        } catch {
          if (timer) clearInterval(timer);
        }
      };

      send();
      timer = setInterval(send, 1000);
    },
    cancel() {
      if (timer) clearInterval(timer);
    },
  });

  return c.newResponse(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
