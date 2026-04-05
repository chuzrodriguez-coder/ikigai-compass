import OpenAI from "openai";

let _openai: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (_openai) return _openai;

  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  if (!baseURL || !apiKey) {
    throw new Error(
      "AI is not available: AI_INTEGRATIONS_OPENAI_BASE_URL and AI_INTEGRATIONS_OPENAI_API_KEY must both be set."
    );
  }

  _openai = new OpenAI({ apiKey, baseURL });
  return _openai;
}

export function isAIAvailable(): boolean {
  return !!(
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL &&
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY
  );
}
