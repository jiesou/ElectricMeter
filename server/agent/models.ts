import { createDeepSeek } from "@ai-sdk/deepseek";
import type { LanguageModel } from "ai";

const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });

export const models: Record<string, LanguageModel> = {
  "deepseek-flash": deepseek("deepseek-flash")
};

export const defaultModel = "deepseek-flash";
