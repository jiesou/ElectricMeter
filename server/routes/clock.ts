import { Hono } from "hono";
import { shiftLastSeen } from "../core/hub.ts";
import { DAY, nextDay, now } from "../core/util.ts";

export const clock = new Hono();

/** 把服务器这台表往前拨一天：所有按时间算的东西跟着前进 */
clock.post("/next-day", (c) => {
  nextDay();
  shiftLastSeen(DAY);
  return c.json({ ts: now() });
});
