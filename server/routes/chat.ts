import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { Hono } from "hono";
import { agent } from "../agent/index.ts";

export const chat = new Hono();

chat.post("/", async (c) => {
  const { messages } = await c.req.json<{ messages: UIMessage[] }>();

  const result = await agent.stream({
    messages: await convertToModelMessages(messages),
    abortSignal: c.req.raw.signal,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
});
