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
import { defaultModel, models } from "../agent/models.ts";

export const chat = new Hono();

chat.post("/", async (c) => {
  const { messages, model } = await c.req.json<{
    messages: UIMessage[];
    model?: string;
  }>();

  const result = streamText({
    model: models[model ?? defaultModel]!,
    system,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(10),
    abortSignal: c.req.raw.signal,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
});
