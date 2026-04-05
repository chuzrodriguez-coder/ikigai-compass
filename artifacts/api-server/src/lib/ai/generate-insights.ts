import { getOpenAIClient } from "../../openaiClient";
import { logAiInteraction, PROMPT_TEMPLATES } from "./logger";
import { z } from "zod";

const InsightCardSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  category: z.enum(["insight", "question", "affirmation", "challenge", "observation"]),
  tags: z.array(z.string()).optional().default([]),
});

const InsightCardsResponseSchema = z.array(InsightCardSchema).min(1).max(10);

const SYSTEM_PROMPT = `You are an Ikigai coach who distills powerful insights from personal reflections. You create concise, meaningful insight cards that the person can return to for guidance and inspiration. Each card should feel personally relevant and specific — not generic advice.`;

function buildFallbackInsights(context: string) {
  return [
    {
      title: "Your Exploration Begins",
      content:
        "Every journey toward purpose starts with honest reflection. The fact that you are here, asking these questions, is itself meaningful.",
      category: "insight" as const,
      tags: ["purpose", "self-discovery"],
    },
  ];
}

export async function generateInsightCards(
  userId: number,
  context: string,
  count = 3
): Promise<{ title: string; content: string; category: string; tags: string[] }[]> {
  const userPrompt = `Based on this personal context, generate ${count} insight cards. Each should be a brief, powerful distillation — something the person can carry with them.

Context:
${context}

Return a JSON array only, no markdown:
[
  {
    "title": "Short memorable title (4-8 words)",
    "content": "The insight itself (2-4 sentences, specific to this person)",
    "category": "insight|question|affirmation|challenge|observation",
    "tags": ["relevant", "tags"]
  }
]`;

  const start = Date.now();
  let success = true;
  let errorMessage: string | undefined;

  try {
    const completion = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: 1200,
    });

    const raw = completion.choices[0]?.message?.content ?? "[]";
    let rawParsed: unknown;
    try {
      const trimmed = raw.trim();
      rawParsed = trimmed.startsWith("[") ? JSON.parse(trimmed) : JSON.parse((raw.match(/\[[\s\S]*\]/) ?? ["[]"])[0]);
    } catch {
      return buildFallbackInsights(context);
    }

    const validation = InsightCardsResponseSchema.safeParse(rawParsed);
    return validation.success ? validation.data : buildFallbackInsights(context);
  } catch (err) {
    success = false;
    errorMessage = err instanceof Error ? err.message : String(err);
    return buildFallbackInsights(context);
  } finally {
    await logAiInteraction({
      userId,
      promptTemplateName: PROMPT_TEMPLATES.INSIGHT_GENERATION.name,
      promptTemplateVersion: PROMPT_TEMPLATES.INSIGHT_GENERATION.version,
      model: "gpt-4o",
      inputTokens: undefined,
      outputTokens: undefined,
      latencyMs: Date.now() - start,
      success,
      errorMessage,
      metadata: { contextLength: context.length, requestedCount: count },
    });
  }
}
