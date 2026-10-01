import { upgradeWebSocket } from "@hono/bun";
import { Hono } from "hono";
import { cors } from "hono/cors";
import * as hub from "./core/hub.ts";
import { api } from "./routes/api.ts";

export const app = new Hono();
app.use("/api/*", cors());
app.route("/api", api);

/** 下位机只出站，连上即自报身份和实体清单 */
app.get(
  "/ws",
  upgradeWebSocket((c) => {
    const deviceId = c.req.query("deviceId");
    if (!deviceId) throw new Error("缺少 deviceId");
    return {
      onOpen(_e, ws) {
        hub.connect(deviceId, ws);
      },
      onMessage(e, ws) {
        hub.onMessage(deviceId, ws, String(e.data));
      },
      onClose(_e, ws) {
        hub.disconnect(deviceId, ws);
      },
    };
  }),
);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: String(err) }, 500);
});
