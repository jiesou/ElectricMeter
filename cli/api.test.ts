import { describe, expect, test } from "bun:test";
import { CliError, createApi, resolveHost } from "./api.ts";
import { rooms, startStub } from "./stub.ts";

const server = startStub();
const api = createApi(`http://localhost:${server.port}`);

describe("resolveHost", () => {
  test("flag 覆盖环境变量覆盖默认", () => {
    process.env.EM_HOST = "http://from-env:1";
    expect(resolveHost()).toBe("http://from-env:1");
    expect(resolveHost("http://from-flag:2/")).toBe("http://from-flag:2");
    delete process.env.EM_HOST;
    expect(resolveHost()).toBe("http://localhost:8080");
  });
});

describe("api.get", () => {
  test("拿 JSON", async () => {
    expect(await api.get<typeof rooms>("/rooms")).toEqual(rooms);
  });

  test("服务端 404 文案原样透出", async () => {
    expect(api.get("/entities/esp-301/nope")).rejects.toThrow("未知实体: esp-301/nope");
  });

  test("连不上给启动提示", async () => {
    const dead = createApi("http://localhost:1");
    expect(dead.get("/rooms")).rejects.toThrow("连不上");
  });
});

describe("api.sse", () => {
  test("逐条回调快照", async () => {
    const seen: unknown[] = [];
    await api.sse<typeof rooms>("/rooms/stream", (s) => seen.push(s));
    expect(seen).toEqual([rooms, rooms]);
  });
});

test("CliError 可被识别", () => {
  expect(new CliError("x")).toBeInstanceOf(CliError);
});
