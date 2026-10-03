import { Hono } from "hono";
import { now } from "../core/util.ts";
import { devices } from "./devices.ts";
import { entities } from "./entities.ts";

export const api = new Hono();

api.get("/health", (c) => c.json({ status: "ok", ts: now() }));

api.route("/devices", devices);
api.route("/entities", entities);
