import type { Context } from "hono";
import { onUpdate } from "./hub.ts";

/** 连上先给一份全量，之后有读数进来才推一次 */
export function streamSnapshot(c: Context, getSnapshot: () => unknown) {
  const encoder = new TextEncoder();
  let push = () => {};
  const body = new ReadableStream({
    start(controller) {
      push = () => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(getSnapshot())}\n\n`),
          );
        } catch {
          onUpdate.splice(onUpdate.indexOf(push), 1);
        }
      };

      push();
      onUpdate.push(push);
    },
    cancel() {
      onUpdate.splice(onUpdate.indexOf(push), 1);
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
