import { getOpenAIClient, isAIAvailable } from "../../openaiClient";
import { logAiInteraction, PROMPT_TEMPLATES } from "./logger";
import { z } from "zod";

const ObstacleHelpSchema = z.object({
  reframe: z.string().describe("A reframed perspective on the obstacle"),
  rootCauses: z.array(z.string()).describe("Likely root causes"),
  strategies: z.array(z.string()).describe("Actionable strategies to overcome it"),
  reflectionQuestions: z.array(z.string()).describe("Questions to spark self-discovery"),
});

export type ObstacleHelp = z.infer<typeof ObstacleHelpSchema>;

function buildFallbackHelp(title: string): ObstacleHelp {
  return {
    reframe: `This challenge with "${title}" may be pointing toward something important about your values or boundaries.`,
    rootCauses: [
      "Unclear priorities or conflicting commitments",
      "Skill or knowledge gap",
      "External circumstances outside your control",
    ],
    strategies: [
      "Break the obstacle into smaller, manageable parts",
      "Seek support from someone who has faced a similar challenge",
      "Experiment with a small action to test your assumptions",
    ],
    reflectionQuestions: [
      "What would you do if this obstacle didn't exist?",
      "What does this obstacle reveal about what matters most to you?",
      "What resources or strengths can you draw on?",
    ],
  };
}

function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  return text.trim();
}

export async function generateObstacleHelp(
  userId: number | null,
  obstacleTitle: string,
  obstacleDescription: string | null | undefined,
  context?: string
): Promise<{ help: ObstacleHelp; isAiGenerated: boolean }> {
  const start = Date.now();
  let success = false;
  let errorMessage: string | undefined;
  let isAiGenerated = false;

  try {
    if (!isAIAvailable()) {
      return { help: buildFallbackHelp(obstacleTitle), isAiGenerated: false };
    }

    const prompt = `You are an Ikigai coach helping someone work through an obstacle.

Obstacle: "${obstacleTitle}"
${obstacleDescription ? `Description: "${obstacleDescription}"` : ""}
${context ? `Additional context: "${context}"` : ""}

Provide a JSON object with these keys:
- reframe: a compassionate reframing of the obstacle (1-2 sentences)
- rootCauses: array of 2-3 likely root causes (strings)
- strategies: array of 3-4 concrete, actionable strategies (strings)
- reflectionQuestions: array of 3 open questions to promote self-discovery (strings)

Reply with JSON only, no markdown fences.`;

    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 800,
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const jsonStr = extractJson(raw);
    const parsed = ObstacleHelpSchema.safeParse(JSON.parse(jsonStr));

    if (parsed.success) {
      success = true;
      isAiGenerated = true;
      return { help: parsed.data, isAiGenerated: true };
    }

    success = false;
    errorMessage = "Schema validation failed";
    return { help: buildFallbackHelp(obstacleTitle), isAiGenerated: false };
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "AI error";
    return { help: buildFallbackHelp(obstacleTitle), isAiGenerated: false };
  } finally {
    await logAiInteraction({
      userId,
      promptTemplateName: PROMPT_TEMPLATES.OBSTACLE_HELP.name,
      promptTemplateVersion: PROMPT_TEMPLATES.OBSTACLE_HELP.version,
      model: "gpt-4o",
      latencyMs: Date.now() - start,
      success,
      errorMessage,
    });
  }
}
