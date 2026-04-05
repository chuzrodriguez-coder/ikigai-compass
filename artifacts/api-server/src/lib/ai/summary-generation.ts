import { getOpenAIClient, isAIAvailable } from "../../openaiClient";
import { logAiInteraction, PROMPT_TEMPLATES } from "./logger";
import { z } from "zod";

const PeriodSummarySchema = z.object({
  headline: z.string().describe("A 1-sentence summary of the period"),
  wins: z.array(z.string()).describe("Key accomplishments"),
  insights: z.array(z.string()).describe("Meaningful insights or learnings"),
  nextFocus: z.array(z.string()).describe("Recommended focus areas for the next period"),
  momentumScore: z.number().min(0).max(100).describe("Overall momentum score 0-100"),
});

export type PeriodSummary = z.infer<typeof PeriodSummarySchema>;

interface SummaryContext {
  completedActions: number;
  totalActions: number;
  completedMilestones: number;
  totalMilestones: number;
  checkinsCount: number;
  recentReflections: string[];
  planTitle: string;
  periodDays: number;
}

function buildFallbackSummary(ctx: SummaryContext): PeriodSummary {
  const completionRate = ctx.totalActions > 0
    ? Math.round((ctx.completedActions / ctx.totalActions) * 100)
    : 0;

  return {
    headline: `You completed ${ctx.completedActions} of ${ctx.totalActions} actions in the last ${ctx.periodDays} days.`,
    wins: ctx.completedActions > 0
      ? [`Completed ${ctx.completedActions} action${ctx.completedActions !== 1 ? "s" : ""}`]
      : ["Showed up and checked in"],
    insights: [
      "Consistent small actions compound over time",
      "Tracking your progress helps build awareness",
    ],
    nextFocus: [
      "Focus on completing your highest-priority action",
      "Schedule a reflection to review what's working",
    ],
    momentumScore: completionRate,
  };
}

function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  return text.trim();
}

export async function generatePeriodSummary(
  userId: number | null,
  ctx: SummaryContext
): Promise<{ summary: PeriodSummary; isAiGenerated: boolean }> {
  const start = Date.now();
  let success = false;
  let errorMessage: string | undefined;

  try {
    if (!isAIAvailable()) {
      return { summary: buildFallbackSummary(ctx), isAiGenerated: false };
    }

    const prompt = `You are an Ikigai coach generating a growth period summary.

Plan: "${ctx.planTitle}"
Period: last ${ctx.periodDays} days
Actions completed: ${ctx.completedActions} / ${ctx.totalActions}
Milestones completed: ${ctx.completedMilestones} / ${ctx.totalMilestones}
Check-ins: ${ctx.checkinsCount}
${ctx.recentReflections.length > 0 ? `Recent reflections:\n${ctx.recentReflections.map(r => `- "${r}"`).join("\n")}` : ""}

Generate a JSON period summary with:
- headline: 1-sentence summary of the period (warm, motivating tone)
- wins: array of 2-3 specific accomplishments
- insights: array of 2-3 meaningful observations
- nextFocus: array of 2-3 recommended focus areas for the next period
- momentumScore: integer 0-100 representing overall momentum

Reply with JSON only, no markdown fences.`;

    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 600,
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const jsonStr = extractJson(raw);
    const parsed = PeriodSummarySchema.safeParse(JSON.parse(jsonStr));

    if (parsed.success) {
      success = true;
      return { summary: parsed.data, isAiGenerated: true };
    }

    success = false;
    errorMessage = "Schema validation failed";
    return { summary: buildFallbackSummary(ctx), isAiGenerated: false };
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "AI error";
    return { summary: buildFallbackSummary(ctx), isAiGenerated: false };
  } finally {
    await logAiInteraction({
      userId,
      promptTemplateName: PROMPT_TEMPLATES.SUMMARY_GENERATION.name,
      promptTemplateVersion: PROMPT_TEMPLATES.SUMMARY_GENERATION.version,
      model: "gpt-4o",
      latencyMs: Date.now() - start,
      success,
      errorMessage,
    });
  }
}
