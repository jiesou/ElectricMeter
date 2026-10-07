import { expect, test } from "bun:test";
import { rooms, startStub } from "./stub.ts";

/** 起真子进程跑 bin 入口：EM_HOST 指向进程内 stub server。
 *  必须异步 spawn——spawnSync 会冻住父进程事件循环，stub 就没法应答子进程的请求了 */
const server = startStub();
const em = async (args: string[]) => {
  const proc = Bun.spawn(["bun", "index.ts", ...args], {
    cwd: import.meta.dir,
    env: { ...process.env, EM_HOST: `http://localhost:${server.port}`, NO_COLOR: "1" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
};

test("无参数默认进总览", async () => {
  const p = await em([]);
  expect(p.exitCode).toBe(0);
  expect(p.stdout).toContain("301 房");
});

test("rooms 表格与合计", async () => {
  const out = (await em(["rooms"])).stdout;
  expect(out).toContain("955 W");
  expect(out).toContain("79.04 kWh");
});

test("--json 前置后置都生效", async () => {
  expect(JSON.parse((await em(["--json", "rooms"])).stdout)).toEqual(rooms);
  expect(JSON.parse((await em(["rooms", "--json"])).stdout)).toEqual(rooms);
});

test("devices / entities / show", async () => {
  expect((await em(["devices"])).stdout).toContain("192.168.1.31");
  const list = (await em(["entities", "--device=esp-301"])).stdout;
  expect(list).toContain("esp-301/light");
  expect(list).toContain("通电");
  expect((await em(["show", "esp-301/light"])).stdout).toContain("照明");
});

test("未知实体：文案透出，退出码 1", async () => {
  const p = await em(["show", "esp-301/nope"]);
  expect(p.exitCode).toBe(1);
  expect(p.stderr).toContain("未知实体: esp-301/nope");
});

test("实体引用格式错：提示写法", async () => {
  const p = await em(["show", "light"]);
  expect(p.exitCode).toBe(1);
  expect(p.stderr).toContain("设备/实体");
});

test("未知命令：拼写建议，非零退出", async () => {
  const p = await em(["entitie"]);
  expect(p.exitCode).not.toBe(0);
  expect(p.stderr).toContain("Did you mean");
});

test("连不上服务器：给启动提示", async () => {
  const proc = Bun.spawn(["bun", "index.ts", "rooms"], {
    cwd: import.meta.dir,
    env: { ...process.env, EM_HOST: "http://localhost:1", NO_COLOR: "1" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stderr, exitCode] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
  expect(exitCode).toBe(1);
  expect(stderr).toContain("连不上");
});

test("--help 列出全部命令与全局参数", async () => {
  const out = (await em(["--help"])).stdout;
  for (const k of ["rooms", "devices", "entities", "show", "watch", "--json", "--host"]) {
    expect(out).toContain(k);
  }
});
