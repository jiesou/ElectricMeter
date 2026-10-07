import { expect, test } from "bun:test";
import { serveApp } from "../server/testkit.ts";
import { now } from "../server/core/util.ts";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 端到端验收：真 server（真 hub/路由/db）+ 真子进程 CLI，不经过任何 stub */
test("cli 连真 server：设备上报 → 总览/清单/详情/JSON/watch 全链路", async () => {
  const server = serveApp();
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

  // 一台真下位机经 WS 接入并上报
  const ws = new WebSocket(`ws://127.0.0.1:${server.port}/ws?device_id=esp-905`);
  await new Promise((r) => (ws.onopen = r));
  await delay(50);
  ws.send(
    JSON.stringify({
      type: "pub_entities",
      ts: now(),
      entities: [
        { id: "light", name: "照明", type: "switch", state: true },
        { id: "ac-meter", name: "空调电表", type: "meter", powerW: 900, energyKwh: 46.2 },
      ],
    }),
  );
  await delay(200);

  const overview = await em([]);
  expect(overview.exitCode).toBe(0);
  expect(overview.stdout).toContain("esp-905");
  expect(overview.stdout).toContain("900 W");

  expect((await em(["devices"])).stdout).toContain("esp-905");

  const list = await em(["entities", "--device=esp-905"]);
  expect(list.stdout).toContain("esp-905/light");
  expect(list.stdout).toContain("通电");

  expect((await em(["show", "esp-905/ac-meter"])).stdout).toContain("空调电表");

  const rooms = JSON.parse((await em(["--json", "rooms"])).stdout);
  expect(rooms.find((r: any) => r.id === "esp-905")).toMatchObject({ power: 900, energy: 46.2 });

  const bad = await em(["show", "esp-905/nope"]);
  expect(bad.exitCode).toBe(1);
  expect(bad.stderr).toContain("未知实体: esp-905/nope");

  // watch：SSE 快照流第一帧就应包含刚接入的房间，读到即杀
  const watch = Bun.spawn(["bun", "index.ts", "watch"], {
    cwd: import.meta.dir,
    env: { ...process.env, EM_HOST: `http://localhost:${server.port}`, NO_COLOR: "1" },
    stdout: "pipe",
  });
  const reader = watch.stdout.getReader();
  const dec = new TextDecoder();
  let frame = "";
  for (let i = 0; i < 20 && !frame.includes("esp-905"); i++) {
    const { value, done } = await reader.read();
    if (done) break;
    frame += dec.decode(value, { stream: true });
  }
  expect(frame).toContain("esp-905");
  watch.kill();

  ws.close();
  server.stop(true);
}, 20000);
