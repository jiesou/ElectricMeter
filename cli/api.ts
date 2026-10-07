import type { Device, Entity } from "@em/shared";
import type { Room } from "./types.ts";

/** 把所有错误变成带可读 message 的异常，入口统一打印并退出码 1 */
export class CliError extends Error {}

export interface Api {
  get<T>(path: string): Promise<T>;
  sse<T>(path: string, on: (snapshot: T) => void): Promise<void>;
}

/** 服务器地址：--host 参数 > EM_HOST 环境变量 > 本机默认 */
export function resolveHost(flag?: string): string {
  const host = flag ?? process.env.EM_HOST ?? "http://localhost:8080";
  return host.replace(/\/+$/, "");
}

/** REST + SSE 客户端，错误文案一处收口 */
export function createApi(host: string): Api {
  const base = `${host}/api`;

  const open = async (path: string): Promise<Response> => {
    let res: Response;
    try {
      res = await fetch(base + path);
    } catch {
      throw new CliError(
        `连不上 ${host}，先起 server：bun run --cwd server dev（或用 --host= / EM_HOST= 指定地址）`,
      );
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new CliError(body?.error ?? `${path} → HTTP ${res.status}`);
    }
    return res;
  };

  return {
    async get<T>(path: string): Promise<T> {
      const res = await open(path);
      return (await res.json()) as T;
    },

    /** SSE 快照流：连上立即收到一次全量，之后每秒一次完整快照 */
    async sse<T>(path: string, on: (snapshot: T) => void): Promise<void> {
      const res = await open(path);
      const dec = new TextDecoder();
      let buf = "";
      for await (const chunk of res.body!) {
        buf += dec.decode(chunk, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const data = part.split("\n").find((l) => l.startsWith("data: "))?.slice(6);
          if (data) on(JSON.parse(data) as T);
        }
      }
    },
  };
}

export type { Device, Entity, Room };
