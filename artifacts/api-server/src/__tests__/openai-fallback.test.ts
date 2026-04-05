import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("AI availability check", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("isAIAvailable returns false when env vars are absent", async () => {
    vi.stubEnv("AI_INTEGRATIONS_OPENAI_BASE_URL", "");
    vi.stubEnv("AI_INTEGRATIONS_OPENAI_API_KEY", "");
    const { isAIAvailable } = await import("../openaiClient");
    expect(isAIAvailable()).toBe(false);
  });

  it("isAIAvailable returns false when only API key is set but not base URL", async () => {
    vi.stubEnv("AI_INTEGRATIONS_OPENAI_BASE_URL", "");
    vi.stubEnv("AI_INTEGRATIONS_OPENAI_API_KEY", "sk-test");
    const { isAIAvailable } = await import("../openaiClient");
    expect(isAIAvailable()).toBe(false);
  });

  it("isAIAvailable returns true when both env vars are set", async () => {
    vi.stubEnv("AI_INTEGRATIONS_OPENAI_BASE_URL", "https://api.openai.com/v1");
    vi.stubEnv("AI_INTEGRATIONS_OPENAI_API_KEY", "sk-test-key");
    const { isAIAvailable } = await import("../openaiClient");
    expect(isAIAvailable()).toBe(true);
  });

  it("getOpenAIClient throws descriptive error when env vars are absent", async () => {
    vi.stubEnv("AI_INTEGRATIONS_OPENAI_BASE_URL", "");
    vi.stubEnv("AI_INTEGRATIONS_OPENAI_API_KEY", "");
    const { getOpenAIClient } = await import("../openaiClient");
    expect(() => getOpenAIClient()).toThrow(/AI is not available/);
  });

  it("getOpenAIClient does not throw when both env vars are set", async () => {
    vi.stubEnv("AI_INTEGRATIONS_OPENAI_BASE_URL", "https://api.openai.com/v1");
    vi.stubEnv("AI_INTEGRATIONS_OPENAI_API_KEY", "sk-test-key");
    const { getOpenAIClient } = await import("../openaiClient");
    expect(() => getOpenAIClient()).not.toThrow();
  });
});
