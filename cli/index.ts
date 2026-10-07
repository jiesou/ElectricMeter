#!/usr/bin/env bun
import { Command } from "commander";
import tab from "@bomb.sh/tab/commander";
import pc from "picocolors";
import type { Device, Entity } from "@em/shared";
import { CliError, createApi, resolveHost, type Api } from "./api.ts";
import type { Room } from "./types.ts";
import * as view from "./render.ts";

const prog = new Command()
  .name("em")
  .description("ElectricMeter 民宿用电管理 CLI")
  .version("0.1.0")
  .option("--json", "输出原始 JSON，供脚本 / MCP 使用")
  .option("--host <url>", "服务器地址（默认读 EM_HOST，再默认 http://localhost:8080）");

const json = () => Boolean(prog.opts().json);

/** 每个命令的公共外壳：建 api、打印错误、退出码 1 */
async function run(fn: (api: Api) => Promise<void>) {
  try {
    await fn(createApi(resolveHost(prog.opts().host)));
  } catch (e) {
    console.error(e instanceof CliError ? e.message : pc.red(String(e)));
    process.exit(1);
  }
}

/** 客房总览：`em` 裸跑与 `em rooms` 共用 */
async function overview(api: Api) {
  const list = await api.get<Room[]>("/rooms");
  console.log(json() ? JSON.stringify(list, null, 2) : view.rooms(list));
}

prog
  .command("rooms")
  .description("客房总览：在线、当前功率、累计电量与合计")
  .action(() => run(overview));

prog
  .command("devices")
  .description("下位机设备清单：IP、在线、最后上线")
  .action(async () => {
    await run(async (api) => {
      const list = await api.get<Device[]>("/devices");
      console.log(json() ? JSON.stringify(list, null, 2) : view.devices(list));
    });
  });

prog
  .command("entities")
  .description("实体清单：开关与电表")
  .option("-d, --device <id>", "按设备过滤，如 esp-301")
  .action(async (opts: { device?: string }) => {
    await run(async (api) => {
      const list = await api.get<Entity[]>(`/entities${opts.device ? `?device=${encodeURIComponent(opts.device)}` : ""}`);
      console.log(json() ? JSON.stringify(list, null, 2) : view.entities(list));
    });
  });

/** esp-301/light → { device_id, id } */
function parseRef(ref: string) {
  const [device_id, id] = ref.split("/");
  if (!device_id || !id) throw new CliError(`实体引用要写成 设备/实体，例如 esp-301/light：${ref}`);
  return { device_id, id };
}

prog
  .command("show")
  .description("单个实体详情")
  .argument("<ref>", "实体引用，写作 设备/实体，如 esp-301/light")
  .action(async (ref: string) => {
    await run(async (api) => {
      const { device_id, id } = parseRef(ref);
      const e = await api.get<Entity>(`/entities/${device_id}/${id}`);
      console.log(json() ? JSON.stringify(e, null, 2) : view.show(e));
    });
  });

prog
  .command("watch")
  .description("实时快照流：每秒整屏刷新，Ctrl-C 退出")
  .option("-d, --device <id>", "改看该设备的实体清单，如 esp-301")
  .action(async (opts: { device?: string }) => {
    await run(async (api) => {
      const path = opts.device
        ? `/entities/stream?device=${encodeURIComponent(opts.device)}`
        : "/rooms/stream";
      console.error(pc.dim("实时快照流，每秒刷新，Ctrl-C 退出"));
      await api.sse<Room[] | Entity[]>(path, (snap) => {
        if (json()) console.log(JSON.stringify(snap));
        else {
          process.stdout.write("\x1b[H\x1b[2J");
          console.log(opts.device ? view.entities(snap as Entity[]) : view.watchTick(snap as Room[]));
        }
      });
    });
  });

/** 生成补全：`em completion bash|zsh|fish|powershell` */
tab(prog, { completionCommandName: "completion" });

/** 裸 `em`（可带全局 flag，无子命令）= 总览；--help/--version 仍交给 commander */
const argv = process.argv.slice(2);
const bare = !argv.some((a) => ["-h", "--help", "-V", "--version"].includes(a)) && !argv.some((a) => !a.startsWith("-"));
if (bare) {
  await run(overview);
  process.exit(0);
}

prog.parse();
