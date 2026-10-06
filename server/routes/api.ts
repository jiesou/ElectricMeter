import { Hono } from "hono";
import { now } from "../core/util.ts";
import { cv } from "./cv.ts";
import { devices } from "./devices.ts";
import { entities } from "./entities.ts";
import { rooms } from "./rooms.ts";

export const api = new Hono();

api.get("/health", (c) => c.json({ status: "ok", ts: now() }));

api.route("/cv", cv);
api.route("/devices", devices);
api.route("/entities", entities);
api.route("/rooms", rooms);
