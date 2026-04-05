import { db } from "@workspace/db";
import { aiInteractionLogsTable } from "@workspace/db/schema";

interface LogAiInteractionOptions {
  userId?: number | null;
  promptTemplateName?: string;
  promptTemplateVersion?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export async function logAiInteraction(opts: LogAiInteractionOptions): Promise<void> {
  try {
    await db.insert(aiInteractionLogsTable).values({
      userId: opts.userId ?? null,
      promptTemplateName: opts.promptTemplateName,
      promptTemplateVersion: opts.promptTemplateVersion,
      model: opts.model ?? "gpt-4o",
      inputTokens: opts.inputTokens,
      outputTokens: opts.outputTokens,
      latencyMs: opts.latencyMs,
      success: opts.success,
      errorMessage: opts.errorMessage,
      metadata: opts.metadata,
    });
  } catch {
    // Never throw from logging — swallow to avoid disrupting main flow
  }
}

export const PROMPT_TEMPLATES = {
  IKIGAI_SYNTHESIZE: { name: "ikigai_synthesize", version: "1.0.0" },
  COACH_SYSTEM: { name: "coach_system", version: "1.0.0" },
  THEME_EXTRACTION: { name: "theme_extraction", version: "1.0.0" },
  INSIGHT_GENERATION: { name: "insight_generation", version: "1.0.0" },
  OBSTACLE_HELP: { name: "obstacle_help", version: "1.0.0" },
  SUMMARY_GENERATION: { name: "summary_generation", version: "1.0.0" },
} as const;
