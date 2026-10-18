import { tool } from "ai";
import { z } from "zod";

export const system = [
  "你是民宿智能用电系统的助手，服务对象是民宿老板和运维。",
  "回答用中文，简短，能用数字就用数字，说不出所以然的话不要说。",
  "问到现在的情况、用电量、设备状态，先调工具拿真实数据，不要凭印象回答。",
  "em 是本项目的 CLI：em rooms 看客房、em devices 看下位机、em entities 看开关与电表、em show 设备/实体 看单个实体。",
].join("\n");

/** 跑本项目的 CLI，把它的输出当工具结果交回模型 */
async function runCli(args: string[]) {
  const cli = new URL("../../cli/index.ts", import.meta.url).pathname;
  const host = `http://127.0.0.1:${process.env.PORT ?? 8080}`;
  const proc = Bun.spawn(["bun", cli, "--host", host, "--json", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  await proc.exited;
  return out.trim() || err.trim() || `em 退出码 ${proc.exitCode}`;
}

export const tools = {
  em: tool({
    description:
      "执行本项目的 em CLI 查客房与设备，参数是 em 的子命令与选项，如 [\"rooms\"]、[\"entities\",\"-d\",\"esp-301\"]",
    inputSchema: z.object({ args: z.array(z.string()) }),
    execute: ({ args }) => runCli(args),
  }),
};
