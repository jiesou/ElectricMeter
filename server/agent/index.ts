import { join } from "node:path";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { Experimental_Agent as Agent, tool } from "ai";
import { z } from "zod";

export const system = [
  "你是民宿智能用电系统的助手，服务对象是民宿老板和运维。",
  "回答用中文，简短，能用数字就用数字，说不出所以然的话不要说。",
  "问到现在的情况、用电量、设备状态，先调工具拿真实数据，不要凭印象回答。",
  "em 是本项目的 CLI 控制工具。即“智能电能表”",
].join("\n");

/** 跑本项目的 CLI，把它的输出当工具结果交回模型 */
async function runCli(args: string[]) {
  const cli = join(import.meta.dirname, "../../cli/index.ts");
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
  electricmeter: tool({
    description:
      "执行 ElectricMeter 查客房与设备，参数是 em CLI 的子命令与选项，如 [\"rooms\"]、[\"entities\",\"-d\",\"esp-301\"]",
    inputSchema: z.object({ args: z.array(z.string()) }),
    execute: ({ args }) => runCli(args),
  }),
};

const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });

export const agent = new Agent({
  model: deepseek("deepseek-flash"),
  instructions: system,
  tools,
});
