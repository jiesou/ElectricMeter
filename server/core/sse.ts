import type { Context } from "hono";
import type { Point } from "./history.ts";
import { onUpdate } from "./hub.ts";

/** 连上先给一份全量，之后有读数进来才推一次 */
export function streamSnapshot(
  c: Context,
  getSnapshot: () => unknown,
  getPoints?: () => Point[],
) {
  const encoder = new TextEncoder();
  let push = (_points: Point[]) => {};
  const body = new ReadableStream({
    start(controller) {
      push = (points) => {
        try {
          // 快照只有每只表的最终值，曲线要的是一轮里那一串，分开推
          if (getPoints)
            controller.enqueue(
              encoder.encode(
                `event: points\ndata: ${JSON.stringify(points)}\n\n`,
              ),
            );
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(getSnapshot())}\n\n`),
          );
        } catch {
          onUpdate.splice(onUpdate.indexOf(push), 1);
        }
      };

      push([]);
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
