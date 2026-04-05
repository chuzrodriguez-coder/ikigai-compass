import { getOpenAIClient, isAIAvailable } from "../../openaiClient";
import { logAiInteraction, PROMPT_TEMPLATES } from "./logger";

export interface CoachMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface CoachStreamCallbacks {
  onChunk: (delta: string) => void;
  onDone: (fullContent: string) => void;
  onError: (err: string) => void;
}

const COACH_SYSTEM_PROMPT = `You are an Ikigai coach — wise, warm, and deeply supportive. You help people explore the meaningful intersection of what they love, what they are good at, what the world needs, and what can sustain them. You ask thoughtful questions, reflect back what you hear, and help people discover their own answers. You are not prescriptive. You are not a productivity tool. You are a guide to purpose and meaning. Keep responses concise (2-4 paragraphs) unless the user asks for more detail.`;

const COACH_FALLBACK = "AI coaching is currently unavailable. Please check back shortly.";

export async function streamCoachResponse(
  history: CoachMessage[],
  userId: number | null,
  callbacks: CoachStreamCallbacks
): Promise<void> {
  if (!isAIAvailable()) {
    callbacks.onChunk(COACH_FALLBACK);
    callbacks.onDone(COACH_FALLBACK);
    await logAiInteraction({
      userId,
      promptTemplateName: PROMPT_TEMPLATES.COACH_SYSTEM.name,
      promptTemplateVersion: PROMPT_TEMPLATES.COACH_SYSTEM.version,
      model: "gpt-4o",
      success: false,
      errorMessage: "AI unavailable",
    });
    return;
  }

  const start = Date.now();
  let success = false;
  let errorMessage: string | undefined;
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;

  try {
    const systemMessage: CoachMessage = {
      role: "system",
      content: COACH_SYSTEM_PROMPT,
    };

    const stream = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [systemMessage, ...history],
      stream: true,
      max_completion_tokens: 1000,
    });

    let assistantContent = "";

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        assistantContent += delta;
        callbacks.onChunk(delta);
      }
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens;
        outputTokens = chunk.usage.completion_tokens;
      }
    }

    success = true;
    callbacks.onDone(assistantContent);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "AI request failed";
    callbacks.onError(errorMessage);
  } finally {
    await logAiInteraction({
      userId,
      promptTemplateName: PROMPT_TEMPLATES.COACH_SYSTEM.name,
      promptTemplateVersion: PROMPT_TEMPLATES.COACH_SYSTEM.version,
      model: "gpt-4o",
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - start,
      success,
      errorMessage,
    });
  }
}
