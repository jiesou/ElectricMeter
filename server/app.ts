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
    const deviceId = c.req.query("deviceId");
    if (!deviceId) throw new Error("缺少 deviceId");
    return {
      onOpen(_e, ws) {
        connect(deviceId, ws);
      },
      onMessage(e) {
        handleMessage(deviceId, String(e.data));
      },
      onClose(_e, ws) {
        disconnect(deviceId, ws);
      },
    };
  }),
);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: String(err) }, 500);
});
