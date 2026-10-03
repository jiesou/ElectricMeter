import { upgradeWebSocket } from "@hono/bun";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { connect, disconnect, handleMessage } from "./core/hub.ts";
import { api } from "./routes/api.ts";

export const app = new Hono();
app.use("/api/*", cors());
app.route("/api", api);

/** 下位机只出站，连上即绑定身份 */
app.get(
  "/ws",
  upgradeWebSocket((c) => {
    const device_id = c.req.query("device_id");
    if (!device_id) throw new Error("缺少 device_id");
    return {
      onOpen(_e, ws) {
        const raw = ws.raw as { remoteAddress?: string } | undefined;
        void connect(device_id, ws, raw?.remoteAddress ?? "");
      },
      onMessage(e) {
        void handleMessage(device_id, String(e.data));
      },
      onClose() {
        disconnect(device_id);
      },
    };
  }),
);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: String(err) }, 500);
});
