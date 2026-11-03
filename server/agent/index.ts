import { join } from "node:path";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { Experimental_Agent as Agent, tool } from "ai";
import { z } from "zod";

export const system = [
  "你是民宿智能用电系统的助手，服务对象是民宿老板和运维。",
  "回答用中文，简短，能用数字就用数字，说不出所以然的话不要说。",
  "em 是本项目的 CLI 控制工具。即“智能电能表”。",
  "要按顺序做事时，一次只调一个工具，看到结果再调下一个；缓启动/逐个上电就是 action、sleep、再 action。",
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
      "执行 ElectricMeter 的 em CLI，查状态或下指令；参数是子命令与选项，如 [\"rooms\"]、[\"show\",\"esp-301/light\"]、[\"action\",\"on\",\"esp-301/light\"]、[\"sleep\",\"500\"]",
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
