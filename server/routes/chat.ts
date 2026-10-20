import { createDeepSeek } from "@ai-sdk/deepseek";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { Hono } from "hono";
import { system, tools } from "../agent/index.ts";

const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });

export const chat = new Hono();

chat.post("/", async (c) => {
  const { messages } = await c.req.json<{ messages: UIMessage[] }>();

  const result = streamText({
    model: deepseek("deepseek-flash"),
    system,
    messages: await convertToModelMessages(messages),
    tools,
    abortSignal: c.req.raw.signal,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
});
