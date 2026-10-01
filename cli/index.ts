#!/usr/bin/env bun
/**
 * em —— ElectricMeter 用电管理 CLI
 *
 *   em                      总览：每台设备的在线状态、当前功率、今日用电
 *   em entities [--domain=] [--device=]   实体清单
 *   em show <ref>            单个实体
 *   em on|off|toggle <ref>   远程通断，传 --device=esp-301 就是整房断电
 *   em power <ref> [--hours=1]   功率波形 + 分时电量
 *   em history <ref>         开关动作时间线
 *   em watch                 实时事件流
 *
 * 全局 --json 输出原始 JSON，将来包一层 MCP 就是现成的工具描述。
 */
import type { Action, Device, Entity, Event, StatSeries, Target } from "@em/shared";
import { bars, c, clock, fail, pad, power, spark, table } from "./format.ts";

const HOST = process.env.EM_HOST ?? "http://localhost:8080";
const argv = process.argv.slice(2);
const JSON_OUT = argv.includes("--json");
const args = argv.filter((a) => a !== "--json");
const flag = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const now = () => Math.floor(Date.now() / 1000);

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${HOST}/api${path}`);
  if (!r.ok) fail(`${path} → ${r.status} ${(await r.text()).slice(0, 120)}`);
  return r.json();
}

const dump = (v: unknown) => console.log(JSON.stringify(v, null, 2));
const stateText = (e: Entity) =>
  e.kind === "relay" ? (e.state ? c.green("通") : c.gray("断")) : `${Number(e.state).toFixed(1)} ${e.unit ?? ""}`.trim();

type DeviceRow = Device & { power: number; energy: number };

/** 总览：一台设备一行，末尾合计 */
async function overview() {
  const rows = await get<DeviceRow[]>("/devices");
  if (JSON_OUT) return dump(rows);
  const sum = rows.reduce(
    (a, r) => ({ power: a.power + (r.online ? r.power : 0), energy: a.energy + r.energy }),
    { power: 0, energy: 0 },
  );
  table(
    ["DEVICE", "名称", "型号", "固件", "在线", "当前功率", "今日用电"],
    [
      ...rows.map((d) => [
        c.bold(d.id),
        d.name,
        d.model ?? c.gray("—"),
        d.fwVersion ?? c.gray("—"),
        d.online ? c.green("是") : c.red("否"),
        d.online ? power(d.power) : c.gray("—"),
        c.bold(`${d.energy.toFixed(3)} kWh`),
      ]),
      [c.dim("合计"), "", "", "", "", c.dim(power(sum.power)), c.dim(`${sum.energy.toFixed(3)} kWh`)],
    ],
    [5, 6],
  );
}

async function entities() {
  const q = new URLSearchParams();
  for (const k of ["kind", "device"]) {
    const v = flag(k);
    if (v) q.set(k, v);
  }
  const rows = await get<Entity[]>(`/entities${q.size ? `?${q}` : ""}`);
  if (JSON_OUT) return dump(rows);
  if (!rows.length) return console.log(c.gray("没有匹配的实体"));
  table(
    ["REF", "名称", "类型", "单位", "状态"],
    rows.map((e) => [e.ref, e.name, e.kind, e.unit ?? c.gray("—"), stateText(e)]),
    [4],
  );
}

async function show(ref: string) {
  const e = await get<Entity>(`/entities/${ref}`);
  if (JSON_OUT) return dump(e);
  console.log(`${c.bold(e.name)}  ${c.dim(e.ref)}`);
  console.log(`  类型    ${e.kind}${e.unit ? ` · ${e.unit}` : ""}`);
  console.log(`  状态    ${stateText(e)}`);
  console.log(`  设备    ${e.deviceId}`);
  console.log(`  更新时间 ${clock(e.ts)}`);
}

async function call(action: Action) {
  const pos = args[1] && !args[1].startsWith("--") ? args[1] : undefined;
  const target: Target = pos ? { entity: pos } : { device: flag("device") ?? "" };
  const r = await fetch(`${HOST}/api/actions/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(target),
  });
  const j = await r.json();
  if (JSON_OUT) return dump(j);
  if (!r.ok) fail(j.error ?? "下发失败");
  if (!j.sent) return console.log(c.red(`✗ 没有可开关的目标（或设备离线）`));
  console.log(`${c.green("✓")} 下发 ${j.sent} 条，回执 ${j.acked} 条  ${c.dim(j.refs.join("  "))}`);
}

async function powerChart(ref: string) {
  const to = now();
  const from = to - Number(flag("hours") ?? 1) * 3600;
  const [s, e] = await Promise.all([
    get<StatSeries>(`/statistics/${ref}?from=${from}&to=${to}`),
    get<Entity>(`/entities/${ref}`),
  ]);
  if (JSON_OUT) return dump(s);
  console.log(`${c.bold(e.name)}  ${c.dim(ref)}  ${c.dim(`${s.points.length} 个 ${s.bucket} 秒桶`)}`);
  if (!s.points.length) return console.log(c.gray("  还没有数据——采样满一个桶才会落库"));
  const mean = s.points.reduce((a, p) => a + p.mean, 0) / s.points.length;
  const hours = new Map<number, number>();
  for (const p of s.points) {
    const h = Math.floor(p.ts / 3600) * 3600;
    hours.set(h, (hours.get(h) ?? 0) + p.sum / 3.6e6);
  }
  console.log(
    `\n  功率  ${c.dim(`时均 ${mean.toFixed(0)} W   峰值 ${Math.max(...s.points.map((p) => p.max)).toFixed(0)} W`)}`,
  );
  console.log(`  ${c.green(spark(s.points.map((p) => p.mean)))}`);
  if (hours.size > 1) {
    console.log(`\n  电量  ${c.dim("瓦秒积分 ÷ 3.6e6")}`);
    bars([...hours].map(([h, v]) => [clock(h), v] as [string, number]), " kWh");
  }
}

async function history(ref: string) {
  const to = now();
  const from = to - Number(flag("hours") ?? 24) * 3600;
  const j = await get<{ states: { ts: number; state: string }[] }>(`/history/${ref}?from=${from}&to=${to}`);
  if (JSON_OUT) return dump(j);
  if (!j.states.length) return console.log(c.gray("这段时间没有开关动作"));
  table(
    ["时间", "状态", "持续"],
    j.states.map((s, i) => [
      clock(s.ts),
      s.state === "true" ? c.green("通") : c.gray("断"),
      j.states[i + 1] ? `${j.states[i + 1].ts - s.ts}s` : c.gray("至今"),
    ]),
  );
}

async function watch() {
  const r = await fetch(`${HOST}/api/events`);
  if (!r.ok) fail("连不上事件流");
  console.log(c.dim("实时事件流，Ctrl-C 退出"));
  const dec = new TextDecoder();
  let buf = "";
  for await (const chunk of r.body!) {
    buf += dec.decode(chunk, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      const data = part.split("\n").find((l) => l.startsWith("data: "))?.slice(6);
      if (!data) continue;
      if (JSON_OUT) console.log(data);
      else showEvent(JSON.parse(data) as Event);
    }
  }
}

function showEvent(e: Event) {
  const t = c.dim(clock(e.ts));
  if (e.type === "state") {
    const v =
      e.kind === "relay" ? (e.state ? c.green("通") : c.gray("断")) : c.bold(`${Number(e.state).toFixed(1)} ${e.unit ?? ""}`.trim());
    console.log(`${t} ${pad(e.ref, 22)} ${pad(e.name, 10)} ${pad(v, 12)}`);
  } else {
    console.log(`${t} ${pad(e.deviceId, 22)} ${e.online ? c.green("上线") : c.red("掉线")}`);
  }
}

const HELP = `${c.bold("em")}  ElectricMeter 用电管理

  em                            总览：设备在线、当前功率、今日用电
  em entities [--kind=relay|meter] [--device=esp-301]   实体清单
  em show <ref>                 单个实体
  em on|off|toggle <ref>        远程通断，传 --device=esp-301 就是整房断电
  em power <ref> [--hours=1]    功率波形 + 分时电量
  em history <ref>              开关动作时间线
  em watch                      实时事件流
  em help                       这份帮助

  --json                        输出原始 JSON`;

const [cmd, ...rest] = args;
const commands: Record<string, () => unknown> = {
  entities,
  show: () => show(rest[0] ?? fail("用法: em show <ref>")),
  on: () => call("turn_on"),
  off: () => call("turn_off"),
  toggle: () => call("toggle"),
  power: () => powerChart(rest[0] ?? fail("用法: em power <ref>")),
  history: () => history(rest[0] ?? fail("用法: em history <ref>")),
  watch,
  help: () => console.log(HELP),
};

if (cmd) {
  const run = commands[cmd];
  if (run) await run();
  else console.log(HELP);
} else {
  await overview();
}
